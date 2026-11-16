import type { Grade } from '../types'

export const NEUTRAL_GRADE: Grade = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  fade: 0,
  vignette: 0,
  grain: 0,
}

export interface GradePreset {
  id: string
  name: string
  description: string
  grade: Grade
}

/**
 * A preset sets every control at once, so people get a finished look
 * in one click instead of tuning eight sliders.
 */
export const GRADE_PRESETS: GradePreset[] = [
  { id: 'original', name: 'Original', description: 'No grading', grade: NEUTRAL_GRADE },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Deeper contrast, cooler shadows, soft vignette',
    grade: { exposure: -0.08, contrast: 0.35, saturation: -0.15, temperature: -0.15, tint: 0.05, fade: 0.08, vignette: 0.55, grain: 0.15 },
  },
  {
    id: 'teal-orange',
    name: 'Teal & Orange',
    description: 'Warm skin tones against cool backgrounds',
    grade: { exposure: 0, contrast: 0.25, saturation: 0.2, temperature: 0.3, tint: -0.2, fade: 0, vignette: 0.3, grain: 0 },
  },
  {
    id: 'vintage',
    name: 'Vintage',
    description: 'Faded blacks, warm cast and film grain',
    grade: { exposure: 0.05, contrast: -0.2, saturation: -0.3, temperature: 0.45, tint: 0.1, fade: 0.45, vignette: 0.4, grain: 0.55 },
  },
  {
    id: 'noir',
    name: 'Noir',
    description: 'High contrast black and white',
    grade: { exposure: -0.05, contrast: 0.6, saturation: -1, temperature: 0, tint: 0, fade: 0.05, vignette: 0.7, grain: 0.35 },
  },
  {
    id: 'vivid',
    name: 'Vivid',
    description: 'Punchy colour for social clips',
    grade: { exposure: 0.08, contrast: 0.2, saturation: 0.55, temperature: 0.05, tint: 0, fade: 0, vignette: 0.1, grain: 0 },
  },
  {
    id: 'moonlight',
    name: 'Moonlight',
    description: 'Day for night, cold and dim',
    grade: { exposure: -0.35, contrast: 0.15, saturation: -0.45, temperature: -0.7, tint: 0.1, fade: 0.1, vignette: 0.6, grain: 0.2 },
  },
]

export interface GradeControl {
  key: keyof Grade
  label: string
  min: number
  max: number
}

export const GRADE_CONTROLS: GradeControl[] = [
  { key: 'exposure', label: 'Exposure', min: -1, max: 1 },
  { key: 'contrast', label: 'Contrast', min: -1, max: 1 },
  { key: 'saturation', label: 'Saturation', min: -1, max: 1 },
  { key: 'temperature', label: 'Temperature', min: -1, max: 1 },
  { key: 'tint', label: 'Tint', min: -1, max: 1 },
  { key: 'fade', label: 'Fade', min: 0, max: 1 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 1 },
  { key: 'grain', label: 'Grain', min: 0, max: 1 },
]

export function presetById(id: string | null): GradePreset | undefined {
  return GRADE_PRESETS.find((p) => p.id === id)
}

export function isNeutral(grade: Grade): boolean {
  return (Object.keys(grade) as (keyof Grade)[]).every((k) => Math.abs(grade[k]) < 1e-6)
}

/** CSS filter string for the parts of the grade the canvas can do natively. */
export function gradeFilter(grade: Grade): string {
  const brightness = 1 + grade.exposure * 0.6
  const contrast = 1 + grade.contrast * 0.6
  const saturate = Math.max(0, 1 + grade.saturation)
  return `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturate.toFixed(3)})`
}

let grainTile: HTMLCanvasElement | null = null

function getGrainTile(): HTMLCanvasElement {
  if (grainTile) return grainTile
  const tile = document.createElement('canvas')
  tile.width = 256
  tile.height = 256
  const ctx = tile.getContext('2d')!
  const img = ctx.createImageData(256, 256)
  let seed = 1234567
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const v = seed % 256
    img.data[i] = v
    img.data[i + 1] = v
    img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  grainTile = tile
  return tile
}

/**
 * Draws `source` onto `target` with the grade applied.
 * `frame` only changes the grain pattern so it moves like film grain.
 */
export function applyGrade(
  target: CanvasRenderingContext2D,
  source: CanvasImageSource,
  grade: Grade,
  frame: number,
) {
  const { width: w, height: h } = target.canvas
  target.save()
  target.clearRect(0, 0, w, h)
  target.filter = gradeFilter(grade)
  target.drawImage(source, 0, 0, w, h)
  target.filter = 'none'

  if (Math.abs(grade.temperature) > 0.001) {
    target.globalCompositeOperation = 'soft-light'
    target.globalAlpha = Math.abs(grade.temperature) * 0.7
    target.fillStyle = grade.temperature > 0 ? '#ff8a1f' : '#1f7bff'
    target.fillRect(0, 0, w, h)
  }
  if (Math.abs(grade.tint) > 0.001) {
    target.globalCompositeOperation = 'soft-light'
    target.globalAlpha = Math.abs(grade.tint) * 0.5
    target.fillStyle = grade.tint > 0 ? '#ff3fd2' : '#3fff6a'
    target.fillRect(0, 0, w, h)
  }
  if (grade.fade > 0.001) {
    target.globalCompositeOperation = 'lighten'
    target.globalAlpha = 1
    const lift = Math.round(grade.fade * 70)
    target.fillStyle = `rgb(${lift}, ${lift}, ${lift + 4})`
    target.fillRect(0, 0, w, h)
  }
  if (grade.vignette > 0.001) {
    target.globalCompositeOperation = 'source-over'
    target.globalAlpha = 1
    const g = target.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${(grade.vignette * 0.85).toFixed(3)})`)
    target.fillStyle = g
    target.fillRect(0, 0, w, h)
  }
  if (grade.grain > 0.001) {
    const tile = getGrainTile()
    target.globalCompositeOperation = 'overlay'
    target.globalAlpha = grade.grain * 0.35
    const ox = ((frame * 97) % 256) - 256
    const oy = ((frame * 57) % 256) - 256
    for (let x = ox; x < w; x += 256) {
      for (let y = oy; y < h; y += 256) target.drawImage(tile, x, y)
    }
  }
  target.restore()
}
