import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, WEDDING_DEFAULTS, Wedding } from "@/lib/supabase";

// GET /api/wedding?boda=sofi-nico
// Devuelve la configuración del casamiento, o defaults si no existe
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const weddingId = searchParams.get("boda") || "default";

  const { data, error } = await supabaseAdmin
    .from("weddings")
    .select("*")
    .eq("id", weddingId)
    .single();

  if (error || !data) {
    // Devolver defaults si no existe en la DB
    return NextResponse.json({
      id: weddingId,
      display_name: "",
      ...WEDDING_DEFAULTS,
    });
  }

  return NextResponse.json(data);
}

// POST /api/wedding  — crea o actualiza un casamiento
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, display_name, text_tagline, text_subtitle, text_footer } = body;

    if (!id || !display_name) {
      return NextResponse.json({ error: "id y display_name son obligatorios" }, { status: 400 });
    }

    // Slug seguro: minúsculas, solo letras, números y guiones
    const safeId = id.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

    const payload: Partial<Wedding> = {
      id: safeId,
      display_name,
      text_tagline: text_tagline ?? WEDDING_DEFAULTS.text_tagline,
      text_subtitle: text_subtitle ?? WEDDING_DEFAULTS.text_subtitle,
      text_footer: text_footer ?? WEDDING_DEFAULTS.text_footer,
    };

    const { data, error } = await supabaseAdmin
      .from("weddings")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("Error upsert wedding:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// GET /api/wedding/list — lista todos los casamientos
export async function PUT(req: NextRequest) {
  // Usamos PUT como "listar todos" para no crear una subruta
  const { data, error } = await supabaseAdmin
    .from("weddings")
    .select("id, display_name, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ weddings: data || [] });
}
