import { useEffect, useRef } from 'react'
import { outputLevel } from '../lib/audio'

/** Output level while playing. Writes straight to the DOM so it never re-renders the editor. */
export function Meter({ active }: { active: boolean }) {
  const fill = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = fill.current
    if (!el) return
    if (!active) {
      el.style.transform = 'scaleX(0)'
      return
    }
    let frame = 0
    let shown = 0
    const tick = () => {
      // Rise at once, fall slowly, like a hardware peak meter.
      shown = Math.max(outputLevel(), shown * 0.9)
      el.style.transform = `scaleX(${shown.toFixed(3)})`
      el.dataset.hot = shown > 0.95 ? 'true' : 'false'
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active])

  return (
    <span className="meter" role="img" aria-label="Output level" title="Output level">
      <span className="meter-fill" ref={fill} />
    </span>
  )
}
