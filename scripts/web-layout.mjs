// Arranges the Vite build for the website: the landing page becomes the site
// root and the web app is served under /app (see vercel.json rewrites).
// The native apps skip this step and load dist/index.html (the app) directly.
import { renameSync } from 'node:fs'

renameSync('dist/index.html', 'dist/app.html')
renameSync('dist/landing.html', 'dist/index.html')
console.log('web layout: landing at /, app at /app')
