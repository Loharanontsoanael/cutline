/**
 * Voiceover sources: text to speech through the ElevenLabs API, or the microphone.
 * Both return an audio blob that the editor decodes like any imported file.
 */

export const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
const KEY_STORAGE = 'cutline.elevenlabs-key'

export function savedApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function saveApiKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* storage blocked: the key just is not remembered */
  }
}

/** Speaks `text` with the given voice. The request goes straight from the browser to ElevenLabs. */
export async function synthesize(text: string, apiKey: string, voiceId: string): Promise<Blob> {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  })
  if (!response.ok) {
    let reason = `${response.status}`
    try {
      const body = await response.json()
      reason = body?.detail?.message ?? body?.detail ?? reason
    } catch {
      /* no JSON body */
    }
    throw new Error(typeof reason === 'string' ? reason : `Request failed (${response.status})`)
  }
  return response.blob()
}

export interface Recording {
  stop: () => Promise<Blob>
}

export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  recorder.start()
  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          for (const track of stream.getTracks()) track.stop()
          resolve(new Blob(chunks, { type: recorder.mimeType }))
        }
        recorder.stop()
      }),
  }
}
