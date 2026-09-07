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

export const MAGIC_DESCRIPTIONS: Record<MagicType, string> = {
  destroy: "墓場に捨て、場のカードを破壊する。守護に当たるとそこで終了。",
  guard: "場のカードに重ね、破壊から守る。終了時に1枚につき+1点。",
  double: "場のカードに重ね、その基礎点を2倍にする。複数枚ならさらに倍。",
  betray: "場のカードに重ね、点数を-1倍する。複数枚なら符号が反転する。",
  moratorium: "墓場に捨て、山札から1枚引く。",
  revive: "墓場に捨て、同じ数字のカード1枚を墓場から手札に戻す。",
  truth: "墓場に捨て、対象スタックの裏向きカードを全て表向きにする。",
};

const MAGIC_TYPES: MagicType[] = [
  "destroy", "guard", "double", "betray", "moratorium", "revive", "truth",
];

export function createDeck(): Card[] {
  return MAGIC_TYPES.flatMap((magic) =>
    Array.from({ length: 7 }, (_, i) => ({
      id: `${magic}-${i + 1}`,
      number: i + 1,
      magic,
    }))
  );
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


/**
 * public/cards/{magic}/{number}.png の画像パスを返す。
 * GitHub Pagesではリポジトリ名のbasePathを自動で付ける。
 */
export function getCardImagePath(
  card: Pick<Card, "magic" | "number">
): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${basePath}/cards/${card.magic}/${card.number}.png`;
}
