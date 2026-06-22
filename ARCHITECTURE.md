# Architecture Overview

## System Components

### 1. Frontend (Web Application)
**Technology**: React + TypeScript
**Key Libraries**:
- **Ogma** (Linkurious) - Graph visualization
- **React** - UI framework
- **Socket.io-client** - Real-time updates
- **Tailwind CSS** - Styling (or styled-components)

**Pages/Components**:
- Landing page with investigation theme
- Witness statement submission form
- Main graph visualization (Ogma canvas)
- Witness "badge" display after submission
- Legend/instructions panel
- Statistics sidebar (optional: total witnesses, sightings, locations)

### 2. Backend API
**Technology**: Node.js + Express (or Python + FastAPI)
**Key Features**:
- REST API endpoints for submissions
- WebSocket server for real-time graph updates
- Claude API integration for NLP processing
- Content moderation pipeline
- Graph data management

**Endpoints**:
- `POST /api/witness-statement` - Submit new witness statement
- `GET /api/graph` - Get current graph state
- `GET /api/stats` - Get statistics (optional)
- `WebSocket /ws` - Real-time updates

### 3. Data Storage
**Technology**: PostgreSQL (or SQLite for simplicity) + Redis
**Schema**:
```
nodes:
  - id (uuid)
  - type (PERSON, LOCATION, ACTIVITY, WITNESS)
  - label (display name)
  - properties (json: timestamp, description, etc.)
  - created_at

edges:
  - id (uuid)
  - source_id (node id)
  - target_id (node id)
  - relationship_type (WITNESSED_AT, REPORTED_BY, DOING, etc.)
  - properties (json)
  - created_at

submissions:
  - id (uuid)
  - witness_name (optional)
  - raw_statement (text)
  - processed_entities (json)
  - moderation_status (approved/rejected)
  - case_number (generated)
  - created_at
```

### 4. Claude API Integration
**Purpose**: 
- Parse witness statements to extract entities
- Identify: WITNESS, LOCATION, ACTIVITY, TIME
- Generate relationships between entities
- Content moderation
- Generate "case report" responses

**Prompt Structure**:
```
System: You are analyzing witness statements for an investigation board.
Extract entities and relationships. Ensure content is work-appropriate.

Input: "I saw [person] at the beach in Hawaii surfing yesterday"

Output: {
  "approved": true,
  "entities": [
    {"type": "WITNESS", "label": "[submitter name]"},
    {"type": "LOCATION", "label": "Hawaii"},
    {"type": "LOCATION", "label": "beach"},
    {"type": "ACTIVITY", "label": "surfing"},
    {"type": "TIME", "label": "yesterday"}
  ],
  "relationships": [
    {"from": "WITNESS", "to": "LOCATION:Hawaii", "type": "REPORTED_SIGHTING_AT"},
    {"from": "[person]", "to": "LOCATION:beach", "type": "SEEN_AT"},
    {"from": "[person]", "to": "ACTIVITY:surfing", "type": "DOING"}
  ],
  "case_report": "Case #[number]: Witness reports subject surfing at beach location in Hawaii. Credibility: UNVERIFIED"
}
```

## Deployment Architecture

### Docker Compose Setup
```
services:
  frontend:
    - React app built and served via Nginx
    - Port 80/443
  
  backend:
    - Node.js API server
    - Port 3001
    - Environment: CLAUDE_API_KEY
  
  database:
    - PostgreSQL
    - Port 5432 (internal only)
    
  redis:
    - Redis cache/pub-sub
    - Port 6379 (internal only)
```

### Network Flow
```
User Browser
    ↓ HTTPS
Nginx (Frontend)
    ↓ HTTP API calls
Express Backend
    ↓ SQL
PostgreSQL
    ↓ WebSocket
User Browser (real-time updates)

Backend → Anthropic Claude API (entity extraction)
```

## Data Flow

### Submission Pipeline
1. User fills out witness statement form
2. Frontend sends to `POST /api/witness-statement`
3. Backend:
   - Generates case number
   - Calls Claude API to process statement
   - Claude extracts entities and checks appropriateness
   - If approved: Store entities/edges in database
   - Generate witness "badge" with case number
   - Broadcast update via WebSocket
4. All connected clients receive graph update
5. Frontend updates Ogma visualization
6. Submitter receives confirmation with their investigator badge

### Real-time Updates
- When new node/edge added, broadcast minimal update packet
- Clients merge updates into existing graph
- Ogma automatically handles layout updates
- Optional: cluster dense areas, highlight new additions

## Security Considerations
- Rate limiting on submissions (prevent spam)
- Input sanitization and validation
- Claude API content moderation as primary filter
- Secondary keyword blacklist for obvious violations
- No authentication required (internal network assumed)
- Optional: CORS restrictions to Nuix domains only
- Store witness names optionally (anonymous mode available)

## Scalability Notes
- Should handle 50-100 concurrent users (expected team size)
- Graph optimized up to ~500 nodes before performance tuning needed
- WebSocket server can scale horizontally if needed
- Database indexes on created_at, node type, relationship type
