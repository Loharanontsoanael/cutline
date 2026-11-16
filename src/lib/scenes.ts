import type { SceneKind } from '../types'

export const SCENES: { kind: SceneKind; name: string; swatch: string }[] = [
  { kind: 'sunset', name: 'Sunset', swatch: 'linear-gradient(180deg,#ff9a3c,#c2416b 60%,#2a1b3d)' },
  { kind: 'ocean', name: 'Ocean', swatch: 'linear-gradient(180deg,#7fd3ff,#1769aa 55%,#06243f)' },
  { kind: 'city', name: 'City night', swatch: 'linear-gradient(180deg,#0b1026,#27305e 70%,#f2b84b)' },
  { kind: 'aurora', name: 'Aurora', swatch: 'linear-gradient(160deg,#04121f,#0f5e4a 55%,#6b3fa0)' },
  { kind: 'orbit', name: 'Orbit', swatch: 'radial-gradient(circle,#ffd166,#ef476f 40%,#1b1b3a 75%)' },
]

export function sceneName(kind: SceneKind): string {
  return SCENES.find((s) => s.kind === kind)?.name ?? kind
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

/** Draws a procedural scene at local time `t` (seconds). Deterministic, so scrubbing is exact. */
export function drawScene(ctx: CanvasRenderingContext2D, kind: SceneKind, t: number) {
  const { width: w, height: h } = ctx.canvas
  ctx.save()
  switch (kind) {
    case 'sunset':
      drawSunset(ctx, w, h, t)
      break
    case 'ocean':
      drawOcean(ctx, w, h, t)
      break
    case 'city':
      drawCity(ctx, w, h, t)
      break
    case 'aurora':
      drawAurora(ctx, w, h, t)
      break
    case 'orbit':
      drawOrbit(ctx, w, h, t)
      break
  }
  ctx.restore()
}

function drawSunset(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const horizon = h * 0.62
  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#2a1b3d')
  sky.addColorStop(0.45, '#c2416b')
  sky.addColorStop(1, '#ffb347')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, horizon)

  const sunY = horizon - h * 0.18 + t * h * 0.012
  const r = h * 0.11
  const glow = ctx.createRadialGradient(w * 0.5, sunY, r * 0.2, w * 0.5, sunY, r * 3.2)
  glow.addColorStop(0, 'rgba(255,230,160,0.9)')
  glow.addColorStop(1, 'rgba(255,140,60,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, horizon)
  ctx.fillStyle = '#ffe8a3'
  ctx.beginPath()
  ctx.arc(w * 0.5, sunY, r, 0, Math.PI * 2)
  ctx.fill()

  const sea = ctx.createLinearGradient(0, horizon, 0, h)
  sea.addColorStop(0, '#d9715a')
  sea.addColorStop(1, '#2b1630')
  ctx.fillStyle = sea
  ctx.fillRect(0, horizon, w, h - horizon)

  ctx.fillStyle = 'rgba(255,224,160,0.55)'
  for (let i = 0; i < 26; i++) {
    const y = horizon + 6 + i * ((h - horizon) / 26)
    const width = r * (1.8 - i * 0.03) * (0.7 + 0.3 * Math.sin(t * 2.2 + i))
    ctx.fillRect(w * 0.5 - width / 2 + Math.sin(t * 1.4 + i * 0.7) * 6, y, width, 2)
  }

  ctx.fillStyle = '#1d1026'
  ctx.beginPath()
  ctx.moveTo(0, horizon)
  for (let x = 0; x <= w * 0.32; x += 8) ctx.lineTo(x, horizon - Math.sin(x / (w * 0.32) * Math.PI) * h * 0.09)
  ctx.lineTo(w * 0.32, horizon)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(w * 0.7, horizon)
  for (let x = w * 0.7; x <= w; x += 8) ctx.lineTo(x, horizon - Math.sin(((x - w * 0.7) / (w * 0.3)) * Math.PI * 0.8) * h * 0.13)
  ctx.lineTo(w, horizon)
  ctx.fill()

  ctx.strokeStyle = 'rgba(20,10,25,0.85)'
  ctx.lineWidth = 2
  for (let b = 0; b < 3; b++) {
    const bx = ((t * 40 + b * 140) % (w + 200)) - 100
    const by = h * (0.2 + b * 0.05) + Math.sin(t * 3 + b) * 6
    const flap = Math.sin(t * 9 + b) * 6
    ctx.beginPath()
    ctx.moveTo(bx - 10, by - flap)
    ctx.quadraticCurveTo(bx - 4, by - 4, bx, by)
    ctx.quadraticCurveTo(bx + 4, by - 4, bx + 10, by - flap)
    ctx.stroke()
  }
}

function drawOcean(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45)
  sky.addColorStop(0, '#5ec2ff')
  sky.addColorStop(1, '#c9ecff')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (let c = 0; c < 4; c++) {
    const cx = ((t * 18 * (1 + c * 0.3) + c * 330) % (w + 300)) - 150
    const cy = h * (0.1 + c * 0.07)
    for (let p = 0; p < 4; p++) {
      ctx.beginPath()
      ctx.ellipse(cx + p * 34, cy + (p % 2) * 6, 42, 18, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const layers = [
    { y: 0.45, amp: 8, color: '#2a8fd0', speed: 0.6 },
    { y: 0.55, amp: 12, color: '#1f78b8', speed: 0.9 },
    { y: 0.66, amp: 16, color: '#155f98', speed: 1.2 },
    { y: 0.78, amp: 20, color: '#0d4577', speed: 1.6 },
    { y: 0.9, amp: 24, color: '#082d52', speed: 2.1 },
  ]
  for (const [i, layer] of layers.entries()) {
    ctx.fillStyle = layer.color
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 10) {
      const y = h * layer.y + Math.sin(x / 90 + t * layer.speed + i) * layer.amp + Math.sin(x / 37 - t * layer.speed * 1.7) * layer.amp * 0.35
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function drawCity(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#070b1f')
  sky.addColorStop(0.7, '#27305e')
  sky.addColorStop(1, '#4a3b6b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 90; i++) {
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))
    ctx.fillStyle = `rgba(255,255,255,${(0.6 * twinkle).toFixed(2)})`
    ctx.fillRect(hash(i) * w, hash(i + 99) * h * 0.45, 2, 2)
  }

  ctx.fillStyle = '#f6f0d8'
  ctx.beginPath()
  ctx.arc(w * 0.82, h * 0.18, h * 0.06, 0, Math.PI * 2)
  ctx.fill()

  const ground = h * 0.86
  let x = -20
  let b = 0
  while (x < w + 20) {
    const bw = 50 + hash(b) * 90
    const bh = h * (0.22 + hash(b + 7) * 0.45)
    ctx.fillStyle = b % 2 ? '#141a3a' : '#1b2148'
    ctx.fillRect(x, ground - bh, bw, bh)
    for (let wy = ground - bh + 12; wy < ground - 10; wy += 18) {
      for (let wx = x + 8; wx < x + bw - 10; wx += 14) {
        const seed = Math.floor(wx * 3 + wy * 7)
        const on = hash(seed + Math.floor(t * 0.7 + hash(seed) * 10)) > 0.45
        if (on) {
          ctx.fillStyle = hash(seed + 3) > 0.8 ? '#9fd3ff' : '#f2c05c'
          ctx.fillRect(wx, wy, 7, 9)
        }
      }
    }
    x += bw + 4
    b++
  }

  ctx.fillStyle = '#0a0d1d'
  ctx.fillRect(0, ground, w, h - ground)
  for (let c = 0; c < 6; c++) {
    const dir = c % 2 ? 1 : -1
    const speed = 90 + c * 25
    const cx = dir > 0 ? ((t * speed + c * 300) % (w + 200)) - 100 : w + 100 - ((t * speed + c * 300) % (w + 200))
    const cy = ground + 14 + (c % 2) * 18
    ctx.fillStyle = dir > 0 ? '#ff4d4d' : '#fff6c7'
    ctx.shadowColor = ctx.fillStyle
    ctx.shadowBlur = 14
    ctx.fillRect(cx, cy, 10, 4)
    ctx.fillRect(cx + 16, cy, 10, 4)
  }
  ctx.shadowBlur = 0
}

function drawAurora(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#030b16'
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = `rgba(255,255,255,${(0.3 + hash(i + 5) * 0.6).toFixed(2)})`
    ctx.fillRect(hash(i) * w, hash(i + 41) * h * 0.7, 1.5, 1.5)
  }
  ctx.globalCompositeOperation = 'lighter'
  const bands = [
    { color: [40, 255, 160], base: 0.32, amp: 0.08, speed: 0.35 },
    { color: [120, 90, 255], base: 0.24, amp: 0.06, speed: 0.25 },
    { color: [30, 200, 255], base: 0.4, amp: 0.07, speed: 0.45 },
  ]
  for (const [i, band] of bands.entries()) {
    for (let x = 0; x <= w; x += 6) {
      const y = h * (band.base + Math.sin(x / 210 + t * band.speed + i * 2) * band.amp + Math.sin(x / 70 - t * band.speed * 2) * 0.015)
      const height = h * (0.18 + 0.08 * Math.sin(x / 120 + t + i))
      const g = ctx.createLinearGradient(0, y, 0, y + height)
      const [r, gg, bb] = band.color
      g.addColorStop(0, `rgba(${r},${gg},${bb},0)`)
      g.addColorStop(0.2, `rgba(${r},${gg},${bb},0.12)`)
      g.addColorStop(1, `rgba(${r},${gg},${bb},0)`)
      ctx.fillStyle = g
      ctx.fillRect(x, y, 6, height)
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#02060c'
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h * 0.8 - Math.abs(Math.sin(x / 80)) * h * 0.06 - hash(Math.floor(x / 12)) * h * 0.05)
  ctx.lineTo(w, h)
  ctx.fill()
}

function drawOrbit(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7)
  bg.addColorStop(0, '#2b2257')
  bg.addColorStop(1, '#0c0b1d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f78c6b']
  ctx.translate(w / 2, h / 2)
  for (let ring = 1; ring <= 5; ring++) {
    const radius = ring * h * 0.08
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.stroke()
    const count = ring + 1
    for (let i = 0; i < count; i++) {
      const a = t * (0.9 / ring) * (ring % 2 ? 1 : -1) + (i / count) * Math.PI * 2
      ctx.fillStyle = colors[(ring + i) % colors.length]
      ctx.beginPath()
      ctx.arc(Math.cos(a) * radius, Math.sin(a) * radius, 6 + ring * 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const pulse = 1 + Math.sin(t * 3) * 0.08
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.06 * pulse * 2)
  core.addColorStop(0, '#fff3c4')
  core.addColorStop(0.5, '#ffd166')
  core.addColorStop(1, 'rgba(255,209,102,0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(0, 0, h * 0.12 * pulse, 0, Math.PI * 2)
  ctx.fill()
}
