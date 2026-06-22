# Technical Specifications

## Technology Stack

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite (or Create React App)
- **Visualization**: Ogma by Linkurious
- **Styling**: Tailwind CSS or styled-components
- **Real-time**: Socket.io-client
- **HTTP Client**: Axios or fetch
- **State Management**: React Context or Zustand (lightweight)

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **WebSocket**: Socket.io
- **Database**: PostgreSQL 15+
- **Cache**: Redis (optional for sessions/rate limiting)
- **ORM**: Prisma or TypeORM (or raw SQL)
- **Validation**: Zod or Joi

### Infrastructure
- **Container**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (for frontend serving)
- **Future**: Kubernetes (when deploying to Nuix cluster)

### External Services
- **Anthropic Claude API**: 
  - Model: Claude 3.5 Sonnet (good balance of speed/capability)
  - Usage: Entity extraction, content moderation
  - Rate limit: Monitor and implement backoff

## API Specifications

### REST Endpoints

#### POST /api/witness-statement
Submit a new witness statement.

**Request Body**:
```json
{
  "statement": "I saw them at the beach in Hawaii surfing yesterday",
  "witnessName": "Alice Smith" // optional
}
```

**Response** (Success):
```json
{
  "success": true,
  "caseNumber": "CASE-2026-0042",
  "status": "approved",
  "message": "Thank you for your statement, Investigator Smith",
  "badge": {
    "name": "Alice Smith",
    "caseNumber": "CASE-2026-0042",
    "timestamp": "2026-06-13T10:30:00Z"
  },
  "extractedEntities": [
    {"type": "LOCATION", "label": "Hawaii"},
    {"type": "LOCATION", "label": "beach"},
    {"type": "ACTIVITY", "label": "surfing"}
  ]
}
```

**Response** (Rejected):
```json
{
  "success": false,
  "status": "rejected",
  "reason": "Content does not meet community guidelines",
  "message": "Thank you for your submission, but it cannot be added to the investigation."
}
```

#### GET /api/graph
Get current state of the knowledge graph.

**Response**:
```json
{
  "nodes": [
    {
      "id": "uuid-1",
      "type": "PERSON",
      "label": "[Target Name]",
      "properties": {
        "status": "MISSING",
        "lastSeen": "2026-06-01"
      }
    },
    {
      "id": "uuid-2",
      "type": "WITNESS",
      "label": "Alice Smith",
      "properties": {
        "caseNumber": "CASE-2026-0042",
        "submissions": 1
      }
    },
    {
      "id": "uuid-3",
      "type": "LOCATION",
      "label": "Hawaii",
      "properties": {
        "mentions": 3
      }
    }
  ],
  "edges": [
    {
      "id": "edge-uuid-1",
      "source": "uuid-2",
      "target": "uuid-3",
      "type": "REPORTED_SIGHTING_AT",
      "properties": {
        "timestamp": "2026-06-13T10:30:00Z"
      }
    }
  ]
}
```

#### GET /api/stats
Get statistics about the investigation.

**Response**:
```json
{
  "totalWitnesses": 42,
  "totalSightings": 67,
  "topLocations": [
    {"label": "Hawaii", "count": 8},
    {"label": "Coffee Shop", "count": 5}
  ],
  "topWitnesses": [
    {"name": "Alice Smith", "submissions": 3},
    {"name": "Bob Jones", "submissions": 2}
  ],
  "timeline": [
    {"date": "2026-06-13", "submissions": 5},
    {"date": "2026-06-14", "submissions": 8}
  ]
}
```

### WebSocket Events

#### Client → Server
```javascript
// Connect to WebSocket
const socket = io('wss://your-domain.com');

// Subscribe to updates
socket.emit('subscribe', { room: 'investigation' });
```

#### Server → Client
```javascript
// New node added
socket.on('node:added', (node) => {
  // node: { id, type, label, properties }
});

// New edge added
socket.on('edge:added', (edge) => {
  // edge: { id, source, target, type, properties }
});

// Stats updated
socket.on('stats:updated', (stats) => {
  // stats: { totalWitnesses, totalSightings, ... }
});
```

## Claude API Integration

### Entity Extraction Prompt

**System Prompt**:
```
You are an AI assistant helping to analyze witness statements for an investigation board. Your task is to:

1. Extract relevant entities from the witness statement
2. Identify relationships between entities
3. Ensure content is appropriate for a workplace environment
4. Generate a brief case report

Entity types to extract:
- WITNESS: The person submitting the statement (if mentioned or provided)
- LOCATION: Places mentioned
- ACTIVITY: Actions or activities described
- TIME: Temporal references (dates, times, durations)
- OBJECT: Relevant objects or items mentioned

Relationship types:
- REPORTED_SIGHTING_AT: Witness reports seeing subject at location
- SEEN_AT: Subject seen at location
- DOING: Subject performing activity
- WITH: Subject seen with person/object
- DURING: Activity during time period

Content moderation:
- Reject statements with profanity, harassment, or inappropriate content
- Reject statements that are completely unrelated or spam
- Accept creative, humorous, or absurd statements as long as they're work-appropriate
```

