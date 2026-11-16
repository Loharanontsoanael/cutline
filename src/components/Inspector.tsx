import type { Clip, Grade, Project, TitleAnimation, TitleClip, TitlePosition, TransitionKind, VideoClip } from '../types'
import { GRADE_CONTROLS, GRADE_PRESETS, presetById } from '../lib/grades'
import { previousAdjacent } from '../lib/project'
import { formatTime } from '../lib/time'
import { PresetThumb } from './PresetThumb'

const TRANSITIONS: { kind: TransitionKind; label: string }[] = [
  { kind: 'none', label: 'Cut' },
  { kind: 'crossfade', label: 'Cross dissolve' },
  { kind: 'dip', label: 'Dip to black' },
  { kind: 'slide', label: 'Slide' },
  { kind: 'wipe', label: 'Wipe' },
  { kind: 'zoom', label: 'Zoom' },
]

interface Props {
  project: Project
  clip: Clip | null
  time: number
  playing: boolean
  onPatch: (id: string, patch: Partial<VideoClip> | Partial<TitleClip>) => void
  onBeginGesture: () => void
  onEndGesture: () => void
  onApplyLookToAll: (grade: Grade, presetId: string | null) => void
}

export function Inspector(props: Props) {
  const { clip } = props
  if (!clip) {
    return (
      <aside className="inspector" aria-label="Inspector">
        <h2>Inspector</h2>
        <p className="muted">Select a clip on the timeline to grade it, add a transition or edit a title.</p>
        <div className="hint-card">
          <strong>Quick tour</strong>
          <ul>
            <li>Drag clips to move them, drag their edges to trim.</li>
            <li>Pick a look in one click, then fine-tune if you want.</li>
            <li>Coming from Premiere Pro or Final Cut Pro? Switch the keyboard layout at the top right.</li>
            <li>
              Press <kbd>?</kbd> to see every shortcut.
            </li>
          </ul>
        </div>
      </aside>
    )
  }
  return (
    <aside className="inspector" aria-label="Inspector">
      {clip.track === 'video' ? <VideoInspector {...props} clip={clip} /> : <TitleInspector {...props} clip={clip} />}
    </aside>
  )
}

function Timing({ clip }: { clip: Clip }) {
  return (
    <dl className="timing">
      <div>
        <dt>In</dt>
        <dd>{formatTime(clip.start)}</dd>
      </div>
      <div>
        <dt>Out</dt>
        <dd>{formatTime(clip.start + clip.duration)}</dd>
      </div>
      <div>
        <dt>Length</dt>
        <dd>{clip.duration.toFixed(2)}s</dd>
      </div>
    </dl>
  )
}

function VideoInspector({ project, clip, time, playing, onPatch, onBeginGesture, onEndGesture, onApplyLookToAll }: Props & { clip: VideoClip }) {
  const preset = presetById(clip.presetId)
  const thumbTime = Math.min(Math.max(time, clip.start), clip.start + clip.duration - 0.01)
  const hasPrev = !!previousAdjacent(project, clip)

  function setGradeValue(key: keyof Grade, value: number) {
    onPatch(clip.id, { grade: { ...clip.grade, [key]: value }, presetId: null })
  }

  return (
    <>
      <h2>{clip.name}</h2>
      <Timing clip={clip} />

      <section className="panel">
        <header className="panel-head">
          <h3>Look</h3>
          <span className="muted">{preset ? preset.name : 'Custom'}</span>
        </header>
        <div className="preset-grid">
          {GRADE_PRESETS.map((p) => (
            <PresetThumb
              key={p.id}
              project={project}
              clipId={clip.id}
              time={playing ? clip.start : thumbTime}
              grade={p.grade}
              active={clip.presetId === p.id}
              name={p.name}
              description={p.description}
              onApply={() => onPatch(clip.id, { grade: { ...p.grade }, presetId: p.id })}
            />
          ))}
        </div>
        <button className="link-btn" onClick={() => onApplyLookToAll(clip.grade, clip.presetId)}>
          Apply this look to every clip
        </button>
        <details className="fine-tune">
          <summary>Fine-tune ({GRADE_CONTROLS.length} controls)</summary>
          {GRADE_CONTROLS.map((c) => (
            <label key={c.key} className="slider">
              <span>{c.label}</span>
              <input
                type="range"
                min={c.min}
                max={c.max}
                step={0.01}
                value={clip.grade[c.key]}
                onPointerDown={onBeginGesture}
                onPointerUp={onEndGesture}
                onChange={(e) => setGradeValue(c.key, Number(e.target.value))}
                onDoubleClick={() => setGradeValue(c.key, 0)}
              />
              <output>{clip.grade[c.key].toFixed(2)}</output>
            </label>
          ))}
        </details>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h3>Transition in</h3>
        </header>
        {hasPrev ? (
          <>
            <div className="segmented" role="radiogroup" aria-label="Transition">
              {TRANSITIONS.map((t) => (
                <button
                  key={t.kind}
                  role="radio"
                  aria-checked={clip.transitionIn.kind === t.kind}
                  className={clip.transitionIn.kind === t.kind ? 'on' : ''}
                  onClick={() => onPatch(clip.id, { transitionIn: { ...clip.transitionIn, kind: t.kind } })}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {clip.transitionIn.kind !== 'none' && (
              <label className="slider">
                <span>Duration</span>
                <input
                  type="range"
                  min={0.2}
                  max={2}
                  step={0.05}
                  value={clip.transitionIn.duration}
                  onPointerDown={onBeginGesture}
                  onPointerUp={onEndGesture}
                  onChange={(e) => onPatch(clip.id, { transitionIn: { ...clip.transitionIn, duration: Number(e.target.value) } })}
                />
                <output>{clip.transitionIn.duration.toFixed(2)}s</output>
              </label>
            )}
          </>
        ) : (
          <p className="muted small">Butt this clip against another one on V1 to add a transition between them.</p>
        )}
      </section>
    </>
  )
}

function TitleInspector({ clip, onPatch, onBeginGesture, onEndGesture }: Props & { clip: TitleClip }) {
  return (
    <>
      <h2>Title</h2>
      <Timing clip={clip} />
      <section className="panel">
        <label className="field">
          <span>Text</span>
          <textarea
            value={clip.text}
            rows={2}
            onFocus={onBeginGesture}
            onBlur={onEndGesture}
            onChange={(e) => onPatch(clip.id, { text: e.target.value })}
          />
        </label>
        <label className="slider">
          <span>Size</span>
          <input
            type="range"
            min={24}
            max={160}
            value={clip.size}
            onPointerDown={onBeginGesture}
            onPointerUp={onEndGesture}
            onChange={(e) => onPatch(clip.id, { size: Number(e.target.value) })}
          />
          <output>{clip.size}px</output>
        </label>
        <div className="field">
          <span>Position</span>
          <div className="segmented">
            {(['top', 'center', 'bottom'] as TitlePosition[]).map((p) => (
              <button key={p} className={clip.position === p ? 'on' : ''} onClick={() => onPatch(clip.id, { position: p })}>
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Animation</span>
          <div className="segmented">
            {(['fade', 'rise', 'typewriter'] as TitleAnimation[]).map((a) => (
              <button key={a} className={clip.animation === a ? 'on' : ''} onClick={() => onPatch(clip.id, { animation: a })}>
                {a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
