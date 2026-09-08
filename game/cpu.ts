import { draftPick, placeAsPoint, stackEffect, useDestroy, useMoratorium, useRevive, useTruth } from "./engine";
import type { Card, FieldStack, GameState, Player } from "./types";

function currentPlayer(state: GameState): Player {
  const id = state.turnOrder[state.currentTurn];
  return state.players.find((p) => p.id === id)!;
}

function levelOf(player: Player | undefined): number {
  return Math.max(1, Math.min(10, Math.round(player?.cpuLevel ?? 5)));
}

function visibleStackValue(stack: FieldStack): number {
  // CPUは裏向きカードの正体を判断材料にしない。
  const visibleEffects = stack.effects.filter((e) => e.isFaceUp);
  let score = stack.baseCard.number;
  const doubles = visibleEffects.filter((e) => e.card.magic === "double").length;
  const betrays = visibleEffects.filter((e) => e.card.magic === "betray").length;
  const guards = visibleEffects.filter((e) => e.card.magic === "guard").length;
  score *= 2 ** doubles;
  score *= (-1) ** betrays;
  score += guards;
  return score;
}

function visibleThreat(stack: FieldStack): number {
  return Math.max(visibleStackValue(stack), stack.baseCard.number) + stack.effects.length * 0.7;
}

function bestOwnStack(player: Player): FieldStack | undefined {
  return [...player.field].sort((a, b) => visibleStackValue(b) - visibleStackValue(a))[0];
}

function bestOpponentStack(state: GameState, playerId: string): FieldStack | undefined {
  return state.players
    .filter((p) => p.id !== playerId)
    .flatMap((p) => p.field)
    .sort((a, b) => visibleThreat(b) - visibleThreat(a))[0];
}

function draftValue(card: Card, level: number): number {
  const magicBonus: Record<Card["magic"], number> = {
    destroy: 2.8,
    guard: 1.4,
    double: 3.1,
    betray: 2.5,
    moratorium: 0.8,
    revive: 1.1,
    truth: 0.5,
  };
  // 低難易度ほど評価に大きなノイズを入れる。Lv10でも完全固定にはしない。
  const noise = Math.random() * ((10 - level) * 1.45 + 0.05);
  return card.number + magicBonus[card.magic] + noise;
}

export function cpuDraftPick(state: GameState): GameState {
  if (state.phase !== "draft") return state;
  const player = state.players[state.draftPlayerIndex];
  if (!player || player.kind !== "cpu") return state;
  const pack = state.draftPacks[state.draftPlayerIndex];
  if (!pack.length) return state;
  const level = levelOf(player);
  const choice = [...pack].sort((a, b) => draftValue(b, level) - draftValue(a, level))[0];
  const next = draftPick(state, choice.id);
  next.lastAction = `${player.name}がドラフトでカードを1枚選びました。`;
  return next;
}

function randomItem<T>(items: T[]): T | undefined {
  return items.length ? items[Math.floor(Math.random() * items.length)] : undefined;
}

function takeMistakeTurn(state: GameState, cpu: Player): GameState {
  const card = randomItem(cpu.hand);
  if (!card) return state;
  const allStacks = state.players.flatMap((p) => p.field);

  // 低難易度でも特殊効果を使うことはあるが、対象やタイミングはかなり雑。
  if (["guard", "double", "betray"].includes(card.magic) && allStacks.length && Math.random() < 0.45) {
    const target = randomItem(allStacks)!;
    return stackEffect(state, cpu.id, card.id, target.id);
  }
  if (card.magic === "destroy" && allStacks.length && Math.random() < 0.42) {
    const target = randomItem(allStacks)!;
    return useDestroy(state, cpu.id, card.id, target.id);
  }
  if (card.magic === "truth") {
    const candidates = allStacks.filter((s) => s.effects.some((e) => !e.isFaceUp));
    const target = randomItem(candidates);
    if (target && Math.random() < 0.45) return useTruth(state, cpu.id, card.id, target.id);
  }
  if (card.magic === "revive") {
    const candidates = state.graveyard.filter((c) => c.number === card.number && c.id !== card.id);
    const target = randomItem(candidates);
    if (target && Math.random() < 0.5) return useRevive(state, cpu.id, card.id, target.id);
  }
  if (card.magic === "moratorium" && state.deck.length && Math.random() < 0.5) {
    return useMoratorium(state, cpu.id, card.id);
  }
  return placeAsPoint(state, cpu.id, card.id);
}

