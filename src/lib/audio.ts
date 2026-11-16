import type { AudioClip, AudioSource, Project, SynthKind } from '../types'
import { audioClips, duckAt, effectiveFades, envelopeAt, isAudio, projectDuration } from './project'

/**
 * Audio for the timeline: generated music beds, imported files, waveform peaks and playback.
 *
 * Playback schedules every clip once on the Web Audio clock and lets the browser mix them.
 * The playhead then follows that clock, so picture and sound cannot drift apart.
 */

const SAMPLE_RATE = 44100
export const PEAKS_PER_SEC = 100

export const SYNTHS: { kind: SynthKind; name: string; hint: string }[] = [
  { kind: 'pulse', name: 'Pulse', hint: 'Kick, bass and hats, 120 bpm' },
  { kind: 'ambient', name: 'Ambient', hint: 'Slow pad, no beat' },
  { kind: 'keys', name: 'Keys', hint: 'Soft arpeggio' },
]

// ---------- generated beds ----------

/** Small deterministic noise source, so a bed sounds and draws the same on every load. */
function noise(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x80000000 - 1
  }
}

/** Adds a note that wraps around the end of the buffer, so the loop has no click. */
function addNote(out: Float32Array, at: number, length: number, sample: (t: number) => number) {
  const first = Math.floor(at * SAMPLE_RATE)
  const count = Math.floor(length * SAMPLE_RATE)
  for (let i = 0; i < count; i++) out[(first + i) % out.length] += sample(i / SAMPLE_RATE)
}

const TAU = Math.PI * 2

function synthPulse(): Float32Array {
  const beat = 0.5
  const out = new Float32Array(SAMPLE_RATE * 8)
  const rand = noise(7)
  const bass = [55, 55, 65.41, 49] // A1 A1 C2 G1, one per bar
  for (let b = 0; b < 16; b++) {
    // Kick: a sine that falls from 120 Hz to 45 Hz.
    addNote(out, b * beat, 0.35, (t) => Math.sin(TAU * (45 * t + (75 / 18) * (1 - Math.exp(-18 * t)))) * Math.exp(-9 * t) * 0.9)
    // Hat on the off-beat.
    addNote(out, b * beat + beat / 2, 0.08, (t) => rand() * Math.exp(-60 * t) * 0.16)
    const f = bass[Math.floor(b / 4)]
    for (const step of [0.25, 0.75]) {
      addNote(out, (b + step) * beat, 0.22, (t) => (Math.sin(TAU * f * t) + 0.4 * Math.sin(TAU * 2 * f * t)) * Math.exp(-7 * t) * 0.35)
    }
  }
  return out
}

function synthAmbient(): Float32Array {
  const seconds = 16
  const out = new Float32Array(SAMPLE_RATE * seconds)
  // Frequencies are rounded to a whole number of cycles over the loop, so the end meets the start.
  const tones = [110, 164.81, 220, 261.63, 329.63, 493.88].map((f) => Math.round(f * seconds) / seconds)
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE
    let v = 0
    tones.forEach((f, n) => {
      const swell = 0.55 + 0.45 * Math.sin(TAU * ((n % 3) + 1) * (t / seconds) + n)
      v += Math.sin(TAU * f * t) * swell * (n < 3 ? 0.3 : 0.16)
    })
    out[i] = v
  }
  return out
}

function synthKeys(): Float32Array {
  const out = new Float32Array(SAMPLE_RATE * 8)
  const chords = [
    [220, 261.63, 329.63, 440], // Am
    [174.61, 220, 261.63, 349.23], // F
    [261.63, 329.63, 392, 523.25], // C
    [196, 246.94, 293.66, 392], // G
  ]
  const order = [0, 1, 2, 3, 2, 1, 2, 3]
  chords.forEach((chord, bar) => {
    order.forEach((n, i) => {
      const f = chord[n]
      addNote(out, bar * 2 + i * 0.25, 0.9, (t) => {
        const attack = Math.min(1, t / 0.005)
        return (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 2 * f * t) + 0.1 * Math.sin(TAU * 3 * f * t)) * Math.exp(-5 * t) * attack * 0.4
      })
    })
  })
  return out
}

function normalise(data: Float32Array, peak = 0.8): Float32Array {
  let max = 0
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]))
  if (max > 0) for (let i = 0; i < data.length; i++) data[i] = (data[i] / max) * peak
  return data
}

const GENERATORS: Record<SynthKind, () => Float32Array> = { pulse: synthPulse, ambient: synthAmbient, keys: synthKeys }

// ---------- buffers and peaks ----------

const buffers = new Map<string, AudioBuffer>()
const peakCache = new Map<string, Float32Array>()

export function sourceKey(source: AudioSource): string {
  return source.kind === 'synth' ? `synth:${source.synth}` : source.url
}

/** The decoded sound for a source. Generated beds are built on first use; files must be loaded first. */
export function bufferFor(source: AudioSource): AudioBuffer | undefined {
  const key = sourceKey(source)
  let buffer = buffers.get(key)
  if (!buffer && source.kind === 'synth') {
    const data = normalise(GENERATORS[source.synth]())
    buffer = new AudioBuffer({ length: data.length, sampleRate: SAMPLE_RATE, numberOfChannels: 1 })
    buffer.getChannelData(0).set(data)
    buffers.set(key, buffer)
  }
  return buffer
}

