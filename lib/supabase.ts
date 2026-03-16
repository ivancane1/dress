import { createClient } from "@supabase/supabase-js";

// Cliente con service role para las API routes (acceso completo, solo server-side)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type Dress = {
  id: string;
  wedding_id: string;
  guest_name: string;
  image_url: string;
  thumb_b64: string;
  created_at: string;
};
