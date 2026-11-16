import type { Grade, Project, TitleClip, TransitionKind, VideoClip } from '../types'
import { applyGrade, isNeutral } from './grades'
import { clipEnd, FPS, previousAdjacent, titleClips, videoClips } from './project'
import { drawScene } from './scenes'

export const OUTPUT_WIDTH = 1280
export const OUTPUT_HEIGHT = 720

/** Image and video elements for imported media, keyed by object URL. */
export const mediaCache = new Map<string, HTMLImageElement | HTMLVideoElement>()

export function loadMedia(file: File): Promise<{ url: string; kind: 'image' | 'video'; length: number }> {
  const url = URL.createObjectURL(file)
  if (file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        mediaCache.set(url, img)
        resolve({ url, kind: 'image', length: Infinity })
      }
      img.onerror = reject
      img.src = url
    })
  }
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.onloadeddata = () => {
      mediaCache.set(url, video)
      resolve({ url, kind: 'video', length: video.duration })
    }
    video.onerror = reject
    video.src = url
  })
}

interface Layers {
  raw: CanvasRenderingContext2D
  a: CanvasRenderingContext2D
  b: CanvasRenderingContext2D
}

const layerCache = new Map<string, Layers>()

function makeCtx(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c.getContext('2d')!
}

function layersFor(w: number, h: number): Layers {
  const key = `${w}x${h}`
  let layers = layerCache.get(key)
  if (!layers) {
    layers = { raw: makeCtx(w, h), a: makeCtx(w, h), b: makeCtx(w, h) }
    layerCache.set(key, layers)
  }
  return layers
}

export interface RenderOptions {
  playing?: boolean
  /** Override the grade of every video clip (used for preset thumbnails). */
  gradeOverride?: Grade
  /** Only draw this clip (used for preset thumbnails). */
  onlyClipId?: string
  skipTitles?: boolean
}

