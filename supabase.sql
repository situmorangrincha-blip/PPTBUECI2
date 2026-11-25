-- PANDA SUKSESS · setup Supabase (jalankan sekali di SQL Editor Supabase)
-- Semua orang bisa MEMBACA deck. MENYIMPAN hanya lewat fungsi panda_save yang mengecek PIN.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.panda_decks (
  id          text primary key,
  doc         jsonb not null,
  excel       text,                       -- file Excel data (base64), opsional
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create table if not exists public.panda_versions (
  id        bigserial primary key,
  deck_id   text not null,
  doc       jsonb not null,
  saved_at  timestamptz not null default now(),
  saved_by  text
);
create index if not exists panda_versions_deck on public.panda_versions (deck_id, saved_at desc);

create table if not exists public.panda_secrets (
  id        text primary key,
  pin_hash  text not null
);

alter table public.panda_decks    enable row level security;
alter table public.panda_versions enable row level security;
alter table public.panda_secrets  enable row level security;   -- tanpa policy = tidak bisa dibaca anon

drop policy if exists "baca deck" on public.panda_decks;
create policy "baca deck" on public.panda_decks for select using (true);
drop policy if exists "baca versi" on public.panda_versions;
create policy "baca versi" on public.panda_versions for select using (true);

create or replace function public.panda_check_pin(p_id text, p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  select pin_hash into h from panda_secrets where id = p_id;
  return h is not null and h = crypt(p_pin, h);
end $$;

create or replace function public.panda_save(p_id text, p_pin text, p_doc jsonb, p_excel text default null, p_by text default null, p_base timestamptz default null)
returns timestamptz language plpgsql security definer set search_path = public, extensions as $$
declare h text; cur timestamptz; t timestamptz := now();
begin
  select pin_hash into h from panda_secrets where id = p_id;
  if h is null or h <> crypt(p_pin, h) then raise exception 'PIN salah'; end if;
  select updated_at into cur from panda_decks where id = p_id;
  if p_base is not null and cur is not null and cur > p_base + interval '1 second' then
    raise exception 'CONFLICT: ada versi lebih baru (%).', cur;
  end if;
  insert into panda_decks (id, doc, excel, updated_at, updated_by) values (p_id, p_doc, p_excel, t, p_by)
  on conflict (id) do update set doc = excluded.doc, excel = coalesce(excluded.excel, panda_decks.excel), updated_at = t, updated_by = excluded.updated_by;
  insert into panda_versions (deck_id, doc, saved_by) values (p_id, p_doc, p_by);
  delete from panda_versions where deck_id = p_id and id not in (select id from panda_versions where deck_id = p_id order by saved_at desc limit 30);
  return t;
end $$;

revoke all on function public.panda_save(text, text, jsonb, text, text, timestamptz) from public;
revoke all on function public.panda_check_pin(text, text) from public;
grant execute on function public.panda_save(text, text, jsonb, text, text, timestamptz) to anon, authenticated;
grant execute on function public.panda_check_pin(text, text) to anon, authenticated;

-- PIN edit (ganti 'GANTI-PIN-INI' sebelum dijalankan). Untuk ganti PIN nanti, jalankan ulang baris ini.
insert into public.panda_secrets (id, pin_hash) values ('kebayoran', crypt('GANTI-PIN-INI', gen_salt('bf')))
on conflict (id) do update set pin_hash = excluded.pin_hash;
