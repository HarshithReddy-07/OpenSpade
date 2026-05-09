import { Card } from './Card';

export class Player {
  id: string; // Socket ID or User ID
  name: string;
  hand: Card[];
  bid: number | null;
  tricksWon: number;
  score: number;
  team: number | null; // 1, 2, or 3 for pair modes
  isBidder: boolean;
  connected: boolean;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.hand = [];
    this.bid = null;
    this.tricksWon = 0;
    this.score = 0;
    this.team = null;
    this.isBidder = false;
    this.connected = true;
  }

  resetForRound() {
    this.hand = [];
    this.bid = null;
    this.tricksWon = 0;
  }

  playCard(suit: string, rank: string): Card | null {
    const cardIndex = this.hand.findIndex(c => c.suit === suit && c.rank === rank);
    if (cardIndex !== -1) {
      return this.hand.splice(cardIndex, 1)[0];
    }
    return null;
  }

  hasSuit(suit: string): boolean {
    return this.hand.some(c => c.suit === suit);
  }
}
