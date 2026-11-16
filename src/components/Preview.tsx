import { useEffect, type RefObject } from 'react'
import type { Project } from '../types'
import { OUTPUT_HEIGHT, OUTPUT_WIDTH, renderFrame } from '../lib/renderer'
import { formatTime } from '../lib/time'

interface Props {
  project: Project
  time: number
  rate: number
  duration: number
  canvasRef: RefObject<HTMLCanvasElement | null>
  onTogglePlay: () => void
  onSeek: (t: number) => void
  onStep: (frames: number) => void
}

export function Preview({ project, time, rate, duration, canvasRef, onTogglePlay, onSeek, onStep }: Props) {
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) renderFrame(ctx, project, time, { playing: rate !== 0 })
  }, [project, time, rate, canvasRef])

  const playing = rate !== 0

  return (
    <section className="preview" aria-label="Preview">
      <div className="preview-stage">
        <canvas
          ref={canvasRef}
          width={OUTPUT_WIDTH}
          height={OUTPUT_HEIGHT}
          className="preview-canvas"
          onClick={onTogglePlay}
          aria-label="Video preview, click to play or pause"
        />
      </div>
      <div className="transport">
        <button className="icon-btn" onClick={() => onSeek(0)} aria-label="Go to start" title="Go to start">
          ⏮
        </button>
        <button className="icon-btn" onClick={() => onStep(-1)} aria-label="Previous frame" title="Previous frame">
          ◀︎
        </button>
        <button className="icon-btn play" onClick={onTogglePlay} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause">
          {playing ? '❚❚' : '▶'}
        </button>
        <button className="icon-btn" onClick={() => onStep(1)} aria-label="Next frame" title="Next frame">
          ▶︎
        </button>
        <button className="icon-btn" onClick={() => onSeek(duration)} aria-label="Go to end" title="Go to end">
          ⏭
        </button>
        <span className="timecode big">{formatTime(time)}</span>
        {Math.abs(rate) > 1 || rate < 0 ? <span className="rate">{rate > 0 ? `${rate}×` : `◀ ${Math.abs(rate)}×`}</span> : null}
      </div>
    </section>
  )
}
