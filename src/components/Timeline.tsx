import { useMemo, useRef, useState } from 'react'
import type { Clip, ClipPatch, Project, TrackId } from '../types'
import { presetById } from '../lib/grades'
import { clipEnd, hasFiniteSource, isAudio, MIN_CLIP, neighbourBounds, previousAdjacent, projectDuration, round, sourceLength, updateClip } from '../lib/project'
import { SCENES } from '../lib/scenes'
import { formatTime } from '../lib/time'
import { Icon } from './Icon'
import { Meter } from './Meter'
import { Waveform } from './Waveform'

const LABEL_W = 72
const RULER_H = 28
const TRACK_H: Record<TrackId, number> = { video: 72, title: 44, voice: 48, audio: 56 }
const TRACKS: { id: TrackId; label: string }[] = [
  { id: 'title', label: 'T1' },
  { id: 'video', label: 'V1' },
  { id: 'voice', label: 'VO' },
  { id: 'audio', label: 'A1' },
]

interface Props {
  project: Project
  time: number
  pxPerSec: number
  selectedId: string | null
  snapping: boolean
  playing: boolean
  onSeek: (t: number) => void
  onSelect: (id: string | null) => void
  onBeginGesture: () => void
  onPreview: (p: Project) => void
  onEndGesture: () => void
  onZoom: (px: number) => void
  onToggleSnap: () => void
}

type DragMode = 'move' | 'trim-left' | 'trim-right'

interface DragState {
  mode: DragMode
  clip: Clip
  base: Project
  startX: number
  bounds: { min: number; max: number }
  snapPoints: number[]
  moved: boolean
}

function tickStep(px: number): number {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60]
  return steps.find((s) => s * px >= 80) ?? 60
}

function clipBackground(clip: Clip): string {
  if (clip.track === 'title') return 'linear-gradient(180deg,#7c5cff,#5a3fd6)'
  if (clip.track === 'audio') return 'linear-gradient(180deg,#1f8a70,#14604e)'
  if (clip.track === 'voice') return 'linear-gradient(180deg,#c2477f,#8a2c58)'
  if (clip.source.kind === 'scene') {
    const kind = clip.source.scene
    return SCENES.find((s) => s.kind === kind)?.swatch ?? '#333'
  }
  return clip.source.kind === 'image' ? 'linear-gradient(180deg,#3b8f6b,#22604a)' : 'linear-gradient(180deg,#3a6fb0,#24497a)'
}

