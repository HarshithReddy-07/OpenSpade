import { Card, Suit, Rank, getCardValue } from './Card';

export class Deck {
  cards: Card[];

  constructor() {
    this.cards = [];
    this.initialize();
  }

  initialize() {
    this.cards = [];
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

    for (let deckNum = 0; deckNum < 2; deckNum++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          this.cards.push({
            suit,
            rank,
            value: getCardValue(rank),
          });
        }
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(numCards: number): Card[] {
    return this.cards.splice(0, numCards);
  }

  drawRandomJoker(): Card {
    const randomIndex = Math.floor(Math.random() * this.cards.length);
    return this.cards.splice(randomIndex, 1)[0];
  }
}
