import { draftPick, placeAsPoint, stackEffect, useDestroy, useMoratorium, useRevive, useTruth } from "./engine";
import type { Card, FieldStack, GameState, Player } from "./types";

function currentPlayer(state: GameState): Player {
  const id = state.turnOrder[state.currentTurn];
  return state.players.find((p) => p.id === id)!;
}

function levelOf(player: Player | undefined): number {
  return Math.max(1, Math.min(13, Math.round(player?.cpuLevel ?? 5)));
}

function visibleStackValue(stack: FieldStack): number {
  // 通常CPUは公開情報だけを判断材料にする。
  const visibleEffects = stack.effects.filter((e) => e.isFaceUp);
  let score = stack.baseCard.number;
  for (const effect of visibleEffects) {
    if (effect.card.magic === "double") score *= 2;
    if (effect.card.magic === "betray") score *= -1;
  }
  score += visibleEffects.filter((e) => e.card.magic === "guard").length;
  return score;
}

function knownStackValue(stack: FieldStack, cpuId: string): number {
  // 高難易度CPUは「自分が伏せたカード」だけは記憶する。相手の伏せ札は見ない。
  const knownEffects = stack.effects.filter(
    (e) => e.isFaceUp || e.placedByPlayerId === cpuId
  );
  let score = stack.baseCard.number;
  for (const effect of knownEffects) {
    if (effect.card.magic === "double") score *= 2;
    if (effect.card.magic === "betray") score *= -1;
  }
  score += knownEffects.filter((e) => e.card.magic === "guard").length;
  return score;
}

