# Maintenance Guide

## Daily Operations

### Starting the App Locally

```bash
# Terminal 1 — Backend (port 50128)
cd ceo-platform
source venv/bin/activate
cd backend
uvicorn app.main:app --port 50128 --host 0.0.0.0

# Terminal 2 — Frontend (port 33221)
cd ceo-platform/frontend
npm run dev
```

If the frontend shows a blank page or build errors:
```bash
cd frontend && rm -rf .next && npm run dev
```

### Database
- **Dev**: SQLite via `aiosqlite` — file `ceo-platform/backend/ceo_platform.db`
- **Config**: Set `DATABASE_URL=sqlite+aiosqlite:///./ceo_platform.db` in `backend/.env`
- **Reset**: Delete `ceo_platform.db` and re-seed: `PYTHONPATH=backend python backend/seed/seed_db.py`

---

## Adding Content

### Adding a New Framework

1. Edit `backend/seed/frameworks.json`
2. Add entry with UUID, slug, title, description, category, concepts[]
3. Each concept needs: `name`, `definition`, `example` (3 examples separated by ` | `), `tags[]`, optional `formula`
4. Re-generate static data:
   ```bash
   cd frontend
   python3 -c "..."  # extracts concepts from seed JSON → staticData.ts
   ```
5. Re-seed database: `PYTHONPATH=backend python backend/seed/seed_db.py`
6. Add to learning pathway in `src/app/pathway/page.tsx` (PATHWAY_STEPS array)

### Adding a Scenario

1. Edit `backend/seed/scenarios.json`
2. Structure: `{ id, slug, title, description, framework_id, difficulty, context, stages[], outcome_branches{} }`
3. Each stage: `{ id, type, prompt, options[], free_response_prompt, feedback_prompt_template }`
4. Re-seed: `PYTHONPATH=backend python backend/seed/seed_db.py`

### Adding a Quiz Question

1. Edit `backend/seed/quiz_questions.json`
2. Format: `{ id, framework_id, question, type, options[], correct_answer, explanation }`
3. Options must be full answer text (not "Option A/B/C")

### Adding a New Page

1. Create `src/app/[route]/page.tsx` with `"use client"` directive
2. Add layout file if route has dynamic params: `src/app/[route]/[slug]/layout.tsx` with `generateStaticParams`
3. Add to `src/data/slugs.json` if needed for static export
4. Add nav link in `src/components/Navbar.tsx` (NAV_ITEMS array)
5. Apply dark mode variants (see [DESIGN.md](./DESIGN.md#color-mapping-rules))

---

## Dark Mode

All new components must include `dark:` variants for every color class.

**Checklist for new elements:**
- [ ] `bg-white` → add `dark:bg-dark-900`
- [ ] `bg-dark-50` → add `dark:bg-dark-900`
- [ ] `bg-dark-100` → add `dark:bg-dark-800`
- [ ] `bg-primary-50` → add `dark:bg-primary-900/20`
- [ ] `text-dark-900` → add `dark:text-dark-100`
- [ ] `text-dark-600/700` → add `dark:text-dark-300`
- [ ] `text-dark-500` → add `dark:text-dark-300`
- [ ] `text-dark-400` → add `dark:text-dark-300`
- [ ] `border-dark-200` → add `dark:border-dark-700`
- [ ] All `hover:bg-*` → add `dark:hover:bg-*`
- [ ] Template literal `${... ? "class-a" : "class-b"}` → dark variants INSIDE both strings

---

## Deploying

### GitHub Pages (Automatic)
Push to `master` → CI builds and deploys automatically via `.github/workflows/deploy.yml`

### Manual Verification
```bash
# Test production build locally
cd frontend
cp next.config.export.js next.config.js
npx next build
# Serve output
npx serve out
```

### Deploy Pipeline (`deploy.yml`)
1. Checkout → Setup Node 20 → `npm install --legacy-peer-deps`
2. Copy `next.config.export.js` → `next.config.js`
3. `npx next build` (output → `frontend/out/`)
4. Upload artifact via `actions/upload-pages-artifact@v3`
5. Deploy via `actions/deploy-pages@v4`

### Static Export Config (`next.config.export.js`)
```js
{
  output: "export",
  basePath: "/TheCEOCompass",
  assetPrefix: "/TheCEOCompass",
  trailingSlash: true,
  images: { unoptimized: true }
}
```

---

## Testing

```bash
# Frontend unit tests (Vitest)
cd frontend && npx vitest run

# Backend unit tests (pytest)
cd backend && source ../venv/bin/activate && python -m pytest tests/unit/ -q

# Backend integration tests (require SQLite)
cd backend && source ../venv/bin/activate && python -m pytest tests/integration/ -q
```

**Test locations:**
- `frontend/src/components/__tests__/` — React component tests
- `frontend/src/lib/__tests__/` — API client and type tests
- `backend/tests/unit/` — ScenarioEngine logic, LLM service mocks
- `backend/tests/integration/` — API contract tests (uses test SQLite DB)

---

## CI/CD (`ci.yml`)

Three jobs on every push:
1. **backend-tests**: Python 3.12, pip install, pytest with 60% coverage threshold
2. **frontend-tests**: Node 20, `npm install --legacy-peer-deps`, vitest
3. **frontend-build**: Same as #2 + `npx next build` (must compile clean)

---

## Troubleshooting

### "Module not found: ./479.js" on dev server
Cause: stale `.next` cache after config changes.
```bash
rm -rf frontend/.next && npm run dev
```

### Backend won't start: "No module named asyncpg"
Cause: `.env` has PostgreSQL URL but no `asyncpg` installed.
```bash
# In backend/.env, set:
DATABASE_URL=sqlite+aiosqlite:///./ceo_platform.db
```

### Build fails: "staticFrameworks defined multiple times"
Check for duplicate import statements in the failing file.

### GitHub Pages shows README instead of app
Cause: Pages source set to "branch" instead of "GitHub Actions".
```bash
gh api repos/kevinkicho/TheCEOCompass/pages -X PUT -f build_type=workflow
```

### Dark mode not working on live site
- Check: Is `dark` class being added to `<html>`? (ThemeProvider client component)
- Check: Are CSS files loading with dark variants?
- Check: Are template literal strings missing dark variants?
- Verify with: `document.documentElement.classList.toggle('dark')` in browser console

### White text on light background in dark mode
The component is using `bg-primary-50` or `bg-white` without a `dark:bg-*` variant. See [DESIGN.md](./DESIGN.md#color-mapping-rules).

### Chips/filters overflowing on mobile
Ensure the flex container has `flex-wrap`:
```tsx
<div className="flex flex-wrap gap-2">  // NOT just "flex gap-2"
```

---

## File Updates Checklist

When changing any visual element:
1. [ ] Add `dark:` variants for all color classes
2. [ ] Test on mobile viewport (< 640px)
3. [ ] Test on desktop viewport
4. [ ] Run `npx next build` (must pass)
5. [ ] Verify on local dev server
6. [ ] Check GitHub Pages after deploy
