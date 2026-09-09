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
  label: string;
  run: () => GameState;
};

function cardRecoveryValue(card: Card): number {
  const bonus: Record<Card["magic"], number> = {
    destroy: 3.8,
    guard: 2.0,
    double: 4.5,
    betray: 4.1,
    moratorium: 5.6,
    revive: 5.0,
    truth: 1.5,
  };
  return card.number + bonus[card.magic];
}

function knownPlayerScore(player: Player, cpuId: string): number {
  return player.field.reduce((sum, stack) => sum + knownStackValue(stack, cpuId), 0);
}

function publicPlayerScore(player: Player): number {
  return player.field.reduce((sum, stack) => sum + visibleStackValue(stack), 0);
}

function playerThreat(state: GameState, player: Player, cpuId: string): number {
  const field = player.id === cpuId ? knownPlayerScore(player, cpuId) : publicPlayerScore(player);
  const hidden = player.field.reduce((sum, stack) => sum + unknownEffectCount(stack, cpuId), 0);
  // 手札枚数は公開情報として「まだ逆転手段を持っている度合い」にだけ使う。
  return field + hidden * 0.9 + player.hand.length * 0.22;
}

function strongestOpponent(state: GameState, cpu: Player): Player | undefined {
  return state.players
    .filter((p) => p.id !== cpu.id)
    .sort((a, b) => playerThreat(state, b, cpu.id) - playerThreat(state, a, cpu.id))[0];
}

function ownLeadMargin(state: GameState, cpu: Player): number {
  const own = knownPlayerScore(cpu, cpu.id);
  const bestEnemy = Math.max(
    0,
    ...state.players
      .filter((p) => p.id !== cpu.id)
      .map((p) => publicPlayerScore(p))
  );
  return own - bestEnemy;
}

function futureHandValue(cpu: Player, cardUsed: Card): number {
  return cpu.hand
    .filter((c) => c.id !== cardUsed.id)
    .reduce((sum, c) => {
      const utility = c.magic === "double" || c.magic === "betray" || c.magic === "destroy" ? 0.55 : 0.28;
      return sum + c.number * 0.10 + utility;
    }, 0);
}



function knownMagicCount(state: GameState, cpu: Player, magic: Card["magic"]): number {
  let count = 0;

  for (const card of state.graveyard) if (card.magic === magic) count++;
  for (const player of state.players) {
    for (const stack of player.field) {
      if (stack.baseCard.magic === magic) count++;
      for (const effect of stack.effects) {
        if ((effect.isFaceUp || effect.placedByPlayerId === cpu.id) && effect.card.magic === magic) count++;
      }
    }
  }
  for (const card of cpu.hand) if (card.magic === magic) count++;

  return Math.min(7, count);
}

function estimatedOpponentBetrayRisk(state: GameState, cpu: Player): number {
  // 相手の手札の中身は見ない。公開済みカードと自分の既知情報だけから、
  // まだ裏切りが残っていそうかを確率的なリスクとして推定する。
  const knownBetrays = knownMagicCount(state, cpu, "betray");
  const remainingBetrays = Math.max(0, 7 - knownBetrays);
  const opponentHandCount = state.players
    .filter((p) => p.id !== cpu.id)
    .reduce((sum, p) => sum + p.hand.length, 0);

  const knownCards =
    state.graveyard.length +
    state.players.reduce((sum, p) =>
      sum + p.field.length + p.field.reduce((eSum, stack) =>
        eSum + stack.effects.filter((e) => e.isFaceUp || e.placedByPlayerId === cpu.id).length, 0
      ), 0
    ) +
    cpu.hand.length;
  const unknownCards = Math.max(1, 49 - knownCards);
  const singleCardChance = Math.min(0.95, remainingBetrays / unknownCards);
  return Math.min(1, 1 - Math.pow(1 - singleCardChance, opponentHandCount));
}