/** Loudest sample of every 10 ms slice, across channels. Enough to draw a waveform at any zoom. */
export function peaksFor(source: AudioSource): Float32Array | undefined {
  const key = sourceKey(source)
  let peaks = peakCache.get(key)
  if (peaks) return peaks
  const buffer = bufferFor(source)
  if (!buffer) return undefined
  const block = Math.floor(buffer.sampleRate / PEAKS_PER_SEC)
  peaks = new Float32Array(Math.ceil(buffer.length / block))
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i])
      const slot = Math.floor(i / block)
      if (v > peaks[slot]) peaks[slot] = v
    }
  }
  peakCache.set(key, peaks)
  return peaks
}

export async function loadAudioFile(file: Blob): Promise<{ url: string; length: number }> {
  const url = URL.createObjectURL(file)
  const buffer = await engine().ctx.decodeAudioData(await file.arrayBuffer())
  buffers.set(url, buffer)
  return { url, length: buffer.duration }
}

/** Position inside a looping source, for any offset, negative included. */
export function wrap(t: number, length: number): number {
  return ((t % length) + length) % length
}

// ---------- playback ----------

interface Engine {
  ctx: AudioContext
  analyser: AnalyserNode
}

let shared: Engine | null = null

function engine(): Engine {
  if (!shared) {
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    shared = { ctx, analyser }
  }
  return shared
}

export interface Playback {
  /** Timeline position, read from the audio clock. */
  time: () => number
  stop: () => void
}

function scheduleClip(ctx: AudioContext, bus: AudioNode, clip: AudioClip, from: number, startAt: number): AudioBufferSourceNode | null {
  const buffer = bufferFor(clip.source)
  const local = Math.max(0, from - clip.start)
  if (!buffer || local >= clip.duration) return null

  const when = startAt + Math.max(0, clip.start - from)
  const remaining = clip.duration - local
  const node = ctx.createBufferSource()
  node.buffer = buffer
  const looping = clip.source.kind === 'synth'
  node.loop = looping
  const position = looping ? wrap(clip.offset + local, buffer.duration) : clip.offset + local

  const gain = ctx.createGain()
  const { fadeIn, fadeOut } = effectiveFades(clip)
  gain.gain.setValueAtTime(envelopeAt(clip, local), when)
  if (local < fadeIn) gain.gain.linearRampToValueAtTime(clip.gain, when + (fadeIn - local))
  if (fadeOut > 0) {
    const fadeStart = Math.max(local, clip.duration - fadeOut)
    gain.gain.setValueAtTime(envelopeAt(clip, fadeStart), when + (fadeStart - local))
    gain.gain.linearRampToValueAtTime(0, when + remaining)
  }

  node.connect(gain).connect(bus)
  node.start(when, position)
  node.stop(when + remaining)
  return node
}

/**
 * Starts every audio clip of the project from `from` seconds.
 * With `recordTo`, the mix goes to that node instead of the speakers (used by export).
 */
export function play(project: Project, from: number, recordTo?: AudioNode): Playback {
  const { ctx, analyser } = engine()
  void ctx.resume()
  const bus = ctx.createGain()
  bus.connect(analyser)
  bus.connect(recordTo ?? ctx.destination)

  const startAt = ctx.currentTime + 0.03

  // Music goes through its own gain, which follows the same ducking curve the waveforms draw.
  const music = ctx.createGain()
  music.connect(bus)
  const left = projectDuration(project) - from
  if (left > 0.1 && project.clips.some((c) => c.track === 'voice')) {
    const steps = Math.max(2, Math.ceil(left * 20))
    const curve = new Float32Array(steps)
    for (let i = 0; i < steps; i++) curve[i] = duckAt(project, from + (i / (steps - 1)) * left)
    music.gain.setValueCurveAtTime(curve, startAt, left)
  }

  const nodes = audioClips(project)
    .map((clip) => scheduleClip(ctx, clip.track === 'voice' ? bus : music, clip, from, startAt))
    .filter((n) => n !== null)

  const wallStart = performance.now()
  return {
    // If the browser refuses to start audio (autoplay policy), fall back to the wall clock so the picture still plays.
    time: () => from + (ctx.state === 'running' ? Math.max(0, ctx.currentTime - startAt) : (performance.now() - wallStart) / 1000),
    stop: () => {
      for (const n of nodes) {
        try {
          n.stop()
        } catch {
          /* already ended */
        }
      }
      bus.disconnect()
    },
  }
}

/** A stream of the mix, to record next to the picture. */
export function recordingDestination(): MediaStreamAudioDestinationNode {
  return engine().ctx.createMediaStreamDestination()
}

const meterData = new Float32Array(1024)

/** Current output peak, 0..1. Zero until something has played. */
export function outputLevel(): number {
  if (!shared) return 0
  shared.analyser.getFloatTimeDomainData(meterData)
  let peak = 0
  for (let i = 0; i < meterData.length; i++) peak = Math.max(peak, Math.abs(meterData[i]))
  return Math.min(1, peak)
}

export function hasAudio(project: Project): boolean {
  return project.clips.some(isAudio)
}
