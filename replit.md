# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains **Bendeki Sen** — a premium Turkish-language PWA that lets users upload WhatsApp chat exports and chat with AI that mimics a person's communication style.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9

### Bendeki Sen App (`artifacts/echotwin`)
- **Framework**: Next.js 15 (App Router) + React 19
- **Styling**: Tailwind CSS v4 + shadcn/ui (new-york style)
- **Auth + DB**: Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- **AI**: OpenAI via Replit proxy (`AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`)
- **Themes**: next-themes (dark default)
- **Animations**: framer-motion
- **Notifications**: sonner
- **Port**: 23097

### API Server (`artifacts/api-server`)
- **Framework**: Express 5
- **Port**: 8080

## Key Features (Phase 1 MVP)
- WhatsApp .txt export parser (multi-format support)
- AI persona extraction (tone, style, emoji, phrases, patterns)
- Streaming chat with typing delay simulation
- 3-message free tier limit → upgrade flow
- Auth routes: /login, /register
- App routes: /home, /onboarding/upload, /onboarding/select, /onboarding/analyzing, /chat/[personaId], /profile/[personaId], /upgrade

## Parser Enhancements
Each ParsedMessage includes:
- `conversation_turn_index`: sequential turn number
- `is_reply`: whether this message follows a different sender
- `message_length`: character count
- `has_question`: contains "?" or question words (TR+EN)

## AI Configuration
- Analysis model: `gpt-5.2` (persona extraction)
- Chat model (free): `gpt-5-mini`
- Chat model (full): `gpt-5.2`
- Parameters: `max_completion_tokens` (NOT max_tokens), NO temperature param
- Analysis output: strict JSON only (PersonaAnalysis type)

## Database (Supabase)
Tables (created via SUPABASE_SETUP.sql):
- `user_profiles` — extends auth.users, stores subscription_tier
- `chat_exports` — parsed WhatsApp file metadata + stats
- `chat_messages_cache` — stores parsed messages as JSONB for AI analysis
- `personas` — AI clones with analysis JSONB
- `messages` — chat history per persona

All tables have RLS policies (anon key only, no service role key).

## Subscription Tiers
- `free`: 1 persona, 3 messages/month
- `basic`: 3 personas, 200 messages/month
- `full`: unlimited personas, unlimited messages, gpt-5.2

## Environment Variables (Secrets)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI proxy URL
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI proxy key

## Setup Required
User must run `artifacts/echotwin/SUPABASE_SETUP.sql` in Supabase SQL Editor to create tables.

## Key Commands

- `pnpm --filter @workspace/echotwin run dev` — run EchoTwin Next.js app
- `pnpm --filter @workspace/api-server run dev` — run API server
- `pnpm run typecheck` — full typecheck across all packages