export function Timeline(props: Props) {
  const { project, time, pxPerSec, selectedId, snapping } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [guide, setGuide] = useState<number | null>(null)

  const duration = projectDuration(project)
  const duckKey = project.clips
    .filter((c) => c.track === 'voice')
    .map((c) => `${c.start}:${c.duration}:${isAudio(c) && c.gain === 0}`)
    .join('|')
  const width = LABEL_W + (Math.max(duration, 20) + 12) * pxPerSec
  const step = tickStep(pxPerSec)

  const ticks = useMemo(() => {
    const out: { t: number; major: boolean }[] = []
    const minor = step / 5
    const end = Math.max(duration, 20) + 12
    for (let i = 0; i * minor <= end; i++) out.push({ t: round(i * minor), major: i % 5 === 0 })
    return out
  }, [step, duration])

  function timeFromClientX(clientX: number): number {
    const el = scrollRef.current!
    const rect = el.getBoundingClientRect()
    return Math.max(0, (clientX - rect.left + el.scrollLeft - LABEL_W) / pxPerSec)
  }

  function startScrub(e: React.PointerEvent) {
    e.preventDefault()
    props.onSeek(timeFromClientX(e.clientX))
    const move = (ev: PointerEvent) => props.onSeek(timeFromClientX(ev.clientX))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function snap(value: number, points: number[]): { value: number; hit: number | null } {
    if (!snapping) return { value, hit: null }
    const threshold = 8 / pxPerSec
    let best: number | null = null
    for (const p of points) {
      if (Math.abs(p - value) <= threshold && (best === null || Math.abs(p - value) < Math.abs(best - value))) best = p
    }
    return best === null ? { value, hit: null } : { value: best, hit: best }
  }

  function onClipPointerDown(e: React.PointerEvent, clip: Clip, mode: DragMode) {
    e.stopPropagation()
    e.preventDefault()
    props.onSelect(clip.id)
    const snapPoints = [time, 0]
    for (const c of project.clips) {
      if (c.id === clip.id) continue
      snapPoints.push(c.start, clipEnd(c))
    }
    dragRef.current = {
      mode,
      clip,
      base: project,
      startX: e.clientX,
      bounds: neighbourBounds(project, clip),
      snapPoints,
      moved: false,
    }
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
  }

  function onDragMove(e: PointerEvent) {
    const d = dragRef.current
    if (!d) return
    const dt = (e.clientX - d.startX) / pxPerSec
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < 3) return
      d.moved = true
      props.onBeginGesture()
    }
    const c = d.clip
    const end = clipEnd(c)
    let hit: number | null = null
    let patch: ClipPatch

    if (d.mode === 'move') {
      let start = c.start + dt
      const s1 = snap(start, d.snapPoints)
      const s2 = snap(start + c.duration, d.snapPoints)
      if (s1.hit !== null && (s2.hit === null || Math.abs(s1.value - start) <= Math.abs(s2.value - (start + c.duration)))) {
        start = s1.value
        hit = s1.hit
      } else if (s2.hit !== null) {
        start = s2.value - c.duration
        hit = s2.hit
      }
      start = Math.min(Math.max(start, d.bounds.min), d.bounds.max - c.duration)
      patch = { start: round(start) }
    } else if (d.mode === 'trim-left') {
      const minOffset = hasFiniteSource(c) ? 0 : -Infinity
      const offset = c.track === 'title' ? 0 : c.offset
      const s = snap(c.start + dt, d.snapPoints)
      hit = s.hit
      let start = Math.max(s.value, d.bounds.min, c.start - (offset - minOffset))
      start = Math.min(start, end - MIN_CLIP)
      const delta = start - c.start
      patch = { start: round(start), duration: round(end - start) }
      if (c.track !== 'title') patch = { ...patch, offset: round(c.offset + delta) }
    } else {
      const s = snap(end + dt, d.snapPoints)
      hit = s.hit
      const offset = c.track === 'title' ? 0 : c.offset
      let newEnd = Math.min(s.value, d.bounds.max, c.start + sourceLength(c) - offset)
      newEnd = Math.max(newEnd, c.start + MIN_CLIP)
      patch = { duration: round(newEnd - c.start) }
    }
    setGuide(hit)
    props.onPreview(updateClip(d.base, c.id, patch))
  }

  function onDragEnd() {
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)
    const d = dragRef.current
    dragRef.current = null
    setGuide(null)
    if (d?.moved) props.onEndGesture()
  }

  function onWheel(e: React.WheelEvent) {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    props.onZoom(pxPerSec * (e.deltaY < 0 ? 1.15 : 1 / 1.15))
  }

  const tracksHeight = TRACKS.reduce((s, t) => s + TRACK_H[t.id], 0)

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline-bar">
        <span className="timecode" aria-live="off">
          {formatTime(time)} <span className="muted">/ {formatTime(duration)}</span>
        </span>
        <div className="timeline-tools">
          <Meter active={props.playing} />
          <button className={`chip ${snapping ? 'on' : ''}`} onClick={props.onToggleSnap} aria-pressed={snapping} title="Snap clips to edit points and the playhead">
            <Icon name="magnet" size={14} /> Snapping {snapping ? 'on' : 'off'}
          </button>
          <label className="zoom">
            <span>Zoom</span>
            <input
              type="range"
              min={15}
              max={240}
              value={pxPerSec}
              onChange={(e) => props.onZoom(Number(e.target.value))}
              aria-label="Timeline zoom"
            />
          </label>
        </div>
      </div>
      <div className="timeline-scroll" ref={scrollRef} onWheel={onWheel}>
        <div className="timeline-inner" style={{ width }}>
          <div className="ruler" style={{ height: RULER_H }} onPointerDown={startScrub}>
            <div className="track-label ruler-corner" />
            {ticks.map((tick) => (
              <div
                key={tick.t}
                className={`tick ${tick.major ? 'major' : ''}`}
                style={{ left: LABEL_W + tick.t * pxPerSec }}
              >
                {tick.major && <span>{formatTime(tick.t, false)}</span>}
              </div>
            ))}
          </div>

          {TRACKS.map((track) => (
            <div key={track.id} className={`track track-${track.id}`} style={{ height: TRACK_H[track.id] }}>
              <div className="track-label">{track.label}</div>
              <div
                className="track-lane"
                onPointerDown={(e) => {
                  props.onSelect(null)
                  startScrub(e)
                }}
              >
                {project.clips
                  .filter((c) => c.track === track.id)
                  .map((clip) => {
                    const selected = clip.id === selectedId
                    const left = clip.start * pxPerSec
                    const w = Math.max(clip.duration * pxPerSec, 6)
                    const hasTransition =
                      clip.track === 'video' && clip.transitionIn.kind !== 'none' && !!previousAdjacent(project, clip)
                    const preset = clip.track === 'video' ? presetById(clip.presetId) : undefined
                    return (
                      <div
                        key={clip.id}
                        role="button"
                        tabIndex={0}
                        aria-label={clip.track === 'title' ? `Title ${clip.text}` : `${isAudio(clip) ? 'Audio' : 'Clip'} ${clip.name}`}
                        aria-pressed={selected}
                        className={`clip clip-${clip.track} ${isAudio(clip) ? 'clip-sound' : ''} ${selected ? 'selected' : ''}`}
                        style={{ left, width: w, background: clipBackground(clip) }}
                        onPointerDown={(e) => onClipPointerDown(e, clip, 'move')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') props.onSelect(clip.id)
                        }}
                      >
                        <div className="handle left" onPointerDown={(e) => onClipPointerDown(e, clip, 'trim-left')} />
                        {isAudio(clip) && <Waveform project={project} clip={clip} duckKey={duckKey} pxPerSec={pxPerSec} height={TRACK_H[clip.track] - 12} />}
                        <div className="clip-body">
                          <span className="clip-name">{clip.track === 'title' ? clip.text : clip.name}</span>
                          {clip.track === 'video' && (
                            <span className="clip-meta">
                              {preset && preset.id !== 'original' ? preset.name : clip.presetId === null ? 'Custom look' : ''}
                            </span>
                          )}
                        </div>
                        {hasTransition && clip.track === 'video' && (
                          <div
                            className="transition-badge"
                            style={{
                              width: Math.max(10, clip.transitionIn.duration * pxPerSec),
                              left: -Math.max(10, clip.transitionIn.duration * pxPerSec) / 2,
                            }}
                            title={`${clip.transitionIn.kind} transition`}
                          />
                        )}
                        <div className="handle right" onPointerDown={(e) => onClipPointerDown(e, clip, 'trim-right')} />
                      </div>
                    )
                  })}
              </div>
            </div>
          ))}

          {guide !== null && (
            <div className="snap-guide" style={{ left: LABEL_W + guide * pxPerSec, top: RULER_H, height: tracksHeight }} />
          )}
          <div className="playhead" style={{ left: LABEL_W + time * pxPerSec, height: RULER_H + tracksHeight }}>
            <div className="playhead-head" onPointerDown={startScrub} />
          </div>
        </div>
      </div>
    </section>
  )
}
