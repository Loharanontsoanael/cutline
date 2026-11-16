import { useEffect, useState } from 'react'
import { ACTIONS, comboFromEvent, displayCombo, type ActionId, type Bindings, type Keymap } from '../lib/keymaps'

interface Props {
  keymaps: Keymap[]
  activeId: string
  bindings: Bindings
  customised: boolean
  onSelectKeymap: (id: string) => void
  onRebind: (action: ActionId, combo: string) => void
  onResetCustom: () => void
  onClose: () => void
}

export function ShortcutSheet(props: Props) {
  const { bindings } = props
  const [recording, setRecording] = useState<ActionId | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (recording) {
        e.preventDefault()
        e.stopPropagation()
        if (e.key === 'Escape') {
          setRecording(null)
          return
        }
        const combo = comboFromEvent(e)
        if (!combo) return
        props.onRebind(recording, combo)
        setRecording(null)
        return
      }
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, props])

  const groups = [...new Set(ACTIONS.map((a) => a.group))]

  return (
    <div className="modal-backdrop" onPointerDown={props.onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onPointerDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h2>Keyboard shortcuts</h2>
            <p className="muted small">Pick the editor your hands already know. Click any shortcut to rebind it.</p>
          </div>
          <button className="icon-btn" onClick={props.onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="segmented keymap-tabs" role="radiogroup" aria-label="Keyboard layout">
          {props.keymaps.map((k) => (
            <button
              key={k.id}
              role="radio"
              aria-checked={props.activeId === k.id}
              className={props.activeId === k.id ? 'on' : ''}
              onClick={() => props.onSelectKeymap(k.id)}
            >
              {k.name}
            </button>
          ))}
        </div>
        {props.customised && (
          <p className="small custom-note">
            You changed some shortcuts. <button className="link-btn" onClick={props.onResetCustom}>Reset to preset</button>
          </p>
        )}
        <div className="shortcut-groups">
          {groups.map((g) => (
            <section key={g}>
              <h3>{g}</h3>
              {ACTIONS.filter((a) => a.group === g).map((a) => (
                <div key={a.id} className="shortcut-row">
                  <span>{a.label}</span>
                  <button
                    className={`keys ${recording === a.id ? 'recording' : ''}`}
                    onClick={() => setRecording(a.id)}
                    aria-label={`Rebind ${a.label}`}
                  >
                    {recording === a.id
                      ? 'Press keys…'
                      : bindings[a.id].map((c) => <kbd key={c}>{displayCombo(c)}</kbd>)}
                  </button>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
