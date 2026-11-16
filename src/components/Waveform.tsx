import { useEffect, useRef } from 'react'
import type { AudioClip, Project } from '../types'
import { PEAKS_PER_SEC, peaksFor, wrap } from '../lib/audio'
import { mixGainAt } from '../lib/project'

const MAX_WIDTH = 8000

interface Props {
  project: Project
  clip: AudioClip
  /** Changes when a voice clip moves, so music redraws its ducking. */
  duckKey: string
  pxPerSec: number
  height: number
}

/** Draws what the clip will sound like: the source peaks, scaled by volume, fades and ducking. */
export function Waveform({ project, clip, duckKey, pxPerSec, height }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { source, offset, start, duration, gain, fadeIn, fadeOut } = clip
  const width = Math.max(1, Math.min(MAX_WIDTH, Math.round(duration * pxPerSec)))

  useEffect(() => {
    const canvas = ref.current
    const peaks = peaksFor(source)
    if (!canvas || !peaks) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    const mid = height / 2
    const secPerPx = duration / width
    const loops = source.kind === 'synth'
    const total = peaks.length / PEAKS_PER_SEC

    for (let x = 0; x < width; x++) {
      const local = x * secPerPx
      // One pixel can cover several peaks when zoomed out: keep the loudest.
      const from = offset + local
      const span = Math.max(1, Math.ceil(secPerPx * PEAKS_PER_SEC))
      let peak = 0
      for (let k = 0; k < span; k++) {
        const t = from + k / PEAKS_PER_SEC
        if (!loops && (t < 0 || t >= total)) continue
        const index = Math.floor((loops ? wrap(t, total) : t) * PEAKS_PER_SEC)
        if (peaks[index] > peak) peak = peaks[index]
      }
      const amp = Math.min(1, peak * mixGainAt(project, clip, local))
      const h = Math.max(1, amp * (height - 6))
      ctx.fillRect(x, mid - h / 2, 1, h)
    }
    // `clip` and `project` are covered by the fields below; listing them would redraw on every unrelated edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, offset, start, duration, gain, fadeIn, fadeOut, duckKey, width, height])

  return <canvas ref={ref} className="waveform" width={width} height={height} aria-hidden />
}
