# 🔧 EXACT FIXES NEEDED

## Fix 1: Frontend Network Issue

**File**: `frontend/vite.config.ts`

**Change Line 6** from:
```typescript
target: 'http://backend:3001',
```

**To**:
```typescript
target: 'http://localhost:3001',
```

**Full corrected section**:
```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',  // ← CHANGED
      changeOrigin: true,
    },
    '/socket.io': {
      target: 'http://localhost:3001',  // ← CHANGED  
      changeOrigin: true,
      ws: true,
    },
  },
}
```

**Then run**: `docker-compose restart frontend`

---

## Fix 2: Strip Markdown from Claude Response

**File**: `backend/src/services/claude.ts`

**Find** (around line 89):
```typescript
    console.log('Claude content text:', content.text);
    const response = JSON.parse(content.text) as ClaudeEntityResponse;
```

**Replace with**:
```typescript
    console.log('Claude content text:', content.text);
    
    // Strip markdown code fences if present
    let textToParse = content.text.trim();
    if (textToParse.startsWith('```')) {
      textToParse = textToParse
        .replace(/^```json?\n?/i, '')
        .replace(/\n?```$/, '');
    }
    
    const response = JSON.parse(textToParse) as ClaudeEntityResponse;
```

**Then run**: `docker-compose restart backend` (or just wait - tsx auto-reloads)

---

## Test After Fixes

```bash
# 1. Test backend directly
curl -X POST http://localhost:3001/api/witness-statement \
  -H "Content-Type: application/json" \
  -d @test_statement.json

# Expected: {"success":true, "caseNumber":"CASE-2026-1001", ...}

# 2. Open browser
# Visit: http://localhost:3000
# Click "SUBMIT STATEMENT"
# Fill form and submit
# Watch graph update!
```

---

## That's It!

Two file changes, two restarts, done. 🎉