function pointRoleScore(state: GameState, cpu: Player, card: Card, level: number): number {
  // 低数字は効果用、高数字は得点用という役割分担。
  // ただしモラトリアム/復活などの強効果は高数字でも効果として保持する。
  const n = card.number;
  let score = 0;
  if (n <= 2) score -= level === 13 ? 5.2 : level === 12 ? 4.2 : 3.2;
  else if (n === 3) score -= level === 13 ? 3.4 : level === 12 ? 2.7 : 2.0;
  else if (n === 4) score -= level === 13 ? 1.2 : 0.7;
  else if (n === 5) score += 1.0;
  else if (n === 6) score += 2.6;
  else if (n === 7) score += 4.4;

  if (card.magic === "moratorium" && state.deck.length > 0) {
    score -= level === 13 ? 8.5 : level === 12 ? 7.0 : 5.6;
  }

  if (card.magic === "revive") {
    const targets = state.graveyard.filter((c) => c.number === card.number && c.id !== card.id);
    if (targets.length) {
      const best = Math.max(...targets.map(cardRecoveryValue));
      score -= Math.min(9, best * (level === 13 ? 0.72 : level === 12 ? 0.60 : 0.48));
    }
  }

  // 効果用の低数字が同種で残っているなら、高数字の同種カードは点に回しやすい。
  const lowerSameMagic = cpu.hand.some(
    (c) => c.id !== card.id && c.magic === card.magic && c.number <= Math.max(3, card.number - 2)
  );
  if (lowerSameMagic && n >= 5 && card.magic !== "moratorium" && card.magic !== "revive") score += 1.5;

  return score;
}

function pointExposurePenalty(state: GameState, cpu: Player, card: Card, level: number): number {
  if (card.number < 5) return 0;
  const risk = estimatedOpponentBetrayRisk(state, cpu);
  const ownExistingHigh = cpu.field.filter((s) => Math.max(0, knownStackValue(s, cpu.id)) >= 5).length;
  const concentration = ownExistingHigh >= 2 ? 0.78 : ownExistingHigh === 1 ? 0.35 : 0;
  const levelWeight = level === 13 ? 1.55 : level === 12 ? 1.25 : 0.95;
  return card.number * risk * levelWeight + concentration;
}

function effectEfficiencyBonus(card: Card, level: number): number {
  // 効果に使うなら数字が低いカードほど機会損失が小さい。
  // Lv13ほどこの役割分担をはっきりさせる。
  const weight = level === 13 ? 0.58 : level === 12 ? 0.45 : 0.32;
  return (8 - card.number) * weight;
}

function maxVisibleOpponentStackValue(state: GameState, cpuId: string): number {
  return Math.max(
    0,
    ...state.players
      .filter((p) => p.id !== cpuId)
      .flatMap((p) => p.field)
      .map((stack) => Math.max(0, visibleStackValue(stack)))
  );
}

function tacticalCardValue(state: GameState, cpu: Player, card: Card, level: number): number {
  const ownPositive = Math.max(0, ...cpu.field.map((s) => Math.max(0, knownStackValue(s, cpu.id))));
  const ownNegative = Math.max(0, ...cpu.field.map((s) => Math.max(0, -knownStackValue(s, cpu.id))));
  const enemyPositive = maxVisibleOpponentStackValue(state, cpu.id);
  const enemyThreat = Math.max(0, ...state.players
    .filter((p) => p.id !== cpu.id)
    .flatMap((p) => p.field)
    .map((s) => visibleThreat(s)));
  const hiddenEnemy = state.players
    .filter((p) => p.id !== cpu.id)
    .flatMap((p) => p.field)
    .reduce((sum, s) => sum + unknownEffectCount(s, cpu.id), 0);
  const sameNumberGrave = state.graveyard
    .filter((c) => c.number === card.number && c.id !== card.id)
    .sort((a, b) => cardRecoveryValue(b) - cardRecoveryValue(a))[0];

  switch (card.magic) {
    case "double":
      return ownPositive * (0.72 + (level - 10) * 0.08);
    case "betray":
      // 相手への攻撃だけでなく、自分の負のスタックを2枚目の裏切りで反転する価値も見る。
      return Math.max(enemyPositive * 1.05, ownNegative * 1.35);
    case "destroy":
      return enemyThreat * 0.78;
    case "guard":
      return ownPositive * 0.34;
    case "truth":
      return hiddenEnemy * 0.72;
    case "revive":
      // Lv11+は「1手使っても手札枚数を減らさない」ことを最重要級に評価。
      // 特にモラトリアム/復活を拾える復活は、さらに次の手数へ連鎖できる。
      if (!sameNumberGrave) return 0;
      return (
        cardRecoveryValue(sameNumberGrave) * 1.18 +
        (sameNumberGrave.magic === "moratorium" ? 5.5 : 0) +
        (sameNumberGrave.magic === "revive" ? 4.2 : 0) +
        (level - 10) * 1.25
      );
    case "moratorium":
      // モラトリアムは手札を減らさずターンを消費できるため、Lv11+の中心戦略にする。
      // 山札が残っている限り、高数字カードであっても単純な点数化より優先しやすくする。
      return state.deck.length > 0
        ? 7.0 + Math.min(6, state.deck.length) * 0.35 + cpu.hand.length * 0.55 + (level - 10) * 1.55
        : 0;
  }
}

