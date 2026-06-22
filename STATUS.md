# Project Status - 2026-06-13

## ✅ What's Working

### Infrastructure
- **Docker Compose**: All 3 containers running (db, backend, frontend)
- **PostgreSQL**: Database initialized with schema
- **Backend**: Express server on port 3001 with WebSocket support
- **Frontend**: React + Vite on port 3000 with Ogma loaded
- **AWS Bedrock**: SDK installed, credentials passing through

### Database
- Target person created: **Cameron Stiller**
- Status: MISSING
- Last seen: 2026-06-26 (Friday, June 26th - your last working day)
- Leave period: June 29 - July 17, 2026

### Endpoints
- `GET /health` - ✅ Working
- `GET /api/graph` - ✅ Working (returns Cameron as target node)
- `POST /api/witness-statement` - 🟡 Partially working (see issue below)

## 🔧 Current Issues

### Issue 1: Network Error on Statement Submission
**Status**: Frontend cannot reach backend API
**Likely Cause**: Vite proxy not configured correctly or CORS issue
**Location**: `frontend/vite.config.ts` and backend CORS settings

### Issue 2: JSON Parsing
**Problem**: Claude via Bedrock is wrapping JSON responses in markdown code blocks
```
```json
{...}
```
```

**Location**: `backend/src/services/claude.ts` line 89

**Solution Needed**: Strip markdown code fences before parsing JSON

**Quick Fix**:
```typescript
// Replace line 89 in claude.ts:
let textToParse = content.text.trim();
// Remove markdown code fences if present
if (textToParse.startsWith('```')) {
  textToParse = textToParse
    .replace(/^```json?\n?/i, '')
    .replace(/\n?```$/,  '');
}
const response = JSON.parse(textToParse) as ClaudeEntityResponse;
```

## 📦 What's Been Built

### Backend (`/backend`)
- **TypeScript** setup with tsx
- **Express** REST API
- **Socket.io** for real-time updates  
- **PostgreSQL** with pg driver
- **AWS Bedrock** integration for Claude
- **Rate limiting** (10 req/min per IP)
- **CORS** configured for frontend

**Key Files**:
- `src/index.ts` - Main server
- `src/services/claude.ts` - AWS Bedrock/Claude integration
- `src/services/database.ts` - PostgreSQL operations
- `src/routes/witness.ts` - API endpoints
- `src/types/index.ts` - TypeScript types

### Frontend (`/frontend`)
- **React 18** + **TypeScript**
- **Vite** dev server with HMR
- **Ogma v6.0.5** graph visualization
- **Socket.io-client** for WebSocket
- Investigation-themed dark UI

**Key Files**:
- `src/App.tsx` - Main application
- `src/components/GraphVisualization.tsx` - Ogma graph component
- `src/components/WitnessForm.tsx` - Statement submission
- `src/services/api.ts` - Backend API client
- `public/ogma/` - Ogma library files

### Docker Setup
- **db**: PostgreSQL 15-alpine with healthcheck
- **backend**: Node 18-alpine, mounts code for hot-reload
- **frontend**: Node 18-alpine with Vite dev server
- All pass AWS credentials from environment

## 🎯 Next Steps (In Order)

1. **Fix JSON parsing** - Apply the markdown stripping fix above
2. **Rebuild backend**: `docker-compose restart backend`
3. **Test witness statement**: Use the test_statement.json file
4. **Verify graph update**: Check `/api/graph` shows new nodes
5. **Test frontend**: Open http://localhost:3000 and submit via UI
6. **Test real-time**: Open 2 browser windows, submit in one, watch both update

## 🧪 Testing

### Test Statement
File: `test_statement.json`
```json
{
  "statement": "I saw Cameron at a coffee shop in Sydney reviewing R&D proposals yesterday",
  "witnessName": "Alice Chen"
}
```

### Expected Result
**Nodes Created**:
- Alice Chen (WITNESS)
- Sydney (LOCATION)
- coffee shop (LOCATION)
- reviewing R&D proposals (ACTIVITY)
- yesterday (TIME)

**Edges Created**:
- Alice Chen → Sydney (REPORTED_SIGHTING_AT)
- Cameron Stiller → coffee shop (SEEN_AT)
- Cameron Stiller → reviewing R&D proposals (DOING)

### Test Commands
```bash
# Health check
curl http://localhost:3001/health

# Get current graph
curl http://localhost:3001/api/graph

# Submit statement
curl -X POST http://localhost:3001/api/witness-statement \
  -H "Content-Type: application/json" \
  -d @test_statement.json

# Check logs
docker-compose logs backend --tail=20
docker-compose logs frontend --tail=20

# Restart services
docker-compose restart backend
docker-compose restart frontend
```

## 📁 Project Structure
```
out_of_office_fun/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/witness.ts
│   │   ├── services/
│   │   │   ├── claude.ts    # AWS Bedrock integration
│   │   │   └── database.ts  # PostgreSQL
│   │   └── types/index.ts
│   ├── Dockerfile
│   └── package.json
├── frontend/                # React application
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── GraphVisualization.tsx
│   │   │   └── WitnessForm.tsx
│   │   └── services/api.ts
│   ├── public/ogma/         # Ogma v6.0.5
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml       # Orchestration
├── .env                     # Config (not tracked)
├── test_statement.json      # Test data
└── Documentation/
    ├── README.md
    ├── QUICKSTART.md
    ├── PROJECT_PLAN.md
    ├── ARCHITECTURE.md
    ├── TECHNICAL_SPECS.md
    ├── IMPLEMENTATION_ROADMAP.md
    └── CLAUDE.md

## 🔐 Configuration

### Environment Variables (in docker-compose.yml)
```yaml
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
AWS_REGION=us-east-1
ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
TARGET_NAME=Cameron Stiller
LAST_SEEN_DATE=2026-06-26
```

## 🌐 URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Backend Health**: http://localhost:3001/health
- **Graph Endpoint**: http://localhost:3001/api/graph
- **PostgreSQL**: localhost:5432 (user: witness, db: witness_board)

## 💡 Notes

### Why Bedrock?
Cameron's environment has AWS credentials configured (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) but no direct Anthropic API key. The backend uses `@aws-sdk/client-bedrock-runtime` to call Claude via AWS Bedrock.

### Ogma Setup
Ogma v6.0.5 is extracted in `frontend/public/ogma/` and loaded via script tag in `index.html`. The license is from Nuix's Linkurious access.

### Development Mode
Both frontend and backend run in dev mode with hot-reload:
- Backend: `tsx watch` monitors TypeScript changes
- Frontend: Vite HMR automatically updates browser
- Code changes require no manual restarts

### Database Persistence
PostgreSQL data persists in Docker volume `postgres_data`. To reset:
```bash
docker-compose down -v  # WARNING: Deletes all witness statements
docker-compose up -d
```

## 🚀 Resume Work

To continue where we left off:

1. **Start services**: `docker-compose up -d`
2. **Apply the JSON parsing fix** (see "Current Issue" above)
3. **Restart backend**: `docker-compose restart backend`
4. **Test**: `curl -X POST http://localhost:3001/api/witness-statement -H "Content-Type: application/json" -d @test_statement.json`
5. **Open frontend**: http://localhost:3000
6. **Submit statements and watch the graph grow!**

The infrastructure is solid - just needs that one-line parsing fix to handle Claude's markdown-wrapped responses.
