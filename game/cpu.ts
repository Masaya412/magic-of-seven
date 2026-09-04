import { draftPick, placeAsPoint, stackEffect, useDestroy, useMoratorium, useRevive, useTruth } from "./engine";
import { calculatePlayerScore, calculateStackScore } from "./scoring";
import type { Card, FieldStack, GameState, Player } from "./types";

function currentPlayer(state: GameState): Player {
  const id = state.turnOrder[state.currentTurn];
  return state.players.find((p) => p.id === id)!;
}

function bestOwnStack(player: Player): FieldStack | undefined {
  return [...player.field].sort((a, b) => calculateStackScore(b) - calculateStackScore(a))[0];
}

function bestOpponentStack(state: GameState, playerId: string): FieldStack | undefined {
  return state.players
    .filter((p) => p.id !== playerId)
    .flatMap((p) => p.field)
    .sort((a, b) => visibleThreat(b) - visibleThreat(a))[0];
}

function visibleThreat(stack: FieldStack): number {
  // CPUは裏向きカードの正体を判断材料にしない。
  const visibleEffects = stack.effects.filter((e) => e.isFaceUp);
  let score = stack.baseCard.number;
  const doubles = visibleEffects.filter((e) => e.card.magic === "double").length;
  const betrays = visibleEffects.filter((e) => e.card.magic === "betray").length;
  const guards = visibleEffects.filter((e) => e.card.magic === "guard").length;
  score *= 2 ** doubles;
  score *= (-1) ** betrays;
  score += guards;
  return Math.max(score, stack.baseCard.number) + stack.effects.length * 0.7;
}

function draftValue(card: Card): number {
  const magicBonus: Record<Card["magic"], number> = {
    destroy: 2.8,
    guard: 1.4,
    double: 3.1,
    betray: 2.5,
    moratorium: 0.8,
    revive: 1.1,
    truth: 0.5,
  };
  return card.number + magicBonus[card.magic] + Math.random() * 1.2;
}

export function cpuDraftPick(state: GameState): GameState {
  if (state.phase !== "draft") return state;
  const player = state.players[state.draftPlayerIndex];
  if (!player || player.kind !== "cpu") return state;
  const pack = state.draftPacks[state.draftPlayerIndex];
  if (!pack.length) return state;
  const choice = [...pack].sort((a, b) => draftValue(b) - draftValue(a))[0];
  const next = draftPick(state, choice.id);
  next.lastAction = `${player.name}がドラフトでカードを1枚選びました。`;
  return next;
}

export function cpuTakeTurn(state: GameState): GameState {
  if (state.phase !== "playing") return state;
  const cpu = currentPlayer(state);
  if (!cpu || cpu.kind !== "cpu" || cpu.hand.length === 0) return state;

  const ownBest = bestOwnStack(cpu);
  const enemyBest = bestOpponentStack(state, cpu.id);
  const handByNumber = [...cpu.hand].sort((a, b) => b.number - a.number);

  // 増大: 自分の高得点カードを倍化する価値が高いときに使う。
  const doubles = cpu.hand.filter((c) => c.magic === "double").sort((a, b) => a.number - b.number);
  if (ownBest && doubles.length && calculateStackScore(ownBest) >= Math.max(3, doubles[0].number)) {
    return stackEffect(state, cpu.id, doubles[0].id, ownBest.id);
  }

  // 裏切り: 相手の高得点カードをマイナス化する。
  const betrays = cpu.hand.filter((c) => c.magic === "betray").sort((a, b) => a.number - b.number);
  if (enemyBest && betrays.length && visibleThreat(enemyBest) >= Math.max(4, betrays[0].number)) {
    return stackEffect(state, cpu.id, betrays[0].id, enemyBest.id);
  }

  // 破壊: 特に脅威の高い相手カードを狙う。
  const destroys = cpu.hand.filter((c) => c.magic === "destroy").sort((a, b) => a.number - b.number);
  if (enemyBest && destroys.length && visibleThreat(enemyBest) + enemyBest.effects.length >= Math.max(5, destroys[0].number + 1)) {
    return useDestroy(state, cpu.id, destroys[0].id, enemyBest.id);
  }

  // 守護: 自分の高得点カードを守る。
  const guards = cpu.hand.filter((c) => c.magic === "guard").sort((a, b) => a.number - b.number);
  if (ownBest && guards.length && calculateStackScore(ownBest) >= Math.max(5, guards[0].number)) {
    return stackEffect(state, cpu.id, guards[0].id, ownBest.id);
  }

  // 復活: 同じ数字の有用なカードが墓場にあれば回収する。
  const revives = cpu.hand.filter((c) => c.magic === "revive").sort((a, b) => a.number - b.number);
  for (const revive of revives) {
    const target = state.graveyard.find((c) => c.number === revive.number && c.id !== revive.id && ["double", "destroy", "betray", "guard"].includes(c.magic));
    if (target && revive.number <= 5) return useRevive(state, cpu.id, revive.id, target.id);
  }

  // 真実: 相手の裏向き効果が多いとき、低い数字の真実を情報獲得に使う。
  const truths = cpu.hand.filter((c) => c.magic === "truth").sort((a, b) => a.number - b.number);
  const hiddenTarget = state.players
    .filter((p) => p.id !== cpu.id)
    .flatMap((p) => p.field)
    .filter((s) => s.effects.some((e) => !e.isFaceUp))
    .sort((a, b) => b.effects.length - a.effects.length)[0];
  if (hiddenTarget && truths.length && truths[0].number <= 3) {
    return useTruth(state, cpu.id, truths[0].id, hiddenTarget.id);
  }

  // モラトリアム: 低い数字なら引き直しを優先。
  const moratoriums = cpu.hand.filter((c) => c.magic === "moratorium").sort((a, b) => a.number - b.number);
  if (state.deck.length && moratoriums.length && moratoriums[0].number <= 3) {
    return useMoratorium(state, cpu.id, moratoriums[0].id);
  }

  // 特殊効果を使う価値が低い場合は、一番高い数字をポイント化する。
  const bestPoint = handByNumber[0];
  return placeAsPoint(state, cpu.id, bestPoint.id);
}

export function cpuStatus(state: GameState): string {
  if (state.phase === "draft") {
    const p = state.players[state.draftPlayerIndex];
    return p?.kind === "cpu" ? `${p.name}がカードを選んでいます…` : "";
  }
  if (state.phase === "playing") {
    const p = currentPlayer(state);
    return p?.kind === "cpu" ? `${p.name}が考えています…` : "";
  }
  return "";
}

export function scoreSummary(state: GameState) {
  return state.players.map((p) => ({ name: p.name, score: calculatePlayerScore(p) }));
}
