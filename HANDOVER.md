# 🔄 HANDOVER - Resume Development

## Quick Status
**95% Complete** - Infrastructure working, one parsing fix + network config needed

## What's Working ✅
- Docker Compose with 3 containers running
- PostgreSQL database initialized
- Backend API on http://localhost:3001 (tested with curl - works)
- Frontend UI on http://localhost:3000 (loads, shows graph)
- AWS Bedrock/Claude integration (responding with entities)
- Cameron Stiller in database as target person

## What Needs Fixing 🔧

### 1. Frontend → Backend Network Issue
**Problem**: Frontend shows network error when submitting statements
**Works**: `curl` directly to backend works fine
**Doesn't Work**: Frontend fetch to `/api/witness-statement`

**Root Cause**: Proxy configuration or CORS

**Fix Options**:

**Option A - Fix Vite Proxy** (in `frontend/vite.config.ts`):
```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',  // Change from 'http://backend:3001'
      changeOrigin: true,
    },
  },
}
```

**Option B - Update Frontend API URL** (in `frontend/src/services/api.ts`):
```typescript
const API_BASE = 'http://localhost:3001/api';  // Direct to backend
```

**Then restart**: `docker-compose restart frontend`

### 2. Strip Markdown from Claude Response
**Location**: `backend/src/services/claude.ts` line ~89

**Current Code**:
```typescript
const response = JSON.parse(content.text) as ClaudeEntityResponse;
```

**Fixed Code**:
```typescript
let textToParse = content.text.trim();
// Remove markdown code fences if present
if (textToParse.startsWith('```')) {
  textToParse = textToParse
    .replace(/^```json?\n?/i, '')
    .replace(/\n?```$/, '');
}
const response = JSON.parse(textToParse) as ClaudeEntityResponse;
```

**Then restart**: `docker-compose restart backend`

## Resume Work - Step by Step

### 1. Start Everything
```bash
cd C:\claude\out_of_office_fun
docker-compose up -d
```

Wait 10 seconds for database to be healthy and backend to start.

### 2. Verify Backend Works
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}

curl http://localhost:3001/api/graph
# Should show Cameron Stiller as a node
```

### 3. Apply Fixes

**Backend Fix** (claude.ts):
- Open `backend/src/services/claude.ts`
- Find line ~89: `const response = JSON.parse(content.text)`
- Replace with the code block from "Fix Options" above
- Save file (backend auto-reloads with tsx watch)

**Frontend Fix** (pick one):
- **Option A**: Edit `frontend/vite.config.ts` - change proxy target
- **Option B**: Edit `frontend/src/services/api.ts` - use direct URL
- Restart: `docker-compose restart frontend`

### 4. Test Backend Directly
```bash
curl -X POST http://localhost:3001/api/witness-statement \
  -H "Content-Type: application/json" \
  -d @test_statement.json
```

**Expected Response**:
```json
{
  "success": true,
  "caseNumber": "CASE-2026-1001",
  "status": "approved",
  "message": "Thank you for your statement, Investigator Alice Chen",
  "badge": {...},
  "extractedEntities": [...]
}
```

### 5. Test Frontend
1. Open http://localhost:3000 in browser
2. Click "SUBMIT STATEMENT" button
3. Fill form:
   - Name: Test Witness
   - Statement: I saw Cameron at Circular Quay having coffee this morning
4. Click submit
5. Watch graph update with new nodes!

### 6. Test Real-Time
- Open http://localhost:3000 in two browser windows
- Submit in one window
- Watch both graphs update simultaneously

## Expected Final Result

**Graph Should Show**:
- 🔴 Cameron Stiller (center, large, red - PERSON/TARGET)
- 🔵 Witness nodes (blue - WITNESS)
- 🟢 Location nodes (green - LOCATION)  
- 🟣 Activity nodes (purple - ACTIVITY)
- Lines connecting them showing relationships

**Example After 3 Submissions**:
```
        [Alice Chen]---reports-->[Sydney]
               |                    |
            reported             contains
               |                    |
               v                    v
        [Cameron Stiller]---seen_at--->[coffee shop]
               |
            doing
               |
               v
        [reviewing R&D proposals]
```

## Project Files

### Core Code
```
backend/
├── src/
│   ├── index.ts              ← Express server + Socket.io
│   ├── routes/witness.ts     ← POST /api/witness-statement
│   ├── services/
│   │   ├── claude.ts         ← AWS Bedrock integration (FIX HERE)
│   │   └── database.ts       ← PostgreSQL operations
│   └── types/index.ts
└── package.json

frontend/
├── src/
│   ├── App.tsx               ← Main application
│   ├── components/
│   │   ├── GraphVisualization.tsx  ← Ogma graph
│   │   └── WitnessForm.tsx         ← Submission form
│   └── services/
│       └── api.ts            ← Backend API calls (FIX HERE?)
├── public/ogma/              ← Ogma v6.0.5 files
└── vite.config.ts            ← Proxy config (FIX HERE?)
```

