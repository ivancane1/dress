# 💍 Wedding Dress Checker

App para compartir en invitaciones de casamiento. Las invitadas suben su vestido y la IA avisa si ya hay alguien con uno igual.

## Stack

- **Next.js 14** (App Router) — frontend + API routes
- **Supabase** — base de datos PostgreSQL + almacenamiento de fotos
- **Claude API** — comparación de imágenes con visión IA
- **Vercel** — hosting con deploy automático

---

## Setup paso a paso

### 1. Clonar y configurar localmente

```bash
git clone <tu-repo>
cd wedding-dress-app
npm install
cp .env.example .env.local
```

### 2. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → New project
2. Una vez creado, ir a **SQL Editor** y ejecutar todo el contenido de `supabase/schema.sql`
3. Copiar las claves desde **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 3. Obtener API key de Anthropic

1. Ir a [console.anthropic.com](https://console.anthropic.com)
2. **API Keys → Create Key**
3. Copiar como `ANTHROPIC_API_KEY`

### 4. Llenar el `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

### 5. Probar localmente

```bash
npm run dev
# Abrir http://localhost:3000
```

---

## Deploy en Vercel

### Opción A — Deploy desde GitHub (recomendado)

1. Subir el proyecto a GitHub
2. Ir a [vercel.com](https://vercel.com) → New Project → importar el repo
3. En **Environment Variables**, agregar las 4 variables del `.env.local`
4. Click en **Deploy**

Vercel te da una URL tipo `https://wedding-dress-app.vercel.app` — esa es la que mandás en la invitación.

### Opción B — Deploy con CLI

```bash
npm i -g vercel
vercel --prod
# Seguir las instrucciones; agregar las env vars cuando pregunte
```

---

## Dominio personalizado (opcional)

1. Comprar dominio en [Namecheap](https://namecheap.com) o [NIC.ar](https://nic.ar)
2. En Vercel → tu proyecto → **Settings → Domains**
3. Agregar el dominio y seguir las instrucciones DNS

---

## URLs de la app

| URL | Descripción |
|-----|-------------|
| `tudominio.com/?boda=nombre-novia-novio` | Invitadas registran vestido |
| `tudominio.com/admin?boda=nombre-novia-novio` | Panel admin (ven todos los vestidos) |

El parámetro `boda` permite usar la misma app para múltiples casamientos.

**Ejemplo:**
- `https://mi-boda.vercel.app/?boda=sofi-nico` — link para invitadas
- `https://mi-boda.vercel.app/admin?boda=sofi-nico` — panel para los novios

---

## Costos estimados

| Servicio | Plan | Costo |
|----------|------|-------|
| Vercel | Hobby (free) | $0 |
| Supabase | Free (1GB storage) | $0 |
| Claude API | ~100 comparaciones | ~$1 |
| Dominio | .com/.ar | ~$10/año |
| **Total** | | **~$11** |

---

## Personalizar el nombre de la boda

En `app/page.tsx` el nombre se toma automáticamente del parámetro `?boda=` en la URL.
Si querés hardcodearlo, modificá esta línea en el `useEffect`:

```typescript
setWeddingLabel("la Boda de Sofi & Nico");
```

---

## Estructura del proyecto

```
wedding-dress-app/
├── app/
│   ├── layout.tsx          ← HTML base, fuentes
│   ├── page.tsx            ← UI principal (formulario + resultados)
│   ├── page.module.css     ← Estilos de la UI
│   ├── globals.css         ← Variables CSS globales
│   └── api/register/
│       └── route.ts        ← API: guarda vestidos y llama a Claude
├── app/admin/
│   ├── page.tsx            ← Panel para ver todos los vestidos
│   └── admin.module.css
├── lib/
│   └── supabase.ts         ← Cliente de Supabase (server)
├── supabase/
│   └── schema.sql          ← Tablas y políticas de seguridad
├── .env.example            ← Plantilla de variables de entorno
└── README.md
```
