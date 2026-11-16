import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project } from '../types'
import { hasAudio, play } from '../lib/audio'
import { projectDuration } from '../lib/project'

/**
 * The transport: where the playhead is and how fast it moves.
 *
 * `rate` is 0 when stopped, 1 for normal playback, and other values for J/L shuttling.
 * At normal speed the sound plays and the playhead follows the audio clock, so picture and sound stay in sync.
 * Shuttling is silent and follows the frame clock.
 */
export function usePlayback(project: Project, suspended: boolean) {
  const [time, setTime] = useState(0)
  const [rate, setRate] = useState(0)
  /** Same value as `time`, readable from callbacks without waiting for a render. */
  const timeRef = useRef(0)
  const duration = projectDuration(project)

  const seek = useCallback((t: number) => {
    const clamped = Math.max(0, t)
    timeRef.current = clamped
    setTime(clamped)
  }, [])

  useEffect(() => {
    if (rate === 0 || suspended) return
    let frame = 0
    let last = performance.now()
    const sound = rate === 1 && hasAudio(project) ? play(project, timeRef.current) : null
    const tick = (now: number) => {
      // rAF timestamps can be slightly older than performance.now(), so never step backwards by accident.
      const dt = Math.max(0, (now - last) / 1000)
      last = Math.max(last, now)
      let next = sound ? sound.time() : timeRef.current + dt * rate
      if (rate > 0 && next >= duration) {
        next = duration
        setRate(0)
      } else if (rate < 0 && next <= 0) {
        next = 0
        setRate(0)
      }
      seek(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      sound?.stop()
    }
  }, [rate, duration, seek, suspended, project])

  return { time, timeRef, rate, setRate, seek, duration }
}
