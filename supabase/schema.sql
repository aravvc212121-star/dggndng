-- =====================================================
-- Jobsy / JobPilot — Supabase Database Schema
-- Run this in the Supabase SQL Editor to set up all tables.
-- =====================================================

-- profiles: personalization + resume data (was jobpilot_personalization / jobpilot_profile)
create table if not exists profiles (
  id uuid references auth.users primary key,
  industry text,
  degree_level text,
  field_of_study text,
  experience_level text,
  work_location text,
  resume_text text,
  skills text[],
  updated_at timestamp default now()
);

-- applications: tracker entries (was jobpilot_applications)
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  job_title text,
  company text,
  apply_link text,
  status text default 'Applied',  -- Applied, Interview, Offer, Rejected
  applied_at timestamp default now()
);

-- followed_companies (was jobpilot_followed_companies)
create table if not exists followed_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  company text not null,
  followed_at timestamp default now(),
  last_checked timestamp,
  unique(user_id, company)
);

-- search_history: for Smart Job Alerts (was jobpilot_search_history)
create table if not exists search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  company text,
  role text,
  searched_at timestamp default now()
);

-- settings (was jobpilot_settings)
create table if not exists settings (
  user_id uuid references auth.users primary key,
  default_mode text default 'job',               -- 'job' | 'career_chat'
  notify_followed boolean default true,
  notify_search_history boolean default true,
  notify_daily_digest boolean default false,
  sheets_connected boolean default false
);


-- =====================================================
-- Row Level Security (RLS) policies
-- Every user can only read/write their own rows.
-- =====================================================

-- profiles
alter table profiles enable row level security;
create policy "Users can manage their own profile"
  on profiles for all
  using (auth.uid() = id);

-- applications
alter table applications enable row level security;
create policy "Users can manage their own applications"
  on applications for all
  using (auth.uid() = user_id);

-- followed_companies
alter table followed_companies enable row level security;
create policy "Users can manage their own followed companies"
  on followed_companies for all
  using (auth.uid() = user_id);

-- search_history
alter table search_history enable row level security;
create policy "Users can manage their own search history"
  on search_history for all
  using (auth.uid() = user_id);

-- settings
alter table settings enable row level security;
create policy "Users can manage their own settings"
  on settings for all
  using (auth.uid() = user_id);


-- =====================================================
-- Indexes for performance
-- =====================================================
create index if not exists idx_applications_user_id on applications(user_id);
create index if not exists idx_followed_companies_user_id on followed_companies(user_id);
create index if not exists idx_search_history_user_id on search_history(user_id);

-- =====================================================
-- Encrypted Chat Persistence
-- =====================================================

-- pgcrypto extension for encryption
create extension if not exists pgcrypto;

-- chat_messages table
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  role text not null,
  content_encrypted bytea not null,
  mode text,
  created_at timestamp default now()
);

-- RLS for chat_messages
alter table chat_messages enable row level security;
create policy "Users can manage their own chat messages"
  on chat_messages for all
  using (auth.uid() = user_id);

-- RPC for saving a message with encryption
create or replace function save_chat_message(
  p_user_id uuid,
  p_role text,
  p_content text,
  p_mode text,
  p_key text
) returns void as $$
begin
  insert into chat_messages (user_id, role, content_encrypted, mode)
  values (p_user_id, p_role, pgp_sym_encrypt(p_content, p_key), p_mode);
end;
$$ language plpgsql security definer;

-- RPC for fetching chat history with decryption
create or replace function get_chat_history(
  p_user_id uuid,
  p_key text
) returns table(
  id uuid,
  role text,
  content text,
  mode text,
  created_at timestamp
) as $$
begin
  return query
  select 
    cm.id, 
    cm.role, 
    pgp_sym_decrypt(cm.content_encrypted, p_key) as content, 
    cm.mode, 
    cm.created_at
  from chat_messages cm
  where cm.user_id = p_user_id
  order by cm.created_at asc;
end;
$$ language plpgsql security definer;

-- =====================================================
-- Username & Profile Photo Support
-- =====================================================

alter table profiles add column if not exists username text unique;
alter table profiles add column if not exists avatar_url text;

-- Storage bucket for avatars (assuming creation via Dashboard)
-- Insert into storage.buckets if not exists (raw SQL approach, better done in Dashboard but added for completeness)
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true) 
on conflict (id) do nothing;

-- RLS policies for avatars bucket
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
