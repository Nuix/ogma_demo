# Project Handoff - Witness Board Application

**Date**: 2026-06-14  
**Status**: Ready for Day 1 deployment  
**Developer**: Cameron Stiller via Claude Code

---

## What This Is

Interactive "missing person investigation" themed web app where Nuix colleagues submit witness statements about Cameron's whereabouts during out-of-office. Submissions are processed by Claude API and visualized as a growing knowledge graph using Ogma.

---

## Current State

### Running Locally ✅
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **Database**: PostgreSQL on port 5432
- **Docker Compose**: All 3 containers running with auto-restart

### What Works
1. Submit witness statements via form
2. Claude API (AWS Bedrock) extracts entities and relationships
3. Real-time graph updates via WebSocket
4. Visual styling with Nuix brand colors
5. Cameron Stiller appears as red star (target person)
6. Chronological timeline (TIME nodes sorted vertically)
7. Content moderation via Claude API

### Seed Data
- 1 PERSON node: Cameron Stiller (red star, status: MISSING)
- 1 seed witness statement submitted (CASE-2026-1000)
- Clean slate ready for colleague submissions

---

## Quick Commands

### Start Everything
```bash
cd C:\claude\out_of_office_fun
docker-compose up -d
```

### View Logs
```bash
docker-compose logs -f
docker-compose logs -f backend  # Backend only
docker-compose logs -f frontend # Frontend only
```

### Stop Everything
```bash
docker-compose down
```

### Check Database
```bash
docker exec out_of_office_fun-db-1 psql -U witness -d witness_board -c "SELECT COUNT(*), type FROM nodes GROUP BY type;"
```

### Clear All Data (Fresh Start)
```bash
docker exec out_of_office_fun-db-1 psql -U witness -d witness_board -c "DELETE FROM edges; DELETE FROM nodes; DELETE FROM submissions;"
```

---

## Environment Requirements

### AWS Credentials (Required)
Must be set in your shell environment:
```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
```

Docker Compose inherits these automatically.

### .env File
Minimal `.env` in project root:
```
TARGET_NAME=Cameron Stiller
LAST_SEEN_DATE=2026-06-26
```

---

## Production Deployment

### Target URL
https://apac.ventures.nuix.com/where_is_cameron

### Files
- **k8s-ingress.yaml** - Complete Kubernetes config (ingress, services, deployments, secrets)
- **DEPLOYMENT.md** - Full deployment guide with troubleshooting
- **frontend/Dockerfile.prod** - Production build with nginx

### Steps
1. Build production images:
   ```bash
   docker build -f frontend/Dockerfile.prod -t <registry>/witness-board-frontend:latest ./frontend
   docker build -t <registry>/witness-board-backend:latest ./backend
   ```

2. Push to Nuix registry:
   ```bash
   docker push <registry>/witness-board-frontend:latest
   docker push <registry>/witness-board-backend:latest
   ```

3. Update secrets in `k8s-ingress.yaml`:
   - `database-url`
   - `aws-access-key-id`
   - `aws-secret-access-key`

4. Deploy:
   ```bash
   kubectl apply -f k8s-ingress.yaml
   ```

5. Verify:
   ```bash
   kubectl get pods -n ventures
   kubectl get ingress -n ventures
   ```

---

## Architecture

