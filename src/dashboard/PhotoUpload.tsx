import { ImagePlus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { BagArt } from '../components/BagArt'
import { api } from '../lib/api'
import { useToast } from './data'
import type { ManagedStore } from './types'
import { Btn, Panel } from './ui'

/** Crops to 3:2 around the centre and scales to 1200×800 JPEG, so uploads stay small and cards look consistent. */
async function prepare(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const W = 1200
  const H = 800
  const scale = Math.max(W / bitmap.width, H / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser can’t process images.')
  ctx.drawImage(bitmap, (W - w) / 2, (H - h) / 2, w, h)
  let quality = 0.82
  let url = canvas.toDataURL('image/jpeg', quality)
  while (url.length > 1_800_000 && quality > 0.5) {
    quality -= 0.1
    url = canvas.toDataURL('image/jpeg', quality)
  }
  return url
}

/**
 * Store cover photo shown on bag cards and the store page. `path` is the API endpoint
 * (partner/photo, or admin/stores/:id/photo).
 */
export function PhotoUpload({ store, path, onSaved }: { store: ManagedStore; path: string; onSaved: (s: ManagedStore) => void }) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const image = await prepare(file)
      const r = await api<{ store: ManagedStore }>(path, { method: 'PUT', json: { image } })
      onSaved(r.store)
      toast('Photo updated')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not upload the photo.', 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  const remove = async () => {
    setBusy(true)
    try {
      const r = await api<{ store: ManagedStore }>(path, { method: 'DELETE' })
      onSaved(r.store)
      toast('Photo removed')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not remove the photo.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Cover photo" className="mb-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-center">
        <BagArt store={{ ...store, bag: { ...store.bag, quantity: 1 } }} className="aspect-[3/2] w-full rounded-2xl" />
        <div>
          <p className="text-[15px] text-ink">
            {store.photoUrl ? 'Customers see this photo on your Surprise Bag.' : 'Add a photo of your food or shop front. Cards with a real photo get more reservations.'}
          </p>
          <p className="mt-1 text-sm text-muted">Landscape works best. We crop it to 3:2 and make it small enough to load fast.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label="Choose a photo" />
            <Btn onClick={() => input.current?.click()} loading={busy}>
              <ImagePlus className="h-4 w-4" aria-hidden /> {store.photoUrl ? 'Replace photo' : 'Upload photo'}
            </Btn>
            {store.photoUrl && (
              <Btn variant="quiet-danger" onClick={remove} disabled={busy}>
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </Btn>
            )}
          </div>
        </div>
      </div>
    </Panel>
  )
}
