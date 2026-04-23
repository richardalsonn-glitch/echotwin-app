# BendekiSen

## Local Development

```powershell
pnpm.cmd install
pnpm.cmd run dev
```

App runs at `http://localhost:3000`.

## Runtime AI Providers

The runtime AI layer is now simplified to two active providers:

- **Gemini 2.5 Flash**: persona/chat analysis, conversation generation, image interpretation.
- **ElevenLabs Creator**: professional voice cloning and text-to-speech.

Required environment variables:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

ELEVENLABS_API_KEY=
ELEVENLABS_TTS_MODEL=eleven_multilingual_v2
ELEVENLABS_DEFAULT_VOICE_ID=
```

OpenRouter, Anthropic, and `AI_INTEGRATIONS_OPENAI_*` are no longer part of the
runtime AI configuration.

## Runtime Service Surface

Core services:

- `analyzeChat(messages)` -> structured persona JSON
- `analyzeImage(image)` -> image interpretation JSON/text
- `createVoiceClone(audioSample)` -> ElevenLabs voice clone
- `synthesizeSpeech(text, voiceId)` -> MP3 audio

API routes:

- `POST /api/analyze/chat`
- `POST /api/analyze/image`
- `POST /api/voice/clone`
- `POST /api/voice/speak`

## Voice Input

Voice input transcription now also runs through Gemini via `/api/transcribe`.
The browser still records audio with `MediaRecorder`, but the transcription
provider is Gemini, so the runtime AI stack stays limited to Gemini and
ElevenLabs.
