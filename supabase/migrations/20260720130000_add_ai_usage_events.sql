create table if not exists public.ai_usage_events (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    feature text not null,
    model text not null default 'gemini-3.5-flash-lite',
    success boolean not null default true,
    error_code text,
    prompt_token_count integer not null default 0,
    candidates_token_count integer not null default 0,
    thoughts_token_count integer not null default 0,
    total_token_count integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_created_idx
    on public.ai_usage_events (user_id, created_at desc);
create index if not exists ai_usage_events_created_idx
    on public.ai_usage_events (created_at desc);

alter table public.ai_usage_events enable row level security;

drop policy if exists "Users can view own AI usage" on public.ai_usage_events;
create policy "Users can view own AI usage"
    on public.ai_usage_events for select
    to authenticated
    using (auth.uid() = user_id);

revoke insert, update, delete on public.ai_usage_events from anon, authenticated;
grant select on public.ai_usage_events to authenticated;
