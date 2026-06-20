# CEO Compass

**[Live Demo →](https://kevinkicho.github.io/TheCEOCompass/)**

57 leadership frameworks, 282 concepts, AI-powered quiz + explanations, decision journal.

---

## Architecture

```
Browser (GitHub Pages)         Firebase RTDB          Local Agent (WSL)
       │                           │                        │
       ├── push /requests/ ──────► │                        │
       │                           ├── onChildAdded ──────► │
       │                           │                        ├── POST localhost:11434
       │                           │◄─── /responses/ ───────┤
       │◄─── /framework/*/responses                          │
```

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | Next.js 14 (static export) + TypeScript + Tailwind | 356 SSG pages, no backend |
| AI bridge | Firebase RTDB | Browser → Firebase → local agent → Ollama |
| Local agent | Node.js + firebase-admin | Watches `/requests`, calls Ollama at `localhost:11434` |
| Auth | Firebase Auth (Google) | Admin prompt editing for `kevinkicho@gmail.com` |
| Cache | `framework/{slug}/{concept}/responses` | 24h TTL, auto-displayed on load |

---

## Quick Start

```bash
# Frontend
cd frontend && cp .env.example .env  # fill Firebase values
npm install && npm run dev           # → localhost:33221

# Agent (requires service account key in agent/)
cd agent && npm install && node index.js
```

Log in via Google on the Profile page to edit AI prompts.

---

## Routes

| Route | Content | Static |
|-------|---------|--------|
| `/` | Landing | ○ |
| `/frameworks` | Browse 57 frameworks | ○ |
| `/frameworks/[slug]` | Framework overview | ● 57 |
| `/frameworks/[slug]/[conceptSlug]` | Concept detail + AI | ● 282 |
| `/scenarios` | Browse scenarios | ○ |
| `/scenarios/[slug]` | Scenario engine | ● 6 |
| `/quiz` | AI-generated quiz | ○ |
| `/journal` | Decision journal | ○ |
| `/pathway` | Learning pathway | ○ |
| `/profile` | AI settings + sign-in | ○ |
| `/cheatsheet` | Quick reference | ○ |

All 356 framework/concept pages statically generated at build time.

---

## Key Features

- **File-tree sidebar**: All 57 frameworks with collapsible concept lists, search
- **AI explanations**: Ollama-generated, cached 24h, auto-displayed on load
- **Quiz generation**: Per-framework, AI-generated questions
- **Styled AI cards**: Color-coded (sky/violet/amber/emerald) with icons
- **Prompt management**: Show/hide prompt, admin can edit cached prompts
- **Google Sign-In**: Admin prompt editing on profile page
- **Console logs**: `[AI]` prefixed messages tracking cache hits/misses/requests

---

## File Structure

```
ceo-platform/
├── frontend/src/
│   ├── app/
│   │   ├── frameworks/[slug]/
│   │   │   ├── layout.tsx        # generateStaticParams for 57 slugs
│   │   │   ├── page.tsx           # Framework overview (concept grid)
│   │   │   └── [conceptSlug]/
│   │   │       ├── layout.tsx     # generateStaticParams for 282 concepts
│   │   │       └── page.tsx       # Concept detail + AI explanation
│   │   ├── layout.tsx             # Navbar + AppSidebar + content
│   │   └── profile/page.tsx       # AI settings + Google Sign-In
│   ├── components/
│   │   ├── AppSidebar.tsx         # File-tree sidebar (all frameworks)
│   │   ├── Navbar.tsx             # Top nav bar
│   │   └── ...
│   └── lib/
│       ├── ollama.ts              # AI: cache, Firebase push/subscribe
│       ├── firebase.ts            # Firebase init (RTDB + Auth)
│       ├── useAuth.ts             # Google Sign-In hook
│       ├── api.ts                 # Static framework data
│       ├── staticData.ts          # 57 frameworks, 282 concepts
│       └── types.ts               # TypeScript interfaces
├── agent/
│   ├── index.js                   # Firebase watcher → Ollama → indexed write
│   ├── package.json
│   └── .gitignore
├── .github/workflows/
│   ├── ci.yml                     # Vitest + Next.js build
│   └── deploy.yml                 # Static export to GitHub Pages
├── AGENTS.md                      # AI agent dev instructions
└── README.md
```

---

## GitHub Secrets

| Secret | Required for |
|--------|-------------|
| `FIREBASE_API_KEY` | CI build + deploy |
| `FIREBASE_AUTH_DOMAIN` | CI build + deploy |
| `FIREBASE_DATABASE_URL` | CI build + deploy |
| `FIREBASE_PROJECT_ID` | CI build + deploy |
| `FIREBASE_STORAGE_BUCKET` | CI build + deploy |
| `FIREBASE_MESSAGING_SENDER_ID` | CI build + deploy |
| `FIREBASE_APP_ID` | CI build + deploy |

---

Built by **DeepSeek V4 Pro** via **OpenCode Go**.
