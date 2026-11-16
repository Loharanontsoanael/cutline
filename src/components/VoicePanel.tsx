import { useState } from 'react'
import { Icon } from './Icon'
import { DEFAULT_VOICE_ID, saveApiKey, savedApiKey } from '../lib/voice'

interface Props {
  recording: boolean
  onGenerate: (text: string, apiKey: string, voiceId: string) => Promise<void>
  onToggleRecord: () => void
}

/** Write a line, get a voice clip and its caption on the timeline. */
export function VoicePanel({ recording, onGenerate, onToggleRecord }: Props) {
  const [text, setText] = useState('')
  const [apiKey, setApiKey] = useState(savedApiKey)
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID)
  const [busy, setBusy] = useState(false)
  const ready = text.trim().length > 0 && apiKey.trim().length > 0 && !busy

  async function generate() {
    setBusy(true)
    saveApiKey(apiKey.trim())
    try {
      await onGenerate(text.trim(), apiKey.trim(), voiceId.trim() || DEFAULT_VOICE_ID)
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="voice-panel">
      <h3 className="bin-heading">Voiceover</h3>
      <textarea
        rows={3}
        value={text}
        placeholder="Type a line of narration…"
        aria-label="Narration text"
        onChange={(e) => setText(e.target.value)}
      />
      <details>
        <summary className="muted small">ElevenLabs settings</summary>
        <label className="field">
          <span>API key</span>
          <input type="password" value={apiKey} autoComplete="off" onChange={(e) => setApiKey(e.target.value)} />
        </label>
        <label className="field">
          <span>Voice ID</span>
          <input type="text" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} />
        </label>
        <p className="muted small">The key stays in this browser and is only sent to api.elevenlabs.io.</p>
      </details>
      <button className="btn wide" onClick={generate} disabled={!ready} title={apiKey ? 'Add the voice and its caption at the playhead' : 'Add your API key first'}>
        {busy ? 'Generating…' : 'Generate voice + caption'}
      </button>
      <button className={`btn wide ${recording ? 'recording' : ''}`} onClick={onToggleRecord}>
        <Icon name={recording ? 'stop' : 'mic'} size={14} /> {recording ? 'Stop recording' : 'Record with microphone'}
      </button>
      <p className="muted small">Music lowers itself while a voice clip plays.</p>
    </div>
  )
}
