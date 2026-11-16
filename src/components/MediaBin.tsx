import { useRef } from 'react'
import type { SceneKind } from '../types'
import { SCENES } from '../lib/scenes'

interface Props {
  onAddScene: (kind: SceneKind) => void
  onAddTitle: () => void
  onImport: (files: FileList) => void
}

export function MediaBin({ onAddScene, onAddTitle, onImport }: Props) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <aside className="bin" aria-label="Media">
      <h2>Media</h2>
      <p className="muted small">Click to drop a clip at the playhead.</p>
      <div className="bin-grid">
        {SCENES.map((s) => (
          <button key={s.kind} className="bin-item" onClick={() => onAddScene(s.kind)}>
            <span className="bin-thumb" style={{ background: s.swatch }} />
            <span>{s.name}</span>
          </button>
        ))}
        <button className="bin-item" onClick={onAddTitle}>
          <span className="bin-thumb title-thumb">Aa</span>
          <span>Title</span>
        </button>
      </div>
      <button className="btn wide" onClick={() => input.current?.click()}>
        Import video or image
      </button>
      <input
        ref={input}
        type="file"
        accept="video/*,image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onImport(e.target.files)
          e.target.value = ''
        }}
      />
      <p className="muted small">Files stay on your machine. Nothing is uploaded.</p>
    </aside>
  )
}
