# Operation: Find [Name] — Live Investigation Board

> A tongue-in-cheek out-of-office experience. Colleagues submit "witness statements" about sightings; Claude extracts entities and plots them on a live knowledge graph and map.

**Built by**: Cameron Stiller · Nuix  
**Graph library**: [Ogma by Linkurious](https://doc.linkurious.com/ogma/latest/)

---

## What it does

- Colleagues visit the live site and see a real-time **investigation board** tracking the missing person's movements
- Staff can submit witness statements (e.g. "I saw Cameron at the airport with a suspicious amount of sunscreen")
- Claude API moderates each statement and extracts **entities** (locations, activities, associates) and **relationships**
- A background **GitHub poller** imports pre-planned sightings from a public JSON feed at a scheduled time — so the board updates itself while you're actually on holiday
- Everything lands on an interactive **Ogma knowledge graph** and **Leaflet map** that updates in real time via WebSockets

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Graph viz | [Ogma (Linkurious)](https://doc.linkurious.com/ogma/latest/) — commercial licence required |
| Map | Leaflet + OpenStreetMap |
| Backend | Node.js + Express + Socket.io |
| AI | Anthropic Claude API (entity extraction, moderation) |
| Geocoding | Nominatim (OpenStreetMap) — rate-limited at 1 req/s |
| Database | PostgreSQL |
| Deployment | Docker Compose (local) · Helm + k3s (production) |
| Real-time | Socket.io (WebSocket broadcast on new sightings) |

---

## Quick start (Docker)

```bash
cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, TARGET_NAME, LAST_SEEN_DATE, POLL_URL
# Optionally set: DB_USER, DB_PASSWORD, DB_NAME (defaults are fine for local dev)

docker-compose up -d
# Frontend → http://localhost:3000
# Backend  → http://localhost:3001
```

### Ogma licence

Ogma is a commercial graph library. You need a licence from [Linkurious](https://linkurious.com/ogma/).  
Once you have the `.zip`, extract the JS files into `frontend/public/ogma/` (the path `vite.config.ts` expects).

---

## Environment variables

Copy `.env.example` and fill in:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `TARGET_NAME` | Name of the "missing" person (e.g. `Cameron Stiller`) |
| `LAST_SEEN_DATE` | Display date in the header (e.g. `2026-06-26`) |
| `POLL_URL` | URL to a JSON array of pre-planned sightings (see below) |
| `POLL_INTERVAL_MS` | How often to check `POLL_URL` (default `300000` = 5 min) |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | PostgreSQL credentials (defaults fine for local) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Only if using AWS Bedrock instead of direct Anthropic API |

---

## Pre-planned sightings feed

The poller fetches a JSON file from `POLL_URL` every `POLL_INTERVAL_MS`. Format:

```json
[
  {
    "time": "2026-06-27T09:20:00",
    "location": "Sydney Airport Terminal 1, Mascot NSW 2020",
    "activity": "Checking in at the departure gate",
    "associate": "Optional — person or thing they were with"
  }
]
```

- `time` is treated as **AEST (UTC+10)** and is also the dedup key — duplicate times are skipped
- Future-dated entries are ignored until their time arrives, so you can commit the whole trip upfront
- Geocoding is done via Nominatim; no coordinates needed in the feed

A good workflow: keep sightings in a separate **public GitHub raw URL** so you can edit them from your phone while you're away.

---

## Kubernetes / Helm deployment

The `helm/operation-find-cameron/` chart deploys frontend, backend, PostgreSQL (Bitnami subchart), and Traefik ingress with a `/demo` subpath.

```bash
helm upgrade --install operation-find-cameron ./helm/operation-find-cameron \
  -n your-namespace \
  --set backend.env.ANTHROPIC_API_KEY=sk-... \
  --set backend.env.TARGET_NAME="Your Name" \
  --set backend.env.POLL_URL="https://raw.githubusercontent.com/..." \
  --set postgresql.auth.password=changeme
```

Images are expected to be pre-built and imported on the node (`imagePullPolicy: Never`) — see `DEPLOYMENT.md` for the full build-and-import workflow.

---

## Project structure

```
├── backend/
│   ├── src/
│   │   ├── index.ts              Express + Socket.io server
│   │   ├── routes/witness.ts     API endpoints
│   │   └── services/
│   │       ├── claude.ts         Anthropic API — entity extraction & moderation
│   │       ├── database.ts       PostgreSQL operations
│   │       ├── geo.ts            Nominatim geocoding + reverse geocoding
│   │       └── poller.ts         GitHub sightings feed poller
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx               Shell, timeline playback, header stats
│   │   └── components/
│   │       ├── GraphVisualization.tsx   Ogma knowledge graph
│   │       ├── MapView.tsx              Leaflet map with suburb clustering
│   │       ├── WitnessForm.tsx          Statement submission (staff only)
│   │       └── LocationAutocomplete.tsx Nominatim address search
│   └── Dockerfile
├── helm/operation-find-cameron/  Helm chart for Kubernetes
├── docker-compose.yml            Local dev / demo
└── .env.example                  Environment variable template
```

---

## Adapting for your own OOO

1. Fork this repo
2. Set `TARGET_NAME` to your name
3. Create a public GitHub repo with your sightings JSON (see format above)
4. Set `POLL_URL` to the raw URL of that file
5. Deploy with Docker Compose or Helm
6. Put the URL in your out-of-office email

---

## Licence

Source code: MIT  
Ogma graph library: commercial licence required from [Linkurious](https://linkurious.com/ogma/) — not included in this repo.
