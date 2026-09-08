import { createDeck, shuffle } from "./cards";
import { calculatePlayerScore } from "./scoring";
import type { Card, FieldStack, GameState, Player, PlayerSetup, TurnOrderPreference } from "./types";

export function createInitialState(): GameState {
  return {
    phase: "setup", players: [], deck: [], graveyard: [], turnOrder: [], currentTurn: 0,
    draftPacks: [], draftSelections: [], draftRound: 0, draftPlayerIndex: 0, winnerIds: [],
    lastAction: "", lastActionCard: null, lastActionActorId: null, lastActionCardHidden: false, lastDrawnCard: null,
  };
}

function clampCpuLevel(value: number | undefined): number {
  return Math.max(1, Math.min(13, Math.round(value ?? 5)));
}

export function startGame(setups: PlayerSetup[], turnOrderPreference: TurnOrderPreference = "random"): GameState {
  const deck = shuffle(createDeck());
  const players: Player[] = setups.map((setup, i) => ({
    id: `p${i + 1}`,
    name: setup.name,
    kind: setup.kind,
    cpuLevel: setup.kind === "cpu" ? clampCpuLevel(setup.cpuLevel) : undefined,
    hand: [], field: [],
  }));
  const packs: Card[][] = players.map(() => deck.splice(0, 7));
  const playerIds = players.map((p) => p.id);
  const others = shuffle(playerIds.slice(1));
  const turnOrder =
    turnOrderPreference === "first"
      ? [playerIds[0], ...others]
      : turnOrderPreference === "last"
        ? [...others, playerIds[0]]
        : shuffle(playerIds);
  return {
    phase: "draft", players, deck, graveyard: [], turnOrder, currentTurn: 0,
    draftPacks: packs, draftSelections: players.map(() => []), draftRound: 0, draftPlayerIndex: 0, winnerIds: [],
    lastAction: "ドラフトを開始しました。", lastActionCard: null, lastActionActorId: null, lastActionCardHidden: false, lastDrawnCard: null,
  };
}

export function draftPick(state: GameState, cardId: string): GameState {
  const s = structuredClone(state);
  const p = s.draftPlayerIndex;
  const pack = s.draftPacks[p];
  const index = pack.findIndex((c) => c.id === cardId);
  if (index < 0) return state;
  const [picked] = pack.splice(index, 1);
  s.draftSelections[p].push(picked);
  s.lastActionCard = picked;
  s.lastActionActorId = s.players[p]?.id ?? null;
  s.lastActionCardHidden = s.players[p]?.kind === "cpu";
  if (p < s.players.length - 1) { s.draftPlayerIndex++; return s; }
  s.draftPlayerIndex = 0;
  s.draftRound++;
  if (s.draftRound < 7) {
    const old = s.draftPacks;
    s.draftPacks = old.map((_, i) => old[(i - 1 + old.length) % old.length]);
    return s;
  }
  s.players.forEach((player, i) => { player.hand = s.draftSelections[i]; });
  s.phase = "playing";
  s.currentTurn = findNextPlayerIndexWithCards(s, -1);
  return s;
}

export function placeAsPoint(state: GameState, playerId: string, cardId: string): GameState {
  const s = structuredClone(state);
  s.lastDrawnCard = null;
  const player = s.players.find((p) => p.id === playerId)!;
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return state;
  const [card] = player.hand.splice(idx, 1);
  player.field.push({ id: `stack-${crypto.randomUUID()}`, ownerId: playerId, baseCard: card, effects: [] });
  s.lastAction = `${player.name}は${describeCard(card)}をポイントとして置きました。`;
  s.lastActionCard = card; s.lastActionActorId = player.id; s.lastActionCardHidden = false;
  return endTurn(s);
}

export function stackEffect(state: GameState, playerId: string, cardId: string, targetStackId: string): GameState {
  const s = structuredClone(state);
  s.lastDrawnCard = null;
  const player = s.players.find((p) => p.id === playerId)!;
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return state;
  const [card] = player.hand.splice(idx, 1);
  const target = findStack(s, targetStackId);
  if (!target) return state;

  // 重要: 真実が過去に使われたまとまりでも、新しく伏せるカードは必ず非公開から始める。
  target.effects.push({ card, isFaceUp: false, placedByPlayerId: playerId, revealedByTruth: false });

  const targetOwner = s.players.find((p) => p.id === target.ownerId)!;
  if (player.kind === "cpu") {
    s.lastAction = `${player.name}は${targetOwner.name}の場のカードにカードを1枚伏せて重ねました。`;
    s.lastActionCardHidden = true;
  } else {
    s.lastAction = `${player.name}は${describeCard(card)}を使い、${targetOwner.name}の場のカードに重ねました。`;
    s.lastActionCardHidden = false;
  }
  s.lastActionCard = card; s.lastActionActorId = player.id;
  return endTurn(s);
}