### Frontend
- **Tech**: React 18 + TypeScript + Vite
- **Graph**: Ogma 6.0.5 (Linkurious)
- **Styling**: Nuix brand colors (blue #0090ff, cyan #00d4ff, red #e74c3c)
- **Port**: 3000

### Backend
- **Tech**: Node.js 18 + Express + TypeScript
- **AI**: Claude Sonnet 4.5 via AWS Bedrock
- **WebSocket**: Socket.io for real-time updates
- **Port**: 3001

### Database
- **Tech**: PostgreSQL 15
- **Tables**: `nodes`, `edges`, `submissions`
- **Port**: 5432

---

## Key Files & Locations

### Configuration
- `docker-compose.yml` - Local development orchestration
- `k8s-ingress.yaml` - Kubernetes production config
- `.env` - Environment variables (TARGET_NAME, LAST_SEEN_DATE)

### Backend
- `backend/src/index.ts` - Express server + Socket.io
- `backend/src/services/claude.ts` - Claude API integration
- `backend/src/services/database.ts` - PostgreSQL operations
- `backend/src/routes/witness.ts` - API endpoints

### Frontend
- `frontend/src/App.tsx` - Main app component
- `frontend/src/components/GraphVisualization.tsx` - Ogma integration
- `frontend/src/components/WitnessForm.tsx` - Submission form
- `frontend/node_modules/@linkurious/ogma/` - Ogma library (manually copied)

### Documentation
- `README.md` - Project overview
- `DEPLOYMENT.md` - Production deployment guide
- `CLAUDE.md` - Instructions for Claude Code (AI assistant)
- `PROJECT_PLAN.md` - Original requirements
- `ARCHITECTURE.md` - System design
- `TECHNICAL_SPECS.md` - API specs, Claude prompts

---

## Known Issues & Workarounds

### 1. Ogma Import Resolution
**Issue**: Vite can't import Ogma from public folder  
**Fix**: Manually copy to node_modules structure
```bash
cp -r frontend/public/ogma/* frontend/node_modules/@linkurious/ogma/
```
Also create `frontend/node_modules/@linkurious/ogma/package.json`:
```json
{
  "name": "@linkurious/ogma",
  "version": "6.0.5",
  "main": "ogma.js",
  "types": "ogma.d.ts",
  "type": "module"
}
```

### 2. Corporate Proxy SSL
**Issue**: AWS Bedrock calls fail with SSL verification error  
**Fix**: Backend disables SSL verification (corporate proxy)
```typescript
new NodeHttpHandler({
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
})
```

### 3. Cameron Not Showing as Red Star
**Issue**: No PERSON node exists initially  
**Fix**: Manually insert PERSON node for Cameron:
```sql
INSERT INTO nodes (type, label, properties)
VALUES ('PERSON', 'Cameron Stiller', '{"status": "MISSING"}'::jsonb);
```

### 4. Relative Dates
**Issue**: Claude returned "yesterday" and "today" as entity labels  
**Fix**: Prompt now includes current date and instructs conversion to actual dates

---

## API Endpoints

### Submit Statement
```
POST /api/witness-statement
Body: {
  "witnessName": "string",
  "statement": "string"
}
```

### Get Graph Data
```
GET /api/graph
Returns: {
  "nodes": [...],
  "edges": [...]
}
```

### Get Statistics
```
GET /api/stats
Returns: {
  "witnessCount": number,
  "locationCount": number,
  "activityCount": number
}
```

---

## Graph Visualization

### Node Types
- **PERSON** (red star, 35px) - Cameron Stiller (target)
- **WITNESS** (blue, 18px) - People who submitted statements
- **LOCATION** (cyan, 16px) - Places mentioned
- **ACTIVITY** (purple, 15px) - Activities described
- **TIME** (orange, 14px) - Temporal references

### Layout
- Force-directed with -2000 charge (high repulsion)
- 300px link distance (prevents tangling)
- TIME nodes positioned chronologically on left side
- Target person pinned centrally

---

## Monitoring & Maintenance

### Check System Health
```bash
# All containers running?
docker-compose ps

# Backend responding?
curl http://localhost:3001/api/stats

# Database connection?
docker exec out_of_office_fun-db-1 pg_isready -U witness
```

### View Submissions
```bash
docker exec out_of_office_fun-db-1 psql -U witness -d witness_board -c "SELECT id, witness_name, raw_statement, moderation_status, case_number, created_at FROM submissions ORDER BY created_at DESC LIMIT 10;"
```

### Check for Inappropriate Content
```bash
docker exec out_of_office_fun-db-1 psql -U witness -d witness_board -c "SELECT * FROM submissions WHERE moderation_status = 'rejected';"
```

### Backup Database
```bash
docker exec out_of_office_fun-db-1 pg_dump -U witness witness_board > backup_$(date +%Y%m%d).sql
```

---

## Costs & Usage

### AWS Bedrock (Claude API)
- Model: `us.anthropic.claude-sonnet-4-5-20250929-v1:0`
- Cost: ~$0.003 per statement (entity extraction)
- Rate limit: 10 requests/minute per IP
- Monitor via AWS Console → Bedrock → Usage

### Expected Volume
- 50-100 statements over 2 weeks = $0.15-$0.30 total
- Negligible for AWS account

---

## Troubleshooting

### Frontend Shows White Screen
1. Check browser console for errors
2. Verify Ogma files exist: `ls frontend/node_modules/@linkurious/ogma/`
3. Restart frontend: `docker-compose restart frontend`

### Backend Not Processing Statements
1. Check AWS credentials: `echo $AWS_ACCESS_KEY_ID`
2. View backend logs: `docker-compose logs -f backend`
3. Test Claude API manually from container:
   ```bash
   docker exec -it out_of_office_fun-backend-1 node -e "console.log(process.env.AWS_ACCESS_KEY_ID)"
   ```

### Graph Not Updating
1. Check WebSocket connection in browser console
2. Verify backend Socket.io is running: `docker-compose logs backend | grep socket.io`
3. Clear browser cache and refresh

### Database Full of Test Data
```bash
# Clear everything
docker exec out_of_office_fun-db-1 psql -U witness -d witness_board -c "DELETE FROM edges; DELETE FROM nodes; DELETE FROM submissions;"

# Re-seed Cameron PERSON node
docker exec out_of_office_fun-db-1 psql -U witness -d witness_board -c "INSERT INTO nodes (type, label, properties) VALUES ('PERSON', 'Cameron Stiller', '{\"status\": \"MISSING\"}'::jsonb);"
```

---

## Contact & Support

- **Developer**: Cameron Stiller (Nuix Ventures)
- **Project Location**: `C:\claude\out_of_office_fun`
- **GitHub**: (Internal Nuix repo if pushed)

---

## Final Checklist Before Going OOO

- [ ] Docker containers running: `docker-compose ps`
- [ ] AWS credentials valid: `aws bedrock list-foundation-models --region us-east-1`
- [ ] Test submission works: Submit via form, check graph updates
- [ ] Database backed up: `pg_dump` to safe location
- [ ] K8s deployment tested (if using): `kubectl get pods -n ventures`
- [ ] Share URL with team: https://apac.ventures.nuix.com/where_is_cameron (or localhost)
- [ ] Monitor costs: Set up AWS budget alert for Bedrock usage

---

**Ready to go!** System is stable and tested. Colleagues can start submitting witness statements immediately.
