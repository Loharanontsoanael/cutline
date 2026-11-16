/** The editor's icon set: 16 px line icons drawn on one grid, so they sit on the text baseline at any size. */
const PATHS = {
  undo: 'M6 3 2.5 6.5 6 10M3 6.5h6.5a4 4 0 0 1 0 8H7',
  redo: 'M10 3l3.5 3.5L10 10M13 6.5H6.5a4 4 0 0 0 0 8H9',
  cut: 'M4.2 4.2 13 13M4.2 11.8 13 3M3.5 5.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM3.5 14.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z',
  trash: 'M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.6 8.5h6.8l.6-8.5M6.7 7v3.8M9.3 7v3.8',
  magnet: 'M3 2.5h3v6a2 2 0 0 0 4 0v-6h3v6a5 5 0 0 1-10 0v-6ZM3 5h3M10 5h3',
  keyboard: 'M1.5 4h13v8h-13zM4 6.5h1M7.5 6.5h1M11 6.5h1M4.5 9.5h7',
  play: 'M4.5 2.8v10.4L13 8z',
  pause: 'M4.5 3v10M11.5 3v10',
  start: 'M3.5 3v10M13 3.2v9.6L5.8 8z',
  end: 'M12.5 3v10M3 3.2v9.6L10.2 8z',
  back: 'M10.5 3.2v9.6L4 8z',
  forward: 'M5.5 3.2v9.6L12 8z',
  note: 'M6 12.2V3.5l7-1.5v8.7M6 12.2a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0ZM13 10.7a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0Z',
  mic: 'M8 1.8a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0v-4a2 2 0 0 0-2-2ZM3.8 7.5a4.2 4.2 0 0 0 8.4 0M8 11.7v2.5',
  stop: 'M4 4h8v8H4z',
} as const

export type IconName = keyof typeof PATHS

const FILLED: ReadonlySet<IconName> = new Set(['play', 'start', 'end', 'back', 'forward', 'stop'])

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const filled = FILLED.has(name)
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 1 : 1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
