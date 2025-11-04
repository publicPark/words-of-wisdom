-- Notes & Sentences schema with RLS and updated_at triggers

-- tables
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  is_public boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sentences (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  title text not null,
  description text,
  mastery_level smallint not null check (mastery_level in (1,2,3)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table notes enable row level security;
alter table sentences enable row level security;

-- anyone can read public notes; owners can read their own
drop policy if exists "notes_select_own" on notes;
create policy "notes_select_public_or_own" on notes
for select using (is_public = true or auth.uid() = created_by);

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_modify_own'
  ) then
    create policy "notes_insert_own" on notes
    for insert with check (auth.uid() = created_by);
    create policy "notes_update_own" on notes
    for update using (auth.uid() = created_by);
    create policy "notes_delete_own" on notes
    for delete using (auth.uid() = created_by);
  end if;
end $$;

-- anyone can read sentences if their note is public; owners can read their own
drop policy if exists "sentences_select_own" on sentences;
create policy "sentences_select_public_or_own" on sentences
for select using (
  exists (
    select 1 from notes n where n.id = note_id and n.is_public = true
  )
  or auth.uid() = created_by
);

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'sentences' and policyname = 'sentences_modify_own'
  ) then
    create policy "sentences_insert_own" on sentences
    for insert with check (auth.uid() = created_by);
    create policy "sentences_update_own" on sentences
    for update using (auth.uid() = created_by);
    create policy "sentences_delete_own" on sentences
    for delete using (auth.uid() = created_by);
  end if;
end $$;

-- updated_at trigger
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_notes_updated on notes;
create trigger trg_notes_updated before update on notes
for each row execute function set_updated_at();

drop trigger if exists trg_sentences_updated on sentences;
create trigger trg_sentences_updated before update on sentences
for each row execute function set_updated_at();


