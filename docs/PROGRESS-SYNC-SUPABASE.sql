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

create table if not exists public.hub_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'trial', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.hub_course_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null check (course_id in ('ios', 'android', 'sdd', 'all')),
  plan_code text not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired', 'trial')),
  granted_by uuid null references auth.users(id) on delete set null,
  granted_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz null,
  notes text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, course_id)
);

create table if not exists public.hub_course_teasers (
  id uuid primary key default gen_random_uuid(),
  course_id text not null check (course_id in ('ios', 'android', 'sdd')),
  topic_id text not null,
  kind text not null default 'lesson' check (kind in ('course_overview', 'lesson')),
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (course_id, topic_id)
);

create table if not exists public.hub_student_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null check (course_id in ('ios', 'android', 'sdd')),
  topic_id text not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, course_id, topic_id)
);

create table if not exists public.hub_student_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null check (course_id in ('ios', 'android', 'sdd')),
  topic_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, course_id, topic_id)
);

create table if not exists public.hub_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  subject_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists hub_course_entitlements_user_status_idx
  on public.hub_course_entitlements (user_id, status, course_id);

create index if not exists hub_course_teasers_course_idx
  on public.hub_course_teasers (course_id, sort_order, topic_id);

create index if not exists hub_student_notes_user_course_idx
  on public.hub_student_notes (user_id, course_id, updated_at desc);

create index if not exists hub_student_bookmarks_user_course_idx
  on public.hub_student_bookmarks (user_id, course_id, updated_at desc);

alter table public.hub_user_roles enable row level security;
alter table public.hub_course_entitlements enable row level security;
alter table public.hub_course_teasers enable row level security;
alter table public.hub_student_notes enable row level security;
alter table public.hub_student_bookmarks enable row level security;
alter table public.hub_admin_audit_log enable row level security;

revoke all on public.hub_user_roles from anon;
revoke all on public.hub_user_roles from authenticated;
revoke all on public.hub_course_entitlements from anon;
revoke all on public.hub_course_entitlements from authenticated;
revoke all on public.hub_course_teasers from anon;
revoke all on public.hub_course_teasers from authenticated;
revoke all on public.hub_student_notes from anon;
revoke all on public.hub_student_notes from authenticated;
revoke all on public.hub_student_bookmarks from anon;
revoke all on public.hub_student_bookmarks from authenticated;
revoke all on public.hub_admin_audit_log from anon;
revoke all on public.hub_admin_audit_log from authenticated;

insert into public.hub_course_teasers (course_id, topic_id, kind, is_public, sort_order)
values
  ('ios', '00-informe-INFORME-CURSO', 'course_overview', true, 0),
  ('ios', '00-core-mobile-00-introduccion', 'lesson', true, 10),
  ('android', '00-informe-INFORME-CURSO', 'course_overview', true, 0),
  ('android', '00-nivel-cero-00-introduccion', 'lesson', true, 10),
  ('sdd', '01-roadmap-00-mapa-16-semanas', 'course_overview', true, 0),
  ('sdd', '00-preparacion-00-bienvenida-y-como-estudiar', 'lesson', true, 10)
on conflict (course_id, topic_id) do update set
  kind = excluded.kind,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());
