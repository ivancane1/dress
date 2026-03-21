"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./admin.module.css";
import type { Theme } from "@/app/api/analyze-invitation/route";

interface Dress {
  id: string;
  guest_name: string;
  image_url: string;
  created_at: string;
}

interface Wedding {
  id: string;
  display_name: string;
  text_tagline: string;
  text_subtitle: string;
  text_footer: string;
  invitation_url: string | null;
  theme_json: Theme | null;
  created_at?: string;
}

type AdminTab = "weddings" | "dresses" | "texts" | "design";

const DEFAULTS = {
  text_tagline: "Registrá tu vestido, y asegurate que tu look sea único",
  text_subtitle: "",
  text_footer: "Dress-up",
};

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("weddings");
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [selectedWedding, setSelectedWedding] = useState<Wedding | null>(null);
  const [dresses, setDresses] = useState<Dress[]>([]);
  const [loadingWeddings, setLoadingWeddings] = useState(true);
  const [loadingDresses, setLoadingDresses] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [editTexts, setEditTexts] = useState({ text_tagline: "", text_subtitle: "", text_footer: "", display_name: "" });

  // Design tab state
  const [invitationPreview, setInvitationPreview] = useState<string | null>(null);
  const [invitationFile, setInvitationFile] = useState<File | null>(null);
  const [analyzingTheme, setAnalyzingTheme] = useState(false);
  const [generatedTheme, setGeneratedTheme] = useState<Theme | null>(null);
  const invitationRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchWeddings(); }, []);

  useEffect(() => {
    if (selectedWedding) {
      setEditTexts({
        display_name: selectedWedding.display_name,
        text_tagline: selectedWedding.text_tagline,
        text_subtitle: selectedWedding.text_subtitle,
        text_footer: selectedWedding.text_footer,
      });
      setGeneratedTheme(selectedWedding.theme_json);
      setInvitationPreview(selectedWedding.invitation_url);
      setInvitationFile(null);
    }
  }, [selectedWedding]);

  const fetchWeddings = async () => {
    setLoadingWeddings(true);
    try {
      const res = await fetch("/api/wedding", { method: "PUT" });
      const data = await res.json();
      setWeddings(data.weddings || []);
    } catch { setWeddings([]); }
    finally { setLoadingWeddings(false); }
  };

  const fetchDresses = async (wid: string) => {
    setLoadingDresses(true);
    try {
      const res = await fetch(`/api/register?wedding_id=${encodeURIComponent(wid)}`);
      const data = await res.json();
      setDresses(data.dresses || []);
    } catch { setDresses([]); }
    finally { setLoadingDresses(false); }
  };

  const selectWedding = (w: Wedding) => {
    setSelectedWedding(w);
    setTab("dresses");
    fetchDresses(w.id);
  };

  const createWedding = async () => {
    if (!newId.trim() || !newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/wedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId.trim(), display_name: newName.trim(), ...DEFAULTS }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewId(""); setNewName(""); setShowNewForm(false);
        await fetchWeddings();
        selectWedding(data);
      }
    } finally { setSaving(false); }
  };

  const saveTexts = async () => {
    if (!selectedWedding) return;
    setSaving(true);
    try {
      const res = await fetch("/api/wedding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedWedding.id, ...editTexts }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedWedding(updated);
        setWeddings((prev) => prev.map((w) => w.id === updated.id ? updated : w));
        setSavedMsg("¡Guardado!");
        setTimeout(() => setSavedMsg(""), 2500);
      }
    } finally { setSaving(false); }
  };

  const analyzeInvitation = async () => {
    if (!selectedWedding || !invitationFile) return;
    setAnalyzingTheme(true);
    try {
      const fd = new FormData();
      fd.append("wedding_id", selectedWedding.id);
      fd.append("image", invitationFile);
      const res = await fetch("/api/analyze-invitation", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setGeneratedTheme(data.theme);
        setInvitationPreview(data.invitation_url);
        setSelectedWedding((prev) => prev ? { ...prev, theme_json: data.theme, invitation_url: data.invitation_url } : prev);
        setWeddings((prev) => prev.map((w) => w.id === selectedWedding.id ? { ...w, theme_json: data.theme, invitation_url: data.invitation_url } : w));
        setSavedMsg("¡Tema generado y guardado!");
        setTimeout(() => setSavedMsg(""), 3000);
      }
    } finally { setAnalyzingTheme(false); }
  };

  const resetTheme = async () => {
    if (!selectedWedding) return;
    setSaving(true);
    try {
      await fetch(`/api/analyze-invitation?wedding_id=${selectedWedding.id}`, { method: "DELETE" });
      setGeneratedTheme(null);
      setInvitationPreview(null);
      setInvitationFile(null);
      setSelectedWedding((prev) => prev ? { ...prev, theme_json: null, invitation_url: null } : prev);
      setWeddings((prev) => prev.map((w) => w.id === selectedWedding.id ? { ...w, theme_json: null, invitation_url: null } : w));
    } finally { setSaving(false); }
  };

  const weddingUrl = (wid: string) => typeof window !== "undefined" ? `${window.location.origin}/?boda=${wid}` : "";

  return (
    <main className={styles.main}>
      {lightboxSrc && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxSrc(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightboxSrc(null)}>✕</button>
          <img src={lightboxSrc} alt="Vestido" className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h1 className={styles.sidebarTitle}>Dress-up</h1>
            <p className={styles.sidebarSubtitle}>Panel de administración</p>
          </div>
          <nav className={styles.sidebarNav}>
            <button className={`${styles.navBtn} ${tab === "weddings" && !selectedWedding ? styles.navBtnActive : ""}`} onClick={() => { setTab("weddings"); setSelectedWedding(null); }}>
              <span>✦</span> Casamientos
            </button>
          </nav>
          {weddings.length > 0 && (
            <div className={styles.weddingList}>
              <p className={styles.weddingListLabel}>Casamientos</p>
              {weddings.map((w) => (
                <button key={w.id} className={`${styles.weddingItem} ${selectedWedding?.id === w.id ? styles.weddingItemActive : ""}`} onClick={() => selectWedding(w)}>
                  {w.display_name}
                  <span className={styles.weddingItemId}>{w.id}</span>
                </button>
              ))}
            </div>
          )}
          <button className={styles.newWeddingBtn} onClick={() => { setShowNewForm(true); setSelectedWedding(null); setTab("weddings"); }}>+ Nuevo casamiento</button>
        </aside>

        <div className={styles.content}>
          {/* ── No wedding selected ── */}
          {!selectedWedding && tab === "weddings" && (
            <div>
              <div className={styles.contentHeader}>
                <h2 className={styles.contentTitle}>Casamientos</h2>
                <button className={styles.btnPrimary} onClick={() => setShowNewForm(true)}>+ Nuevo</button>
              </div>
              {showNewForm && (
                <div className={styles.newForm}>
                  <h3 className={styles.formTitle}>Nuevo casamiento</h3>
                  <div className={styles.formGrid}>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>ID (slug para la URL)</label>
                      <input className={styles.formInput} placeholder="sofi-nico" value={newId} onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
                      {newId && <p className={styles.formHint}>URL: .../?boda={newId}</p>}
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Nombre para mostrar</label>
                      <input className={styles.formInput} placeholder="Sofi & Nico" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    </div>
                  </div>
                  <div className={styles.formActions}>
                    <button className={styles.btnGhost} onClick={() => setShowNewForm(false)}>Cancelar</button>
                    <button className={styles.btnPrimary} onClick={createWedding} disabled={!newId || !newName || saving}>{saving ? "Guardando…" : "Crear casamiento"}</button>
                  </div>
                </div>
              )}
              {loadingWeddings ? (
                <div className={styles.loading}><div className={styles.spinner} /></div>
              ) : weddings.length === 0 ? (
                <div className={styles.empty}><p>No hay casamientos todavía.</p><p>Creá el primero con el botón de arriba.</p></div>
              ) : (
                <div className={styles.weddingCards}>
                  {weddings.map((w) => (
                    <div key={w.id} className={styles.weddingCard}>
                      <div className={styles.weddingCardName}>{w.display_name}</div>
                      <div className={styles.weddingCardId}>/?boda={w.id}</div>
                      <div className={styles.weddingCardActions}>
                        <button className={styles.btnSmall} onClick={() => navigator.clipboard.writeText(weddingUrl(w.id))}>Copiar link</button>
                        <button className={styles.btnSmallPrimary} onClick={() => selectWedding(w)}>Gestionar →</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Wedding selected ── */}
          {selectedWedding && (
            <div>
              <div className={styles.contentHeader}>
                <div>
                  <h2 className={styles.contentTitle}>{selectedWedding.display_name}</h2>
                  <p className={styles.contentSubtitle}>/?boda={selectedWedding.id}</p>
                </div>
                <button className={styles.btnSmall} onClick={() => navigator.clipboard.writeText(weddingUrl(selectedWedding.id))}>Copiar link invitadas</button>
              </div>

              <div className={styles.subTabs}>
                <button className={`${styles.subTab} ${tab === "dresses" ? styles.subTabActive : ""}`} onClick={() => { setTab("dresses"); fetchDresses(selectedWedding.id); }}>
                  Vestidos {dresses.length > 0 && `(${dresses.length})`}
                </button>
                <button className={`${styles.subTab} ${tab === "texts" ? styles.subTabActive : ""}`} onClick={() => setTab("texts")}>Textos</button>
                <button className={`${styles.subTab} ${tab === "design" ? styles.subTabActive : ""}`} onClick={() => setTab("design")}>
                  Diseño {selectedWedding.theme_json ? "✦" : ""}
                </button>
              </div>

              {/* Dresses tab */}
              {tab === "dresses" && (
                loadingDresses ? <div className={styles.loading}><div className={styles.spinner} /></div>
                : dresses.length === 0 ? <div className={styles.empty}><p>Aún no hay vestidos registrados.</p></div>
                : <div className={styles.grid}>
                    {dresses.map((d) => (
                      <div key={d.id} className={styles.dressCard} onClick={() => setLightboxSrc(d.image_url)}>
                        <img src={d.image_url} alt={d.guest_name} className={styles.dressImg} />
                        <div className={styles.dressInfo}>
                          <p className={styles.dressName}>{d.guest_name}</p>
                          <p className={styles.dressDate}>{new Date(d.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
              )}

              {/* Texts tab */}
              {tab === "texts" && (
                <div className={styles.textsForm}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Nombre para mostrar (título principal)</label>
                    <input className={styles.formInput} value={editTexts.display_name} onChange={(e) => setEditTexts((p) => ({ ...p, display_name: e.target.value }))} placeholder="Sofi & Nico" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Texto debajo del título (tagline)</label>
                    <textarea className={styles.formTextarea} value={editTexts.text_tagline} onChange={(e) => setEditTexts((p) => ({ ...p, text_tagline: e.target.value }))} rows={2} placeholder={DEFAULTS.text_tagline} />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Subtítulo opcional</label>
                    <input className={styles.formInput} value={editTexts.text_subtitle} onChange={(e) => setEditTexts((p) => ({ ...p, text_subtitle: e.target.value }))} placeholder="Ej: ¡Las esperamos!" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel}>Texto del pie de página</label>
                    <input className={styles.formInput} value={editTexts.text_footer} onChange={(e) => setEditTexts((p) => ({ ...p, text_footer: e.target.value }))} placeholder="Dress-up" />
                    <p className={styles.formHint}>Se muestra como: "[texto] · © {new Date().getFullYear()}"</p>
                  </div>
                  <div className={styles.formActions}>
                    {savedMsg && <span className={styles.savedMsg}>{savedMsg}</span>}
                    <button className={styles.btnPrimary} onClick={saveTexts} disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
                  </div>
                  <div className={styles.previewBox}>
                    <p className={styles.previewLabel}>Vista previa</p>
                    <p className={styles.previewTitle}>{editTexts.display_name || "Bienvenida"}</p>
                    <p className={styles.previewTagline}>{editTexts.text_tagline || DEFAULTS.text_tagline}</p>
                    {editTexts.text_subtitle && <p className={styles.previewSubtitle}>{editTexts.text_subtitle}</p>}
                    <p className={styles.previewFooter}>{editTexts.text_footer || DEFAULTS.text_footer} · © {new Date().getFullYear()}</p>
                  </div>
                </div>
              )}

              {/* Design tab */}
              {tab === "design" && (
                <div className={styles.designSection}>
                  <div className={styles.designOptions}>

                    {/* Option A: Standard */}
                    <div className={`${styles.designOption} ${!generatedTheme ? styles.designOptionActive : ""}`}>
                      <div className={styles.designOptionHeader}>
                        <div>
                          <p className={styles.designOptionTitle}>Plantilla estándar</p>
                          <p className={styles.designOptionDesc}>El diseño elegante rosado por defecto</p>
                        </div>
                        {!generatedTheme && <span className={styles.activeBadge}>Activo</span>}
                      </div>
                      <div className={styles.themeSwatches}>
                        {["#faf7f2","#b87e7e","#c9a070","#2e2320"].map((c) => (
                          <div key={c} className={styles.swatch} style={{ background: c }} title={c} />
                        ))}
                        <span className={styles.swatchLabel}>clásico elegante</span>
                      </div>
                      {generatedTheme && (
                        <button className={styles.btnGhost} onClick={resetTheme} disabled={saving}>
                          {saving ? "Aplicando…" : "← Volver a plantilla estándar"}
                        </button>
                      )}
                    </div>

                    {/* Option B: Custom from invitation */}
                    <div className={`${styles.designOption} ${generatedTheme ? styles.designOptionActive : ""}`}>
                      <div className={styles.designOptionHeader}>
                        <div>
                          <p className={styles.designOptionTitle}>Tema desde la invitación</p>
                          <p className={styles.designOptionDesc}>La IA extrae los colores y estilo de tu invitación</p>
                        </div>
                        {generatedTheme && <span className={styles.activeBadge}>Activo</span>}
                      </div>

                      {/* Upload area */}
                      <div
                        className={styles.invitationDrop}
                        onClick={() => invitationRef.current?.click()}
                      >
                        {invitationFile?.type === "application/pdf" ? (
                          <div className={styles.invitationDropEmpty}>
                            <p className={styles.invitationDropText}>PDF cargado · tocá para cambiar</p>
                            <small>{invitationFile.name}</small>
                          </div>
                        ) : invitationPreview && !invitationPreview.endsWith(".pdf") ? (
                          <img src={invitationPreview} alt="Invitación" className={styles.invitationPreview} />
                        ) : invitationPreview?.endsWith(".pdf") ? (
                          <div className={styles.invitationDropEmpty}>
                            <p className={styles.invitationDropText}>Invitación PDF guardada</p>
                            <small>Tocá para reemplazar</small>
                          </div>
                        ) : (
                          <div className={styles.invitationDropEmpty}>
                            <p className={styles.invitationDropText}>Subí tu invitación</p>
                            <small>JPG, PNG, WEBP o PDF</small>
                          </div>
                        )}
                      </div>
                      <input ref={invitationRef} type="file" accept="image/*,.pdf,application/pdf" style={{ display: "none" }} onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setInvitationFile(f);
                          if (f.type !== "application/pdf") {
                            setInvitationPreview(URL.createObjectURL(f));
                          } else {
                            setInvitationPreview(null);
                          }
                        }
                      }} />

                      {invitationFile && (
                        <button className={styles.btnPrimary} onClick={analyzeInvitation} disabled={analyzingTheme}>
                          {analyzingTheme ? "Analizando con IA…" : "✦ Generar tema desde esta invitación"}
                        </button>
                      )}

                      {/* Generated theme preview */}
                      {generatedTheme && (
                        <div className={styles.themeResult}>
                          <p className={styles.themeResultLabel}>Tema generado · {generatedTheme.aesthetic}</p>
                          <div className={styles.themeSwatches}>
                            {[generatedTheme.bg_color, generatedTheme.primary_color, generatedTheme.accent_color, generatedTheme.text_color].map((c) => (
                              <div key={c} className={styles.swatch} style={{ background: c }} title={c} />
                            ))}
                            <span className={styles.swatchLabel}>{generatedTheme.google_font}</span>
                          </div>
                          <div className={styles.themePagePreview} style={{
                            background: generatedTheme.bg_color,
                            border: `0.5px solid ${generatedTheme.border_color}`,
                          }}>
                            <p style={{ fontFamily: `'${generatedTheme.google_font}', serif`, fontSize: "1.3rem", fontStyle: "italic", color: generatedTheme.text_color }}>
                              {selectedWedding.display_name || "Nombre de la boda"}
                            </p>
                            <p style={{ fontSize: "0.75rem", color: generatedTheme.muted_color, marginTop: "0.3rem" }}>
                              {editTexts.text_tagline || DEFAULTS.text_tagline}
                            </p>
                            <div style={{ background: generatedTheme.card_color, border: `0.5px solid ${generatedTheme.border_color}`, borderRadius: "8px", padding: "0.6rem 1rem", marginTop: "0.75rem" }}>
                              <div style={{ background: generatedTheme.primary_color, borderRadius: "6px", padding: "0.3rem", textAlign: "center" }}>
                                <span style={{ fontSize: "0.7rem", color: "#fff" }}>Verificar mi vestido →</span>
                              </div>
                            </div>
                          </div>
                          {savedMsg && <p className={styles.savedMsg}>{savedMsg}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