### Documentation
- `STATUS.md` - Current status (this session)
- `HANDOVER.md` - Resume instructions (you are here)
- `QUICKSTART.md` - Testing guide
- `CLAUDE.md` - For future Claude Code sessions
- `PROJECT_PLAN.md` - Original concept & requirements
- `ARCHITECTURE.md` - System design
- `TECHNICAL_SPECS.md` - API specs, Claude prompts, DB schema

### Configuration
- `docker-compose.yml` - Container orchestration
- `.env` - Not tracked, contains TARGET_NAME and dates
- `test_statement.json` - Sample test data

## Troubleshooting

### Backend Won't Start
```bash
docker-compose logs backend
# Check for:
# - "Database initialized successfully"
# - "Server running on port 3001"
```

### Frontend Shows Blank
```bash
docker-compose logs frontend
# Should show: "VITE v6.4.3 ready in XXXms"
```

### Database Issues
```bash
# Reset database (CAUTION: Deletes all data)
docker-compose down -v
docker-compose up -d
```

### Can't Access Ports
```bash
# Check if ports are in use
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :5432
```

## Environment Details

### Your Configuration
- **Name**: Cameron Stiller
- **Last Working Day**: Friday, June 26, 2026
- **Leave Period**: June 29 - July 17, 2026
- **Return Date**: Thursday, July 17, 2026
- **AWS**: Bedrock credentials from environment
- **Region**: us-east-1
- **Model**: us.anthropic.claude-sonnet-4-5-20250929-v1:0

### Ports
- 3000: Frontend (React + Vite)
- 3001: Backend (Express + Socket.io)
- 5432: PostgreSQL

### Containers
- `out_of_office_fun-frontend-1`
- `out_of_office_fun-backend-1`  
- `out_of_office_fun-db-1`

## Commands Reference

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# Restart a service
docker-compose restart backend
docker-compose restart frontend

# View logs
docker-compose logs backend --tail=50
docker-compose logs frontend --tail=50
docker-compose logs -f  # Follow all logs

# Rebuild after code changes
docker-compose build backend
docker-compose up -d backend

# Check status
docker-compose ps

# Access database
docker-compose exec db psql -U witness -d witness_board
# Then: SELECT * FROM nodes;

# Shell into container
docker-compose exec backend sh
docker-compose exec frontend sh
```

## Test Data

**test_statement.json**:
```json
{
  "statement": "I saw Cameron at a coffee shop in Sydney reviewing R&D proposals yesterday",
  "witnessName": "Alice Chen"
}
```

**More test cases**:
```bash
# Casual sighting
echo '{"statement":"Spotted Cameron at Circular Quay eating lunch","witnessName":"Bob"}' | \
  curl -X POST http://localhost:3001/api/witness-statement -H "Content-Type: application/json" -d @-

# Technical activity
echo '{"statement":"Cameron was at the data center in Melbourne checking servers last Tuesday","witnessName":"Sarah"}' | \
  curl -X POST http://localhost:3001/api/witness-statement -H "Content-Type: application/json" -d @-

# Travel
echo '{"statement":"I think I saw Cameron at Brisbane airport on Monday morning","witnessName":"Mike"}' | \
  curl -X POST http://localhost:3001/api/witness-statement -H "Content-Type: application/json" -d @-
```

## Success Criteria

✅ Backend responds to health check
✅ Database shows Cameron Stiller as target
✅ Submit statement via curl gets approved response
✅ Frontend loads without errors
✅ Frontend can submit statements
✅ Graph displays nodes with correct colors
✅ Real-time updates work across browser windows
✅ Witness gets badge with case number

## Next Phase (After Basic Functionality Works)

1. **Styling**: Customize investigation theme colors
2. **Stats Panel**: Show live statistics
3. **Filters**: Filter graph by node type
4. **Export**: Download graph as image
5. **OOO Message**: Craft the perfect out-of-office message
6. **Deployment**: Move to Nuix K8s cluster
7. **Domain**: Set up on appropriate Nuix domain

## Notes

- Ogma license via Nuix's Linkurious access
- All AWS credentials passed from environment (not in code)
- PostgreSQL data persists in Docker volume
- Hot reload enabled (code changes auto-apply)
- No need to rebuild Docker images for code changes
- Frontend proxies API to avoid CORS (when proxy works)

## Contact Points

- Project files: `C:\claude\out_of_office_fun`
- Backend code: Watch for typescript errors in logs
- Frontend code: Check browser console for errors
- Database: Use psql commands above to inspect

---

**TL;DR**: Apply two fixes (proxy + JSON parsing), restart services, test with curl, then test in browser. Everything else is working! 🚀
