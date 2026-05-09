import { Game, GameMode } from './Game';
import { Player } from './Player';

export class RoomManager {
  private games: Map<string, Game>;
  private socketToRoom: Map<string, string>;

  constructor() {
    this.games = new Map();
    this.socketToRoom = new Map();
  }

  createRoom(roomId: string, mode: GameMode, maxPlayers: number = 4, totalRounds: number = 1, allowNil: boolean = false): Game {
    if (this.games.has(roomId)) {
      throw new Error("Room already exists");
    }
    const game = new Game(roomId, mode, maxPlayers, totalRounds, allowNil);
    this.games.set(roomId, game);
    return game;
  }

  getGame(roomId: string): Game | undefined {
    return this.games.get(roomId);
  }

  joinRoom(roomId: string, socketId: string, playerName: string): Game {
    let game = this.games.get(roomId);
    if (!game) {
      throw new Error("Room does not exist");
    }
    
    // Check if player is already in room (reconnection)
    const existingPlayer = game.players.find(p => p.name === playerName);
    if (existingPlayer) {
      existingPlayer.id = socketId; // Update socket ID
      existingPlayer.connected = true;
    } else {
      const player = new Player(socketId, playerName);
      const success = game.addPlayer(player);
      if (!success) throw new Error("Room is full");
    }

    this.socketToRoom.set(socketId, roomId);
    return game;
  }

  leaveRoom(socketId: string) {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return;

    const game = this.games.get(roomId);
    if (game) {
      const player = game.players.find(p => p.id === socketId);
      if (player) {
        player.connected = false;
        // Optionally, remove player fully if game hasn't started
        if (game.phase === 'Lobby') {
          game.removePlayer(socketId);
        }
      }
      
      // Cleanup empty rooms
      if (game.players.every(p => !p.connected)) {
         this.games.delete(roomId);
      }
    }
    this.socketToRoom.delete(socketId);
  }

  getRoomIdForSocket(socketId: string): string | undefined {
    return this.socketToRoom.get(socketId);
  }
}
