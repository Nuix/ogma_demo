# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**"Operation: Find [Name]"** - An interactive witness board / knowledge graph for an out-of-office experience at Nuix. Colleagues submit "witness statements" about sightings, which are processed by Claude API to extract entities (people, places, activities), then visualized as a growing investigation graph using Ogma (Linkurious).

**Status**: Core implementation complete. Backend and frontend scaffolded with Ogma integration.

**Theme**: Missing person investigation. Witnesses become nodes in the graph alongside their reported sightings, creating a collaborative narrative.

**Key Constraint**: Must be work-appropriate (Claude API moderates all submissions).

## Architecture

### Three-Tier System
1. **Frontend**: React + TypeScript + Ogma (graph visualization) + Socket.io-client
2. **Backend**: Node.js + Express + Socket.io (WebSockets) + PostgreSQL
3. **AI Processing**: Anthropic Claude API (entity extraction, moderation, relationship mapping)

### Core Data Flow
```
User submits witness statement
  → Backend generates case number
  → Claude API extracts entities (WITNESS, LOCATION, ACTIVITY, TIME) and relationships
  → If approved: store as nodes/edges in PostgreSQL
  → Broadcast to all clients via WebSocket
  → Ogma graph updates in real-time
  → Submitter gets investigator "badge"
```

### Key Architectural Decision
**Witnesses are graph nodes**: When someone reports "I saw [person] at [location]", the witness becomes a node connected to their reported sighting. This creates emergent social network patterns alongside location/activity clusters.

## Database Schema

Three main tables:
- **nodes**: id, type (PERSON/LOCATION/ACTIVITY/WITNESS), label, properties (json), timestamps
- **edges**: id, source_id, target_id, relationship_type (WITNESSED_AT/SEEN_AT/DOING), properties (json)
- **submissions**: id, witness_name, raw_statement, processed_entities (json), moderation_status, case_number

## Development Commands

### Prerequisites
- Docker and Docker Compose (primary deployment)
- Node.js 18+ (local dev)
- Anthropic API key
- Ogma license from Linkurious

### Environment Setup
```bash
cp .env.example .env
# Edit .env: Add ANTHROPIC_API_KEY, TARGET_NAME, LAST_SEEN_DATE
```

### Docker (Recommended)
```bash
docker-compose up -d        # Start all services (frontend, backend, db, redis)
docker-compose logs -f      # View logs
docker-compose down         # Stop services
```

### Local Development
```bash
# Backend (terminal 1)
cd backend
npm install
npm run dev                 # Runs on port 3001

# Frontend (terminal 2)
cd frontend
npm install
npm run dev                 # Runs on port 3000 (proxies API to 3001)
```

**Note**: Frontend requires Ogma files in `frontend/public/ogma/` (already extracted from zip).

### Key Files
- `backend/src/index.ts` - Express server with Socket.io
- `backend/src/services/claude.ts` - Claude API integration
- `backend/src/services/database.ts` - PostgreSQL operations
- `backend/src/routes/witness.ts` - API endpoints
- `frontend/src/App.tsx` - Main React app
- `frontend/src/components/GraphVisualization.tsx` - Ogma integration
- `frontend/src/components/WitnessForm.tsx` - Statement submission

## Claude API Integration

### Entity Extraction Prompt Pattern
The backend sends witness statements to Claude with a structured prompt requesting:
- **Entities**: WITNESS (submitter), LOCATION, ACTIVITY, TIME, OBJECT
- **Relationships**: REPORTED_SIGHTING_AT, SEEN_AT, DOING, WITH
- **Moderation**: approve/reject with reason
- **Case Report**: Brief investigative summary

Response format: JSON with `{approved, entities[], relationships[], caseReport}`

See `TECHNICAL_SPECS.md` for full prompt template and examples.

### Content Moderation Strategy
1. Primary: Claude API classifies work-appropriateness
2. Fallback: Keyword blacklist for obvious violations
3. Rate limiting: 10 requests/min per IP
4. All submissions logged for manual review if needed

## Graph Visualization (Ogma)

### Node Types & Visual Encoding
- **PERSON** (target): Large, red/orange, central position, "STATUS: MISSING" label
- **WITNESS**: Medium, blue, detective badge icon, shows case number
- **LOCATION**: Medium, green, map pin icon, clusters by geography
- **ACTIVITY**: Small, purple, activity-specific icons
- **TIME**: Small, yellow, clock icon (or shown as edge labels)

### Layout Algorithm
Force-directed with target person pinned centrally. Witnesses form a ring, locations/activities cluster by similarity. Edge length represents relationship strength.

## Project Documentation

- **PROJECT_PLAN.md**: Requirements, success criteria, constraints
- **ARCHITECTURE.md**: Full system design, data flow, security considerations
- **TECHNICAL_SPECS.md**: API endpoints, Claude prompts, database indexes, Ogma config
- **IMPLEMENTATION_ROADMAP.md**: 3-week phase-by-phase checklist
- **README.md**: Quick start guide

## Deployment Target

Starting with Docker Compose on local/staging. Future deployment to Nuix Kubernetes cluster with appropriate domain. System designed to run autonomously for duration of leave (no manual updates required).
