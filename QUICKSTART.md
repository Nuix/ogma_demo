# Quick Start Guide

## What We've Built

A fully functional witness board application with:
- **Backend**: Node.js + Express API with Claude AI entity extraction
- **Frontend**: React app with Ogma graph visualization
- **Database**: PostgreSQL for storing nodes/edges
- **Real-time**: WebSocket updates via Socket.io

## Prerequisites

- Node.js 18+ 
- Docker + Docker Compose
- Anthropic API key
- Ogma files (already in `ogma/extracted/`)

## Setup Steps

### 1. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add:
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key
TARGET_NAME=Your Name
LAST_SEEN_DATE=2026-06-13
```

### 2. Option A: Docker (Recommended)

```bash
# Start everything (backend + database)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Install frontend deps and start dev server
cd frontend
npm install
npm run dev
```

Frontend will be at http://localhost:3000

### 3. Option B: Local Development

```bash
# Terminal 1: Database
docker-compose up db

# Terminal 2: Backend
cd backend
npm install
npm run dev

# Terminal 3: Frontend
cd frontend
npm install
npm run dev
```

## Testing the Application

### 1. Check Backend Health
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Check Database Connection
The backend logs should show:
```
Database initialized successfully
Target person node created: Your Name
Server running on port 3001
```

### 3. Test Frontend
Open http://localhost:3000 in your browser:
- You should see the "OPERATION: FIND [TARGET]" header
- The graph canvas should load (dark background)
- Click "SUBMIT STATEMENT" to open the form

### 4. Submit a Test Statement
Fill out the form:
- Name: "Alice"
- Statement: "I saw them at the beach in Hawaii surfing yesterday"
- Click "SUBMIT STATEMENT"

You should see:
- A success message with a case number
- The graph updates with new nodes (Alice, Hawaii, beach, surfing)
- Nodes are colored by type
- Edges connect the witness to locations/activities

### 5. Test Real-time Updates
Open a second browser window to http://localhost:3000
Submit a statement in one window - both windows should update!

## Troubleshooting

### Ogma not loading
Check that files exist:
```bash
ls frontend/public/ogma/
# Should show: ogma.js, ogma.d.ts, package.json, README.md
```

Make sure `index.html` loads Ogma:
```html
<script src="/ogma/ogma.js"></script>
```

### Claude API errors
Check your API key in `.env`:
```bash
# Backend logs will show:
Error analyzing witness statement: ...
```

Test AWS Bedrock access:
```bash
aws bedrock list-foundation-models --region us-east-1
```

### Database connection fails
Check if PostgreSQL is running:
```bash
docker-compose ps
# db should be "Up"
```

Check connection string in docker-compose.yml matches backend env vars.

### Frontend can't reach backend
Check Vite proxy configuration in `frontend/vite.config.ts`:
```ts
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
}
```

## Next Steps

Once everything works:

1. **Customize the target person** - Update `TARGET_NAME` and `LAST_SEEN_DATE` in `.env`
2. **Style tweaks** - Adjust colors in `frontend/src/App.tsx` and `GraphVisualization.tsx`
3. **Test moderation** - Try submitting inappropriate content to test Claude's filtering
4. **Deploy** - Move to Kubernetes when ready for production

## Key Endpoints

- `GET http://localhost:3001/health` - Health check
- `POST http://localhost:3001/api/witness-statement` - Submit statement
- `GET http://localhost:3001/api/graph` - Get full graph
- `GET http://localhost:3001/api/stats` - Get statistics
- `ws://localhost:3001` - WebSocket connection

## File Structure

```
.
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server + Socket.io
│   │   ├── routes/witness.ts     # API routes
│   │   ├── services/
│   │   │   ├── claude.ts         # Claude API integration
│   │   │   └── database.ts       # PostgreSQL operations
│   │   └── types/index.ts        # TypeScript types
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main app component
│   │   ├── components/
│   │   │   ├── GraphVisualization.tsx  # Ogma graph
│   │   │   └── WitnessForm.tsx         # Submission form
│   │   ├── services/api.ts       # API client
│   │   └── types/index.ts        # TypeScript types
│   ├── public/ogma/              # Ogma library files
│   └── package.json
├── docker-compose.yml
└── .env                          # Your API keys
```
