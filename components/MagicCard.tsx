"use client";

import { Box, Image } from "@chakra-ui/react";
import { getCardImagePath } from "@/game/cards";
import type { Card } from "@/game/types";

type MagicCardProps = {
  card: Card;
  hidden?: boolean;
  onClick?: () => void;
  selected?: boolean;
  size?: "normal" | "small";
};

export default function MagicCard({
  card,
  hidden = false,
  onClick,
  selected = false,
  size = "normal",
}: MagicCardProps) {
  const width = size === "small" ? "92px" : "170px";
  const height = size === "small" ? "138px" : "255px";

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const backImagePath = `${basePath}/cards/card-back.png`;

  return (
    <Box
      onClick={onClick}
      cursor={onClick ? "pointer" : "default"}
      w={width}
      h={height}
      borderRadius="8px"
      overflow="hidden"
      border="2px solid"
      borderColor={selected ? "#E2C275" : "rgba(171,132,64,.28)"}
      outline={selected ? "1px solid rgba(243,212,138,.62)" : "none"}
      outlineOffset="3px"
      transform={selected ? "translateY(-10px)" : "translateY(0)"}
      filter={selected ? "drop-shadow(0 0 14px rgba(230,190,100,.50))" : "none"}
      boxShadow={selected ? "0 14px 28px rgba(0,0,0,.50)" : "0 8px 22px rgba(0,0,0,.42)"}
      _hover={
        onClick
          ? {
              transform: selected ? "translateY(-12px)" : "translateY(-6px)",
              borderColor: "#B99756",
              boxShadow: "0 14px 30px rgba(0,0,0,.52), 0 0 14px rgba(215,181,109,.15)",
            }
          : undefined
      }
      transition="transform .16s ease, box-shadow .16s ease, border-color .16s ease, filter .16s ease"
      bg="#050608"
      flexShrink={0}
    >
      <Image
        src={hidden ? backImagePath : getCardImagePath(card)}
        alt={hidden ? "カード裏面" : `${card.magic}-${card.number}`}
        w="100%"
        h="100%"
        objectFit="cover"
        display="block"
        draggable={false}
        loading="lazy"
        decoding="async"
      />
    </Box>
  );
}
