# Stack

## Backend
- **Python 3.11+** with **FastAPI** and **Uvicorn**
- **Ollama** (local LLM, model: phi3.5) for email classification
- File-based JSON store for classification cache

## Frontend
- **React 19** with **TypeScript**
- **Material UI (MUI) 7**
- **Vite** for dev server and bundling

## Infrastructure
- **Docker** — all modes run in containers
- **GPU passthrough** — auto-detected via nvidia runtime

## Run Modes

| Script | Purpose | Ollama | Data location | Claude |
|---|---|---|---|---|
| `claude-ollama.sh` | Development with Claude | Inside container | `backend/data/` | Yes |
| `run-real.sh` | Real Gmail processing | Inside container | `~/.gmail_receipts/` | No |
