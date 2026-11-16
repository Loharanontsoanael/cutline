import { describe, expect, it } from 'vitest'
import type { Project } from '../types'
import {
  addClip,
  clipEnd,
  demoProject,
  DUCK_GAIN,
  DUCK_RAMP,
  duckAt,
  editPoints,
  envelopeAt,
  freeSlot,
  makeAudioClip,
  makeSceneClip,
  makeTitle,
  mixGainAt,
  neighbourBounds,
  projectDuration,
  removeClip,
  sourceLength,
  splitClip,
} from './project'

const synth = { kind: 'synth', synth: 'pulse' } as const
const file = { kind: 'file', url: 'blob:test', fileName: 'take.mp3', length: 10 } as const

function twoClips(): Project {
  return { clips: [makeSceneClip('sunset', 0, 4), makeSceneClip('ocean', 4, 4)] }
}

describe('splitClip', () => {
  it('cuts a video clip in two halves that play the same frames as before', () => {
    const p = twoClips()
    const { project, newId } = splitClip(p, p.clips[0].id, 1.5)
    const [first, second] = project.clips
    expect(first.duration).toBe(1.5)
    expect(second.id).toBe(newId)
    expect(second.start).toBe(1.5)
    expect(second.duration).toBe(2.5)
    expect(second.track === 'video' && second.offset).toBe(1.5)
    expect(projectDuration(project)).toBe(projectDuration(p))
  })

  it('does not add a transition on the cut', () => {
    const p = twoClips()
    const ocean = p.clips[1]
    if (ocean.track === 'video') ocean.transitionIn = { kind: 'crossfade', duration: 1 }
    const { project } = splitClip(p, ocean.id, 6)
    const second = project.clips[2]
    expect(second.track === 'video' && second.transitionIn.kind).toBe('none')
  })

  it('keeps only the outer fades when it cuts sound', () => {
    const clip = { ...makeAudioClip(synth, 'Pulse', 0, 8), fadeIn: 1, fadeOut: 2 }
    const { project } = splitClip({ clips: [clip] }, clip.id, 3)
    const [first, second] = project.clips
    expect(first.track === 'audio' && [first.fadeIn, first.fadeOut]).toEqual([1, 0])
    expect(second.track === 'audio' && [second.fadeIn, second.fadeOut, second.offset]).toEqual([0, 2, 3])
  })

  it('refuses a cut on the edge of a clip', () => {
    const p = twoClips()
    expect(splitClip(p, p.clips[0].id, 0).newId).toBeNull()
    expect(splitClip(p, p.clips[0].id, 4).newId).toBeNull()
    expect(splitClip(p, 'missing', 2).project).toBe(p)
  })
})

describe('removeClip', () => {
  it('leaves a gap by default and closes it on ripple', () => {
    const p = twoClips()
    expect(removeClip(p, p.clips[0].id, false).clips[0].start).toBe(4)
    expect(removeClip(p, p.clips[0].id, true).clips[0].start).toBe(0)
  })

  it('ripples only the track of the removed clip', () => {
    const p = addClip(twoClips(), makeTitle(5, 'Hello', 2))
    const next = removeClip(p, p.clips[0].id, true)
    expect(next.clips.find((c) => c.track === 'title')!.start).toBe(5)
  })
})

describe('placement', () => {
  it('finds the first free slot that fits', () => {
    const p = twoClips()
    expect(freeSlot(p, 'video', 1, 2)).toBe(8)
    expect(freeSlot(p, 'title', 1, 2)).toBe(1)
    expect(freeSlot({ clips: [makeSceneClip('sunset', 3, 2)] }, 'video', 0, 2)).toBe(0)
    expect(freeSlot({ clips: [makeSceneClip('sunset', 3, 2)] }, 'video', 0, 4)).toBe(5)
  })

  it('bounds a clip between its neighbours', () => {
    const p: Project = { clips: [makeSceneClip('sunset', 0, 2), makeSceneClip('ocean', 3, 2), makeSceneClip('city', 8, 2)] }
    expect(neighbourBounds(p, p.clips[1])).toEqual({ min: 2, max: 8 })
    expect(neighbourBounds(p, p.clips[2])).toEqual({ min: 5, max: Infinity })
  })

  it('lists every edit point once, in order', () => {
    expect(editPoints(twoClips())).toEqual([0, 4, 8])
  })

  it('knows which sources have an end', () => {
    expect(sourceLength(makeAudioClip(synth, 'Pulse', 0, 8))).toBe(Infinity)
    expect(sourceLength(makeAudioClip(file, 'Take', 0, 8))).toBe(10)
  })
})

describe('sound', () => {
  it('applies volume and fades', () => {
    const clip = { ...makeAudioClip(synth, 'Pulse', 0, 10), gain: 0.8, fadeIn: 2, fadeOut: 4 }
    expect(envelopeAt(clip, 0)).toBe(0)
    expect(envelopeAt(clip, 1)).toBeCloseTo(0.4)
    expect(envelopeAt(clip, 5)).toBeCloseTo(0.8)
    expect(envelopeAt(clip, 8)).toBeCloseTo(0.4)
    expect(envelopeAt(clip, 10)).toBe(0)
    expect(envelopeAt(clip, 11)).toBe(0)
  })

  it('never lets two fades overlap on a short clip', () => {
    const clip = { ...makeAudioClip(synth, 'Pulse', 0, 2), gain: 1, fadeIn: 5, fadeOut: 5 }
    expect(envelopeAt(clip, 1)).toBeCloseTo(1)
    expect(envelopeAt(clip, 0.5)).toBeCloseTo(0.5)
  })

  it('ducks music under a voice clip, with a ramp on each side', () => {
    const voice = makeAudioClip(file, 'Take', 4, 2, 'voice')
    const music = { ...makeAudioClip(synth, 'Pulse', 0, 10), gain: 1 }
    const p: Project = { clips: [music, voice] }
    expect(duckAt(p, 1)).toBe(1)
    expect(duckAt(p, 4 - DUCK_RAMP / 2)).toBeCloseTo(1 - (1 - DUCK_GAIN) / 2)
    expect(duckAt(p, 5)).toBeCloseTo(DUCK_GAIN)
    expect(duckAt(p, clipEnd(voice) + DUCK_RAMP)).toBeCloseTo(1)
    expect(mixGainAt(p, music, 5)).toBeCloseTo(DUCK_GAIN)
    expect(mixGainAt(p, voice, 1)).toBe(1)
  })

  it('does not duck under a muted voice clip', () => {
    const voice = { ...makeAudioClip(file, 'Take', 4, 2, 'voice'), gain: 0 }
    expect(duckAt({ clips: [voice] }, 5)).toBe(1)
  })
})

describe('demoProject', () => {
  it('has no overlapping clips on any track', () => {
    const p = demoProject()
    for (const clip of p.clips) {
      const { min, max } = neighbourBounds(p, clip)
      expect(clip.start).toBeGreaterThanOrEqual(min)
      expect(clipEnd(clip)).toBeLessThanOrEqual(max)
    }
  })
})
