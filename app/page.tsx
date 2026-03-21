"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import type { Theme } from "@/app/api/analyze-invitation/route";

type Step = "form" | "checking" | "ok" | "conflict";

interface ConflictInfo {
  guestName: string;
  imageUrl: string;
}

interface WeddingConfig {
  id: string;
  display_name: string;
  text_tagline: string;
  text_subtitle: string;
  text_footer: string;
  theme_json: Theme | null;
}

function getWeddingId(): string {
  if (typeof window === "undefined") return "default";
  return new URLSearchParams(window.location.search).get("boda") || "default";
}

async function maybeConvertHeic(file: File): Promise<File> {
  const name = file.name.toLowerCase();
  const isHeic = name.endsWith(".heic") || name.endsWith(".heif") || file.type === "image/heic" || file.type === "image/heif";
  if (!isHeic) return file;
  try {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
  } catch (e) {
    console.warn("HEIC conversion failed:", e);
    return file;
  }
}

async function compressImage(file: File, maxPx = 800): Promise<string> {
  const converted = await maybeConvertHeic(file);
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(converted);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(""); };
    img.src = url;
  });
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty("--t-bg", theme.bg_color);
  root.style.setProperty("--t-card", theme.card_color);
  root.style.setProperty("--t-primary", theme.primary_color);
  root.style.setProperty("--t-accent", theme.accent_color);
  root.style.setProperty("--t-text", theme.text_color);
  root.style.setProperty("--t-muted", theme.muted_color);
  root.style.setProperty("--t-border", theme.border_color);

  // Cargar Google Font si no es la default
  if (theme.google_font && theme.google_font !== "Cormorant Garamond" && theme.google_font !== "Jost") {
    const fontName = theme.google_font.replace(/ /g, "+");
    const linkId = "dynamic-font";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${fontName}:ital,wght@0,400;0,500;1,400&display=swap`;
      document.head.appendChild(link);
    }
    root.style.setProperty("--t-font-heading", `'${theme.google_font}', serif`);
  } else {
    root.style.setProperty("--t-font-heading", theme.font_style === "sans" ? "'Jost', sans-serif" : "'Cormorant Garamond', serif");
  }
}

function resetTheme() {
  const root = document.documentElement;
  ["--t-bg","--t-card","--t-primary","--t-accent","--t-text","--t-muted","--t-border","--t-font-heading"]
    .forEach((v) => root.style.removeProperty(v));
}

const DEFAULT_CONFIG: WeddingConfig = {
  id: "default",
  display_name: "",
  text_tagline: "Registrá tu vestido, y asegurate que tu look sea único",
  text_subtitle: "",
  text_footer: "Dress-up",
  theme_json: null,
};

export default function Home() {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [registeredUrl, setRegisteredUrl] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [config, setConfig] = useState<WeddingConfig>(DEFAULT_CONFIG);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const wid = getWeddingId();
    fetch(`/api/wedding?boda=${encodeURIComponent(wid)}`)
      .then((r) => r.json())
      .then((data: WeddingConfig) => {
        setConfig(data);
        if (data.theme_json) {
          applyTheme(data.theme_json);
        } else {
          resetTheme();
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleFile = async (f: File) => {
    const ok = f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);
    if (!ok) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearFile = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const canSubmit = name.trim().length > 0 && file !== null;

  const handleSubmit = async () => {
    if (!canSubmit || !file) return;
    setStep("checking");
    try {
      const base64 = await compressImage(file);
      if (!base64) throw new Error("No se pudo procesar la imagen");
      const blob = await (await fetch(base64)).blob();
      const compressed = new File([blob], "dress.jpg", { type: "image/jpeg" });
      const fd = new FormData();
      fd.append("wedding_id", getWeddingId());
      fd.append("guest_name", name.trim());
      fd.append("image", compressed);
      const res = await fetch("/api/register", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      if (data.status === "conflict") {
        setConflict(data.conflictWith);
        setStep("conflict");
      } else {
        setRegisteredUrl(data.imageUrl);
        setStep("ok");
      }
    } catch (err) {
      console.error(err);
      alert("Hubo un error. Por favor intentá de nuevo.");
      setStep("form");
    }
  };

  const reset = () => {
    clearFile();
    setName("");
    setConflict(null);
    setRegisteredUrl(null);
    setStep("form");
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        {config.display_name
          ? <h1 className={styles.title}>{config.display_name}</h1>
          : <h1 className={styles.title}>Bienvenida</h1>
        }
        <p className={styles.tagline}>{config.text_tagline}</p>
        {config.text_subtitle && <p className={styles.subtitle}>{config.text_subtitle}</p>}
      </header>

      {lightboxSrc && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxSrc(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightboxSrc(null)}>✕</button>
          <img src={lightboxSrc} alt="Vestido ampliado" className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {step === "form" && (
        <div className={styles.card}>
          <span className={styles.badge}>Registrá tu vestido</span>
          <div className={styles.field}>
            <label htmlFor="guestName" className={styles.label}>Tu nombre</label>
            <input id="guestName" type="text" className={styles.input} placeholder="Ej: María González" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Foto de tu vestido</label>
            {!preview ? (
              <div
                className={`${styles.dropzone} ${isDragging ? styles.dropping : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                <div className={styles.dropIcon}>👗</div>
                <p className={styles.dropText}>Tocá o arrastrá una foto</p>
                <small className={styles.dropHint}>JPG, PNG, WEBP o HEIC (iPhone) · máx. 10 MB</small>
              </div>
            ) : (
              <div className={styles.previewWrap}>
                <img src={preview} alt="Vista previa" className={`${styles.previewImg} ${styles.clickable}`} onClick={() => setLightboxSrc(preview)} />
                <button className={styles.clearBtn} onClick={clearFile} aria-label="Quitar foto">✕</button>
                <div className={styles.expandHint}>toca para ampliar</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*,.heic,.heif" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
          </div>
          <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={!canSubmit} onClick={handleSubmit}>Verificar mi vestido →</button>
        </div>
      )}

      {step === "checking" && (
        <div className={styles.card}>
          <div className={styles.checking}>
            <div className={styles.spinner} />
            <h2 className={styles.checkingTitle}>Analizando tu vestido…</h2>
            <p className={styles.checkingText}>Nuestra IA está comparando tu elección<br />con los vestidos ya registrados.</p>
          </div>
        </div>
      )}

      {step === "ok" && (
        <div className={styles.card}>
          <div className={styles.resultOk}>
            <div className={styles.bigIcon}>🌸</div>
            <h2 className={styles.resultTitle}>¡Vestido registrado!</h2>
            <div className={styles.divider}><span>✦</span></div>
            <p className={styles.resultText}>Tu look es único. Nadie más eligió un vestido igual.<br />¡Te va a ver espléndida!</p>
            {registeredUrl && (
              <div className={styles.registeredImgWrap}>
                <img src={registeredUrl} alt="Tu vestido registrado" className={`${styles.registeredImg} ${styles.clickable}`} onClick={() => setLightboxSrc(registeredUrl!)} />
                <div className={styles.expandHint}>toca para ampliar</div>
              </div>
            )}
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={reset}>← Registrar otro vestido</button>
          </div>
        </div>
      )}

      {step === "conflict" && conflict && (
        <div className={styles.card}>
          <div className={styles.resultConflict}>
            <div className={styles.bigIcon}>💛</div>
            <h2 className={styles.resultTitle}>¡Ese vestido ya fue elegido!</h2>
            <div className={styles.divider}><span>✦</span></div>
            <div className={styles.conflictGrid}>
              <div className={styles.conflictImgBox}>
                {preview && <img src={preview} alt="Tu vestido" className={`${styles.conflictImg} ${styles.clickable}`} onClick={() => setLightboxSrc(preview!)} />}
                <span className={styles.conflictLabel}>Tu vestido</span>
              </div>
              <div className={styles.conflictImgBox}>
                <img src={conflict.imageUrl} alt="Vestido ya registrado" className={`${styles.conflictImg} ${styles.clickable}`} onClick={() => setLightboxSrc(conflict.imageUrl)} />
                <span className={styles.conflictLabel}>{conflict.guestName}</span>
              </div>
            </div>
            <div className={styles.conflictMsg}>
              ¡Qué gusto coincidente! <strong>{conflict.guestName}</strong> ya eligió un vestido muy similar. Te recomendamos elegir un look diferente para que todas brillen a su manera. 💛
            </div>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={reset}>← Probar con otro vestido</button>
          </div>
        </div>
      )}

      <footer className={styles.footer}>
        <p>{config.text_footer} · © {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
