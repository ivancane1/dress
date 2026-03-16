"use client";

import { useEffect, useState } from "react";
import styles from "./admin.module.css";

interface Dress {
  id: string;
  guest_name: string;
  image_url: string;
  created_at: string;
}

export default function AdminPage() {
  const [dresses, setDresses] = useState<Dress[]>([]);
  const [loading, setLoading] = useState(true);
  const [weddingId, setWeddingId] = useState("default");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wid = params.get("boda") || "default";
    setWeddingId(wid);
    fetchDresses(wid);
  }, []);

  const fetchDresses = async (wid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/register?wedding_id=${encodeURIComponent(wid)}`);
      const data = await res.json();
      setDresses(data.dresses || []);
    } catch {
      setDresses([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Panel de Vestidos</h1>
        <p className={styles.subtitle}>
          Boda: <code>{weddingId}</code> · {dresses.length} vestido{dresses.length !== 1 ? "s" : ""} registrado{dresses.length !== 1 ? "s" : ""}
        </p>
        <button className={styles.refreshBtn} onClick={() => fetchDresses(weddingId)}>
          ↻ Actualizar
        </button>
      </header>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Cargando…</p>
        </div>
      )}

      {!loading && dresses.length === 0 && (
        <div className={styles.empty}>
          <p>Aún no hay vestidos registrados para este casamiento.</p>
        </div>
      )}

      {!loading && dresses.length > 0 && (
        <div className={styles.grid}>
          {dresses.map((d) => (
            <div key={d.id} className={styles.dressCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.image_url} alt={d.guest_name} className={styles.dressImg} />
              <div className={styles.dressInfo}>
                <p className={styles.dressName}>{d.guest_name}</p>
                <p className={styles.dressDate}>
                  {new Date(d.created_at).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
