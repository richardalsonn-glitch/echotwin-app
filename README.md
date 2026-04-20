# Bendeki Sen

## Local Development

```powershell
pnpm.cmd install
pnpm.cmd run dev
```

App runs at `http://localhost:3000`.

## AI Provider

The app uses OpenRouter as the default AI provider. All AI calls go through the shared service layer in `artifacts/echotwin/src/lib/ai`.

Required environment variables:

```env
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_URL=http://localhost:3000
OPENROUTER_APP_NAME=Bendeki Sen
```

Optional legacy OpenAI-compatible variables are still supported as a fallback:

```env
AI_INTEGRATIONS_OPENAI_API_KEY=
AI_INTEGRATIONS_OPENAI_BASE_URL=
```

## Voice Input

Chat supports voice input as an MVP: the user records audio in the browser, the app sends it to `/api/transcribe`, OpenAI speech-to-text converts it to text, and the existing `/api/chat` flow responds with a written message. The app does not generate voice replies or clone voices.

Voice transcription uses OpenAI directly. Configure these variables in `artifacts/echotwin/.env.local`:

```env
AI_TRANSCRIBE_OPENAI_API_KEY=
AI_TRANSCRIBE_OPENAI_BASE_URL=https://api.openai.com/v1
AI_TRANSCRIBE_OPENAI_MODEL=gpt-4o-mini-transcribe
```

If `AI_TRANSCRIBE_OPENAI_API_KEY` is omitted, the app falls back to `AI_INTEGRATIONS_OPENAI_API_KEY`.

## Model Routing

Persona analysis:

1. `openai/gpt-oss-120b:free`
2. `meta-llama/llama-3.3-70b-instruct:free`
3. `openrouter/free`

Persona chat:

1. `meta-llama/llama-3.3-70b-instruct:free`
2. `minimax/minimax-m2.5:free`
3. `openrouter/free`

Fast reply:

1. `minimax/minimax-m2.5:free`
2. `openrouter/free`

The agent layer automatically falls back on retryable provider errors such as rate limits, timeouts, and upstream 5xx responses.
