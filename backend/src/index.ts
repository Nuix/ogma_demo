import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initializeDatabase, createNode, findNodeByLabel } from './services/database';
import { startPoller } from './services/poller';
import witnessRouter from './routes/witness';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/witness-statement', limiter);

// Routes
app.use('/api', witnessRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe', ({ room }) => {
    socket.join(room);
    console.log(`Client ${socket.id} subscribed to ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Initialize database and start server
async function start() {
  try {
    await initializeDatabase();

    const targetName = process.env.TARGET_NAME || 'Unknown Person';
    const lastSeen = process.env.LAST_SEEN_DATE || new Date().toISOString().split('T')[0];
    const existing = await findNodeByLabel(targetName, 'PERSON');
    if (!existing) {
      await createNode({ type: 'PERSON', label: targetName, properties: { status: 'MISSING', lastSeen } });
      console.log(`Target person node created: ${targetName}`);
    }

    startPoller(io);

    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export { io };
