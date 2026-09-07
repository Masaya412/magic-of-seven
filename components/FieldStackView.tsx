"use client";

import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import MagicCard from "@/components/MagicCard";
import { MAGIC_NAMES } from "@/game/cards";
import type { FieldStack } from "@/game/types";

export default function FieldStackView({
  stack,
  onClick,
  selectable = false,
}: {
  stack: FieldStack;
  onClick?: () => void;
  selectable?: boolean;
}) {
  return (
    <Box
      onClick={onClick}
      cursor={selectable ? "pointer" : "default"}
      p="3"
      border="1px solid"
      borderColor={selectable ? "#D7B56D" : "rgba(215,181,109,.28)"}
      borderRadius="8px"
      bg="linear-gradient(180deg, rgba(22,18,12,.82), rgba(7,8,10,.88))"
      minW="132px"
      boxShadow={selectable ? "0 0 18px rgba(215,181,109,.18)" : "inset 0 0 18px rgba(0,0,0,.52)"}
      _hover={
        selectable
          ? {
              borderColor: "#F0D08A",
              transform: "translateY(-2px)",
              boxShadow: "0 0 20px rgba(215,181,109,.22)",
            }
          : undefined
      }
      transition="all .15s ease"
    >
      <VStack align="stretch" gap="2">
        <Box display="flex" justifyContent="center">
          <MagicCard card={stack.baseCard} size="small" />
        </Box>

        <Text fontSize="10px" color="#A79C8A" textAlign="center" letterSpacing="0.05em">
          POINTS HIDDEN
        </Text>

        {stack.effects.length > 0 && (
          <VStack align="stretch" gap="1">
            {stack.effects.map((effect, i) => (
              <HStack
                key={`${effect.card.id}-${i}`}
                justify="space-between"
                bg="rgba(0,0,0,.40)"
                border="1px solid rgba(215,181,109,.14)"
                px="2"
                py="1"
                borderRadius="4px"
              >
                <Text fontSize="xs" color={effect.isFaceUp ? "#EAD9B7" : "#918673"}>
                  {effect.isFaceUp ? MAGIC_NAMES[effect.card.magic] : "？？？"}
                </Text>
                <Text fontSize="xs" color={effect.isFaceUp ? "#EAD9B7" : "#918673"}>
                  {effect.isFaceUp ? effect.card.number : "裏"}
                </Text>
              </HStack>
            ))}
          </VStack>
        )}
      </VStack>
    </Box>
  );
}
