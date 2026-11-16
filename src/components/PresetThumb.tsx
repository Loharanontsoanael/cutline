import { useEffect, useRef } from 'react'
import type { Grade, Project } from '../types'
import { renderFrame } from '../lib/renderer'

interface Props {
  project: Project
  clipId: string
  time: number
  grade: Grade
  active: boolean
  name: string
  description: string
  onApply: () => void
}

/** Shows the selected clip's current frame with a preset applied, so people pick a look by seeing it. */
export function PresetThumb({ project, clipId, time, grade, active, name, description, onApply }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const ctx = ref.current?.getContext('2d')
      if (ctx) renderFrame(ctx, project, time, { onlyClipId: clipId, gradeOverride: grade, skipTitles: true })
    }, 60)
    return () => window.clearTimeout(handle)
  }, [project, clipId, time, grade])

  return (
    <button className={`preset ${active ? 'active' : ''}`} onClick={onApply} title={description} aria-pressed={active}>
      <canvas ref={ref} width={192} height={108} />
      <span>{name}</span>
    </button>
  )
}
