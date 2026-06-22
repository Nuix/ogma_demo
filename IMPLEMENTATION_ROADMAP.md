# Implementation Roadmap

## Phase 1: Core Infrastructure (Week 1)

### Backend Setup
- [ ] Initialize Node.js project with TypeScript
- [ ] Set up Express server with basic routing
- [ ] Configure PostgreSQL database with schema
- [ ] Implement database models and migrations
- [ ] Create basic CRUD operations for nodes/edges
- [ ] Set up environment variables and config

### Claude API Integration
- [ ] Create Claude API client wrapper
- [ ] Design entity extraction prompt
- [ ] Implement content moderation logic
- [ ] Test with sample witness statements
- [ ] Handle API errors and rate limits gracefully
- [ ] Add response caching for similar queries (optional)

### Database Schema
```sql
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    properties JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES nodes(id),
    target_id UUID REFERENCES nodes(id),
    relationship_type VARCHAR(100) NOT NULL,
    properties JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    witness_name VARCHAR(255),
    raw_statement TEXT NOT NULL,
    processed_entities JSONB,
    moderation_status VARCHAR(20) DEFAULT 'pending',
    case_number VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_created ON nodes(created_at DESC);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
```

### Docker Setup
- [ ] Create Dockerfile for backend
- [ ] Create Dockerfile for frontend (placeholder)
- [ ] Create docker-compose.yml
- [ ] Configure networking between containers
- [ ] Set up volume mounts for persistence

## Phase 2: Frontend Foundation (Week 1-2)

### React Application
- [ ] Initialize React + TypeScript project (Vite or Create React App)
- [ ] Set up project structure (components, hooks, services)
- [ ] Install and configure Ogma
- [ ] Create basic layout with header and graph canvas
- [ ] Implement API client for backend communication
- [ ] Set up Socket.io for WebSocket connection

### UI Components
- [ ] Landing page with investigation theme
  - Title: "OPERATION: FIND [NAME]"
  - Case status board
  - "Submit Witness Statement" CTA
- [ ] Witness statement form
  - Free-text area for statement
  - Optional witness name field
  - Submit button
- [ ] Graph visualization container
  - Ogma canvas integration
  - Zoom/pan controls
  - Legend showing node types
- [ ] Confirmation modal
  - Shows generated case number
  - Displays investigator "badge"
  - Thanks for contribution

### Styling Theme
- Investigation/detective aesthetic
- Dark mode with accent colors (amber warnings, red alerts)
- Typewriter or monospace fonts for atmosphere
- Cork board or evidence board background texture (subtle)
- Polaroid-style cards for witness badges

## Phase 3: Core Features (Week 2)

### Graph Visualization
- [ ] Configure Ogma graph rendering
- [ ] Implement node styling by type:
  - PERSON (target): Large, central, distinct color
  - WITNESS: Medium, different color, show name
  - LOCATION: Icon-based, grouped
  - ACTIVITY: Smaller, tagged style
- [ ] Implement edge styling by relationship type
- [ ] Add tooltips on node hover (show properties)
- [ ] Implement force-directed layout
- [ ] Add clustering for dense areas (optional)

### Submission Processing
- [ ] Connect form to backend API
- [ ] Show loading state during processing
- [ ] Handle Claude API response
- [ ] Update graph with new nodes/edges
- [ ] Generate and display case number
- [ ] Handle moderation rejections gracefully

### Real-time Updates
- [ ] Implement WebSocket connection on mount
- [ ] Subscribe to graph update events
- [ ] Merge incoming nodes/edges into graph state
- [ ] Animate new node additions
- [ ] Show notification when others contribute
- [ ] Handle reconnection logic

## Phase 4: Polish & Features (Week 2-3)

### Enhanced Functionality
- [ ] Statistics panel
  - Total witnesses
  - Total sightings
  - Top locations
  - Most active investigators
- [ ] Filter/search capabilities
  - Filter by node type
  - Search for specific entities
  - Highlight related nodes
- [ ] Timeline view (optional)
  - Show submissions chronologically
  - Replay graph growth
- [ ] Download/export case file
  - Export graph as image
  - Generate PDF case report

### Content Moderation
- [ ] Implement profanity filter as backup
- [ ] Add manual review queue (optional)
- [ ] Log rejected submissions for monitoring
- [ ] Rate limiting per IP/session
- [ ] CAPTCHA or simple challenge (if spam occurs)

### Responsive Design
- [ ] Mobile-friendly layout
- [ ] Touch controls for graph
- [ ] Simplified form on mobile
- [ ] Responsive statistics panel

## Phase 5: Testing & Deployment (Week 3)

### Testing
- [ ] Unit tests for Claude API parsing
- [ ] Integration tests for submission flow
- [ ] Test graph performance with 100+ nodes
- [ ] Cross-browser testing
- [ ] Mobile device testing
- [ ] Load testing for concurrent users

### Deployment Preparation
- [ ] Set up production environment variables
- [ ] Configure HTTPS/SSL certificates
- [ ] Set up domain and DNS
- [ ] Build production Docker images
- [ ] Create deployment scripts
- [ ] Set up monitoring/logging (optional)

### Documentation
- [ ] Update README with development commands
- [ ] Document API endpoints
- [ ] Document Claude API prompts and responses
- [ ] Create troubleshooting guide
- [ ] Write deployment instructions

### Launch Preparation
- [ ] Seed database with initial node (the target person)
- [ ] Test OOO email message
- [ ] Prepare announcement for team
- [ ] Set up analytics (optional)
- [ ] Create backup/restore procedure

## Optional Enhancements (Post-MVP)

### Advanced Features
- [ ] AI-generated "case theories" summarizing the graph
- [ ] Voting/credibility system for sightings
- [ ] Photo upload for "evidence"
- [ ] Integration with Slack (post updates to channel)
- [ ] Multiple investigation modes (serious/absurd slider)
- [ ] Generated "final report" when leave ends

### Gamification
- [ ] Leaderboard of most creative witnesses
- [ ] Badges for contribution types
- [ ] Easter eggs hidden in the graph
- [ ] Achievements system

### Technical Improvements
- [ ] GraphQL API instead of REST
- [ ] Server-side rendering for initial graph
- [ ] Progressive Web App (PWA)
- [ ] Graph persistence/versioning
- [ ] A/B testing different themes

## Timeline Estimate
- **Weeks 1-2**: Core backend + frontend foundation
- **Week 2-3**: Features + polish
- **Week 3**: Testing + deployment
- **Total**: ~3 weeks for full implementation

## Risk Mitigation
- **Risk**: Claude API rate limits hit
  - **Mitigation**: Implement request queuing, caching, fallback parsing
- **Risk**: Graph becomes too large/complex
  - **Mitigation**: Implement pagination, clustering, performance optimizations
- **Risk**: Inappropriate content gets through
  - **Mitigation**: Multiple moderation layers, manual review queue, easy deletion
- **Risk**: Low engagement from team
  - **Mitigation**: Seed initial submissions, promote at launch, make submission easy/fun
