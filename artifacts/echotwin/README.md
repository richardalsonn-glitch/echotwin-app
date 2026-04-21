# EchoTwin

## Voice input

User voice input is handled by `/api/transcribe`. The browser records audio with
`MediaRecorder`, sends it as multipart form data, and the backend transcribes it
with OpenAI speech-to-text. The resulting text enters the normal chat pipeline.

Required env:

```bash
AI_TRANSCRIBE_OPENAI_API_KEY=
AI_TRANSCRIBE_OPENAI_BASE_URL=https://api.openai.com/v1
AI_TRANSCRIBE_OPENAI_MODEL=gpt-4o-mini-transcribe
```

## Target voice profile and one-time AI voice message

Target voice samples are Full-plan only. Free and Basic users see the uploader in
the persona creation screen, but it is locked. Full users can optionally upload a
target voice sample before analysis starts.

The uploaded sample is stored in the `voice-samples` Supabase Storage bucket and
the persona row is updated with:

- `voice_sample_url`
- `voice_profile_status`
- `voice_enabled`
- `voice_profile_metadata`
- `voice_message_sent`

After the 5th AI text reply in a chat, the frontend requests `/api/voice-message`.
That endpoint re-checks plan, persona ownership, voice profile readiness, and
`voice_message_sent`. If eligible, it generates one MP3 with the voice service,
stores it in the `voice-messages` bucket, inserts an assistant `voice` message,
and marks the persona as sent. If generation fails, chat falls back to text only.

Current MVP uses the uploaded sample as profile metadata and OpenAI TTS fallback.
The provider is isolated under `src/lib/voice`, so a real clone provider can be
added later without changing the chat flow.

Required env:

```bash
AI_VOICE_OPENAI_API_KEY=
AI_VOICE_OPENAI_BASE_URL=https://api.openai.com/v1
AI_VOICE_OPENAI_TTS_MODEL=gpt-4o-mini-tts
AI_VOICE_OPENAI_TTS_VOICE=verse
```

Run `SUPABASE_SETUP.sql` after pulling this change so the new columns and storage
buckets exist.

## Chat uploads with media

The onboarding upload screen accepts both:

- `.txt` WhatsApp exports without media
- `.zip` WhatsApp exports with `_chat.txt` plus media files

ZIP parsing is best-effort. The text chat is always parsed first. If individual
media files cannot be matched or uploaded, the app keeps the text history and
stores a warning in `parsed_data.parse_warnings`. Matched media references are
stored in `parsed_data.media_memory` and uploaded to the `chat-media` bucket when
they are within the configured limits.

## Photo messages

Users can send photos from the chat input. The photo is uploaded to Supabase
Storage, saved as a user `image` message, analyzed by a vision model, and then
the existing persona chat pipeline generates a normal text reply.

The image analysis layer decides whether the photo is related to the current
conversation, unrelated, or unclear. It also compares against recent uploaded
chat-media memories when available, but only surfaces a memory hint when there is
a strong enough match.

Required env for image analysis:

```bash
AI_IMAGE_OPENROUTER_API_KEY=
AI_IMAGE_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
AI_IMAGE_OPENROUTER_MODEL=openai/gpt-4o-mini
```

`AI_IMAGE_OPENROUTER_API_KEY` is optional when `OPENROUTER_API_KEY` is already
set.

## Media limits

- Audio files: 50 MB
- Photo files: 50 MB
- Chat upload files (`.txt` or `.zip`): 50 MB
