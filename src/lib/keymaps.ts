export type ActionId =
  | 'playPause'
  | 'shuttleBack'
  | 'stop'
  | 'shuttleForward'
  | 'split'
  | 'delete'
  | 'rippleDelete'
  | 'undo'
  | 'redo'
  | 'frameBack'
  | 'frameForward'
  | 'goStart'
  | 'goEnd'
  | 'prevEdit'
  | 'nextEdit'
  | 'zoomIn'
  | 'zoomOut'
  | 'toggleSnap'

export const ACTIONS: { id: ActionId; label: string; group: string }[] = [
  { id: 'playPause', label: 'Play / pause', group: 'Playback' },
  { id: 'shuttleBack', label: 'Play backwards (press again to go faster)', group: 'Playback' },
  { id: 'stop', label: 'Stop', group: 'Playback' },
  { id: 'shuttleForward', label: 'Play forwards (press again to go faster)', group: 'Playback' },
  { id: 'frameBack', label: 'Previous frame', group: 'Navigation' },
  { id: 'frameForward', label: 'Next frame', group: 'Navigation' },
  { id: 'prevEdit', label: 'Previous edit point', group: 'Navigation' },
  { id: 'nextEdit', label: 'Next edit point', group: 'Navigation' },
  { id: 'goStart', label: 'Go to start', group: 'Navigation' },
  { id: 'goEnd', label: 'Go to end', group: 'Navigation' },
  { id: 'split', label: 'Cut at playhead', group: 'Editing' },
  { id: 'delete', label: 'Delete (leave gap)', group: 'Editing' },
  { id: 'rippleDelete', label: 'Ripple delete (close gap)', group: 'Editing' },
  { id: 'undo', label: 'Undo', group: 'Editing' },
  { id: 'redo', label: 'Redo', group: 'Editing' },
  { id: 'toggleSnap', label: 'Toggle snapping', group: 'Timeline' },
  { id: 'zoomIn', label: 'Zoom in', group: 'Timeline' },
  { id: 'zoomOut', label: 'Zoom out', group: 'Timeline' },
]

export type Bindings = Record<ActionId, string[]>

export interface Keymap {
  id: string
  name: string
  bindings: Bindings
}

const shared: Pick<Bindings, 'playPause' | 'shuttleBack' | 'stop' | 'shuttleForward' | 'undo' | 'redo' | 'frameBack' | 'frameForward' | 'goStart' | 'goEnd' | 'prevEdit' | 'nextEdit'> = {
  playPause: ['Space'],
  shuttleBack: ['J'],
  stop: ['K'],
  shuttleForward: ['L'],
  undo: ['Mod+Z'],
  redo: ['Mod+Shift+Z'],
  frameBack: ['ArrowLeft'],
  frameForward: ['ArrowRight'],
  goStart: ['Home'],
  goEnd: ['End'],
  prevEdit: ['ArrowUp'],
  nextEdit: ['ArrowDown'],
}

/**
 * Subsets of the default shortcuts of each editor, so someone coming from
 * Premiere Pro or Final Cut Pro can switch their muscle memory in one click.
 */
export const KEYMAPS: Keymap[] = [
  {
    id: 'cutline',
    name: 'Cutline',
    bindings: {
      ...shared,
      redo: ['Mod+Shift+Z', 'Mod+Y'],
      split: ['S'],
      delete: ['Delete', 'Backspace'],
      rippleDelete: ['Shift+Delete', 'Shift+Backspace'],
      toggleSnap: ['N'],
      zoomIn: ['='],
      zoomOut: ['-'],
    },
  },
  {
    id: 'premiere',
    name: 'Premiere Pro',
    bindings: {
      ...shared,
      split: ['Mod+K'],
      delete: ['Delete', 'Backspace'],
      rippleDelete: ['Shift+Delete', 'Shift+Backspace'],
      toggleSnap: ['S'],
      zoomIn: ['='],
      zoomOut: ['-'],
    },
  },
  {
    id: 'fcp',
    name: 'Final Cut Pro',
    bindings: {
      ...shared,
      split: ['Mod+B'],
      // Final Cut's magnetic timeline closes the gap on a plain delete.
      delete: ['Shift+Delete', 'Shift+Backspace'],
      rippleDelete: ['Delete', 'Backspace'],
      toggleSnap: ['N'],
      zoomIn: ['Mod+='],
      zoomOut: ['Mod+-'],
    },
  },
]

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const CODE_NAMES: Record<string, string> = {
  Space: 'Space',
  Equal: '=',
  Minus: '-',
  NumpadAdd: '=',
  NumpadSubtract: '-',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
}

/** Turns a keyboard event into a combo like "Mod+Shift+Z". Returns null for lone modifier keys. */
export function comboFromEvent(e: KeyboardEvent): string | null {
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return null
  let key: string
  if (CODE_NAMES[e.code]) key = CODE_NAMES[e.code]
  else if (e.key.length === 1) key = e.key.toUpperCase()
  else key = e.key
  const parts: string[] = []
  if (isMac ? e.metaKey : e.ctrlKey) parts.push('Mod')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}

const DISPLAY: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Backspace: '⌫',
  Delete: 'Del',
}

export function displayCombo(combo: string): string {
  return combo
    .split('+')
    .map((part) => {
      if (part === 'Mod') return isMac ? '⌘' : 'Ctrl'
      if (part === 'Shift') return isMac ? '⇧' : 'Shift'
      if (part === 'Alt') return isMac ? '⌥' : 'Alt'
      return DISPLAY[part] ?? part
    })
    .join(isMac ? '' : '+')
}

export function findAction(bindings: Bindings, combo: string): ActionId | null {
  for (const action of Object.keys(bindings) as ActionId[]) {
    if (bindings[action].includes(combo)) return action
  }
  return null
}
