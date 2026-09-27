// @ts-check
import pg from 'pg'
import { readFileSync } from 'node:fs'

/** Neon's Vercel integration sets DATABASE_URL (and POSTGRES_URL for older setups). */
export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
}

/** @type {pg.Pool | null} */
let pool = null

export function getPool() {
  if (!pool) {
    const url = databaseUrl()
    if (!url) throw new HttpError(503, 'Database is not configured yet.')
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url)
    pool = new pg.Pool({
      connectionString: url,
      max: 3,
      ssl: local ? false : { rejectUnauthorized: false },
    })
  }
  return pool
}

/**
 * @param {string} text
 * @param {unknown[]} [params]
 */
export async function query(text, params = []) {
  await ensureSchema()
  return getPool().query(text, params)
}

/**
 * Runs `fn` inside a transaction.
 * @template T
 * @param {(client: pg.PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function tx(fn) {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (err) {
    await client.query('rollback').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export class HttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const SCHEMA = `
create table if not exists stores (
  id text primary key,
  name text not null,
  branch text,
  category text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  rating double precision not null default 0,
  rating_count integer not null default 0,
  highlights jsonb not null default '[]',
  reviews jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending','active','suspended','rejected')),
  contact_name text,
  contact_email text,
  contact_phone text,
  note text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists bags (
  store_id text primary key references stores(id) on delete cascade,
  id text not null unique,
  title text not null,
  description text not null default '',
  price integer not null check (price >= 0),
  original_price integer not null check (original_price >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  pickup_day text not null default 'today' check (pickup_day in ('today','tomorrow')),
  pickup_start integer not null,
  pickup_end integer not null,
  diet text check (diet in ('vegetarian','vegan')),
  allergens_note text not null default '',
  is_new boolean not null default false,
  paused boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  role text not null check (role in ('admin','partner','customer')),
  store_id text references stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  store_id text not null references stores(id) on delete cascade,
  bag_id text not null,
  device_id text not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null,
  unit_original_price integer not null,
  pickup_start timestamptz not null,
  pickup_end timestamptz not null,
  pickup_code text not null,
  status text not null check (status in ('reserved','collected','cancelled')),
  payment_method text not null,
  rating integer,
  rating_tags jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  collected_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists orders_store_idx on orders (store_id, created_at desc);
create index if not exists orders_device_idx on orders (device_id, created_at desc);
create index if not exists sessions_user_idx on sessions (user_id);
`

/** @type {Promise<void> | null} */
let schemaReady = null

/** Creates tables on first use and seeds the demo stores into an empty database. */
export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      if (await schemaIsCurrent()) return
      const client = await getPool().connect()
      try {
        // One transaction with a transaction-scoped lock: safe behind Neon's pooler, released even if we crash,
        // and the timeouts stop a cold start from hanging on a lock until the function is killed.
        await client.query('begin')
        await client.query(`set local statement_timeout = '25s'`)
        await client.query('select pg_advisory_xact_lock(4242)')
        // Only the DDL below gets a short lock wait, not the queue for the setup lock above.
        await client.query(`set local lock_timeout = '5s'`)
        await client.query(SCHEMA)
        const { rows } = await client.query('select count(*)::int as n from stores')
        if (rows[0].n === 0) await seedStores(client)
        // Migration for databases created before customer accounts existed. Only runs when needed,
        // because these statements lock the users and orders tables.
        const { rows: m } = await client.query(`
          select
            exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'user_id') as has_user_id,
            coalesce((select pg_get_constraintdef(oid) like '%customer%' from pg_constraint where conname = 'users_role_check'), false) as has_customer_role
        `)
        if (!m[0].has_customer_role)
          await client.query(`
            alter table users drop constraint if exists users_role_check;
            alter table users add constraint users_role_check check (role in ('admin','partner','customer'));
          `)
        if (!m[0].has_user_id)
          await client.query(`
            alter table orders add column if not exists user_id text references users(id) on delete set null;
            create index if not exists orders_user_idx on orders (user_id, created_at desc);
          `)
        // One-off rename: demo reviews seeded before the Buko → Ngopu rebrand.
        await client.query(`update stores set reviews = replace(reviews::text, 'Buko', 'Ngopu')::jsonb where reviews::text like '%Buko%'`)
        await client.query('commit')
      } catch (err) {
        await client.query('rollback').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    })().catch((err) => {
      schemaReady = null
      throw err
    })
  }
  return schemaReady
}

/**
 * True when every table, index and migration already exists and stores are seeded. This is the
 * normal case, and it takes no locks, so cold starts on a set-up database never queue behind each other.
 */
async function schemaIsCurrent() {
  const objects = ['stores', 'bags', 'users', 'sessions', 'orders', 'orders_store_idx', 'orders_device_idx', 'sessions_user_idx', 'orders_user_idx']
  const { rows } = await getPool().query(
    `select bool_and(to_regclass('public.' || name) is not null) as tables,
       coalesce((select pg_get_constraintdef(oid) like '%customer%' from pg_constraint where conname = 'users_role_check'), false) as roles
     from unnest($1::text[]) as name`,
    [objects],
  )
  if (!rows[0].tables || !rows[0].roles) return false
  const { rows: s } = await getPool().query('select exists (select 1 from stores) as seeded')
  return s[0].seeded
}

/** @param {pg.PoolClient} client */
async function seedStores(client) {
  const seed = JSON.parse(readFileSync(new URL('./seed-stores.json', import.meta.url), 'utf8'))
  for (const s of seed) {
    await client.query(
      `insert into stores (id, name, branch, category, address, lat, lng, rating, rating_count, highlights, reviews, status, approved_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',now())`,
      [s.id, s.name, s.branch ?? null, s.category, s.address, s.lat, s.lng, s.rating, s.ratingCount, JSON.stringify(s.highlights), JSON.stringify(s.reviews)],
    )
    const b = s.bag
    await client.query(
      `insert into bags (store_id, id, title, description, price, original_price, quantity, pickup_day, pickup_start, pickup_end, diet, allergens_note, is_new)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [s.id, b.id, b.title, b.description, b.price, b.originalPrice, b.quantity, b.pickup.day, b.pickup.start, b.pickup.end, b.diet ?? null, b.allergensNote, !!b.isNew],
    )
  }
}
