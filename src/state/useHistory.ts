import { useCallback, useReducer } from 'react'
import type { Project } from '../types'

interface HistoryState {
  past: Project[]
  present: Project
  future: Project[]
  /** Snapshot taken when a drag starts, so the whole drag is one undo step. */
  gestureBase: Project | null
}

type HistoryAction =
  | { type: 'commit'; project: Project }
  | { type: 'beginGesture' }
  | { type: 'preview'; project: Project }
  | { type: 'endGesture' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; project: Project }

const LIMIT = 100

function reducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'commit':
      if (action.project === state.present) return state
      return { past: [...state.past, state.present].slice(-LIMIT), present: action.project, future: [], gestureBase: null }
    case 'beginGesture':
      return { ...state, gestureBase: state.present }
    case 'preview':
      return { ...state, present: action.project }
    case 'endGesture': {
      const base = state.gestureBase
      if (!base || base === state.present) return { ...state, gestureBase: null }
      return { past: [...state.past, base].slice(-LIMIT), present: state.present, future: [], gestureBase: null }
    }
    case 'undo': {
      if (!state.past.length) return state
      const previous = state.past[state.past.length - 1]
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], gestureBase: null }
    }
    case 'redo': {
      if (!state.future.length) return state
      const [next, ...rest] = state.future
      return { past: [...state.past, state.present], present: next, future: rest, gestureBase: null }
    }
    case 'reset':
      return { past: [], present: action.project, future: [], gestureBase: null }
  }
}

export function useHistory(initial: () => Project) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    past: [],
    present: initial(),
    future: [],
    gestureBase: null,
  }))

  return {
    project: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    commit: useCallback((project: Project) => dispatch({ type: 'commit', project }), []),
    beginGesture: useCallback(() => dispatch({ type: 'beginGesture' }), []),
    preview: useCallback((project: Project) => dispatch({ type: 'preview', project }), []),
    endGesture: useCallback(() => dispatch({ type: 'endGesture' }), []),
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
    reset: useCallback((project: Project) => dispatch({ type: 'reset', project }), []),
  }
}