export function useDestroy(state: GameState, playerId: string, cardId: string, targetStackId: string): GameState {
  const s = structuredClone(state);
  s.lastDrawnCard = null;
  const source = removeHandCard(s, playerId, cardId); if (!source) return state;
  s.graveyard.push(source);
  const sourcePlayer = s.players.find((p) => p.id === playerId)!;
  const target = findStackWithOwner(s, targetStackId); if (!target) return state;
  const { owner, stack } = target;
  while (stack.effects.length) {
    const top = stack.effects.pop()!; s.graveyard.push(top.card);
    if (top.card.magic === "guard") {
      s.lastAction = `${sourcePlayer.name}は${describeCard(source)}で破壊を試みましたが、守護の魔法に止められました。`;
      s.lastActionCard = source; s.lastActionActorId = sourcePlayer.id; s.lastActionCardHidden = false;
      return endTurn(s);
    }
  }
  s.graveyard.push(stack.baseCard); owner.field = owner.field.filter((x) => x.id !== stack.id);
  s.lastAction = `${sourcePlayer.name}は${describeCard(source)}で${owner.name}の場のカードを破壊しました。`;
  s.lastActionCard = source; s.lastActionActorId = sourcePlayer.id; s.lastActionCardHidden = false;
  return endTurn(s);
}

export function useMoratorium(state: GameState, playerId: string, cardId: string): GameState {
  const s = structuredClone(state);
  s.lastDrawnCard = null;
  const source = removeHandCard(s, playerId, cardId); if (!source) return state;
  s.graveyard.push(source);
  const drawn = s.deck.pop();
  const player = s.players.find((p) => p.id === playerId)!;
  if (drawn) player.hand.push(drawn);
  s.lastDrawnCard = drawn ?? null;
  s.lastAction = drawn ? `${player.name}は${describeCard(source)}を使い、山札から1枚引きました。` : `${player.name}は${describeCard(source)}を使いましたが、山札は空でした。`;
  s.lastActionCard = source; s.lastActionActorId = player.id; s.lastActionCardHidden = false;
  return endTurn(s);
}

export function useRevive(state: GameState, playerId: string, cardId: string, targetCardId: string): GameState {
  const s = structuredClone(state);
  s.lastDrawnCard = null;
  const source = removeHandCard(s, playerId, cardId); if (!source) return state;
  s.graveyard.push(source);
  const idx = s.graveyard.findIndex((c) => c.id === targetCardId && c.number === source.number && c.id !== source.id);
  const player = s.players.find((p) => p.id === playerId)!;
  const revivedCard = idx >= 0 ? s.graveyard.splice(idx, 1)[0] : null;
  if (revivedCard) player.hand.push(revivedCard);
  s.lastAction = revivedCard ? `${player.name}は${describeCard(source)}で${describeCard(revivedCard)}を墓場から戻しました。` : `${player.name}は${describeCard(source)}を使いましたが、復活できるカードはありませんでした。`;
  s.lastActionCard = source; s.lastActionActorId = player.id; s.lastActionCardHidden = false;
  return endTurn(s);
}

export function useTruth(state: GameState, playerId: string, cardId: string, targetStackId: string): GameState {
  const s = structuredClone(state);
  s.lastDrawnCard = null;
  const source = removeHandCard(s, playerId, cardId); if (!source) return state;
  s.graveyard.push(source);
  const target = findStack(s, targetStackId);
  if (target) {
    // 発動時点で存在する効果カードだけを公開する。
    // 以後stackEffectで追加されるカードは revealedByTruth:false / isFaceUp:false なので公開されない。
    const existingIds = new Set(target.effects.map((e) => e.card.id));
    target.effects.forEach((effect) => {
      if (existingIds.has(effect.card.id)) {
        effect.isFaceUp = true;
        effect.revealedByTruth = true;
      }
    });
  }
  const player = s.players.find((p) => p.id === playerId)!;
  s.lastAction = `${player.name}は${describeCard(source)}を使い、重なっていたカードを公開しました。`;
  s.lastActionCard = source; s.lastActionActorId = player.id; s.lastActionCardHidden = false;
  return endTurn(s);
}

function removeHandCard(state: GameState, playerId: string, cardId: string) {
  const player = state.players.find((p) => p.id === playerId)!;
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return null;
  return player.hand.splice(idx, 1)[0];
}
function findStack(state: GameState, id: string): FieldStack | undefined {
  return state.players.flatMap((p) => p.field).find((s) => s.id === id);
}
function findStackWithOwner(state: GameState, id: string) {
  for (const owner of state.players) {
    const stack = owner.field.find((s) => s.id === id);
    if (stack) return { owner, stack };
  }
}
function findNextPlayerIndexWithCards(state: GameState, fromIndex: number): number {
  for (let step = 1; step <= state.turnOrder.length; step++) {
    const index = (fromIndex + step) % state.turnOrder.length;
    const playerId = state.turnOrder[index];
    const player = state.players.find((p) => p.id === playerId);
    if (player && player.hand.length > 0) return index;
  }
  return 0;
}
function describeCard(card: Card): string { return `${card.number}の${cardName(card.magic)}`; }
function cardName(magic: Card["magic"]): string {
  switch (magic) {
    case "destroy": return "破壊の魔法";
    case "guard": return "守護の魔法";
    case "double": return "増大の魔法";
    case "betray": return "裏切りの魔法";
    case "moratorium": return "モラトリアムの魔法";
    case "revive": return "復活の魔法";
    case "truth": return "真実の魔法";
  }
}
export function endTurn(state: GameState): GameState {
  if (state.players.every((p) => p.hand.length === 0)) {
    state.phase = "result";
    const scores = state.players.map((p) => ({ id: p.id, score: calculatePlayerScore(p) }));
    const max = Math.max(...scores.map((s) => s.score));
    state.winnerIds = scores.filter((s) => s.score === max).map((s) => s.id);
    return state;
  }
  state.currentTurn = findNextPlayerIndexWithCards(state, state.currentTurn);
  return state;
}
