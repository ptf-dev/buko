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

/**
 * Numbered migrations, applied in order on top of SCHEMA (the original tables). Each runs once, inside the
 * setup transaction, and bumps schema_version. Older databases without schema_version re-run migration 1,
 * which is written to be safe on a database that already has it.
 * @type {((c: pg.PoolClient) => Promise<void>)[]}
 */
const MIGRATIONS = [
  // 1: customer accounts.
  async (c) => {
    await c.query(`
      alter table users drop constraint if exists users_role_check;
      alter table users add constraint users_role_check check (role in ('admin','partner','customer'));
      alter table orders add column if not exists user_id text references users(id) on delete set null;
      create index if not exists orders_user_idx on orders (user_id, created_at desc);
    `)
    // One-off rename: demo reviews seeded before the Buko → Ngopu rebrand.
    await c.query(`update stores set reviews = replace(reviews::text, 'Buko', 'Ngopu')::jsonb where reviews::text like '%Buko%'`)
  },
  // 2: money: ledger, payouts, billing details, complaints, settings, audit log. See docs/payments-and-reporting.md.
  async (c) => {
    await c.query(`
      alter table orders drop constraint if exists orders_status_check;
      alter table orders add constraint orders_status_check check (status in ('reserved','collected','cancelled','no_show'));
      alter table orders add column if not exists cancelled_by text check (cancelled_by in ('customer','store','admin'));
      alter table orders add column if not exists cancel_reason text;
      alter table orders add column if not exists closed_at timestamptz;
      create index if not exists orders_open_idx on orders (pickup_end) where status = 'reserved';
      update orders set cancelled_by = 'customer' where status = 'cancelled' and cancelled_by is null;
      update orders set closed_at = case status when 'collected' then coalesce(collected_at, pickup_end) when 'cancelled' then coalesce(cancelled_at, created_at) end
       where closed_at is null and status in ('collected','cancelled');

      create table platform_settings (
        key text primary key,
        value jsonb not null,
        updated_at timestamptz not null default now()
      );

      -- Per-store money terms and bank details. Null terms mean "use the platform default".
      create table store_billing (
        store_id text primary key references stores(id) on delete cascade,
        commission_bps integer check (commission_bps between 0 and 10000),
        commission_min integer check (commission_min >= 0),
        membership_fee integer check (membership_fee >= 0),
        membership_paid_until timestamptz,
        payouts_paused boolean not null default false,
        legal_name text,
        nipt text,
        iban text,
        bank_verified_at timestamptz,
        pending_legal_name text,
        pending_nipt text,
        pending_iban text,
        pending_submitted_at timestamptz,
        updated_at timestamptz not null default now()
      );
      insert into store_billing (store_id) select id from stores on conflict do nothing;

      create table payouts (
        id text primary key,
        run_id text not null,
        store_id text not null references stores(id),
        amount integer not null check (amount > 0),
        status text not null check (status in ('draft','approved','paid','cancelled')),
        legal_name text,
        iban text,
        bank_reference text,
        created_by text,
        approved_by text,
        approved_at timestamptz,
        paid_by text,
        paid_at timestamptz,
        cancelled_at timestamptz,
        created_at timestamptz not null default now()
      );
      create index payouts_store_idx on payouts (store_id, created_at desc);
      create index payouts_run_idx on payouts (run_id);

      create table complaints (
        id text primary key,
        order_id text not null unique references orders(id) on delete cascade,
        store_id text not null references stores(id),
        user_id text references users(id) on delete set null,
        reason text not null,
        details text,
        status text not null default 'open' check (status in ('open','refunded','rejected')),
        refund_amount integer,
        funded_by text check (funded_by in ('store','ngopu')),
        resolution_note text,
        resolved_by text,
        resolved_at timestamptz,
        created_at timestamptz not null default now()
      );
      create index complaints_status_idx on complaints (status, created_at desc);

      -- Append-only money ledger, in qindarka (1 L = 100). store_delta changes what Ngopu owes the store,
      -- platform_delta changes Ngopu's revenue, vat is the VAT included in platform_delta.
      create table ledger_entries (
        id bigserial primary key,
        store_id text not null references stores(id),
        order_id text references orders(id) on delete cascade,
        complaint_id text references complaints(id) on delete cascade,
        payout_id text references payouts(id),
        type text not null check (type in ('sale','cancellation','commission','commission_reversal','complaint_refund',
                                           'goodwill_refund','adjustment','membership_fee','payout')),
        store_delta integer not null default 0,
        platform_delta integer not null default 0,
        vat integer not null default 0,
        eligible_at timestamptz,
        note text,
        created_by text,
        is_demo boolean not null default false,
        created_at timestamptz not null default now()
      );
      create index ledger_store_idx on ledger_entries (store_id, created_at);
      create index ledger_payout_idx on ledger_entries (payout_id);
      create index ledger_created_idx on ledger_entries (created_at);
      create unique index ledger_order_once on ledger_entries (order_id, type) where order_id is not null;

      create table audit_log (
        id bigserial primary key,
        actor_id text,
        action text not null,
        target text,
        details jsonb,
        created_at timestamptz not null default now()
      );
      create index audit_created_idx on audit_log (created_at desc);
    `)
    // Money history for orders placed before the ledger existed, at the default terms (20%, at least 60 L a bag, 3-day hold).
    await c.query(`
      insert into ledger_entries (store_id, order_id, type, store_delta, eligible_at, is_demo, created_at)
      select store_id, id, 'sale', quantity * unit_price * 100,
             case status when 'cancelled' then closed_at when 'collected' then closed_at + interval '3 days' end, is_demo, created_at
        from orders;
      insert into ledger_entries (store_id, order_id, type, store_delta, eligible_at, is_demo, created_at)
      select store_id, id, 'cancellation', -quantity * unit_price * 100, closed_at, is_demo, closed_at
        from orders where status = 'cancelled';
      insert into ledger_entries (store_id, order_id, type, store_delta, platform_delta, eligible_at, is_demo, created_at)
      select store_id, id, 'commission', -x.c, x.c, closed_at + interval '3 days', is_demo, closed_at
        from orders, lateral (select least(quantity * unit_price * 100, greatest(round(quantity * unit_price * 100 * 0.2)::int, 6000 * quantity)) as c) x
       where status = 'collected';
    `)
  },
  // 3: real payments (provider-ready), cash at pickup, fee payment requests.
  async (c) => {
    await c.query(`
      alter table orders drop constraint if exists orders_status_check;
      alter table orders add constraint orders_status_check
        check (status in ('pending_payment','reserved','collected','cancelled','no_show','expired'));
      create index if not exists orders_pending_idx on orders (created_at) where status = 'pending_payment';

      alter table ledger_entries drop constraint if exists ledger_entries_type_check;
      alter table ledger_entries add constraint ledger_entries_type_check check (type in (
        'sale','cancellation','commission','commission_reversal','complaint_refund','goodwill_refund','adjustment',
        'membership_fee','payout','cash_sale','cash_collected','fee_payment','chargeback_hold','chargeback_release','processor_fee'));

      alter table store_billing add column if not exists accepts_cash boolean not null default false;

      -- One card payment per order, as the provider sees it. Amounts in qindarka.
      create table payments (
        id text primary key,
        order_id text not null unique references orders(id) on delete cascade,
        provider text not null,
        provider_ref text,
        amount integer not null,
        currency text not null default 'ALL',
        status text not null check (status in ('pending','succeeded','failed','expired')),
        refunded integer not null default 0,
        fee integer,
        failure text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create unique index payments_provider_ref on payments (provider, provider_ref) where provider_ref is not null;

      -- Refunds are queued in the same transaction as the ledger entry, then sent to the provider (retried on failure).
      create table refunds (
        id text primary key,
        payment_id text not null references payments(id) on delete cascade,
        order_id text not null references orders(id) on delete cascade,
        amount integer not null check (amount > 0),
        reason text not null,
        status text not null default 'queued' check (status in ('queued','sent','succeeded','failed')),
        provider_ref text,
        attempts integer not null default 0,
        last_error text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index refunds_status_idx on refunds (status);

      create table disputes (
        id text primary key,
        payment_id text not null references payments(id) on delete cascade,
        order_id text not null references orders(id) on delete cascade,
        store_id text not null references stores(id),
        amount integer not null,
        status text not null default 'open' check (status in ('open','won','lost')),
        provider_ref text,
        created_at timestamptz not null default now(),
        resolved_at timestamptz
      );

      -- Every provider event we processed, so a retried webhook is handled once.
      create table webhook_events (
        provider text not null,
        event_id text not null,
        type text not null,
        payload jsonb,
        received_at timestamptz not null default now(),
        primary key (provider, event_id)
      );

      -- "Please pay Ngopu" requests for fees a store owes (e.g. commission on cash orders). Paid by bank transfer.
      create sequence if not exists payment_request_seq;
      create table payment_requests (
        id text primary key,
        number text not null unique,
        store_id text not null references stores(id),
        amount integer not null check (amount > 0),
        status text not null default 'open' check (status in ('open','paid','settled','cancelled')),
        due_at timestamptz not null,
        paid_at timestamptz,
        reference text,
        note text,
        created_by text,
        created_at timestamptz not null default now()
      );
      create index payment_requests_store_idx on payment_requests (store_id, created_at desc);

      -- Historical orders were "paid" by the simulated provider.
      insert into payments (id, order_id, provider, provider_ref, amount, status, refunded, created_at)
      select 'pay_' || id, id, 'simulated', 'sim_' || id, quantity * unit_price * 100, 'succeeded',
             case when status = 'cancelled' then quantity * unit_price * 100 else 0 end, created_at
        from orders where payment_method <> 'cash';
    `)
  },
  // 4: store cover photos (small JPEG/WebP, resized in the browser before upload).
  async (c) => {
    await c.query(`
      create table store_photos (
        store_id text primary key references stores(id) on delete cascade,
        mime text not null check (mime in ('image/jpeg','image/webp','image/png')),
        data bytea not null,
        updated_at timestamptz not null default now()
      );
    `)
  },
  // 5: POK manual refunds, emails, push, security (rate limits, 2FA, permissions), monitoring.
  async (c) => {
    await c.query(`
      alter table refunds drop constraint if exists refunds_status_check;
      alter table refunds add constraint refunds_status_check check (status in ('queued','sent','succeeded','failed','manual'));

      alter table users add column email_verified_at timestamptz;
      alter table users add column language text check (language in ('sq','en'));
      alter table users add column totp_secret text;
      alter table users add column totp_enabled_at timestamptz;
      alter table users add column totp_recovery text[];
      alter table users add column permissions text[] not null default '{}';
      -- Existing admins keep the access they had.
      update users set permissions = array['finance'] where role = 'admin';

      create table user_tokens (
        token_hash text primary key,
        user_id text not null references users(id) on delete cascade,
        purpose text not null check (purpose in ('verify_email','reset_password','login_2fa')),
        expires_at timestamptz not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      );
      create index user_tokens_user_idx on user_tokens (user_id, purpose);

      create table email_log (
        id bigserial primary key,
        to_email text not null,
        kind text not null,
        subject text not null,
        status text not null check (status in ('sent','failed','not_configured')),
        provider_id text,
        error text,
        created_at timestamptz not null default now()
      );
      create index email_log_created_idx on email_log (created_at desc);

      create table push_subscriptions (
        id text primary key,
        user_id text not null references users(id) on delete cascade,
        kind text not null check (kind in ('web','fcm')),
        endpoint text not null unique,
        keys jsonb,
        created_at timestamptz not null default now(),
        last_used_at timestamptz
      );
      create index push_subscriptions_user_idx on push_subscriptions (user_id);
      alter table orders add column reminded_at timestamptz;
      alter table orders add column receipt_sent_at timestamptz;

      create table login_attempts (
        id bigserial primary key,
        key text not null,
        ok boolean not null,
        created_at timestamptz not null default now()
      );
      create index login_attempts_key_idx on login_attempts (key, created_at desc);

      create table error_events (
        fingerprint text primary key,
        source text not null check (source in ('app','dashboard','api')),
        message text not null,
        stack text,
        url text,
        user_agent text,
        release text,
        count integer not null default 1,
        first_seen timestamptz not null default now(),
        last_seen timestamptz not null default now(),
        resolved_at timestamptz
      );
      create index error_events_seen_idx on error_events (last_seen desc);

      create table analytics_events (
        id bigserial primary key,
        name text not null,
        path text,
        props jsonb,
        session text,
        platform text,
        created_at timestamptz not null default now()
      );
      create index analytics_events_created_idx on analytics_events (created_at desc);
      create index analytics_events_name_idx on analytics_events (name, created_at desc);
    `)
  },
  // 8: the fictional demo stores must never sell to real customers. Databases seeded before launch had them
  // active; suspend them (an admin can reactivate one on purpose, e.g. for a test with a tester account).
  async (c) => {
    await c.query(`update stores set status = 'suspended' where id = any($1::text[]) and status = 'active'`, [demoStoreIds()])
  },
]

