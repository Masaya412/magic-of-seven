import type { Card, FieldStack, Player } from "./types";

export type StackScoreStep = {
  kind: "base" | "double" | "betray" | "guard";
  card: Card;
  before: number;
  after: number;
  label: string;
};

export function calculateStackScore(stack: FieldStack): number {
  const doubles = stack.effects.filter((e) => e.card.magic === "double").length;
  const betrays = stack.effects.filter((e) => e.card.magic === "betray").length;
  const guards = stack.effects.filter((e) => e.card.magic === "guard").length;

  let score = stack.baseCard.number;
  score *= 2 ** doubles;
  score *= (-1) ** betrays;
  score += guards;
  return score;
}

export function calculatePlayerScore(player: Player): number {
  return player.field.reduce((sum, stack) => sum + calculateStackScore(stack), 0);
}

/**
 * 最終結果の演出用。
 * ゲーム本来の計算順と同じく、増大 → 裏切り → 守護 の順で
 * 1枚ずつ適用した途中経過を返す。
 */
export function getStackScoreSteps(stack: FieldStack): StackScoreStep[] {
  const steps: StackScoreStep[] = [
    {
      kind: "base",
      card: stack.baseCard,
      before: 0,
      after: stack.baseCard.number,
      label: `ベース ${stack.baseCard.number}点`,
    },
  ];

  let score = stack.baseCard.number;

  const orderedEffects = [
    ...stack.effects.filter((e) => e.card.magic === "double"),
    ...stack.effects.filter((e) => e.card.magic === "betray"),
    ...stack.effects.filter((e) => e.card.magic === "guard"),
  ];

  for (const effect of orderedEffects) {
    const before = score;

    if (effect.card.magic === "double") {
      score *= 2;
      steps.push({
        kind: "double",
        card: effect.card,
        before,
        after: score,
        label: "増大 ×2",
      });
      continue;
    }

    if (effect.card.magic === "betray") {
      score *= -1;
      steps.push({
        kind: "betray",
        card: effect.card,
        before,
        after: score,
        label: "裏切り ×-1",
      });
      continue;
    }

    if (effect.card.magic === "guard") {
      score += 1;
      steps.push({
        kind: "guard",
        card: effect.card,
        before,
        after: score,
        label: "守護 +1",
      });
    }
  }

  return steps;
}
