import { ChevronsRight } from 'lucide-react'
import { useRef, useState } from 'react'

/**
 * Slide-to-confirm control shown at pickup. The customer swipes in front of
 * staff so the store can see the order being validated.
 */
export function SwipeToConfirm({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  // Travel distance of the knob, measured when a drag starts.
  const [maxX, setMaxX] = useState(0)
  const startX = useRef(0)
  const KNOB = 52

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setMaxX(trackRef.current ? trackRef.current.clientWidth - KNOB - 8 : 0)
    startX.current = e.clientX - x
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    setX(Math.max(0, Math.min(maxX, e.clientX - startX.current)))
  }
  const onPointerUp = () => {
    setDragging(false)
    if (maxX > 0 && x >= maxX * 0.9) {
      setX(maxX)
      onConfirm()
    } else {
      setX(0)
    }
  }

  const progress = maxX ? x / maxX : 0

  return (
    <div
      ref={trackRef}
      className="relative h-[60px] w-full select-none overflow-hidden rounded-full bg-brand p-1"
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onConfirm()
      }}
    >
      <div className="absolute inset-y-1 left-1 rounded-full bg-mint/40" style={{ width: x + KNOB }} />
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-10 font-semibold text-white"
        style={{ opacity: 1 - progress }}
      >
        {label}
      </span>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative flex h-[52px] w-[52px] cursor-grab touch-none items-center justify-center rounded-full bg-white text-brand shadow ${
          dragging ? '' : 'transition-transform'
        }`}
        style={{ transform: `translateX(${x}px)` }}
      >
        <ChevronsRight className="h-6 w-6" />
      </div>
    </div>
  )
}
