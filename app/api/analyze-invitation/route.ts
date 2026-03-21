import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type Theme = {
  bg_color: string;
  card_color: string;
  primary_color: string;
  accent_color: string;
  text_color: string;
  muted_color: string;
  border_color: string;
  font_style: "serif" | "sans" | "script";
  google_font: string;
  aesthetic: string;
};

const DEFAULT_THEME: Theme = {
  bg_color: "#faf7f2",
  card_color: "#ffffff",
  primary_color: "#b87e7e",
  accent_color: "#c9a070",
  text_color: "#2e2320",
  muted_color: "#8a7060",
  border_color: "#e8ddd5",
  font_style: "serif",
  google_font: "Cormorant Garamond",
  aesthetic: "clásico elegante",
};

// Mapeo de estilos a Google Fonts
const FONT_MAP: Record<string, string> = {
  serif: "Cormorant Garamond",
  sans: "Jost",
  script: "Great Vibes",
  modern: "Playfair Display",
  rustic: "Libre Baskerville",
  minimal: "DM Sans",
  romantic: "Cormorant Garamond",
  floral: "Lora",
  vintage: "EB Garamond",
  tropical: "Josefin Sans",
};

function pickFont(aesthetic: string, fontStyle: string): string {
  const lower = (aesthetic + " " + fontStyle).toLowerCase();
  for (const [key, font] of Object.entries(FONT_MAP)) {
    if (lower.includes(key)) return font;
  }
  return "Cormorant Garamond";
}

// Asegura que el contraste entre texto y fondo sea suficiente
function ensureContrast(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  // Si el color es muy oscuro para texto principal, usamos uno seguro
  if (luminance < 0.15) return "#2e2320";
  return hex;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const weddingId = formData.get("wedding_id") as string;
    const imageFile = formData.get("image") as File;

    if (!weddingId || !imageFile) {
      return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
    }

    // Subir imagen a Supabase Storage
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = imageFile.type === "image/png" ? "png" : "jpg";
    const fileName = `invitations/${weddingId}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("dresses")
      .upload(fileName, buffer, { contentType: imageFile.type, upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Error al subir imagen" }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("dresses")
      .getPublicUrl(fileName);

    const invitationUrl = urlData.publicUrl;

    // Analizar con Claude Vision
    const base64 = buffer.toString("base64");
const mimeType = imageFile.type;
const isPdf = mimeType === "application/pdf";

const mediaContent = isPdf
  ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
  : { type: "image" as const, source: { type: "base64" as const, media_type: mimeType as "image/jpeg" | "image/png" | "image/webp", data: base64 } };

const response = await anthropic.messages.create({
  model: "claude-opus-4-5",
  max_tokens: 400,
  messages: [
    {
      role: "user",
      content: [
        mediaContent,
            {
              type: "text",
              text: `Analizá esta invitación de casamiento y extraé su identidad visual.
Respondé ÚNICAMENTE con JSON válido, sin markdown ni texto extra:
{
  "bg_color": "#hex del color de fondo predominante, claro y suave",
  "card_color": "#hex para cards/formularios, ligeramente más claro o igual al bg",
  "primary_color": "#hex del color primario de los elementos decorativos o texto principal",
  "accent_color": "#hex del color de acento (detalles, bordes, ornamentos)",
  "text_color": "#hex oscuro legible sobre el bg_color (nunca muy oscuro tipo #000)",
  "muted_color": "#hex para texto secundario, gris medio",
  "border_color": "#hex para bordes suaves, muy similar al bg pero más definido",
  "font_style": "serif | sans | script (el que más se parezca a la tipografía de la invitación)",
  "aesthetic": "descripción en 2-3 palabras del estilo (ej: romántico floral, rústico campestre, moderno minimalista)"
}
Reglas: todos los valores deben ser colores hex válidos de 6 dígitos. bg_color y card_color deben ser claros (luminosidad > 80%). text_color debe tener buen contraste sobre bg_color.`,
            },
          ],
        },
      ],
    });

    const rawText = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    let aiTheme: Partial<Theme> = {};
    try {
      aiTheme = JSON.parse(rawText);
    } catch {
      console.error("No se pudo parsear tema:", rawText);
      aiTheme = {};
    }

    // Combinar con defaults y validar
    const theme: Theme = {
      bg_color: aiTheme.bg_color || DEFAULT_THEME.bg_color,
      card_color: aiTheme.card_color || DEFAULT_THEME.card_color,
      primary_color: aiTheme.primary_color || DEFAULT_THEME.primary_color,
      accent_color: aiTheme.accent_color || DEFAULT_THEME.accent_color,
      text_color: ensureContrast(aiTheme.text_color || DEFAULT_THEME.text_color),
      muted_color: aiTheme.muted_color || DEFAULT_THEME.muted_color,
      border_color: aiTheme.border_color || DEFAULT_THEME.border_color,
      font_style: aiTheme.font_style || DEFAULT_THEME.font_style,
      google_font: pickFont(aiTheme.aesthetic || "", aiTheme.font_style || ""),
      aesthetic: aiTheme.aesthetic || DEFAULT_THEME.aesthetic,
    };

    // Guardar en la base de datos
    const { error: updateError } = await supabaseAdmin
      .from("weddings")
      .update({ invitation_url: invitationUrl, theme_json: theme })
      .eq("id", weddingId);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Error al guardar tema" }, { status: 500 });
    }

    return NextResponse.json({ theme, invitation_url: invitationUrl });
  } catch (err) {
    console.error("Error inesperado:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE - borra el tema personalizado y vuelve al default
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const weddingId = searchParams.get("wedding_id");
  if (!weddingId) return NextResponse.json({ error: "Falta wedding_id" }, { status: 400 });

  await supabaseAdmin
    .from("weddings")
    .update({ invitation_url: null, theme_json: null })
    .eq("id", weddingId);

  return NextResponse.json({ ok: true });
}