**User Prompt Template**:
```
Witness Name: {witnessName or "Anonymous"}
Statement: {statement}

Please analyze this witness statement and respond in JSON format with:
{
  "approved": boolean,
  "reason": "string (if rejected)",
  "entities": [
    {"type": "entity_type", "label": "entity_name"}
  ],
  "relationships": [
    {"from": "entity_label", "to": "entity_label", "type": "relationship_type"}
  ],
  "caseReport": "Brief investigative summary"
}
```

**Example Request**:
```javascript
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: `Witness Name: Alice Smith
Statement: I saw them at the beach in Hawaii surfing yesterday

Please analyze this witness statement and respond in JSON format...`
  }],
  system: "You are an AI assistant helping to analyze witness statements..."
});
```

**Example Response**:
```json
{
  "approved": true,
  "entities": [
    {"type": "WITNESS", "label": "Alice Smith"},
    {"type": "LOCATION", "label": "Hawaii"},
    {"type": "LOCATION", "label": "beach"},
    {"type": "ACTIVITY", "label": "surfing"},
    {"type": "TIME", "label": "yesterday"}
  ],
  "relationships": [
    {"from": "Alice Smith", "to": "Hawaii", "type": "REPORTED_SIGHTING_AT"},
    {"from": "[Target]", "to": "beach", "type": "SEEN_AT"},
    {"from": "[Target]", "to": "surfing", "type": "DOING"},
    {"from": "beach", "to": "Hawaii", "type": "LOCATED_IN"}
  ],
  "caseReport": "CASE SUMMARY: Witness Alice Smith reports subject engaging in water sports activity at coastal location in Hawaiian islands. Timeframe: Previous day. Status: UNVERIFIED. Recommend cross-referencing with additional witness statements."
}
```

## Graph Data Structure

### Node Types & Styling

**PERSON (Target)**
- Size: Large (30px radius)
- Color: Red/Orange (#FF6B6B)
- Icon: User silhouette with question mark
- Always central in layout
- Label: Name + "STATUS: MISSING"

**WITNESS**
- Size: Medium (20px radius)
- Color: Blue (#4ECDC4)
- Icon: Detective badge or eye
- Label: Witness name + case number
- Hover: Show total submissions

**LOCATION**
- Size: Medium (18px radius)
- Color: Green (#95E1D3)
- Icon: Pin or map marker
- Label: Location name
- Hover: Show number of mentions

**ACTIVITY**
- Size: Small (15px radius)
- Color: Purple (#A78BFA)
- Icon: Activity-specific (swimming, eating, etc.)
- Label: Activity name
- Hover: Show context

**TIME**
- Size: Small (12px radius)
- Color: Yellow (#FCD34D)
- Icon: Clock
- Label: Time reference
- Optional: Could be shown as edge labels instead

### Edge Types & Styling

**REPORTED_SIGHTING_AT**
- Style: Solid line
- Color: Blue
- Direction: WITNESS → LOCATION
- Label: "reported at"

**SEEN_AT**
- Style: Dashed line
- Color: Orange
- Direction: TARGET → LOCATION
- Label: "seen at"

**DOING**
- Style: Dotted line
- Color: Purple
- Direction: TARGET → ACTIVITY
- Label: "doing"

**WITH**
- Style: Solid line
- Color: Green
- Direction: TARGET → OBJECT/PERSON
- Label: "with"

### Graph Layout

**Force-Directed Layout**:
- Central node: Target person (pinned)
- Witnesses form a ring around target
- Locations and activities cluster by similarity
- Edge length represents relationship strength

**Ogma Configuration**:
```javascript
{
  layoutName: 'force',
  layoutOptions: {
    charge: -300,
    linkDistance: 100,
    gravity: 0.1
  },
  nodeStyle: {
    radius: node => node.size,
    color: node => node.color,
    label: {
      text: node => node.label,
      position: 'bottom'
    }
  },
  edgeStyle: {
    width: 2,
    color: edge => edge.color,
    shape: edge => edge.shape // 'line', 'dashed', 'dotted'
  }
}
```

## Environment Variables

```env
# Backend
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@db:5432/witness_board
REDIS_URL=redis://redis:6379

# Claude API
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Application
TARGET_NAME="[User Name]"
LAST_SEEN_DATE="2026-06-01"
CASE_START_NUMBER=1000

# Security
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10

# Optional
LOG_LEVEL=info
SENTRY_DSN=xxx
```

## Docker Configuration

### docker-compose.yml
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://witness:password@db:5432/witness_board
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - TARGET_NAME=${TARGET_NAME}
    depends_on:
      - db
    volumes:
      - ./backend:/app
      - /app/node_modules

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=witness
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=witness_board
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

## Performance Considerations

### Frontend
- Use React.memo for expensive components
- Virtualize large lists (if showing submission history)
- Debounce graph updates (batch WebSocket messages)
- Lazy load Ogma library
- Use Web Workers for heavy computations

### Backend
- Connection pooling for PostgreSQL
- Cache frequently accessed graph data in Redis
- Rate limit API endpoints (10 req/min per IP)
- Implement request queuing for Claude API
- Use database indexes effectively

### Database
- Index on node types for filtering
- Index on created_at for timeline queries
- Composite indexes for common joins
- Regular VACUUM ANALYZE for performance

### Monitoring
- Log all Claude API calls and costs
- Track graph size and complexity metrics
- Monitor WebSocket connection count
- Alert on moderation rejection rate spikes
- Track submission rate and patterns
