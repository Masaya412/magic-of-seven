import type { Card, MagicType } from "./types";


export const MAGIC_NAMES: Record<MagicType, string> = {
  destroy: "破壊の魔法",
  guard: "守護の魔法",
  double: "増大の魔法",
  betray: "裏切りの魔法",
  moratorium: "モラトリアムの魔法",
  revive: "復活の魔法",
  truth: "真実の魔法",
};

export const MAGIC_TYPES: MagicType[] = [
  "destroy",
  "guard",
  "double",
  "betray",
  "moratorium",
  "revive",
  "truth",
];

export function createDeck(): Card[] {
  return MAGIC_TYPES.flatMap((magic) =>
    Array.from({ length: 7 }, (_, index) => ({
      id: `${magic}-${index + 1}`,
      magic,
      number: index + 1,
    }))
  );
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function getCardImagePath(card: Card): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${basePath}/cards/${card.magic}/${card.number}.png`;
}