/** IDs of the fictional seed stores (`seed-stores.json`). */
function demoStoreIds() {
  return /** @type {{ id: string }[]} */ (JSON.parse(readFileSync(new URL('./seed-stores.json', import.meta.url), 'utf8'))).map((s) => s.id)
}

/** @type {Promise<void> | null} */
let schemaReady = null

/** Creates tables on first use, runs pending migrations and seeds the demo stores into an empty database. */
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
        await client.query('create table if not exists schema_version (version integer not null)')
        const { rows: v } = await client.query('select coalesce(max(version), 0)::int as v from schema_version')
        for (let i = v[0].v; i < MIGRATIONS.length; i++) await MIGRATIONS[i](client)
        if (v[0].v < MIGRATIONS.length) {
          await client.query('delete from schema_version')
          await client.query('insert into schema_version (version) values ($1)', [MIGRATIONS.length])
        }
        const { rows } = await client.query('select count(*)::int as n from stores')
        if (rows[0].n === 0) await seedStores(client)
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
 * True when every migration has run and stores are seeded. This is the normal case, and it takes no locks,
 * so cold starts on a set-up database never queue behind each other.
 */
async function schemaIsCurrent() {
  const { rows } = await getPool().query(`select to_regclass('public.schema_version') is not null as ok`)
  if (!rows[0].ok) return false
  const { rows: v } = await getPool().query(
    'select coalesce(max(version), 0)::int as v, exists (select 1 from stores) as seeded from schema_version',
  )
  return v[0].v >= MIGRATIONS.length && v[0].seeded
}