function handTempoBonus(cpu: Player, level: number): number {
  // 手札が多いほど選択肢と残り手数が増える。Lv13ではかなり重く評価する。
  const weight = level === 13 ? 2.35 : level === 12 ? 1.75 : 1.20;
  return cpu.hand.length * weight;
}

function hasSecondBetray(cpu: Player, excludingCardId: string): boolean {
  return cpu.hand.some((c) => c.id !== excludingCardId && c.magic === "betray");
}

function proactiveSelfBetrayValue(
  state: GameState,
  cpu: Player,
  card: Card,
  stack: FieldStack,
  level: number
): number {
  if (level < 12) return Number.NEGATIVE_INFINITY;
  const secondBetrays = cpu.hand
    .filter((c) => c.id !== card.id && c.magic === "betray")
    .sort((a, b) => a.number - b.number);
  if (!secondBetrays.length) return Number.NEGATIVE_INFINITY;
  if (cpu.hand.length < 4) return Number.NEGATIVE_INFINITY;
  if (unknownEffectCount(stack, cpu.id) > 0) return Number.NEGATIVE_INFINITY;

  const value = knownStackValue(stack, cpu.id);
  if (value <= 0) return Number.NEGATIVE_INFINITY;

  const lead = ownLeadMargin(state, cpu);
  const lowCostPair = (8 - card.number) * 0.42 + (8 - secondBetrays[0].number) * 0.34;
  const remainingTurns = cpu.hand.length;
  const canAffordTwoStep = remainingTurns >= 5 || lead >= 4;
  if (!canAffordTwoStep) return Number.NEGATIVE_INFINITY;

  // 2枚の裏切りを自分の場へ重ねると最終的には符号が元に戻る。
  // 純粋な得点増ではないため常用せず、低コストの裏切り2枚・十分な手数・
  // ある程度のリードがある時だけ「読みにくい伏せ札の塊を作る」ブラフとして採用する。
  const stackFit = value <= 4 ? 2.2 : level === 13 && value <= 7 ? 0.9 : -2.0;
  const leadBonus = lead >= 6 ? 2.2 : lead >= 2 ? 1.0 : lead >= 0 ? 0.2 : -2.4;
  const levelBonus = level === 13 ? 1.7 : 0.5;
  return stackFit + leadBonus + levelBonus + lowCostPair;
}

