import { describe, expect, it } from 'vitest'
import type { Project } from '../types'
import { historyReducer, type HistoryState } from './useHistory'

const project = (n: number): Project => ({ clips: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, track: 'title', text: '', start: i, duration: 1, size: 40, position: 'center', animation: 'fade' })) })
const start = (p: Project): HistoryState => ({ past: [], present: p, future: [], gestureBase: null })

describe('history', () => {
  it('undoes and redoes a commit', () => {
    const a = project(1)
    const b = project(2)
    let s = historyReducer(start(a), { type: 'commit', project: b })
    s = historyReducer(s, { type: 'undo' })
    expect(s.present).toBe(a)
    s = historyReducer(s, { type: 'redo' })
    expect(s.present).toBe(b)
  })

  it('turns a whole drag into one undo step', () => {
    const a = project(1)
    let s = historyReducer(start(a), { type: 'beginGesture' })
    for (let n = 2; n < 6; n++) s = historyReducer(s, { type: 'preview', project: project(n) })
    s = historyReducer(s, { type: 'endGesture' })
    expect(s.past).toEqual([a])
    expect(historyReducer(s, { type: 'undo' }).present).toBe(a)
  })

  it('adds no step for a gesture that changed nothing', () => {
    let s = historyReducer(start(project(1)), { type: 'beginGesture' })
    s = historyReducer(s, { type: 'endGesture' })
    expect(s.past).toHaveLength(0)
  })

  it('drops the redo stack on a new edit', () => {
    let s = historyReducer(start(project(1)), { type: 'commit', project: project(2) })
    s = historyReducer(s, { type: 'undo' })
    s = historyReducer(s, { type: 'commit', project: project(3) })
    expect(s.future).toHaveLength(0)
  })
})
