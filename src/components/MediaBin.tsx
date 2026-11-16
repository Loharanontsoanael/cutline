import { useRef } from 'react'
import type { SceneKind, SynthKind } from '../types'
import { SYNTHS } from '../lib/audio'
import { SCENES } from '../lib/scenes'
import { Icon } from './Icon'
import { VoicePanel } from './VoicePanel'

interface Props {
  onAddScene: (kind: SceneKind) => void
  onAddTitle: () => void
  onAddSynth: (kind: SynthKind) => void
  onImport: (files: FileList) => void
  recording: boolean
  onGenerateVoice: (text: string, apiKey: string, voiceId: string) => Promise<void>
  onToggleRecord: () => void
}

export function MediaBin({ onAddScene, onAddTitle, onAddSynth, onImport, recording, onGenerateVoice, onToggleRecord }: Props) {
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
      <h3 className="bin-heading">Music</h3>
      <div className="bin-list">
        {SYNTHS.map((s) => (
          <button key={s.kind} className="bin-row" onClick={() => onAddSynth(s.kind)} title={`Add ${s.name} to the audio track`}>
            <span className="bin-row-icon">
              <Icon name="note" size={14} />
            </span>
            <span className="bin-row-text">
              {s.name}
              <span className="muted small">{s.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <VoicePanel recording={recording} onGenerate={onGenerateVoice} onToggleRecord={onToggleRecord} />
      <h3 className="bin-heading">Your files</h3>
      <button className="btn wide" onClick={() => input.current?.click()}>
        Import video, image or audio
      </button>
      <input
        ref={input}
        type="file"
        accept="video/*,image/*,audio/*"
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