function draftValue(card: Card, level: number, drafted: Card[] = []): number {
  const magicBonus: Record<Card["magic"], number> = {
    destroy: 3.5,
    guard: 2.0,
    double: 4.2,
    betray: 3.9,
    moratorium: 6.8,
    revive: 6.0,
    truth: 1.2,
  };

  let value = card.number * 1.12 + magicBonus[card.magic];

  if (level >= 11) {
    const highPointCards = drafted.filter((c) => c.number >= 5).length;
    const sameNumber = drafted.filter((c) => c.number === card.number).length;
    const sameMagic = drafted.filter((c) => c.magic === card.magic).length;
    const doubles = drafted.filter((c) => c.magic === "double").length;
    const guards = drafted.filter((c) => c.magic === "guard").length;
    const revives = drafted.filter((c) => c.magic === "revive").length;
    const attacks = drafted.filter((c) => c.magic === "destroy" || c.magic === "betray").length;

    if (card.magic === "double") value += highPointCards * 0.95 + Math.max(0, 2 - doubles) * 0.35;
    if (card.magic === "guard") value += highPointCards * 0.52 + Math.max(0, 2 - guards) * 0.22;
    if (card.magic === "revive" && sameNumber > 0) value += 3.2 + sameNumber * 0.85;
    if (card.magic === "revive") {
      const sameNumberTargets = drafted.filter((c) => c.number === card.number && c.magic !== "revive");
      value += sameNumberTargets.length ? 1.4 : 0;
      if (sameNumberTargets.some((c) => c.magic === "moratorium")) value += 3.2;
      if (drafted.some((c) => c.magic === "revive" && c.number === card.number)) value += 1.0;
    }
    if (card.magic === "moratorium") {
      // 高難易度は低数字だけでなく高数字のモラトリアムも「追加手数」として確保する。
      value += level === 13 ? 3.8 : level === 12 ? 3.0 : 2.3;
      value += drafted.filter((c) => c.magic === "revive" && c.number === card.number).length * 2.4;
    }
    if (card.magic === "destroy" || card.magic === "betray") value += Math.max(0, 3 - attacks) * 0.30;
    if (card.magic === "truth") value += drafted.some((c) => c.magic === "destroy" || c.magic === "betray") ? 0.30 : 0;

    // 同じ魔法への寄り過ぎは抑えるが、強カードの重複は許容する。
    value -= sameMagic * (
      card.magic === "moratorium" || card.magic === "revive"
        ? 0.02
        : card.magic === "double" || card.magic === "betray"
          ? 0.08
          : 0.22
    );

    // 高数字は得点源、低数字は効果用として取り分ける。
    // モラトリアム/復活は数字に関係なく強い効果として確保する。
    const lowEffectEfficiency = (8 - card.number) * (level === 13 ? 0.30 : level === 12 ? 0.23 : 0.16);
    if (["destroy", "guard", "double", "betray", "truth"].includes(card.magic)) value += lowEffectEfficiency;
    if (card.number >= 6 && card.magic !== "moratorium" && card.magic !== "revive") {
      value += card.number * (level === 13 ? 0.44 : level === 12 ? 0.32 : 0.22);
    }
    if (card.magic === "moratorium" || card.magic === "revive") {
      value += level === 13 ? 1.8 : level === 12 ? 1.3 : 0.9;
    }
  }

  const noise = level === 11 ? Math.random() * 0.10 : level === 12 ? Math.random() * 0.025 : 0;
  return value + noise;
}

