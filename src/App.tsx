import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Clip, ClipPatch, Grade, Project, SceneKind, SynthKind } from './types'
import { Inspector } from './components/Inspector'
import { MediaBin } from './components/MediaBin'
import { Preview } from './components/Preview'
import { ShortcutSheet } from './components/ShortcutSheet'
import { Timeline } from './components/Timeline'
import { loadAudioFile } from './lib/audio'
import { downloadBlob, exportMime, exportProject } from './lib/exporter'
import { ACTIONS, comboFromEvent, displayCombo, findAction, KEYMAPS, type ActionId, type Bindings } from './lib/keymaps'
import {
  addClip,
  clipsAt,
  demoProject,
  editPoints,
  FPS,
  freeSlot,
  isAudio,
  makeAudioClip,
  makeMediaClip,
  makeSceneClip,
  makeTitle,
  removeClip,
  snapToFrame,
  splitClip,
  synthName,
  updateClip,
} from './lib/project'
import { loadMedia } from './lib/renderer'
import { startRecording, synthesize, type Recording } from './lib/voice'
import { useHistory } from './state/useHistory'
import { usePlayback } from './state/usePlayback'

const STORAGE_KEY = 'cutline.v2'

interface Saved {
  project: Project
  keymapId: string
  custom: Bindings | null
}

function readSaved(): Partial<Saved> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<Saved>) : {}
  } catch {
    return {}
  }
}

/** Imported files live in object URLs that die on reload, so only generated clips are saved. */
function persistable(p: Project): Project {
  return { clips: p.clips.filter((c) => c.track === 'title' || c.source.kind === 'scene' || c.source.kind === 'synth') }
}

