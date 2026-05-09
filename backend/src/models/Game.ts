import { Player } from './Player';
import { Deck } from './Deck';
import { Card, Suit } from './Card';

export type GamePhase = 'Lobby' | 'Bidding' | 'Playing' | 'RoundOver' | 'GameOver';
export type GameMode = 'Solo' | 'Pair' | 'Pair6';

export interface Trick {
  leadSuit: Suit | null;
  cards: { player: Player; card: Card }[];
  winner: Player | null;
}

export class Game {
  id: string;
  players: Player[];
  mode: GameMode;
  phase: GamePhase;
  deck: Deck;
  jokerCard: Card | null;
  trumpSuit: Suit | null;
  currentTurnIndex: number;
  startingPlayerIndex: number; // who starts the round
  currentTrick: Trick;
  maxPlayers: number;
  totalRounds: number;
  currentRoundIndex: number;
  allowNil: boolean;
  maxScore: number;
  teamScores: { [teamId: number]: number };

  constructor(id: string, mode: GameMode = 'Solo', maxPlayers: number = 4, totalRounds: number = 1, allowNil: boolean = false) {
    this.id = id;
    this.players = [];
    this.mode = mode;
    this.phase = 'Lobby';
    this.deck = new Deck();
    this.jokerCard = null;
    this.trumpSuit = null;
    this.currentTurnIndex = 0;
    this.startingPlayerIndex = 0;
    this.currentTrick = { leadSuit: null, cards: [], winner: null };
    this.maxPlayers = maxPlayers;
    this.totalRounds = totalRounds;
    this.currentRoundIndex = 1;
    this.allowNil = allowNil;
    this.maxScore = 500;
    this.teamScores = { 1: 0, 2: 0, 3: 0 };
  }

  addPlayer(player: Player): boolean {
    if (this.players.length >= this.maxPlayers) return false;
    
    if (this.mode === 'Pair' || this.mode === 'Pair6') {
      const numTeams = this.mode === 'Pair6' ? 3 : 2;
      player.team = (this.players.length % numTeams) + 1;
      // First player in the team becomes the bidder
      player.isBidder = !this.players.some(p => p.team === player.team);
    } else {
      player.isBidder = true;
    }
    
    this.players.push(player);
    return true;
  }

  removePlayer(playerId: string) {
    this.players = this.players.filter(p => p.id !== playerId);
    if (this.players.length === 0) {
      this.phase = 'GameOver';
    }
  }

  startGame() {
    if (this.players.length < 2) return;
    this.phase = 'Bidding';
    this.teamScores = { 1: 0, 2: 0, 3: 0 };
    this.players.forEach(p => p.score = 0);
    this.currentRoundIndex = 1;
    this.startingPlayerIndex = Math.floor(Math.random() * this.players.length);
    this.startRound();
  }

  startRound() {
    this.phase = 'Bidding';
    this.players.forEach(p => p.resetForRound());
    
    this.deck = new Deck();
    this.deck.shuffle();

    // Draw Joker Card for Trump
    this.jokerCard = this.deck.drawRandomJoker();
    this.trumpSuit = this.jokerCard.suit;

    // Deal progressive cards
    const cardsPerPlayer = this.currentRoundIndex;
    
    for (let i = 0; i < this.players.length; i++) {
      this.players[i].hand = this.deck.deal(cardsPerPlayer);
      // Sort hand by suit and rank
      this.players[i].hand.sort((a, b) => {
        if (a.suit === b.suit) return b.value - a.value;
        return a.suit.localeCompare(b.suit);
      });
    }

    this.currentTurnIndex = this.startingPlayerIndex;
    this.currentTrick = { leadSuit: null, cards: [], winner: null };
  }

  placeBid(playerId: string, bid: number): boolean {
    if (this.phase !== 'Bidding') return false;
    
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.bid !== null || !player.isBidder) return false;

    player.bid = bid;
    
    if (this.mode === 'Pair' || this.mode === 'Pair6') {
      // Assign the bid to other team members
      this.players.forEach(p => {
        if (p.team === player.team && p.id !== player.id) {
          p.bid = bid;
        }
      });
    }

