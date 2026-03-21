-- Ejecutar en Supabase > SQL Editor
-- Este script agrega la tabla de configuración de casamientos

create table if not exists public.weddings (
  id            text primary key,
  display_name  text not null,
  text_tagline  text not null default 'Registrá tu vestido, y asegurate que tu look sea único',
  text_subtitle text not null default '',
  text_footer   text not null default 'Dress-up',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- RLS
alter table public.weddings enable row level security;

create policy "Lectura pública weddings" on public.weddings
  for select using (true);

create policy "Inserción weddings desde servidor" on public.weddings
  for insert with check (true);

create policy "Actualización weddings desde servidor" on public.weddings
  for update using (true);

-- Trigger para updated_at automático
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger weddings_updated_at
  before update on public.weddings
  for each row execute function update_updated_at();
