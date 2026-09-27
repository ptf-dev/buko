// Strips website-only files from the Vite build before it is copied into the
// native apps, so the APK/IPA don't bundle the landing page or the APK itself.
import { rmSync } from 'node:fs'

for (const path of ['dist/landing.html', 'dist/landing', 'dist/downloads']) rmSync(path, { recursive: true, force: true })
console.log('native layout: removed landing page and downloads from dist')
