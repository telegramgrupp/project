import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Configure CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Queue-based matching system
const waitingQueue = [];

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('match:search', () => {
    // Remove any existing entries for this socket
    const existingIndex = waitingQueue.findIndex(s => s.id === socket.id);
    if (existingIndex !== -1) {
      waitingQueue.splice(existingIndex, 1);
    }

    if (waitingQueue.length > 0) {
      const peer = waitingQueue.shift();
      if (peer.connected) {
        // Notify both users
        socket.emit('match:found', { peerId: peer.id });
        peer.emit('match:found', { peerId: socket.id });
      } else {
        // If peer disconnected, try next in queue
        waitingQueue.push(socket);
      }
    } else {
      // Put this user in the queue
      waitingQueue.push(socket);
    }
  });

  socket.on('match:cancel', () => {
    const index = waitingQueue.findIndex(s => s.id === socket.id);
    if (index !== -1) {
      waitingQueue.splice(index, 1);
      socket.emit('match:cancelled');
    }
  });

  socket.on('webrtc:offer', ({ userId, offer }) => {
    console.log('Relaying offer to:', userId);
    socket.to(userId).emit('webrtc:offer', {
      userId: socket.id,
      offer,
    });
  });

  socket.on('webrtc:answer', ({ userId, answer }) => {
    console.log('Relaying answer to:', userId);
    socket.to(userId).emit('webrtc:answer', {
      userId: socket.id,
      answer,
    });
  });

  socket.on('webrtc:candidate', ({ userId, candidate }) => {
    console.log('Relaying ICE candidate to:', userId);
    socket.to(userId).emit('webrtc:candidate', {
      userId: socket.id,
      candidate,
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove from waiting queue if present
    const index = waitingQueue.findIndex(s => s.id === socket.id);
    if (index !== -1) {
      waitingQueue.splice(index, 1);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});