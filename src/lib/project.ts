import type { AudioClip, AudioSource, Clip, ClipPatch, MediaSource, Project, SceneKind, SynthKind, TitleClip, TrackId, VideoClip } from '../types'
import { GRADE_PRESETS, NEUTRAL_GRADE } from './grades'
import { sceneName } from './scenes'

export const FPS = 30
export const MIN_CLIP = 0.2

let counter = 0
export function uid(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`
}

export function clipEnd(c: Clip): number {
  return c.start + c.duration
}

export function projectDuration(p: Project): number {
  return p.clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0)
}

export function sortedTrack(p: Project, track: TrackId): Clip[] {
  return p.clips.filter((c) => c.track === track).sort((a, b) => a.start - b.start)
}

export function videoClips(p: Project): VideoClip[] {
  return sortedTrack(p, 'video') as VideoClip[]
}

export function titleClips(p: Project): TitleClip[] {
  return sortedTrack(p, 'title') as TitleClip[]
}

export function isAudio(c: Clip): c is AudioClip {
  return c.track === 'audio' || c.track === 'voice'
}

/** Every clip that makes sound: music and voice. */
export function audioClips(p: Project): AudioClip[] {
  return p.clips.filter(isAudio)
}

/** Longest stretch a clip can show from its source, or Infinity for generated content. */
export function sourceLength(c: Clip): number {
  if (c.track === 'video' && c.source.kind === 'video') return c.source.length
  if (isAudio(c) && c.source.kind === 'file') return c.source.length
  return Infinity
}

/** True when the clip plays a recorded file, so it cannot be trimmed past the start of that file. */
export function hasFiniteSource(c: Clip): boolean {
  return sourceLength(c) !== Infinity
}

/** Fades never overlap: each one is capped at half the clip. */
export function effectiveFades(c: AudioClip): { fadeIn: number; fadeOut: number } {
  const half = c.duration / 2
  return { fadeIn: Math.min(c.fadeIn, half), fadeOut: Math.min(c.fadeOut, half) }
}

/** Gain of an audio clip `local` seconds after its start, fades included. */
export function envelopeAt(c: AudioClip, local: number): number {
  if (local < 0 || local > c.duration) return 0
  const { fadeIn, fadeOut } = effectiveFades(c)
  let k = 1
  if (fadeIn > 0) k = Math.min(k, local / fadeIn)
  if (fadeOut > 0) k = Math.min(k, (c.duration - local) / fadeOut)
  return c.gain * Math.max(0, k)
}

/** How far music drops under a voice clip, and how long it takes to get there. */
export const DUCK_GAIN = 0.3
export const DUCK_RAMP = 0.3

/** Music gain factor at time `t`: 1 when nobody speaks, DUCK_GAIN under a voice clip, a ramp around its edges. */
export function duckAt(p: Project, t: number): number {
  let depth = 0
  for (const c of p.clips) {
    if (c.track !== 'voice' || c.gain === 0) continue
    const rampIn = (t - (c.start - DUCK_RAMP)) / DUCK_RAMP
    const rampOut = (clipEnd(c) + DUCK_RAMP - t) / DUCK_RAMP
    depth = Math.max(depth, Math.min(1, rampIn, rampOut))
  }
  return 1 - (1 - DUCK_GAIN) * Math.max(0, depth)
}

/** What a clip contributes to the mix `local` seconds after its start: its own envelope, ducked if it is music. */
export function mixGainAt(p: Project, c: AudioClip, local: number): number {
  return envelopeAt(c, local) * (c.track === 'audio' ? duckAt(p, c.start + local) : 1)
}

/** The clip that ends exactly where `clip` starts on the same track, if any. */
export function previousAdjacent(p: Project, clip: Clip): Clip | undefined {
  return sortedTrack(p, clip.track).find((c) => c.id !== clip.id && Math.abs(clipEnd(c) - clip.start) < 1e-3)
}

/** Room a clip has on its track, between its neighbours. */
export function neighbourBounds(p: Project, clip: Clip): { min: number; max: number } {
  const others = sortedTrack(p, clip.track).filter((c) => c.id !== clip.id)
  let min = 0
  let max = Infinity
  for (const o of others) {
    if (clipEnd(o) <= clip.start + 1e-6) min = Math.max(min, clipEnd(o))
    if (o.start >= clipEnd(clip) - 1e-6) max = Math.min(max, o.start)
  }
  return { min, max }
}

export function editPoints(p: Project): number[] {
  const set = new Set<number>([0])
  for (const c of p.clips) {
    set.add(round(c.start))
    set.add(round(clipEnd(c)))
  }
  return [...set].sort((a, b) => a - b)
}

export function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function snapToFrame(t: number): number {
  return Math.round(t * FPS) / FPS
}

export function makeSceneClip(scene: SceneKind, start: number, duration = 4): VideoClip {
  return {
    id: uid('clip'),
    track: 'video',
    name: sceneName(scene),
    source: { kind: 'scene', scene },
    start,
    duration,
    offset: 0,
    grade: { ...NEUTRAL_GRADE },
    presetId: 'original',
    transitionIn: { kind: 'none', duration: 0.8 },
  }
}

export function makeMediaClip(source: MediaSource, name: string, start: number, duration: number): VideoClip {
  return {
    id: uid('clip'),
    track: 'video',
    name,
    source,
    start,
    duration,
    offset: 0,
    grade: { ...NEUTRAL_GRADE },
    presetId: 'original',
    transitionIn: { kind: 'none', duration: 0.8 },
  }
}

const SYNTH_NAMES: Record<SynthKind, string> = { pulse: 'Pulse', ambient: 'Ambient', keys: 'Keys' }

export function synthName(kind: SynthKind): string {
  return SYNTH_NAMES[kind]
}

export function makeAudioClip(source: AudioSource, name: string, start: number, duration: number, track: AudioClip['track'] = 'audio'): AudioClip {
  return { id: uid(track), track, name, source, start, duration, offset: 0, gain: track === 'voice' ? 1 : 0.8, fadeIn: 0, fadeOut: 0 }
}

export function makeTitle(start: number, text = 'Your title', duration = 3): TitleClip {
  return { id: uid('title'), track: 'title', text, start, duration, size: 64, position: 'center', animation: 'rise' }
}

/** First free spot on a track at or after `from` that fits `duration`. */
export function freeSlot(p: Project, track: TrackId, from: number, duration: number): number {
  let start = from
  for (const c of sortedTrack(p, track)) {
    if (clipEnd(c) <= start) continue
    if (c.start >= start + duration) break
    start = clipEnd(c)
  }
  return round(start)
}

export function demoProject(): Project {
  const cinematic = GRADE_PRESETS.find((g) => g.id === 'cinematic')!
  const a = makeSceneClip('sunset', 0, 5)
  a.grade = { ...cinematic.grade }
  a.presetId = cinematic.id
  const b = makeSceneClip('ocean', 5, 4)
  b.transitionIn = { kind: 'crossfade', duration: 1 }
  const c = makeSceneClip('city', 9, 4.5)
  c.transitionIn = { kind: 'dip', duration: 0.8 }
  const d = makeSceneClip('aurora', 13.5, 4.5)
  d.transitionIn = { kind: 'slide', duration: 0.8 }
  const title = makeTitle(0.5, 'Cutline', 3.5)
  title.size = 96
  const sub = makeTitle(9.5, 'Grade, cut and ship in the browser', 3.2)
  sub.size = 48
  sub.position = 'bottom'
  sub.animation = 'typewriter'
  const music = makeAudioClip({ kind: 'synth', synth: 'pulse' }, synthName('pulse'), 0, 18)
  music.fadeIn = 1
  music.fadeOut = 2.5
  return { clips: [a, b, c, d, title, sub, music] }
}

// ---------- edits (all pure) ----------

export function updateClip(p: Project, id: string, patch: ClipPatch): Project {
  return { clips: p.clips.map((c) => (c.id === id ? ({ ...c, ...patch } as Clip) : c)) }
}

export function addClip(p: Project, clip: Clip): Project {
  return { clips: [...p.clips, clip] }
}

export function removeClip(p: Project, id: string, ripple: boolean): Project {
  const target = p.clips.find((c) => c.id === id)
  if (!target) return p
  const rest = p.clips.filter((c) => c.id !== id)
  if (!ripple) return { clips: rest }
  return {
    clips: rest.map((c) =>
      c.track === target.track && c.start >= clipEnd(target) - 1e-6 ? { ...c, start: round(c.start - target.duration) } : c,
    ),
  }
}

export function splitClip(p: Project, id: string, at: number): { project: Project; newId: string | null } {
  const c = p.clips.find((x) => x.id === id)
  if (!c || at <= c.start + MIN_CLIP / 2 || at >= clipEnd(c) - MIN_CLIP / 2) return { project: p, newId: null }
  const firstDuration = round(at - c.start)
  const rest = { start: round(at), duration: round(c.duration - firstDuration) }
  let first = { ...c, duration: firstDuration } as Clip
  let second: Clip
  if (c.track === 'video') {
    second = { ...c, ...rest, id: uid('clip'), offset: round(c.offset + firstDuration), transitionIn: { ...c.transitionIn, kind: 'none' } }
  } else if (isAudio(c)) {
    // A cut must not add a fade in the middle of the sound: each half keeps only its outer fade.
    first = { ...c, duration: firstDuration, fadeOut: 0 }
    second = { ...c, ...rest, id: uid('audio'), offset: round(c.offset + firstDuration), fadeIn: 0 }
  } else {
    second = { ...c, ...rest, id: uid('title') }
  }
  return { project: { clips: p.clips.flatMap((x) => (x.id === id ? [first, second] : [x])) }, newId: second.id }
}

export function clipsAt(p: Project, t: number): Clip[] {
  return p.clips.filter((c) => t >= c.start && t < clipEnd(c))
}
