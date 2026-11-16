import { FPS } from './project'

/** 75.5 -> "01:15:15" (minutes:seconds:frames), or "1:15" for ruler labels. */
export function formatTime(t: number, withFrames = true): string {
  const safe = Math.max(0, t)
  const minutes = Math.floor(safe / 60)
  const seconds = Math.floor(safe % 60)
  if (!withFrames) return `${minutes}:${String(seconds).padStart(2, '0')}`
  const frames = Math.floor((safe * FPS) % FPS)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
}
