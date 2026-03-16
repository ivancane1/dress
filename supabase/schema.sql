-- Ejecutar en Supabase > SQL Editor

-- Tabla principal de vestidos
create table if not exists public.dresses (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  text not null,
  guest_name  text not null,
  image_url   text not null,
  thumb_b64   text not null,
  created_at  timestamptz default now()
);

-- Índice para consultas por casamiento
create index if not exists dresses_wedding_id_idx on public.dresses(wedding_id);

-- Row Level Security: lectura pública, escritura solo desde el servidor
alter table public.dresses enable row level security;

create policy "Lectura pública" on public.dresses
  for select using (true);

create policy "Inserción desde servidor" on public.dresses
  for insert with check (true);

-- Storage bucket para las fotos
insert into storage.buckets (id, name, public)
values ('dresses', 'dresses', true)
on conflict (id) do nothing;

create policy "Subida pública" on storage.objects
  for insert with check (bucket_id = 'dresses');

create policy "Lectura pública storage" on storage.objects
  for select using (bucket_id = 'dresses');
