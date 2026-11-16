# Cutline

A small video editor that runs entirely in the browser. It focuses on what editors care about every day: getting a good look fast, cutting precisely on a timeline, mixing voice and music without thinking about it, and keeping the keyboard shortcuts their hands already know.

![Cutline screenshot](docs/screenshot.jpg)

## What it does

**Timeline**
- Move clips by dragging, trim them from either edge, cut at the playhead.
- Snapping to the playhead and to every edit point, with a guide line while you drag.
- Ripple delete or delete with a gap, undo and redo for every edit (a whole drag is one undo step).
- Zoom with the slider, the keyboard or Ctrl / ⌘ + scroll.

**Looks in one click**
- Seven grading presets (Cinematic, Teal & Orange, Vintage, Noir, Vivid, Moonlight, Original). Each preset sets eight controls at once: exposure, contrast, saturation, temperature, tint, fade, vignette and grain.
- Preset thumbnails render the selected clip's current frame, so you choose a look by seeing it.
- Fine-tune any control afterwards, or apply the same look to every clip.

**Sound**
- A music track and a voice track, each clip drawn as a waveform.
- Volume, fade in and fade out per clip. The waveform shows the result, not the raw file.
- Automatic ducking: music drops to 30% under a voice clip and comes back after it, with a short ramp on each side.
- Three generated music beds (Pulse, Ambient, Keys) that loop without a click, so the demo has sound without any download.
- Voiceover from text through the ElevenLabs API: type a line, get the voice clip and its caption on the timeline. You bring your own API key; it stays in the browser.
- Voiceover from the microphone.
- Playback follows the audio clock, so picture and sound stay in sync.

**Transitions and titles**
- Cross dissolve, dip to black, slide, wipe and zoom between two clips, with adjustable duration.
- Titles with fade, rise or typewriter animations.

**Shortcuts for people coming from other editors**
- Switch between Cutline, Premiere Pro and Final Cut Pro layouts in one click (top right, or press `?`).
- Example: cut at playhead is `S` in Cutline, `Ctrl/⌘ + K` in Premiere Pro and `⌘ + B` in Final Cut Pro. In the Final Cut layout, Delete closes the gap like the magnetic timeline does.
- Click any shortcut in the sheet to rebind it. Conflicting keys are removed from the other action.
- J / K / L shuttle, frame stepping, previous and next edit point.

**Media and export**
- Five generated demo scenes, so the project works without uploading anything.
- Import your own videos, images and audio files. Files stay on your machine.
- Export the timeline to WebM with its sound, in real time (Chrome, Edge, Firefox).
- The project autosaves in the browser.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

```bash
npm test          # unit tests for the edit, sound and undo logic
npm run check     # type check, lint, tests and production build (what CI runs)
npm run preview   # serve the production build
```

## Deploy on Vercel

Import the repository in Vercel. It detects Vite automatically: build command `npm run build`, output folder `dist`.

## How it is built

React 19, TypeScript, Vite. No UI, video or audio library.

The project is plain data, every edit is a pure function on it, and picture and sound are both computed from that data and a time. That one rule is what makes undo, scrubbing, thumbnails, waveforms and export agree with each other.

```
src/
  types.ts              the project model: video, title, music and voice clips
  lib/
    project.ts          pure edits (split, ripple, slots, bounds) and the gain maths (fades, ducking)
    renderer.ts         draws one frame for a project and a time
    grades.ts           colour grading with canvas filters and blend modes
    audio.ts            generated beds, waveform peaks, Web Audio scheduling
    voice.ts            ElevenLabs text to speech and microphone recording
    exporter.ts         records picture and mix into one WebM
    keymaps.ts          actions defined once, mapped to each keyboard layout
  state/
    useHistory.ts       undo and redo; a drag or a slider move is one step
    usePlayback.ts      the transport; the playhead follows the audio clock
  components/           timeline, preview, inspector, media panel, waveform, meter
```

- **One source of truth for gain.** `mixGainAt` in `project.ts` gives the level of a clip at any time. The waveform draws it and the audio engine plays it, so what you see is what you hear.
- **Sound is scheduled, not polled.** On play, every clip is scheduled once on the Web Audio clock and the browser mixes them. The playhead reads that clock.
- **Tested where it matters.** The pure logic (cuts, ripple delete, free slots, fades, ducking, undo steps) has unit tests. CI runs type check, lint, tests and build on every push.

## Limits and next steps

- One video track and one title track. Next: more tracks and drag between them.
- One music track and one voice track. Sound from imported video files is not played yet.
- Voice generation needs your own ElevenLabs API key. It was built against the public text-to-speech endpoint and is the one part not covered by an automated test.
- Export runs in real time through MediaRecorder. A WebCodecs encoder would make it faster than real time and allow MP4.
- The keyboard layouts cover the most used shortcuts, not the full Premiere Pro or Final Cut Pro sets.