function eliteTakeTurn(state: GameState, cpu: Player, level: number): GameState {
  const actions: EliteAction[] = [];
  const allStacks = state.players.flatMap((p) => p.field);
  const leader = strongestOpponent(state, cpu);
  const leadMargin = ownLeadMargin(state, cpu);
  const levelBonus = level - 10;
  const handAfter = Math.max(0, cpu.hand.length - 1);
  const endgame = handAfter <= 2;
  const finalTurn = handAfter === 0;

  // Lv13ほど「今の1手の点差」を重視し、Lv11は少し将来価値を残す。
  const immediateWeight = level === 13 ? 1.42 : level === 12 ? 1.30 : 1.18;
  const futureWeight = level === 13 ? 0.15 : level === 12 ? 0.24 : 0.34;
  const uncertaintyPenalty = level === 13 ? 0.10 : level === 12 ? 0.16 : 0.24;

  for (const card of cpu.hand) {
    // 素点化。終盤、特に最後の1枚では高数字を確実に点へ変える価値を上げる。
    const tacticalValue = tacticalCardValue(state, cpu, card, level);
    const strategyWeight = level === 13 ? 0.92 : level === 12 ? 0.68 : 0.42;
    // Lv11+では「とりあえず点として置く」を弱める。
    // 効果カードは、有効な使い道がある限り素点化より効果発動を優先しやすくする。
    const effectCardPenalty =
      card.magic === "moratorium" ? 5.8 + levelBonus * 1.15 :
      card.magic === "revive" ? 5.0 + levelBonus * 1.00 :
      card.magic === "double" ? 3.6 + levelBonus * 0.75 :
      card.magic === "betray" ? 3.5 + levelBonus * 0.75 :
      card.magic === "destroy" ? 3.2 + levelBonus * 0.70 :
      card.magic === "guard" ? 2.2 + levelBonus * 0.45 :
      card.magic === "truth" ? 1.4 + levelBonus * 0.30 : 0;
    const roleScore = pointRoleScore(state, cpu, card, level);
    const exposurePenalty = pointExposurePenalty(state, cpu, card, level);
    const pointScore =
      card.number * immediateWeight +
      roleScore +
      (endgame ? card.number * 0.18 : 0) +
      (finalTurn ? card.number * 0.42 : 0) +
      futureHandValue(cpu, card) * futureWeight -
      (!finalTurn ? tacticalValue * strategyWeight : tacticalValue * 0.18) -
      (!finalTurn ? effectCardPenalty : effectCardPenalty * 0.28) -
      (!finalTurn ? exposurePenalty : exposurePenalty * 0.25);
    actions.push({
      score: pointScore,
      label: `point:${card.id}`,
      run: () => placeAsPoint(state, cpu.id, card.id),
    });
  }

  for (const card of cpu.hand) {
    const opportunityCost = card.number * (finalTurn ? 1.00 : endgame ? 0.78 : 0.58);
    const preservedFuture = futureHandValue(cpu, card) * futureWeight;
    const efficientEffect = effectEfficiencyBonus(card, level);

    if (card.magic === "double") {
      for (const stack of cpu.field) {
        const before = knownStackValue(stack, cpu.id);
        const unknowns = unknownEffectCount(stack, cpu.id);
        // 負の場を倍化しない。高得点の自分の場ほど優先。
        if (before <= 0) continue;
        const rawGain = before;
        const protectSynergy = stack.effects.some(
          (e) => (e.isFaceUp || e.placedByPlayerId === cpu.id) && e.card.magic === "guard"
        ) ? 0.65 : 0;
        const score =
          rawGain * (1.52 + levelBonus * 0.14) +
          protectSynergy + 2.2 + levelBonus * 0.45 + efficientEffect -
          opportunityCost -
          unknowns * uncertaintyPenalty +
          preservedFuture;
        actions.push({
          score,
          label: `double:${card.id}:${stack.id}`,
          run: () => stackEffect(state, cpu.id, card.id, stack.id),
        });
      }
    }

    if (card.magic === "betray") {
      // 高難易度では自分の場への裏切りも候補にする。
      // すでに自分の裏切りで負になっている場なら、2枚目で正へ戻すのは大きな点差改善になる。
      for (const stack of cpu.field) {
        const before = knownStackValue(stack, cpu.id);
        const hidden = unknownEffectCount(stack, cpu.id);
        if (before < 0) {
          const swing = Math.abs(before) * 2;
          actions.push({
            score:
              swing * (1.28 + levelBonus * 0.10) +
              efficientEffect +
              (stack.effects.filter((e) => e.placedByPlayerId === cpu.id && e.card.magic === "betray").length % 2 === 1
                ? (level === 13 ? 4.8 : 3.0)
                : 0) -
              opportunityCost * 0.48 -
              hidden * uncertaintyPenalty +
              preservedFuture +
              handTempoBonus(cpu, level) * 0.12,
            label: `betray-self-flip:${card.id}:${stack.id}`,
            run: () => stackEffect(state, cpu.id, card.id, stack.id),
          });
        } else {
          const bluff = proactiveSelfBetrayValue(state, cpu, card, stack, level);
          if (Number.isFinite(bluff)) {
            actions.push({
              score:
                bluff + efficientEffect - opportunityCost * 0.35 + preservedFuture +
                handTempoBonus(cpu, level) * 0.08,
              label: `betray-self-trap:${card.id}:${stack.id}`,
              run: () => stackEffect(state, cpu.id, card.id, stack.id),
            });
          }
        }
      }

      for (const player of state.players.filter((p) => p.id !== cpu.id)) {
        const leaderBonus = player.id === leader?.id ? 1.35 : 0;
        for (const stack of player.field) {
          const before = visibleStackValue(stack);
          const hidden = unknownEffectCount(stack, cpu.id);
          // 公開値がプラスの場に裏切りを置くと、概ね 2*before の点差改善。
          const swing = before > 0 ? before * 2 : before * 0.25;
          const score =
            swing * (1.34 + levelBonus * 0.10) +
            leaderBonus + 2.0 + levelBonus * 0.42 + efficientEffect +
            hidden * 0.18 -
            opportunityCost -
            hidden * uncertaintyPenalty +
            preservedFuture;
          actions.push({
            score,
            label: `betray:${card.id}:${stack.id}`,
            run: () => stackEffect(state, cpu.id, card.id, stack.id),
          });
        }
      }
    }

    if (card.magic === "guard") {
      for (const stack of cpu.field) {
        const value = knownStackValue(stack, cpu.id);
        if (value <= 0) continue;
        const hidden = unknownEffectCount(stack, cpu.id);
        const hasKnownGuard = stack.effects.some(
          (e) => (e.isFaceUp || e.placedByPlayerId === cpu.id) && e.card.magic === "guard"
        );
        const protection =
          value * (0.48 + levelBonus * 0.055) +
          (endgame ? value * 0.15 : 0) +
          (leadMargin > 0 ? 0.70 : 0) -
          (hasKnownGuard ? 0.85 : 0);
        actions.push({
          score: protection + 1.6 + levelBonus * 0.30 + efficientEffect - opportunityCost * 0.82 - hidden * uncertaintyPenalty * 0.35 + preservedFuture,
          label: `guard:${card.id}:${stack.id}`,
          run: () => stackEffect(state, cpu.id, card.id, stack.id),
        });
      }
    }

    if (card.magic === "destroy") {
      for (const player of state.players) {
        for (const stack of player.field) {
          const ownerIsCpu = player.id === cpu.id;
          const known = ownerIsCpu ? knownStackValue(stack, cpu.id) : visibleStackValue(stack);
          const unknowns = unknownEffectCount(stack, cpu.id);
          const knownTop = [...stack.effects]
            .reverse()
            .find((e) => e.isFaceUp || e.placedByPlayerId === cpu.id);

          let swing: number;
          if (ownerIsCpu) {
            // 自分の負得点スタックだけは破壊候補にする。
            swing = known < 0 ? Math.abs(known) * 1.55 : -Math.max(1, known) * 0.65;
          } else {
            swing = Math.max(0, known) * 1.18 + unknowns * (0.55 + levelBonus * 0.12);
            if (player.id === leader?.id) swing += 1.25;
          }

          // 守護が見えている/自分が置いたと記憶している場合、破壊は1枚で止まりやすい。
          if (knownTop?.card.magic === "guard") swing *= 0.42;
          if (stack.effects.length === 0) swing *= 0.48;

          actions.push({
            score: swing * (1.24 + levelBonus * 0.09) + 2.0 + levelBonus * 0.40 + efficientEffect - opportunityCost * 0.82 + preservedFuture,
            label: `destroy:${card.id}:${stack.id}`,
            run: () => useDestroy(state, cpu.id, card.id, stack.id),
          });
        }
      }
    }

    if (card.magic === "truth") {
      for (const player of state.players) {
        for (const stack of player.field) {
          const hidden = unknownEffectCount(stack, cpu.id);
          if (hidden === 0) continue;
          const ownerIsCpu = player.id === cpu.id;
          const baseThreat = Math.max(1, visibleStackValue(stack));
          const leaderBonus = player.id === leader?.id ? 0.8 : 0;
          const informationValue = hidden * (ownerIsCpu ? 0.75 : 1.45 + levelBonus * 0.22);
          const score =
            informationValue +
            Math.min(2.0, baseThreat * 0.16) +
            leaderBonus +
            1.2 + levelBonus * 0.22 + efficientEffect -
            opportunityCost * 0.62 +
            preservedFuture;
          actions.push({
            score,
            label: `truth:${card.id}:${stack.id}`,
            run: () => useTruth(state, cpu.id, card.id, stack.id),
          });
        }
      }
    }

    if (card.magic === "revive") {
      const candidates = state.graveyard.filter((c) => c.number === card.number && c.id !== card.id);
      for (const target of candidates) {
        let recovered = cardRecoveryValue(target);
        // Lv11+は復活を「手札維持 + 次の手数確保」の主軸にする。
        // モラトリアムを拾えば、次の手でも手札を減らさず山札へアクセスできる。
        if (target.magic === "moratorium" && state.deck.length > 0) recovered += level === 13 ? 8.0 : level === 12 ? 6.5 : 5.2;
        if (target.magic === "revive") recovered += level === 13 ? 6.0 : level === 12 ? 4.8 : 3.8;
        if (target.magic === "double" || target.magic === "betray" || target.magic === "destroy") recovered += 1.0;
        const followUp = tacticalCardValue(state, cpu, target, level);
        const tempoBonus = level === 13 ? 7.0 : level === 12 ? 5.4 : 4.0;
        const score =
          recovered * (1.02 + levelBonus * 0.08) +
          efficientEffect +
          followUp * (level === 13 ? 0.88 : level === 12 ? 0.68 : 0.48) -
          opportunityCost * 0.30 +
          tempoBonus +
          (endgame ? 2.25 : 1.10) +
          preservedFuture +
          handTempoBonus(cpu, level) * 0.30;
        actions.push({
          score,
          label: `revive:${card.id}:${target.id}`,
          run: () => useRevive(state, cpu.id, card.id, target.id),
        });
      }
    }

    if (card.magic === "moratorium" && state.deck.length > 0) {
      // 山札の中身は見ない。既知のカードだけを除外して平均数字を推定する。
      const knownCards = [
        ...state.graveyard,
        ...state.players.flatMap((p) => [
          ...p.field.map((s) => s.baseCard),
          ...p.field.flatMap((s) => s.effects.filter((e) => e.isFaceUp || e.placedByPlayerId === cpu.id).map((e) => e.card)),
        ]),
        ...cpu.hand,
      ];
      const totalNumbers = 7 * (1 + 2 + 3 + 4 + 5 + 6 + 7);
      const knownSum = knownCards.reduce((sum, c) => sum + c.number, 0);
      const unknownCardCount = Math.max(1, 49 - knownCards.length);
      const expectedDraw = Math.max(1, Math.min(7, (totalNumbers - knownSum) / unknownCardCount));
      const handPreservation =
        (level === 13 ? 9.0 : level === 12 ? 7.1 : 5.4) +
        cpu.hand.length * (level === 13 ? 0.72 : level === 12 ? 0.55 : 0.40);
      const tempo = endgame ? 4.8 : cpu.hand.length <= 4 ? 3.2 : 2.0;
      const reviveChain = state.graveyard.some((g) =>
        cpu.hand.some((h) => h.magic === "revive" && h.number === g.number && h.id !== g.id)
      ) ? (level === 13 ? 2.4 : level === 12 ? 1.7 : 1.1) : 0;
      actions.push({
        score:
          expectedDraw * (0.82 + levelBonus * 0.06) +
          tempo +
          handPreservation +
          reviveChain +
          efficientEffect -
          opportunityCost * 0.20 +
          preservedFuture +
          handTempoBonus(cpu, level) * 0.34,
        label: `moratorium:${card.id}`,
        run: () => useMoratorium(state, cpu.id, card.id),
      });
    }
  }

  // Lv11+では「有効な効果があるのに素点化する」挙動を抑える。
  // 効果候補が一定以上なら、ポイント候補との僅差比較ではなく効果側を明確に優先する。
  const effectActions = actions.filter((a) => !a.label.startsWith("point:"));
  const bestEffect = [...effectActions].sort((a, b) => b.score - a.score)[0];
  const bestPointAction = [...actions]
    .filter((a) => a.label.startsWith("point:"))
    .sort((a, b) => b.score - a.score)[0];
  const effectThreshold = level === 13 ? 3.0 : level === 12 ? 3.8 : 4.6;
  // 高数字を置く判断も残すが、強効果は別格。低数字の効果カードはほぼ効果用にする。
  const bestPointCard = bestPointAction?.label.startsWith("point:")
    ? cpu.hand.find((c) => bestPointAction.label === `point:${c.id}`)
    : undefined;
  const bestEffectCardId = bestEffect?.label.split(":")[1];
  const bestEffectCard = cpu.hand.find((c) => c.id === bestEffectCardId);
  const premiumEffect = bestEffectCard?.magic === "moratorium" || bestEffectCard?.magic === "revive";
  const lowNumberEffect = (bestEffectCard?.number ?? 7) <= 3;
  const highPoint = (bestPointCard?.number ?? 0) >= 6;
  const baseEffectPreference = level === 13 ? 4.8 : level === 12 ? 3.7 : 2.6;
  const effectPreference =
    baseEffectPreference +
    (premiumEffect ? (level === 13 ? 4.5 : 3.2) : 0) +
    (lowNumberEffect ? 2.3 : 0) -
    (highPoint && !premiumEffect ? 1.8 : 0);
  if (
    bestEffect &&
    bestEffect.score >= effectThreshold &&
    (!bestPointAction || bestEffect.score + effectPreference >= bestPointAction.score)
  ) {
    return bestEffect.run();
  }

  // Lv11+は「手札を減らさない連鎖」を主戦略にする。
  // モラトリアム/復活が十分有効な局面では、単発の点数行動より優先する。
  const tempoActions = actions.filter(
    (a) => a.label.startsWith("moratorium:") || a.label.startsWith("revive:")
  );
  const bestTempo = [...tempoActions].sort((a, b) => b.score - a.score)[0];
  const bestNonTempo = [...actions]
    .filter((a) => !a.label.startsWith("moratorium:") && !a.label.startsWith("revive:"))
    .sort((a, b) => b.score - a.score)[0];
  const tempoTolerance = level === 13 ? 7.0 : level === 12 ? 5.2 : 3.6;
  if (bestTempo && (!bestNonTempo || bestTempo.score + tempoTolerance >= bestNonTempo.score)) {
    // Lv13ほど多少の即時得点を捨てても追加手数を取りにいく。
    if (level >= 12 || bestTempo.score >= bestNonTempo.score - tempoTolerance) {
      return bestTempo.run();
    }
  }

  // リード中は守りを、負けている時は攻撃を少し強める。
  const adjusted = actions.map((action) => {
    let situational = 0;
    if (leadMargin >= 5 && action.label.startsWith("guard:")) situational += 0.75;
    if (action.label.startsWith("point:")) {
      const cardId = action.label.slice("point:".length);
      const pointCard = cpu.hand.find((c) => c.id === cardId);
      if (pointCard) {
        // 高数字は点に回す。ただし相手に裏切りが残っていそうで、すでに高得点を並べている時は
        // 得点源を一か所に偏らせず、効果で盤面を揺らす選択も残す。
        if (pointCard.number >= 6) situational += level === 13 ? 2.2 : level === 12 ? 1.6 : 1.0;
        if (pointCard.number <= 3) situational -= level === 13 ? 3.0 : level === 12 ? 2.2 : 1.5;
        situational -= pointExposurePenalty(state, cpu, pointCard, level) * 0.45;
      }
    }
    if (leadMargin <= -5 && (action.label.startsWith("betray:") || action.label.startsWith("destroy:"))) situational += 1.0;
    if (action.label.startsWith("moratorium:")) {
      situational += level === 13 ? 4.6 : level === 12 ? 3.5 : 2.6;
      if (cpu.hand.length <= 4) situational += 1.6;
    }
    if (action.label.startsWith("revive:")) {
      situational += level === 13 ? 4.1 : level === 12 ? 3.0 : 2.1;
      if (cpu.hand.length <= 4) situational += 1.3;
    }
    if (leadMargin >= 4 && action.label.startsWith("betray-self-trap:")) situational += level === 13 ? 1.0 : 0.35;
    if (action.label.startsWith("betray-self-flip:")) situational += level === 13 ? 1.6 : level === 12 ? 1.05 : 0.55;
    if (finalTurn && action.label.startsWith("truth:")) situational -= 1.4;
    if (finalTurn && action.label.startsWith("moratorium:")) situational += 1.4;
    return { ...action, adjusted: action.score + situational };
  });

  // Lv11のみごく僅かな揺らぎ。Lv12/13は評価値どおりに選ぶ。
  const noiseScale = level === 11 ? 0.10 : 0;
  const ranked = adjusted
    .map((action) => ({ ...action, finalScore: action.adjusted + Math.random() * noiseScale }))
    .sort((a, b) => b.finalScore - a.finalScore);

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