    // Check if all players have bid
    if (this.players.every(p => p.bid !== null)) {
      this.phase = 'Playing';
      // The person who starts the round starts the first trick
      this.currentTurnIndex = this.startingPlayerIndex;
    } else {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    }
    return true;
  }

  playCard(playerId: string, card: Card): boolean {
    if (this.phase !== 'Playing') return false;
    
    const currentPlayer = this.players[this.currentTurnIndex];
    if (currentPlayer.id !== playerId) return false; // Not their turn

    // Validate if the player has the card
    const hasCard = currentPlayer.hand.some(c => c.suit === card.suit && c.rank === card.rank);
    if (!hasCard) return false;

    // Validate follow suit
    if (this.currentTrick.cards.length > 0) {
      const leadSuit = this.currentTrick.leadSuit!;
      if (card.suit !== leadSuit && currentPlayer.hasSuit(leadSuit)) {
        return false; // Must follow suit
      }
    } else {
      // First card of the trick
      this.currentTrick.leadSuit = card.suit;
    }

    // Remove card from hand
    currentPlayer.playCard(card.suit, card.rank);
    
    // Add to trick
    this.currentTrick.cards.push({ player: currentPlayer, card });

    // Check if trick is over
    if (this.currentTrick.cards.length === this.players.length) {
      this.resolveTrick();
    } else {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    }

    return true;
  }

  resolveTrick() {
    let winningCard = this.currentTrick.cards[0].card;
    let winner = this.currentTrick.cards[0].player;
    const leadSuit = this.currentTrick.leadSuit;

    for (let i = 1; i < this.currentTrick.cards.length; i++) {
      const play = this.currentTrick.cards[i];
      const card = play.card;
      
      const isNewTrump = card.suit === this.trumpSuit && winningCard.suit !== this.trumpSuit;
      const isHigherTrump = card.suit === this.trumpSuit && winningCard.suit === this.trumpSuit && card.value > winningCard.value;
      const isHigherLead = card.suit === leadSuit && winningCard.suit === leadSuit && card.value > winningCard.value;

      if (isNewTrump || isHigherTrump || isHigherLead) {
        winningCard = card;
        winner = play.player;
      }
    }

    winner.tricksWon += 1;
    this.currentTrick.winner = winner;
    
    // Player who won the trick starts the next one
    this.currentTurnIndex = this.players.findIndex(p => p.id === winner.id);

    // Check if round is over (no cards left in hand)
    if (this.players[0].hand.length === 0) {
      this.phase = 'RoundOver';
      this.calculateScores();
    }
  }

  clearTrick() {
    this.currentTrick = { leadSuit: null, cards: [], winner: null };
  }

  calculateScores() {
    if (this.mode === 'Solo') {
      this.players.forEach(p => {
        let roundScore = 0;
        if (p.tricksWon >= p.bid!) {
          roundScore = p.bid! * 10 + (p.tricksWon - p.bid!); // 10 points per bid trick, 1 point per overtrick
        } else {
          roundScore = (-p.bid! + p.tricksWon) * 10; // Penalty for missing bid
        }
        
        // Nil bid bonus
        if (this.allowNil && this.currentRoundIndex === this.totalRounds && p.bid === 0) {
           if (p.tricksWon === 0) roundScore += 100;
           else roundScore -= 100;
        }

        p.score += roundScore;
      });
    } else if (this.mode === 'Pair' || this.mode === 'Pair6') {
      const teams = this.mode === 'Pair6' ? [1, 2, 3] : [1, 2];
      teams.forEach(team => {
        const teamPlayers = this.players.filter(p => p.team === team);
        if (teamPlayers.length === 0) return;
        
        // In team mode, we assigned the same bid to all teammates, but for logic, 
        // the "teamBid" is just the bidder's bid. Since we duplicated the bid to all teammates above,
        // we should just read one of them.
        const teamBid = teamPlayers[0].bid || 0;
        const teamTricks = teamPlayers.reduce((sum, p) => sum + p.tricksWon, 0);

        let roundScore = 0;
        if (teamTricks >= teamBid) {
          roundScore = teamBid * 10 + (teamTricks - teamBid);
        } else {
          roundScore = (-teamBid + teamTricks) * 10;
        }

        // Handle Nil bids individually
        if (this.allowNil && this.currentRoundIndex === this.totalRounds) {
          if (teamBid === 0) {
             if (teamTricks === 0) roundScore += 100;
             else roundScore -= 100;
          }
        }

        this.teamScores[team] += roundScore;
        teamPlayers.forEach(p => p.score = this.teamScores[team]);
      });
    }

    // Check for game over
    const isGameOver = this.currentRoundIndex === this.totalRounds ||
                       this.players.some(p => p.score >= this.maxScore) || 
                       ((this.mode === 'Pair' || this.mode === 'Pair6') && 
                        (this.teamScores[1] >= this.maxScore || this.teamScores[2] >= this.maxScore || this.teamScores[3] >= this.maxScore));
    
    if (isGameOver) {
      this.phase = 'GameOver';
    }
  }

  nextRound() {
    if (this.phase !== 'RoundOver') return;
    this.startingPlayerIndex = (this.startingPlayerIndex + 1) % this.players.length;
    this.currentRoundIndex++;
    if (this.currentRoundIndex > this.totalRounds) {
      this.phase = 'GameOver';
    } else {
      this.startRound();
    }
  }

  getGameState(playerId: string) {
    return {
      id: this.id,
      mode: this.mode,
      phase: this.phase,
      maxPlayers: this.maxPlayers,
      totalRounds: this.totalRounds,
      currentRoundIndex: this.currentRoundIndex,
      allowNil: this.allowNil,
      jokerCard: this.jokerCard,
      trumpSuit: this.trumpSuit,
      currentTurnIndex: this.currentTurnIndex,
      currentTrick: {
        leadSuit: this.currentTrick.leadSuit,
        cards: this.currentTrick.cards.map(c => ({ playerId: c.player.id, card: c.card })),
        winnerId: this.currentTrick.winner?.id || null
      },
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        bid: p.bid,
        tricksWon: p.tricksWon,
        score: p.score,
        team: p.team,
        isBidder: p.isBidder,
        connected: p.connected,
        handSize: p.hand.length,
        // Only send hand to the specific player
        hand: p.id === playerId ? p.hand : []
      })),
      teamScores: this.teamScores
    };
  }
}