export default function App() {
  const [saved] = useState(readSaved)
  const history = useHistory(() => (saved.project?.clips?.length ? saved.project : demoProject()))
  const { project } = history

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pxPerSec, setPxPerSec] = useState(60)
  const [snapping, setSnapping] = useState(true)
  const [keymapId, setKeymapId] = useState(saved.keymapId ?? 'cutline')
  const [custom, setCustom] = useState<Bindings | null>(saved.custom ?? null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [exportProgress, setExportProgress] = useState<number | null>(null)
  const { time, timeRef, rate, setRate, seek, duration } = usePlayback(project, exportProgress !== null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gestureRef = useRef(false)
  const projectRef = useRef(project)
  useLayoutEffect(() => {
    projectRef.current = project
  })
  const recordingRef = useRef<Recording | null>(null)
  const [recording, setRecording] = useState(false)

  const keymap = KEYMAPS.find((k) => k.id === keymapId) ?? KEYMAPS[0]
  const bindings = custom ?? keymap.bindings
  const selected = project.clips.find((c) => c.id === selectedId) ?? null

  const toastTimer = useRef<number | undefined>(undefined)
  const notify = useCallback((message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  // Autosave
  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ project: persistable(project), keymapId, custom }))
      } catch {
        /* storage full or blocked: editing still works */
      }
    }, 400)
    return () => window.clearTimeout(handle)
  }, [project, keymapId, custom])

  // ---------- editing helpers ----------

  const beginGesture = useCallback(() => {
    gestureRef.current = true
    history.beginGesture()
  }, [history])

  const endGesture = useCallback(() => {
    gestureRef.current = false
    history.endGesture()
  }, [history])

  const patchClip = useCallback(
    (id: string, patch: ClipPatch) => {
      const next = updateClip(project, id, patch)
      if (gestureRef.current) history.preview(next)
      else history.commit(next)
    },
    [project, history],
  )

  function addScene(kind: SceneKind) {
    const start = freeSlot(project, 'video', snapToFrame(time), 4)
    const clip = makeSceneClip(kind, start, 4)
    history.commit(addClip(project, clip))
    setSelectedId(clip.id)
  }

  function addTitle() {
    const start = freeSlot(project, 'title', snapToFrame(time), 3)
    const clip = makeTitle(start)
    history.commit(addClip(project, clip))
    setSelectedId(clip.id)
  }

  function addSynth(kind: SynthKind) {
    const start = freeSlot(project, 'audio', snapToFrame(time), 8)
    const clip = makeAudioClip({ kind: 'synth', synth: kind }, synthName(kind), start, 8)
    history.commit(addClip(project, clip))
    setSelectedId(clip.id)
  }

  /** Puts a voice take on the VO track at the playhead, with its text as a caption when there is one. */
  async function addVoice(blob: Blob, name: string, caption?: string) {
    const sound = await loadAudioFile(blob)
    const base = projectRef.current
    const start = freeSlot(base, 'voice', snapToFrame(timeRef.current), sound.length)
    const clip = makeAudioClip({ kind: 'file', url: sound.url, fileName: name, length: sound.length }, name, start, sound.length, 'voice')
    let next = addClip(base, clip)
    if (caption) {
      const title = makeTitle(freeSlot(next, 'title', start, sound.length), caption, sound.length)
      title.size = 40
      title.position = 'bottom'
      title.animation = 'fade'
      next = addClip(next, title)
    }
    history.commit(next)
    setSelectedId(clip.id)
  }

  async function generateVoice(text: string, apiKey: string, voiceId: string) {
    try {
      await addVoice(await synthesize(text, apiKey, voiceId), text.slice(0, 24), text)
      notify('Voice and caption added at the playhead')
    } catch (error) {
      notify(`ElevenLabs: ${error instanceof Error ? error.message : 'request failed'}`)
      throw error
    }
  }

  async function toggleRecord() {
    try {
      if (recordingRef.current) {
        const take = recordingRef.current
        recordingRef.current = null
        setRecording(false)
        await addVoice(await take.stop(), 'Recording')
        return
      }
      setRate(0)
      recordingRef.current = await startRecording()
      setRecording(true)
    } catch {
      setRecording(false)
      notify('Could not use the microphone')
    }
  }

  async function importFiles(files: FileList) {
    let next = project
    let lastId: string | null = null
    for (const file of Array.from(files)) {
      try {
        if (file.type.startsWith('audio/')) {
          const sound = await loadAudioFile(file)
          const start = freeSlot(next, 'audio', snapToFrame(timeRef.current), sound.length)
          const source = { kind: 'file', url: sound.url, fileName: file.name, length: sound.length } as const
          const clip = makeAudioClip(source, file.name.replace(/\.[^.]+$/, ''), start, sound.length)
          next = addClip(next, clip)
          lastId = clip.id
          continue
        }
        const media = await loadMedia(file)
        const length = media.kind === 'video' ? media.length : 4
        const start = freeSlot(next, 'video', snapToFrame(timeRef.current), length)
        const source =
          media.kind === 'video'
            ? ({ kind: 'video', url: media.url, fileName: file.name, length: media.length } as const)
            : ({ kind: 'image', url: media.url, fileName: file.name } as const)
        const clip = makeMediaClip(source, file.name.replace(/\.[^.]+$/, ''), start, Math.min(length, 60))
        next = addClip(next, clip)
        lastId = clip.id
      } catch {
        notify(`Could not read ${file.name}`)
      }
    }
    if (next !== project) {
      history.commit(next)
      setSelectedId(lastId)
    }
  }

  function applyLookToAll(grade: Grade, presetId: string | null) {
    history.commit({
      clips: project.clips.map((c) => (c.track === 'video' ? { ...c, grade: { ...grade }, presetId } : c)),
    })
    notify('Look applied to every clip')
  }

  function splitAtPlayhead() {
    const t = timeRef.current
    const under = clipsAt(project, t)
    const target: Clip | undefined = under.find((c) => c.id === selectedId) ?? under.find((c) => c.track === 'video') ?? under.find((c) => !isAudio(c)) ?? under[0]
    if (!target) {
      notify('Move the playhead over a clip to cut it')
      return
    }
    const { project: next, newId } = splitClip(project, target.id, t)
    if (newId) {
      history.commit(next)
      setSelectedId(newId)
    }
  }

  function deleteSelected(ripple: boolean) {
    if (!selectedId) return
    history.commit(removeClip(project, selectedId, ripple))
    setSelectedId(null)
  }

  function goToEdit(direction: 1 | -1) {
    const points = editPoints(project)
    const t = timeRef.current
    const target = direction > 0 ? points.find((p) => p > t + 1e-3) : [...points].reverse().find((p) => p < t - 1e-3)
    if (target !== undefined) {
      setRate(0)
      seek(target)
    }
  }

  function togglePlay() {
    if (rate !== 0) setRate(0)
    else {
      if (timeRef.current >= duration - 1e-3) seek(0)
      setRate(1)
    }
  }

  function zoom(px: number) {
    setPxPerSec(Math.min(240, Math.max(15, px)))
  }

  function selectKeymap(id: string) {
    setKeymapId(id)
    setCustom(null)
    const k = KEYMAPS.find((x) => x.id === id)!
    notify(`${k.name} shortcuts on. Cut at playhead is now ${displayCombo(k.bindings.split[0])}`)
  }

  function rebind(action: ActionId, combo: string) {
    const base = custom ?? keymap.bindings
    const next = Object.fromEntries(
      (Object.keys(base) as ActionId[]).map((a) => [a, a === action ? [combo] : base[a].filter((c) => c !== combo)]),
    ) as Bindings
    setCustom(next)
    const label = ACTIONS.find((a) => a.id === action)!.label
    notify(`${label} is now ${displayCombo(combo)}`)
  }

  const run = (action: ActionId) => {
    switch (action) {
      case 'playPause':
        return togglePlay()
      case 'stop':
        return setRate(0)
      case 'shuttleForward':
        return setRate((r) => (r <= 0 ? 1 : Math.min(r * 2, 8)))
      case 'shuttleBack':
        return setRate((r) => (r >= 0 ? -1 : Math.max(r * 2, -8)))
      case 'split':
        return splitAtPlayhead()
      case 'delete':
        return deleteSelected(false)
      case 'rippleDelete':
        return deleteSelected(true)
      case 'undo':
        return history.undo()
      case 'redo':
        return history.redo()
      case 'frameBack':
        setRate(0)
        return seek(snapToFrame(timeRef.current) - 1 / FPS)
      case 'frameForward':
        setRate(0)
        return seek(snapToFrame(timeRef.current) + 1 / FPS)
      case 'goStart':
        setRate(0)
        return seek(0)
      case 'goEnd':
        setRate(0)
        return seek(duration)
      case 'prevEdit':
        return goToEdit(-1)
      case 'nextEdit':
        return goToEdit(1)
      case 'zoomIn':
        return zoom(pxPerSec * 1.25)
      case 'zoomOut':
        return zoom(pxPerSec / 1.25)
      case 'toggleSnap':
        setSnapping((s) => !s)
        return notify(`Snapping ${snapping ? 'off' : 'on'}`)
    }
  }

  const runRef = useRef(run)
  useLayoutEffect(() => {
    runRef.current = run
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (showShortcuts || exportProgress !== null) return
      const target = e.target as HTMLElement
      const typing = target.closest('input[type=text], textarea, select, [contenteditable=true]')
      if (typing) return
      if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts(true)
        return
      }
      if (e.key === 'Escape') {
        setSelectedId(null)
        return
      }
      const combo = comboFromEvent(e)
      if (!combo) return
      const action = findAction(bindings, combo)
      if (!action) return
      e.preventDefault()
      runRef.current(action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bindings, showShortcuts, exportProgress])

  async function exportVideo() {
    const canvas = canvasRef.current
    if (!canvas || duration <= 0) return
    if (!exportMime(project)) {
      notify('This browser cannot record video. Try Chrome or Firefox.')
      return
    }
    setRate(0)
    setSelectedId(null)
    setExportProgress(0)
    try {
      downloadBlob(await exportProject(canvas, project, setExportProgress), 'cutline-export.webm')
      notify('Export ready: cutline-export.webm')
    } catch {
      notify('Export failed. Keep this tab in front and try again.')
    } finally {
      setExportProgress(null)
      seek(0)
    }
  }

  function resetDemo() {
    history.reset(demoProject())
    setSelectedId(null)
    seek(0)
    notify('Demo project restored')
  }

  const splitKey = bindings.split[0] ? displayCombo(bindings.split[0]) : ''

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◐
          </span>
          <span>Cutline</span>
        </div>
        <div className="toolbar" role="toolbar" aria-label="Editing">
          <button className="btn ghost" onClick={history.undo} disabled={!history.canUndo} title="Undo">
            ↶ Undo
          </button>
          <button className="btn ghost" onClick={history.redo} disabled={!history.canRedo} title="Redo">
            ↷ Redo
          </button>
          <span className="sep" />
          <button className="btn ghost" onClick={splitAtPlayhead} title={`Cut at playhead (${splitKey})`}>
            ✂ Cut <kbd>{splitKey}</kbd>
          </button>
          <button className="btn ghost" onClick={() => deleteSelected(true)} disabled={!selectedId} title="Ripple delete">
            🗑 Delete
          </button>
        </div>
        <div className="topbar-right">
          <label className="keymap-select">
            <span className="muted small">Shortcuts</span>
            <select value={custom ? 'custom' : keymapId} onChange={(e) => selectKeymap(e.target.value)} aria-label="Keyboard layout">
              {custom && <option value="custom">Custom</option>}
              {KEYMAPS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn ghost" onClick={() => setShowShortcuts(true)} title="All shortcuts (?)">
            ⌨ ?
          </button>
          <button className="btn ghost" onClick={resetDemo} title="Reload the demo project">
            Demo
          </button>
          <button className="btn primary" onClick={exportVideo} disabled={exportProgress !== null}>
            Export
          </button>
        </div>
      </header>

      <main className="workspace">
        <MediaBin onAddScene={addScene} onAddTitle={addTitle} onAddSynth={addSynth}
          onImport={importFiles}
          recording={recording}
          onGenerateVoice={generateVoice}
          onToggleRecord={toggleRecord}
        />
        <Preview
          project={project}
          time={time}
          rate={rate}
          duration={duration}
          canvasRef={canvasRef}
          onTogglePlay={togglePlay}
          onSeek={(t) => {
            setRate(0)
            seek(t)
          }}
          onStep={(n) => {
            setRate(0)
            seek(snapToFrame(timeRef.current) + n / FPS)
          }}
        />
        <Inspector
          project={project}
          clip={selected}
          time={time}
          playing={rate !== 0}
          onPatch={patchClip}
          onBeginGesture={beginGesture}
          onEndGesture={endGesture}
          onApplyLookToAll={applyLookToAll}
        />
      </main>

      <Timeline
        project={project}
        time={time}
        pxPerSec={pxPerSec}
        selectedId={selectedId}
        snapping={snapping}
        playing={rate !== 0 || exportProgress !== null}
        onSeek={(t) => {
          setRate(0)
          seek(snapToFrame(t))
        }}
        onSelect={setSelectedId}
        onBeginGesture={beginGesture}
        onPreview={history.preview}
        onEndGesture={endGesture}
        onZoom={zoom}
        onToggleSnap={() => setSnapping((s) => !s)}
      />

      {showShortcuts && (
        <ShortcutSheet
          keymaps={KEYMAPS}
          activeId={keymapId}
          bindings={bindings}
          customised={!!custom}
          onSelectKeymap={selectKeymap}
          onRebind={rebind}
          onResetCustom={() => setCustom(null)}
          onClose={() => setShowShortcuts(false)}
        />
      )}

      {exportProgress !== null && (
        <div className="modal-backdrop">
          <div className="modal export" role="dialog" aria-modal="true" aria-label="Exporting">
            <h2>Exporting…</h2>
            <progress value={exportProgress} max={1} />
            <p className="muted small">Rendering picture and sound in real time to WebM. Keep this tab in front.</p>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
