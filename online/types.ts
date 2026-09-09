import type { Card, GameState, TurnOrderPreference } from "@/game/types";

export type OnlineRoomStatus = "waiting" | "playing" | "finished";

export type OnlineSession = {
  roomCode: string;
  uid: string;
  playerId: string;
  isHost: boolean;
};

export type OnlineRoom = {
  code: string;
  hostUid: string;
  status: OnlineRoomStatus;
  maxPlayers: 2 | 3 | 4;
  turnOrderPreference?: TurnOrderPreference;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type OnlineRoomPlayer = {
  uid: string;
  playerId: string;
  name: string;
  seat: number;
  joinedAt?: unknown;
};

export type PublicStackEffect = {
  id: string;
  card: Card | null;
  isFaceUp: boolean;
};

export type PublicFieldStack = {
  id: string;
  ownerId: string;
  baseCard: Card;
  effects: PublicStackEffect[];
};

export type PublicOnlinePlayer = {
  id: string;
  name: string;
  handCount: number;
  field: PublicFieldStack[];
};

export type PublicGameSnapshot = {
  revision: number;
  phase: GameState["phase"];
  players: PublicOnlinePlayer[];
  deckCount: number;
  graveyard: Card[];
  turnOrder: string[];
  currentTurn: number;
  draftRound: number;
  draftPlayerIndex: number;
  draftCurrentPlayerId: string | null;
  draftSelectedCount: number;
  winnerIds: string[];
  lastAction: string;
  lastActionActorId: string | null;
  lastActionCard: Card | null;
  lastActionCardHidden: boolean;
  resultGameState: GameState | null;
};

export type PrivateGameSnapshot = {
  revision: number;
  playerId: string;
  hand: Card[];
  draftPack: Card[];
  draftSelectionsCount: number;
  draftSelections: Card[];
  draftSelectedCard: Card | null;
  draftSubmitted: boolean;
  drawnCardNotice: Card | null;
};

export type HostGameState = {
  revision: number;
  game: GameState;
  playerUids: Record<string, string>;
  pendingDraftPicks: Record<string, string>;
  privateDrawNotices: Record<string, Card | null>;
};

export type OnlineActionPreviewPhase =
  | "idle"
  | "thinking"
  | "cardSelected"
  | "targetSelecting"
  | "committing";

export type OnlineActionPreview = {
  actorUid: string;
  playerId: string;
  phase: OnlineActionPreviewPhase;
  updatedAt?: unknown;
};

export type OnlineActionType =
  | "draftPick"
  | "placePoint"
  | "stackEffect"
  | "destroy"
  | "moratorium"
  | "revive"
  | "truth";

export type OnlineActionPayload = {
  cardId: string;
  targetStackId?: string;
  targetCardId?: string;
};

export type OnlineAction = {
  actorUid: string;
  type: OnlineActionType;
  payload: OnlineActionPayload;
  processed: boolean;
  clientSentAtMs?: number;
  createdAt?: unknown;
};
