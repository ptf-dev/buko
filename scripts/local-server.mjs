// Serves the production build like Vercel does (landing at /, app at /app,
// dashboard at /dashboard, API at /api) for local end-to-end testing.
// Usage: npm run build:web && DATABASE_URL=postgres://... node scripts/local-server.mjs [port]
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { handle } from '../api/index.js'

const ROOT = new URL('../dist/', import.meta.url).pathname
const PORT = Number(process.argv[2] || 4180)
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.apk': 'application/vnd.android.package-archive',
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
    })
    const response = await handle(request)
    const headers = Object.fromEntries(response.headers)
    res.writeHead(response.status, headers)
    res.end(Buffer.from(await response.arrayBuffer()))
    return
  }
  let p = url.pathname
  if (p === '/') p = '/index.html'
  else if (p === '/app' || p.startsWith('/app/')) p = '/app.html'
  else if (p === '/dashboard' || p.startsWith('/dashboard/')) p = '/dashboard.html'
  try {
    const file = join(ROOT, normalize(p))
    const data = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404).end('Not found')
  }
}).listen(PORT, () => console.log(`Buko running on http://localhost:${PORT}`))
