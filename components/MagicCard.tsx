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

  const basePath =
    process.env.NODE_ENV === "production"
      ? "/magic-of-seven"
      : "";

  const backImagePath = `${basePath}/cards/card-back.png`;

  return (
    <Box
      onClick={onClick}
      cursor={onClick ? "pointer" : "default"}
      w={width}
      h={height}
      borderRadius="lg"
      overflow="hidden"
      border="3px solid"
      borderColor={selected ? "purple.300" : "transparent"}
      boxShadow={
        selected
          ? "0 0 0 3px rgba(183,148,244,.45)"
          : "lg"
      }
      _hover={
        onClick
          ? {
              transform: "translateY(-5px)",
              boxShadow: "2xl",
            }
          : undefined
      }
      transition="transform 0.15s ease, box-shadow 0.15s ease"
      bg="black"
      flexShrink={0}
    >
      <Image
        src={
          hidden
            ? backImagePath
            : getCardImagePath(card)
        }
        alt={
          hidden
            ? "カード裏面"
            : `${card.magic}-${card.number}`
        }
        w="100%"
        h="100%"
        objectFit="cover"
        display="block"
        draggable={false}
      />
    </Box>
  );
}