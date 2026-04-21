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