function drawCover(ctx: CanvasRenderingContext2D, el: CanvasImageSource, iw: number, ih: number, zoom = 1) {
  const { width: w, height: h } = ctx.canvas
  const scale = Math.max(w / iw, h / ih) * zoom
  const dw = iw * scale
  const dh = ih * scale
  ctx.drawImage(el, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

function drawSource(ctx: CanvasRenderingContext2D, clip: VideoClip, local: number, playing: boolean) {
  const { width: w, height: h } = ctx.canvas
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  const src = clip.source
  if (src.kind === 'scene') {
    drawScene(ctx, src.scene, local)
    return
  }
  const el = mediaCache.get(src.url)
  if (!el) {
    ctx.fillStyle = '#2a2a33'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#9a9aac'
    ctx.font = `${Math.round(h / 22)}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`Media offline: ${src.fileName}`, w / 2, h / 2)
    return
  }
  if (el instanceof HTMLImageElement) {
    // Slow push-in so stills don't feel frozen.
    const progress = Math.min(1, Math.max(0, (local - clip.offset) / Math.max(clip.duration, 0.001)))
    drawCover(ctx, el, el.naturalWidth, el.naturalHeight, 1 + progress * 0.06)
    return
  }
  const target = Math.min(Math.max(local, 0), Math.max(el.duration - 0.05, 0))
  if (playing) {
    if (el.paused) void el.play().catch(() => {})
    if (Math.abs(el.currentTime - target) > 0.3) el.currentTime = target
  } else {
    if (!el.paused) el.pause()
    if (Math.abs(el.currentTime - target) > 1 / FPS) el.currentTime = target
  }
  drawCover(ctx, el, el.videoWidth || w, el.videoHeight || h)
}

function renderClipLayer(
  layers: Layers,
  out: CanvasRenderingContext2D,
  clip: VideoClip,
  t: number,
  frame: number,
  opts: RenderOptions,
) {
  const local = t - clip.start + clip.offset
  drawSource(layers.raw, clip, local, !!opts.playing)
  const grade = opts.gradeOverride ?? clip.grade
  if (isNeutral(grade)) {
    out.clearRect(0, 0, out.canvas.width, out.canvas.height)
    out.drawImage(layers.raw.canvas, 0, 0)
  } else {
    applyGrade(out, layers.raw.canvas, grade, frame)
  }
}

function ease(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}

function composeTransition(
  ctx: CanvasRenderingContext2D,
  from: HTMLCanvasElement,
  to: HTMLCanvasElement,
  kind: TransitionKind,
  progress: number,
) {
  const { width: w, height: h } = ctx.canvas
  const p = ease(Math.min(1, Math.max(0, progress)))
  ctx.save()
  switch (kind) {
    case 'crossfade':
      ctx.drawImage(from, 0, 0, w, h)
      ctx.globalAlpha = p
      ctx.drawImage(to, 0, 0, w, h)
      break
    case 'dip':
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2
      ctx.drawImage(p < 0.5 ? from : to, 0, 0, w, h)
      break
    case 'slide':
      ctx.drawImage(from, -w * p, 0, w, h)
      ctx.drawImage(to, w * (1 - p), 0, w, h)
      break
    case 'wipe':
      ctx.drawImage(from, 0, 0, w, h)
      ctx.beginPath()
      ctx.rect(0, 0, w * p, h)
      ctx.clip()
      ctx.drawImage(to, 0, 0, w, h)
      ctx.restore()
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      if (p > 0 && p < 1) ctx.fillRect(w * p - 2, 0, 4, h)
      break
    case 'zoom': {
      const s = 1 + p * 0.25
      ctx.globalAlpha = 1 - p
      ctx.drawImage(from, (w - w * s) / 2, (h - h * s) / 2, w * s, h * s)
      const s2 = 1.25 - p * 0.25
      ctx.globalAlpha = p
      ctx.drawImage(to, (w - w * s2) / 2, (h - h * s2) / 2, w * s2, h * s2)
      break
    }
    default:
      ctx.drawImage(to, 0, 0, w, h)
  }
  ctx.restore()
}

function drawTitle(ctx: CanvasRenderingContext2D, title: TitleClip, t: number) {
  const { width: w, height: h } = ctx.canvas
  const local = t - title.start
  const scale = h / OUTPUT_HEIGHT
  const fadeIn = Math.min(1, local / 0.45)
  const fadeOut = Math.min(1, (title.duration - local) / 0.45)
  const alpha = Math.max(0, Math.min(fadeIn, fadeOut))
  let text = title.text
  let offsetY = 0
  if (title.animation === 'rise') offsetY = (1 - ease(Math.min(1, local / 0.6))) * 40 * scale
  if (title.animation === 'typewriter') {
    const chars = Math.floor(local * 22)
    text = title.text.slice(0, chars)
  }
  const size = title.size * scale
  const y = title.position === 'top' ? h * 0.16 : title.position === 'bottom' ? h * 0.84 : h * 0.5
  ctx.save()
  ctx.globalAlpha = title.animation === 'typewriter' ? Math.min(1, fadeOut) : alpha
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 18 * scale
  ctx.shadowOffsetY = 3 * scale
  ctx.fillStyle = '#ffffff'
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, y + offsetY + (i - (lines.length - 1) / 2) * size * 1.15)
  })
  ctx.restore()
}

/** Renders the whole composition at time `t` into `ctx`. */
export function renderFrame(ctx: CanvasRenderingContext2D, project: Project, t: number, opts: RenderOptions = {}) {
  const { width: w, height: h } = ctx.canvas
  const layers = layersFor(w, h)
  const frame = Math.floor(t * FPS)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)

  const clips = videoClips(project).filter((c) => !opts.onlyClipId || c.id === opts.onlyClipId)
  let drawn = false

  if (!opts.onlyClipId) {
    for (const clip of clips) {
      const tr = clip.transitionIn
      if (tr.kind === 'none') continue
      const prev = previousAdjacent(project, clip) as VideoClip | undefined
      if (!prev) continue
      const half = Math.min(tr.duration / 2, prev.duration / 2, clip.duration / 2)
      if (t >= clip.start - half && t < clip.start + half) {
        renderClipLayer(layers, layers.a, prev, t, frame, opts)
        renderClipLayer(layers, layers.b, clip, t, frame, opts)
        composeTransition(ctx, layers.a.canvas, layers.b.canvas, tr.kind, (t - (clip.start - half)) / (half * 2))
        drawn = true
        break
      }
    }
  }

  if (!drawn) {
    const active = clips.find((c) => t >= c.start && t < clipEnd(c)) ?? (opts.onlyClipId ? clips[0] : undefined)
    if (active) {
      renderClipLayer(layers, layers.a, active, opts.onlyClipId ? Math.min(Math.max(t, active.start), clipEnd(active) - 0.001) : t, frame, opts)
      ctx.drawImage(layers.a.canvas, 0, 0)
    }
  }

  // Pause any imported video that is not on screen right now.
  for (const c of videoClips(project)) {
    if (c.source.kind !== 'video') continue
    const el = mediaCache.get(c.source.url)
    if (el instanceof HTMLVideoElement && !el.paused && !(t >= c.start - 1 && t < clipEnd(c) + 1)) el.pause()
  }

  if (!opts.skipTitles) {
    for (const title of titleClips(project)) {
      if (t >= title.start && t < clipEnd(title)) drawTitle(ctx, title, t)
    }
  }
}
