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
