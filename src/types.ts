export type SceneKind = 'sunset' | 'ocean' | 'city' | 'aurora' | 'orbit'

export type MediaSource =
  | { kind: 'scene'; scene: SceneKind }
  | { kind: 'image'; url: string; fileName: string }
  | { kind: 'video'; url: string; fileName: string; length: number }

/** All values are normalised: -1..1 for bipolar controls, 0..1 for the others. */
export interface Grade {
  exposure: number
  contrast: number
  saturation: number
  temperature: number
  tint: number
  fade: number
  vignette: number
  grain: number
}

export type TransitionKind = 'none' | 'crossfade' | 'dip' | 'slide' | 'wipe' | 'zoom'

export interface Transition {
  kind: TransitionKind
  duration: number
}

interface ClipBase {
  id: string
  start: number
  duration: number
}

export interface VideoClip extends ClipBase {
  track: 'video'
  name: string
  source: MediaSource
  /** Where the clip starts inside its source, in seconds. */
  offset: number
  grade: Grade
  presetId: string | null
  transitionIn: Transition
}

export type TitlePosition = 'top' | 'center' | 'bottom'
export type TitleAnimation = 'fade' | 'rise' | 'typewriter'

export interface TitleClip extends ClipBase {
  track: 'title'
  text: string
  size: number
  position: TitlePosition
  animation: TitleAnimation
}

export type Clip = VideoClip | TitleClip
export type TrackId = Clip['track']

export interface Project {
  clips: Clip[]
}
