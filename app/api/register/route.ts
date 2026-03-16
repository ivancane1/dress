import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin, Dress } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Comprime una imagen en base64 a un thumbnail de máximo 600px
async function resizeToThumb(base64: string): Promise<string> {
  // En el servidor (Node.js) no hay Canvas API nativo, usamos el buffer raw.
  // Devolvemos el base64 original truncado a 800KB máximo para no exceder
  // el límite de tokens de Claude. En producción podés usar sharp.
  const MAX_BYTES = 800_000;
  if (base64.length > MAX_BYTES) {
    // Tomamos los primeros MAX_BYTES (JPEG es seguro de truncar para almacenamiento
    // pero para comparación alcanza con reducir la calidad de envío)
    return base64.slice(0, MAX_BYTES);
  }
  return base64;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const weddingId = (formData.get("wedding_id") as string) || "default";
    const guestName = formData.get("guest_name") as string;
    const imageFile = formData.get("image") as File;

    if (!guestName || !imageFile) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    // Convertir imagen a base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Full = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = (imageFile.type || "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/webp";
    const thumbB64 = await resizeToThumb(base64Full);

    // Buscar vestidos ya registrados para este casamiento
    const { data: existingDresses, error: dbError } = await supabaseAdmin
      .from("dresses")
      .select("*")
      .eq("wedding_id", weddingId)
      .order("created_at", { ascending: true });

    if (dbError) {
      console.error("DB error:", dbError);
      return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
    }

    const dresses: Dress[] = existingDresses || [];

    // Si hay vestidos previos, comparar con IA
    if (dresses.length > 0) {
      const messageContent: Anthropic.MessageParam["content"] = [];

      // Agregar vestidos existentes al prompt
      for (const dress of dresses) {
        messageContent.push({
          type: "text",
          text: `Vestido registrado de ${dress.guest_name}:`,
        });
        // Extraer el base64 puro (sin prefijo data:...)
        const existingB64 = dress.thumb_b64.startsWith("data:")
          ? dress.thumb_b64.split(",")[1]
          : dress.thumb_b64;
        messageContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: existingB64,
          },
        });
      }

      // Agregar el nuevo vestido
      messageContent.push({
        type: "text",
        text: `Nuevo vestido de ${guestName} que quiere registrar:`,
      });
      messageContent.push({
        type: "image",
        source: { type: "base64", media_type: mimeType, data: thumbB64 },
      });

      messageContent.push({
        type: "text",
        text: `Analizá si el nuevo vestido es igual o muy similar a alguno ya registrado.
Considerá "similar" si comparten el mismo color principal Y el mismo estilo general (largo, formal/informal, escote).
Respondé ÚNICAMENTE con JSON válido, sin markdown ni texto extra:
{"conflict":true,"conflictIndex":0}
o
{"conflict":false}
donde conflictIndex es el índice 0-based del vestido en conflicto.`,
      });

      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 100,
        messages: [{ role: "user", content: messageContent }],
      });

      const rawText = response.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .replace(/```json|```/g, "")
        .trim();

      let result: { conflict: boolean; conflictIndex?: number } = {
        conflict: false,
      };
      try {
        result = JSON.parse(rawText);
      } catch {
        console.error("No se pudo parsear respuesta de Claude:", rawText);
      }

      if (
        result.conflict &&
        typeof result.conflictIndex === "number" &&
        dresses[result.conflictIndex]
      ) {
        const conflictDress = dresses[result.conflictIndex];
        return NextResponse.json({
          status: "conflict",
          conflictWith: {
            guestName: conflictDress.guest_name,
            imageUrl: conflictDress.image_url,
          },
        });
      }
    }

    // Sin conflicto → guardar en Supabase Storage
    const fileName = `${weddingId}/${Date.now()}-${guestName.replace(/\s+/g, "_")}.jpg`;
    const imageBuffer = Buffer.from(base64Full, "base64");

    const { error: uploadError } = await supabaseAdmin.storage
      .from("dresses")
      .upload(fileName, imageBuffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Error al subir imagen" }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("dresses")
      .getPublicUrl(fileName);

    // Guardar registro en la base de datos
    const { error: insertError } = await supabaseAdmin.from("dresses").insert({
      wedding_id: weddingId,
      guest_name: guestName,
      image_url: publicUrlData.publicUrl,
      thumb_b64: thumbB64,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json({ error: "Error al guardar registro" }, { status: 500 });
    }

    return NextResponse.json({
      status: "registered",
      imageUrl: publicUrlData.publicUrl,
    });
  } catch (err) {
    console.error("Error inesperado:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// Ruta GET para obtener todos los vestidos de un casamiento (panel admin)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const weddingId = searchParams.get("wedding_id") || "default";

  const { data, error } = await supabaseAdmin
    .from("dresses")
    .select("id, guest_name, image_url, created_at")
    .eq("wedding_id", weddingId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dresses: data });
}
