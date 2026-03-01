create table if not exists public.course_progress (
  course_id text not null,
  profile_key text not null,
  data jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (course_id, profile_key)
);

create index if not exists course_progress_updated_at_idx
  on public.course_progress (updated_at desc);

alter table public.course_progress enable row level security;

revoke all on public.course_progress from anon;
revoke all on public.course_progress from authenticated;