function unknownEffectCount(stack: FieldStack, cpuId: string): number {
  return stack.effects.filter(
    (e) => !e.isFaceUp && e.placedByPlayerId !== cpuId
  ).length;
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

function draftValue(card: Card, level: number, drafted: Card[] = []): number {
  const magicBonus: Record<Card["magic"], number> = {
    destroy: 2.8,
    guard: 1.4,
    double: 3.1,
    betray: 2.5,
    moratorium: 0.8,
    revive: 1.1,
    truth: 0.5,
  };

  let value = card.number + magicBonus[card.magic];

  if (level >= 11) {
    const highPointCards = drafted.filter((c) => c.number >= 5).length;
    const sameNumber = drafted.filter((c) => c.number === card.number).length;
    const sameMagic = drafted.filter((c) => c.magic === card.magic).length;

    // 超高難易度では、自分のドラフト済みカードとの相性まで見る。
    if (card.magic === "double") value += highPointCards * 0.65;
    if (card.magic === "guard") value += highPointCards * 0.35;
    if (card.magic === "revive" && sameNumber > 0) value += 1.2 + sameNumber * 0.25;
    if (card.magic === "destroy" || card.magic === "betray") value += 0.45;
    if (card.magic === "truth") value += 0.25;
    value -= sameMagic * 0.18;
    value += card.number * (level === 13 ? 0.20 : level === 12 ? 0.14 : 0.08);
  }

  const noise =
    level <= 10
      ? Math.random() * ((10 - level) * 1.45 + 0.05)
      : level === 11
        ? Math.random() * 0.18
        : level === 12
          ? Math.random() * 0.06
          : 0;
  return value + noise;
}

export function cpuDraftPick(state: GameState): GameState {
  if (state.phase !== "draft") return state;
  const player = state.players[state.draftPlayerIndex];
  if (!player || player.kind !== "cpu") return state;
  const pack = state.draftPacks[state.draftPlayerIndex];
  if (!pack.length) return state;
  const level = levelOf(player);
  const drafted = state.draftSelections[state.draftPlayerIndex] ?? [];
  const choice = [...pack].sort(
    (a, b) => draftValue(b, level, drafted) - draftValue(a, level, drafted)
  )[0];
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

type EliteAction = {
  score: number;
  run: () => GameState;
};

function cardRecoveryValue(card: Card): number {
  const bonus: Record<Card["magic"], number> = {
    destroy: 2.8,
    guard: 1.3,
    double: 3.2,
    betray: 2.7,
    moratorium: 0.7,
    revive: 1.0,
    truth: 0.8,
  };
  return card.number + bonus[card.magic];
}

function eliteTakeTurn(state: GameState, cpu: Player, level: number): GameState {
  const actions: EliteAction[] = [];
  const allStacks = state.players.flatMap((p) => p.field);
  const levelBonus = level - 10; // 11→1, 12→2, 13→3
  const uncertaintyPenalty = level === 11 ? 0.35 : level === 12 ? 0.18 : 0.08;
  const pointWeight = level === 13 ? 1.18 : level === 12 ? 1.14 : 1.10;

  // 常に「そのままポイント化」を候補に残す。
  for (const card of cpu.hand) {
    actions.push({
      score: card.number * pointWeight,
      run: () => placeAsPoint(state, cpu.id, card.id),
    });
  }

  for (const card of cpu.hand) {
    const opportunityCost = card.number * (level === 13 ? 0.52 : level === 12 ? 0.48 : 0.44);

    if (card.magic === "double" || card.magic === "betray") {
      for (const stack of allStacks) {
        const ownerIsCpu = stack.ownerId === cpu.id;
        const before = knownStackValue(stack, cpu.id);
        let after = before;
        if (card.magic === "double") after *= 2;
        if (card.magic === "betray") after *= -1;
        const perspectiveDelta = ownerIsCpu ? after - before : -(after - before);
        const unknowns = unknownEffectCount(stack, cpu.id);
        const score =
          perspectiveDelta * (1.05 + levelBonus * 0.08) -
          opportunityCost -
          unknowns * uncertaintyPenalty;
        actions.push({
          score,
          run: () => stackEffect(state, cpu.id, card.id, stack.id),
        });
      }
    }

    if (card.magic === "guard") {
      for (const stack of cpu.field) {
        const value = knownStackValue(stack, cpu.id);
        const unknowns = unknownEffectCount(stack, cpu.id);
        const protectionValue = Math.max(0, value) * (0.42 + levelBonus * 0.035) + 1.2;
        actions.push({
          score: protectionValue - opportunityCost - unknowns * uncertaintyPenalty * 0.4,
          run: () => stackEffect(state, cpu.id, card.id, stack.id),
        });
      }
    }

    if (card.magic === "destroy") {
      for (const stack of allStacks) {
        const ownerIsCpu = stack.ownerId === cpu.id;
        const known = knownStackValue(stack, cpu.id);
        const unknowns = unknownEffectCount(stack, cpu.id);
        let swing = ownerIsCpu ? Math.max(0, -known) : Math.max(0, known);
        swing += ownerIsCpu ? 0 : unknowns * (0.55 + levelBonus * 0.10);
        // 守護が公開済み、または自分が置いて記憶している場合は破壊の期待値を抑える。
        const knownTop = [...stack.effects]
          .reverse()
          .find((e) => e.isFaceUp || e.placedByPlayerId === cpu.id);
        if (knownTop?.card.magic === "guard") swing *= 0.45;
        actions.push({
          score: swing * (1.18 + levelBonus * 0.05) - opportunityCost,
          run: () => useDestroy(state, cpu.id, card.id, stack.id),
        });
      }
    }

    if (card.magic === "truth") {
      for (const stack of allStacks) {
        const hidden = unknownEffectCount(stack, cpu.id);
        if (hidden === 0) continue;
        const ownerIsCpu = stack.ownerId === cpu.id;
        const informationValue = hidden * (ownerIsCpu ? 0.9 : 1.7 + levelBonus * 0.18);
        actions.push({
          score: informationValue - opportunityCost * 0.65,
          run: () => useTruth(state, cpu.id, card.id, stack.id),
        });
      }
    }

    if (card.magic === "revive") {
      for (const target of state.graveyard.filter(
        (c) => c.number === card.number && c.id !== card.id
      )) {
        const futureValue = cardRecoveryValue(target) * (0.78 + levelBonus * 0.04);
        actions.push({
          score: futureValue - opportunityCost * 0.72,
          run: () => useRevive(state, cpu.id, card.id, target.id),
        });
      }
    }

    if (card.magic === "moratorium" && state.deck.length > 0) {
      // 山札1枚の平均数字は概ね4。終盤ほど手札を1枚延命する価値も少し加える。
      const expectedDraw = 4.0 + (state.deck.length / 49) * 0.35;
      const tempo = cpu.hand.length <= 2 ? 1.0 : 0.35;
      actions.push({
        score: expectedDraw + tempo + levelBonus * 0.10 - opportunityCost * 0.70,
        run: () => useMoratorium(state, cpu.id, card.id),
      });
    }
  }

  // Lv11/12はごく小さな揺らぎを残す。Lv13は同一情報なら常に最善評価を選ぶ。
  const noiseScale = level === 11 ? 0.42 : level === 12 ? 0.14 : 0;
  const ranked = actions
    .map((action) => ({ ...action, adjusted: action.score + Math.random() * noiseScale }))
    .sort((a, b) => b.adjusted - a.adjusted);

  return ranked[0]?.run() ?? placeAsPoint(state, cpu.id, cpu.hand[0].id);
}

export function cpuTakeTurn(state: GameState): GameState {
  if (state.phase !== "playing") return state;
  const cpu = currentPlayer(state);
  if (!cpu || cpu.kind !== "cpu" || cpu.hand.length === 0) return state;

  const level = levelOf(cpu);

  // Lv11〜13は全候補を比較する超高難易度ロジック。
  if (level >= 11) return eliteTakeTurn(state, cpu, level);

  // Lv1: 約72%ミス行動、Lv5: 約40%、Lv10: 0%。
  const mistakeChance = Math.max(0, (10 - level) * 0.08);
  if (Math.random() < mistakeChance) return takeMistakeTurn(state, cpu);

  const ownBest = bestOwnStack(cpu);
  const enemyBest = bestOpponentStack(state, cpu.id);
  const handByNumber = [...cpu.hand].sort((a, b) => b.number - a.number);
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
      .sort((a, b) => cardRecoveryValue(b) - cardRecoveryValue(a))[0];
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