/**
 * Fills an empty database with the fictional demo stores so there is something to look at. They are active in
 * development and preview databases only: in production they are suspended, so real customers never pay for a
 * bag at a store that doesn't exist.
 * @param {pg.PoolClient} client
 */
async function seedStores(client) {
  const seed = JSON.parse(readFileSync(new URL('./seed-stores.json', import.meta.url), 'utf8'))
  const status = process.env.VERCEL_ENV === 'production' ? 'suspended' : 'active'
  for (const s of seed) {
    await client.query(
      `insert into stores (id, name, branch, category, address, lat, lng, rating, rating_count, highlights, reviews, status, approved_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())`,
      [s.id, s.name, s.branch ?? null, s.category, s.address, s.lat, s.lng, s.rating, s.ratingCount, JSON.stringify(s.highlights), JSON.stringify(s.reviews), status],
    )
    const b = s.bag
    await client.query(
      `insert into bags (store_id, id, title, description, price, original_price, quantity, pickup_day, pickup_start, pickup_end, diet, allergens_note, is_new)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [s.id, b.id, b.title, b.description, b.price, b.originalPrice, b.quantity, b.pickup.day, b.pickup.start, b.pickup.end, b.diet ?? null, b.allergensNote, !!b.isNew],
    )
    await client.query('insert into store_billing (store_id) values ($1) on conflict do nothing', [s.id])
  }
}
