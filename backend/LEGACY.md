# Legacy FastAPI backend

The production CEO Compass path is:

- Next.js static export (GitHub Pages)
- Firebase RTDB for content + user data + AI request bus
- Local `agent/` + Ollama for AI

This `backend/` directory is retained for historical scenario/API experiments only.
It is **not** required for the live site. CI runs it only via `.github/workflows/backend-legacy.yml`
when `backend/**` changes or on manual dispatch.
