"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "form" | "checking" | "ok" | "conflict";

interface ConflictInfo {
  guestName: string;
  imageUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeddingId(): string {
  if (typeof window === "undefined") return "default";
  const params = new URLSearchParams(window.location.search);
  return params.get("boda") || "default";
}

async function compressImage(file: File, maxPx = 800): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ base64: canvas.toDataURL("image/jpeg", 0.82), mime: "image/jpeg" });
    };
    img.src = url;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [registeredUrl, setRegisteredUrl] = useState<string | null>(null);
  const [coupleNames, setCoupleNames] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const wid = getWeddingId();
    if (wid !== "default") {
      // "sofi-nico" → "Sofi & Nico"
      const names = wid
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" & ");
      setCoupleNames(names);
    }
  }, []);

  // Cerrar lightbox con Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleFile = (f: File) => {
    if (!f.type.startsWith("image/")) return;
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
      const { base64 } = await compressImage(file);
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
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.ornamentTop}>✿</div>
        {coupleNames ? (
          <h1 className={styles.title}>{coupleNames}</h1>
        ) : (
          <h1 className={styles.title}>Bienvenida</h1>
        )}
        <p className={styles.tagline}>Registrá tu vestido</p>
        <p className={styles.subtitle}>Asegurate tu look único · Nadie llega igual</p>
      </header>

      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxSrc(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightboxSrc(null)}>✕</button>
          <img
            src={lightboxSrc}
            alt="Vestido ampliado"
            className={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Form step ── */}
      {step === "form" && (
        <div className={styles.card}>
          <span className={styles.badge}>Registrá tu vestido</span>

          <div className={styles.field}>
            <label htmlFor="guestName" className={styles.label}>Tu nombre</label>
            <input
              id="guestName"
              type="text"
              className={styles.input}
              placeholder="Ej: María González"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Foto de tu vestido</label>
            {!preview ? (
              <div
                className={`${styles.dropzone} ${isDragging ? styles.dropping : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
              >
                <div className={styles.dropIcon}>👗</div>
                <p className={styles.dropText}>Tocá o arrastrá una foto</p>
                <small className={styles.dropHint}>JPG, PNG o WEBP · máx. 10 MB</small>
              </div>
            ) : (
              <div className={styles.previewWrap}>
                <img src={preview} alt="Vista previa" className={`${styles.previewImg} ${styles.clickable}`} onClick={() => setLightboxSrc(preview)} title="Clic para ampliar" />
                <button className={styles.clearBtn} onClick={clearFile} aria-label="Quitar foto">✕</button>
                <div className={styles.expandHint}>toca para ampliar</div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
          </div>

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            Verificar mi vestido →
          </button>
        </div>
      )}

      {/* ── Checking step ── */}
      {step === "checking" && (
        <div className={styles.card}>
          <div className={styles.checking}>
            <div className={styles.spinner} />
            <h2 className={styles.checkingTitle}>Analizando tu vestido…</h2>
            <p className={styles.checkingText}>
              Nuestra IA está comparando tu elección<br />con los vestidos ya registrados.
            </p>
          </div>
        </div>
      )}

      {/* ── OK step ── */}
      {step === "ok" && (
        <div className={styles.card}>
          <div className={styles.resultOk}>
            <div className={styles.bigIcon}>🌸</div>
            <h2 className={styles.resultTitle}>¡Vestido registrado!</h2>
            <div className={styles.divider}><span>✦</span></div>
            <p className={styles.resultText}>
              Tu look es único. Nadie más eligió un vestido igual.<br />
              ¡Te va a ver espléndida!
            </p>
            {registeredUrl && (
              <div className={styles.registeredImgWrap}>
                <img src={registeredUrl} alt="Tu vestido registrado" className={`${styles.registeredImg} ${styles.clickable}`} onClick={() => setLightboxSrc(registeredUrl)} title="Clic para ampliar" />
                <div className={styles.expandHint}>toca para ampliar</div>
              </div>
            )}
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={reset}>
              ← Registrar otro vestido
            </button>
          </div>
        </div>
      )}

      {/* ── Conflict step ── */}
      {step === "conflict" && conflict && (
        <div className={styles.card}>
          <div className={styles.resultConflict}>
            <div className={styles.bigIcon}>💛</div>
            <h2 className={styles.resultTitle}>¡Ese vestido ya fue elegido!</h2>
            <div className={styles.divider}><span>✦</span></div>

            <div className={styles.conflictGrid}>
              <div className={styles.conflictImgBox}>
                {preview && (
                  <img src={preview} alt="Tu vestido" className={`${styles.conflictImg} ${styles.clickable}`} onClick={() => setLightboxSrc(preview)} title="Clic para ampliar" />
                )}
                <span className={styles.conflictLabel}>Tu vestido</span>
              </div>
              <div className={styles.conflictImgBox}>
                <img src={conflict.imageUrl} alt="Vestido ya registrado" className={`${styles.conflictImg} ${styles.clickable}`} onClick={() => setLightboxSrc(conflict.imageUrl)} title="Clic para ampliar" />
                <span className={styles.conflictLabel}>{conflict.guestName}</span>
              </div>
            </div>

            <div className={styles.conflictMsg}>
              ¡Qué gusto coincidente! <strong>{conflict.guestName}</strong> ya eligió
              un vestido muy similar. Te recomendamos elegir un look diferente
              para que todas brillen a su manera. 💛
            </div>

            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={reset}>
              ← Probar con otro vestido
            </button>
          </div>
        </div>
      )}

      <footer className={styles.footer}>
        <p>Hecho con amor · {new Date().getFullYear()}</p>
      </footer>
    </main>
  );
}
