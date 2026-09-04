import type { FieldStack, Player } from "./types";

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
