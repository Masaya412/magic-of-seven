export type MagicType =
  | "destroy"
  | "guard"
  | "double"
  | "betray"
  | "moratorium"
  | "revive"
  | "truth";

export type Card = {
  id: string;
  number: number;
  magic: MagicType;
};

export type StackedCard = {
  card: Card;
  isFaceUp: boolean;
};

export type FieldStack = {
  id: string;
  ownerId: string;
  baseCard: Card;
  effects: StackedCard[];
};

export type PlayerKind = "human" | "cpu";

export type Player = {
  id: string;
  name: string;
  kind: PlayerKind;
  hand: Card[];
  field: FieldStack[];
};

export type Phase = "setup" | "draft" | "playing" | "result";

export type GameState = {
  phase: Phase;
  players: Player[];
  deck: Card[];
  graveyard: Card[];
  turnOrder: string[];
  currentTurn: number;
  draftPacks: Card[][];
  draftSelections: Card[][];
  draftRound: number;
  draftPlayerIndex: number;
  winnerIds: string[];
  lastAction: string;
  lastActionCard: Card | null;
  lastActionActorId: string | null;

  // CPUが伏せて重ねたカードなど、行動確認時にも正体を見せないカードか
  lastActionCardHidden: boolean;
};

export type PlayerSetup = {
  name: string;
  kind: PlayerKind;
};
