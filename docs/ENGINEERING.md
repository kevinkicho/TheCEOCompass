# Engineering Decisions

## Architecture

```
GitHub Pages (static)      Firebase RTDB         Local Agent (WSL)
     │                         │                       │
     ├── push /requests/ ────► │                       │
     │                         ├── onChildAdded ──────► │
     │                         │                       ├── POST localhost:11434
     │                         │◄─── /responses/ ──────┤
     │◄─── /framework/*/responses                       │
```

**Key principle**: the browser never calls localhost directly. All AI requests go through Firebase RTDB, eliminating CORS issues entirely.

## Why Firebase RTDB instead of a proxy?

The original approach used a CORS proxy (Node.js) and a second Ollama instance on port 11435. This added complexity — two extra processes to manage. Firebase RTDB acts as a durable message queue: the browser writes a request, the agent picks it up, calls Ollama, and writes the response. The browser subscribes to the response path via real-time listener.

## Why no Python backend?

The original FastAPI backend handled scenarios, journal, progress, and quiz endpoints. Over time, framework data moved to `staticData.ts` (static export), AI moved to direct Ollama via Firebase, and the remaining features (journal, progress) were deemed out of scope for the static demo. The result: zero backend dependencies for the deployed site.

## Static Generation

Next.js 14 generates 356 pages at build time:
- 57 framework overview pages (`/frameworks/[slug]`)
- 282 concept detail pages (`/frameworks/[slug]/[conceptSlug]`)
- 6 scenario pages
- 10 static pages (home, frameworks browse, quiz, etc.)

`generateStaticParams` reads from `slugs.json` which contains all framework slugs and their concept slugs. Build time ~20s.

## Firebase RTDB Structure

```
/requests/$uuid           ← agent watches this
  type, framework_slug, concept_slug, payload, status, created_at

/responses/$uuid          ← flat path, agent writes here
  result, model, created_at

/framework/{slug}/
  {concept}/
    responses/$uuid       ← indexed for caching, includes prompt
      result, prompt, model, created_at
  quiz/
    responses/$uuid       ← quiz responses indexed per framework
```

## Cache Strategy

- Frontend checks `/framework/{slug}/{concept}/responses` before pushing
- TTL: 24 hours
- Full prompt stored alongside result for admin editing
- "Re-generate" always bypasses cache via `skipCache` flag

## Auth

- Firebase Auth with Google provider
- Admin determined by email `kevinkicho@gmail.com`
- Admin can edit cached prompts (inline textarea → write to RTDB)
- RTDB rules restrict `framework/*/responses` writes to authenticated admin

## Sidebar

File-tree panel showing all 57 frameworks with collapsible concept lists:
- Expand/collapse fully independent from main view
- Real-time search filters across 282 concepts
- Mobile: slide-in drawer via FAB button
- Desktop: sticky sidebar, w-72

## AI Prompts

Each prompt includes framework context:
- Domain, difficulty, use cases, related concepts
- System prompt specialized per task: `explain` vs `quiz`
- Stored in indexed response for review/editing
