import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomManager } from './models/RoomManager';

dotenv.config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const roomManager = new RoomManager();

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  const broadcastGameState = (roomId: string) => {
    const game = roomManager.getGame(roomId);
    if (!game) return;
    
    // Send state tailored to each player (hide other players' hands)
    game.players.forEach(p => {
      if (p.connected && io.sockets.sockets.get(p.id)) {
        io.to(p.id).emit('game_state', game.getGameState(p.id));
      }
    });
  };

  socket.on('create_room', ({ roomId, mode, playerName, maxPlayers, totalRounds, allowNil }) => {
    try {
      const game = roomManager.createRoom(roomId, mode, maxPlayers, totalRounds, allowNil);
      roomManager.joinRoom(roomId, socket.id, playerName);
      socket.join(roomId);
      broadcastGameState(roomId);
    } catch (e: any) {
      socket.emit('error', e.message);
    }
  });

  socket.on('join_room', ({ roomId, playerName }) => {
    try {
      roomManager.joinRoom(roomId, socket.id, playerName);
      socket.join(roomId);
      broadcastGameState(roomId);
    } catch (e: any) {
      socket.emit('error', e.message);
    }
  });

  socket.on('leave_room', () => {
    const roomId = roomManager.getRoomIdForSocket(socket.id);
    if (roomId) {
      roomManager.leaveRoom(socket.id);
      socket.leave(roomId);
      broadcastGameState(roomId);
    }
  });

  socket.on('start_game', () => {
    const roomId = roomManager.getRoomIdForSocket(socket.id);
    if (!roomId) return;
    
    const game = roomManager.getGame(roomId);
    if (game && game.phase === 'Lobby') {
      game.startGame();
      broadcastGameState(roomId);
    }
  });

  socket.on('place_bid', ({ bid }) => {
    const roomId = roomManager.getRoomIdForSocket(socket.id);
    if (!roomId) return;
    
    const game = roomManager.getGame(roomId);
    if (game && game.placeBid(socket.id, bid)) {
      broadcastGameState(roomId);
    }
  });

  socket.on('play_card', ({ card }) => {
    const roomId = roomManager.getRoomIdForSocket(socket.id);
    if (!roomId) return;
    
    const game = roomManager.getGame(roomId);
    if (game && game.playCard(socket.id, card)) {
      broadcastGameState(roomId);
      
      // If trick is resolved, we might want to delay before clearing to let frontend show it
      if (game.currentTrick.winner && game.phase === 'Playing') {
        setTimeout(() => {
          game.clearTrick();
          broadcastGameState(roomId);
        }, 3000);
      }
    }
  });

  socket.on('next_round', () => {
    const roomId = roomManager.getRoomIdForSocket(socket.id);
    if (!roomId) return;
    
    const game = roomManager.getGame(roomId);
    if (game && game.phase === 'RoundOver') {
      game.nextRound();
      broadcastGameState(roomId);
    }
  });

  socket.on('send_message', (text: string) => {
    const roomId = roomManager.getRoomIdForSocket(socket.id);
    if (!roomId) return;
    const game = roomManager.getGame(roomId);
    const player = game?.players.find(p => p.id === socket.id);
    
    if (player) {
      io.to(roomId).emit('chat_message', {
        playerName: player.name,
        text,
        timestamp: Date.now()
      });
    }
  });

  // WebRTC Signaling
  socket.on('webrtc_signal', ({ targetSocketId, signal }) => {
    io.to(targetSocketId).emit('webrtc_signal', {
      senderSocketId: socket.id,
      signal
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const roomId = roomManager.getRoomIdForSocket(socket.id);
    if (roomId) {
      roomManager.handleDisconnect(socket.id, (cleanedRoomId) => {
        broadcastGameState(cleanedRoomId);
      });
      broadcastGameState(roomId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
