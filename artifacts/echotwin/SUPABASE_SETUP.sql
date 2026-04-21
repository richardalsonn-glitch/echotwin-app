-- ========================================================
-- EchoTwin — Supabase SQL Setup
-- Supabase Dashboard > SQL Editor'da çalıştır
-- ========================================================

-- 1. User Profiles (auth.users'ı extend eder)
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_url text,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'basic', 'full')),
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can view own profile" on public.user_profiles;
create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

-- 2. Chat Exports (parsed WhatsApp files)
create table if not exists public.chat_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  file_name text not null,
  participants jsonb not null default '[]',
  message_count integer not null default 0,
  parsed_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.chat_exports enable row level security;

drop policy if exists "Users can manage own chat exports" on public.chat_exports;
create policy "Users can manage own chat exports"
  on public.chat_exports for all
  using (auth.uid() = user_id);

-- 3. Message Cache (for AI analysis)
create table if not exists public.chat_messages_cache (
  id uuid primary key default gen_random_uuid(),
  export_id uuid references public.chat_exports(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  messages jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.chat_messages_cache enable row level security;

drop policy if exists "Users can manage own message cache" on public.chat_messages_cache;
create policy "Users can manage own message cache"
  on public.chat_messages_cache for all
  using (auth.uid() = user_id);

-- 4. Personas (AI clones)
create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  export_id uuid references public.chat_exports(id) on delete set null,
  target_name text not null,
  requester_name text not null,
  display_name text not null,
  avatar_url text,
  analysis jsonb,
  message_count_used integer not null default 0,
  voice_sample_url text,
  voice_profile_status text not null default 'none' check (voice_profile_status in ('none', 'processing', 'ready', 'failed')),
  voice_enabled boolean not null default false,
  voice_profile_metadata jsonb,
  voice_message_sent boolean not null default false,
  voice_message_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.personas enable row level security;

drop policy if exists "Users can manage own personas" on public.personas;
create policy "Users can manage own personas"
  on public.personas for all
  using (auth.uid() = user_id);

-- 5. Messages (chat history)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid references public.personas(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  message_type text not null default 'text' check (message_type in ('text', 'voice', 'image')),
  audio_url text,
  image_url text,
  audio_duration_seconds integer,
  voice_provider text,
  media_mime_type text,
  media_size_bytes integer,
  media_metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

drop policy if exists "Users can manage own messages" on public.messages;
create policy "Users can manage own messages"
  on public.messages for all
  using (auth.uid() = user_id);

-- 5b. Voice profile / voice message columns for existing installs
alter table public.personas
  add column if not exists voice_sample_url text,
  add column if not exists voice_profile_status text not null default 'none',
  add column if not exists voice_enabled boolean not null default false,
  add column if not exists voice_profile_metadata jsonb,
  add column if not exists voice_message_sent boolean not null default false,
  add column if not exists voice_message_sent_at timestamptz;

alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists audio_url text,
  add column if not exists image_url text,
  add column if not exists audio_duration_seconds integer,
  add column if not exists voice_provider text,
  add column if not exists media_mime_type text,
  add column if not exists media_size_bytes integer,
  add column if not exists media_metadata jsonb;

alter table public.messages
  drop constraint if exists messages_message_type_check;

alter table public.messages
  add constraint messages_message_type_check check (message_type in ('text', 'voice', 'image'));

-- 6. Auto-create user_profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========================================================
-- 7. Storage bucket for profile photos (avatars)
-- ========================================================

-- Create public avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read access
drop policy if exists "Avatars are publicly viewable" on storage.objects;
create policy "Avatars are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated users can upload to their own folder
drop policy if exists "Users can upload own avatars" on storage.objects;
create policy "Users can upload own avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Authenticated users can update their own avatars
drop policy if exists "Users can update own avatars" on storage.objects;
create policy "Users can update own avatars"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Authenticated users can delete their own avatars
drop policy if exists "Users can delete own avatars" on storage.objects;
create policy "Users can delete own avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ========================================================
-- 8. Storage buckets for target voice samples and AI voice messages
-- ========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-samples',
  'voice-samples',
  false,
  52428800,
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a']
)
on conflict (id) do nothing;

update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a']
where id = 'voice-samples';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-messages',
  'voice-messages',
  true,
  10485760,
  array['audio/mpeg', 'audio/mp3']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4',
    'video/mp4', 'video/quicktime', 'application/pdf'
  ]
)
on conflict (id) do nothing;

update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4',
    'video/mp4', 'video/quicktime', 'application/pdf'
  ]
where id = 'chat-media';

drop policy if exists "Users can upload own voice samples" on storage.objects;
create policy "Users can upload own voice samples"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can read own voice samples" on storage.objects;
create policy "Users can read own voice samples"
  on storage.objects for select
  using (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own voice samples" on storage.objects;
create policy "Users can update own voice samples"
  on storage.objects for update
  using (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can upload own voice messages" on storage.objects;
create policy "Users can upload own voice messages"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-messages'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Voice messages are publicly viewable" on storage.objects;
create policy "Voice messages are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'voice-messages');

drop policy if exists "Users can upload own chat media" on storage.objects;
create policy "Users can upload own chat media"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Chat media is publicly viewable" on storage.objects;
create policy "Chat media is publicly viewable"
  on storage.objects for select
  using (bucket_id = 'chat-media');

-- ========================================================
-- DONE! Tabloları kontrol et:
-- Table Editor'da user_profiles, chat_exports,
-- chat_messages_cache, personas, messages tablolarını görmelisin
-- Storage > Buckets'ta "avatars" bucket'ını görmelisin
-- ========================================================
