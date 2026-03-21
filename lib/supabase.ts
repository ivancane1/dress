import { createClient } from "@supabase/supabase-js";

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

export type Wedding = {
  id: string;
  display_name: string;
  text_tagline: string;
  text_subtitle: string;
  text_footer: string;
  invitation_url: string | null;
  theme_json: import("@/app/api/analyze-invitation/route").Theme | null;
  created_at: string;
  updated_at: string;
};

export const WEDDING_DEFAULTS = {
  text_tagline: "Registrá tu vestido, y asegurate que tu look sea único",
  text_subtitle: "",
  text_footer: "Dress-up",
};
