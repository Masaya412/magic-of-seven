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
  /** この効果カードを場に伏せたプレイヤー */
  placedByPlayerId?: string;
  /** 真実の魔法によって公開されたカードか。新しく積むカードは必ずfalse */
  revealedByTruth?: boolean;
};

export type FieldStack = {
  id: string;
  ownerId: string;
  baseCard: Card;
  effects: StackedCard[];
};

export type PlayerKind = "human" | "cpu";
export type TurnOrderPreference = "first" | "last" | "random";
export type Player = {
  id: string;
  name: string;
  kind: PlayerKind;
  /** CPUのみ使用。1（弱い）〜13（超高難易度）。 */
  cpuLevel?: number;
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
  lastActionCardHidden: boolean;
  /** 直前のモラトリアムで引いたカード。公開UIには直接出さず、本人向け通知に使う。 */
  lastDrawnCard: Card | null;
};

export type PlayerSetup = {
  name: string;
  kind: PlayerKind;
  cpuLevel?: number;
};
