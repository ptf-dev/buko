// Exports the demo partner stores from src/data/stores.ts to JSON so the API
// (plain JavaScript) can seed an empty database with the same data.
// Run with Node 22.18+ (built-in TypeScript type stripping): node scripts/export-seed.mjs
import { writeFileSync } from 'node:fs'
import { SEED_STORES } from '../src/data/stores.ts'

writeFileSync('api/_lib/seed-stores.json', JSON.stringify(SEED_STORES, null, 2) + '\n')
console.log(`exported ${SEED_STORES.length} stores`)
