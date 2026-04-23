# BendekiSen

## Runtime AI Architecture

The runtime AI layer is intentionally limited to two active providers:

- **Gemini 2.5 Flash** for chat/persona analysis, conversation generation, and image interpretation.
- **ElevenLabs Creator** for voice cloning and text-to-speech.

OpenRouter, Anthropic, and `AI_INTEGRATIONS_OPENAI_*` are no longer part of the
runtime AI work.

Required env:

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

ELEVENLABS_API_KEY=
ELEVENLABS_TTS_MODEL=eleven_multilingual_v2
ELEVENLABS_DEFAULT_VOICE_ID=
```

## AI Service Surface

Core service functions:

- `analyzeChat(messages)` -> structured persona JSON
- `analyzeImage(image)` -> image interpretation JSON/text
- `createVoiceClone(audioSample)` -> ElevenLabs voice profile
- `synthesizeSpeech(text, voiceId)` -> MP3 audio

API routes:

- `POST /api/analyze/chat`
- `POST /api/analyze/image`
- `POST /api/voice/clone`
- `POST /api/voice/speak`

The existing onboarding analyze flow still uses `/api/analyze`, but that route
now runs through the Gemini-backed resilient analysis pipeline.

## Voice Input

User voice input is handled by `/api/transcribe` and transcribed with Gemini.
The browser still records audio with `MediaRecorder`, but the runtime AI stack
stays limited to Gemini and ElevenLabs.

## Target Voice Profile and One-Time AI Voice Message

Target voice samples are Full-plan only. Free and Basic users see the uploader in
the persona creation screen, but it is locked. Full users can optionally upload a
target voice sample before analysis starts.

The uploaded sample is stored in the `voice-samples` Supabase Storage bucket.
ElevenLabs creates the cloned voice and stores its `voice_id` in persona voice
metadata. After the 5th AI text reply, `/api/voice-message` generates one MP3
with ElevenLabs TTS and stores it in the `voice-messages` bucket. If generation
fails, chat falls back to text only.

Run `SUPABASE_SETUP.sql` after pulling schema changes so the required columns and
storage buckets exist.

## Chat Uploads with Media

The onboarding upload screen accepts both:

- `.txt` WhatsApp exports without media
- `.zip` WhatsApp exports with `_chat.txt` plus media files

ZIP parsing is best-effort. The text chat is always parsed first. If individual
media files cannot be matched or uploaded, the app keeps the text history and
stores a warning in `parsed_data.parse_warnings`.

## Photo Messages

Users can send photos from the chat input. The photo is uploaded to Supabase
Storage, saved as a user `image` message, interpreted with Gemini, and then the
persona chat pipeline generates a normal text reply.

## Media Limits

- Audio files: 50 MB
- Photo files: 50 MB
- Chat upload files (`.txt` or `.zip`): 50 MB
