import type { Project } from '../types'
import { hasAudio, play, recordingDestination } from './audio'
import { FPS, projectDuration } from './project'
import { renderFrame } from './renderer'

/** The WebM flavour this browser can record for the project, or undefined when it cannot record at all. */
export function exportMime(project: Project): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const codecs = hasAudio(project) ? ['vp9,opus', 'vp8,opus'] : ['vp9', 'vp8']
  return [...codecs.map((c) => `video/webm;codecs=${c}`), 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m))
}

/**
 * Plays the project once into a recorder and returns the file.
 * The mix is recorded next to the picture and its clock decides which frame to draw, so both stay aligned.
 */
export async function exportProject(canvas: HTMLCanvasElement, project: Project, onProgress: (done: number) => void): Promise<Blob> {
  const mimeType = exportMime(project)
  if (!mimeType) throw new Error('Recording is not supported in this browser')
  const duration = projectDuration(project)
  const ctx = canvas.getContext('2d')!
  const stream = canvas.captureStream(FPS)
  const mix = hasAudio(project) ? recordingDestination() : null
  for (const track of mix?.stream.getAudioTracks() ?? []) stream.addTrack(track)

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()))

  recorder.start(250)
  const wallStart = performance.now()
  const sound = mix ? play(project, 0, mix) : null
  try {
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        const t = sound ? sound.time() : (now - wallStart) / 1000
        renderFrame(ctx, project, Math.min(t, duration), { playing: true })
        onProgress(Math.min(1, t / duration))
        if (t >= duration) resolve()
        else requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
  } finally {
    recorder.stop()
    sound?.stop()
    await stopped
  }
  return new Blob(chunks, { type: 'video/webm' })
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