export function cpuTakeTurn(state: GameState): GameState {
  if (state.phase !== "playing") return state;
  const cpu = currentPlayer(state);
  if (!cpu || cpu.kind !== "cpu" || cpu.hand.length === 0) return state;

  const level = levelOf(cpu);
  // Lv1: 72%程度ミス行動、Lv5: 40%、Lv10: 0%。
  const mistakeChance = Math.max(0, (10 - level) * 0.08);
  if (Math.random() < mistakeChance) return takeMistakeTurn(state, cpu);

  const ownBest = bestOwnStack(cpu);
  const enemyBest = bestOpponentStack(state, cpu.id);
  const handByNumber = [...cpu.hand].sort((a, b) => b.number - a.number);
  // 高難易度ほど特殊効果を使う価値の閾値が下がり、適切に使いやすくなる。
  const thresholdAdjust = (level - 5) * 0.35;

  const doubles = cpu.hand.filter((c) => c.magic === "double").sort((a, b) => a.number - b.number);
  if (ownBest && doubles.length && visibleStackValue(ownBest) >= Math.max(2, doubles[0].number - thresholdAdjust)) {
    return stackEffect(state, cpu.id, doubles[0].id, ownBest.id);
  }

  const betrays = cpu.hand.filter((c) => c.magic === "betray").sort((a, b) => a.number - b.number);
  if (enemyBest && betrays.length && visibleThreat(enemyBest) >= Math.max(3, betrays[0].number - thresholdAdjust)) {
    return stackEffect(state, cpu.id, betrays[0].id, enemyBest.id);
  }

  const destroys = cpu.hand.filter((c) => c.magic === "destroy").sort((a, b) => a.number - b.number);
  if (enemyBest && destroys.length && visibleThreat(enemyBest) + enemyBest.effects.length >= Math.max(4, destroys[0].number + 1 - thresholdAdjust)) {
    return useDestroy(state, cpu.id, destroys[0].id, enemyBest.id);
  }

  const guards = cpu.hand.filter((c) => c.magic === "guard").sort((a, b) => a.number - b.number);
  if (ownBest && guards.length && visibleStackValue(ownBest) >= Math.max(4, guards[0].number - thresholdAdjust)) {
    return stackEffect(state, cpu.id, guards[0].id, ownBest.id);
  }

  const revives = cpu.hand.filter((c) => c.magic === "revive").sort((a, b) => a.number - b.number);
  for (const revive of revives) {
    const target = state.graveyard
      .filter((c) => c.number === revive.number && c.id !== revive.id)
      .sort((a, b) => {
        const useful = (c: Card) => (["double", "destroy", "betray", "guard"].includes(c.magic) ? 10 : 0) + c.number;
        return useful(b) - useful(a);
      })[0];
    if (target && revive.number <= Math.min(7, 3 + Math.floor(level / 2))) {
      return useRevive(state, cpu.id, revive.id, target.id);
    }
  }

  const truths = cpu.hand.filter((c) => c.magic === "truth").sort((a, b) => a.number - b.number);
  const hiddenTarget = state.players
    .filter((p) => p.id !== cpu.id)
    .flatMap((p) => p.field)
    .filter((s) => s.effects.some((e) => !e.isFaceUp))
    .sort((a, b) => b.effects.filter((e) => !e.isFaceUp).length - a.effects.filter((e) => !e.isFaceUp).length)[0];
  if (hiddenTarget && truths.length && truths[0].number <= Math.min(6, 2 + Math.floor(level / 2))) {
    return useTruth(state, cpu.id, truths[0].id, hiddenTarget.id);
  }

  const moratoriums = cpu.hand.filter((c) => c.magic === "moratorium").sort((a, b) => a.number - b.number);
  if (state.deck.length && moratoriums.length && moratoriums[0].number <= Math.min(5, 1 + Math.floor(level / 2))) {
    return useMoratorium(state, cpu.id, moratoriums[0].id);
  }

  // 戦略行動が不要なら高い数字をポイント化。低〜中難易度では上位候補から少し揺らす。
  const candidateCount = level >= 8 ? 1 : level >= 5 ? Math.min(2, handByNumber.length) : Math.min(3, handByNumber.length);
  const bestPoint = randomItem(handByNumber.slice(0, candidateCount)) ?? handByNumber[0];
  return placeAsPoint(state, cpu.id, bestPoint.id);
}

export function cpuStatus(state: GameState): string {
  if (state.phase === "draft") {
    const p = state.players[state.draftPlayerIndex];
    return p?.kind === "cpu" ? `${p.name}（Lv.${levelOf(p)}）がカードを選んでいます…` : "";
  }
  if (state.phase === "playing") {
    const p = currentPlayer(state);
    return p?.kind === "cpu" ? `${p.name}（Lv.${levelOf(p)}）が考えています…` : "";
  }
  return "";
}
