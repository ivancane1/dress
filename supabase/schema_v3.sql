-- Ejecutar en Supabase > SQL Editor
-- Agrega soporte de tema visual a la tabla weddings

alter table public.weddings
  add column if not exists invitation_url text default null,
  add column if not exists theme_json jsonb default null;

-- Storage policy para invitaciones (si no existe ya el bucket dresses, ya fue creado)
-- Las invitaciones se guardan en el mismo bucket bajo la carpeta /invitations/
