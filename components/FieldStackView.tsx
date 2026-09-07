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
      borderWidth="2px"
      borderColor={selectable ? "purple.300" : "whiteAlpha.200"}
      borderRadius="xl"
      bg="whiteAlpha.100"
      minW="132px"
      _hover={selectable ? { borderColor: "purple.200", bg: "whiteAlpha.200" } : undefined}
    >
      <VStack align="stretch" gap="2">
        <Box display="flex" justifyContent="center">
          <MagicCard card={stack.baseCard} size="small" />
        </Box>

        <Text fontSize="xs" color="gray.300" textAlign="center">
          得点はゲーム終了まで非公開
        </Text>

        {stack.effects.length > 0 && (
          <VStack align="stretch" gap="1">
            {stack.effects.map((effect, i) => (
              <HStack
                key={`${effect.card.id}-${i}`}
                justify="space-between"
                bg="blackAlpha.400"
                px="2"
                py="1"
                borderRadius="md"
              >
                <Text fontSize="xs">
                  {effect.isFaceUp ? MAGIC_NAMES[effect.card.magic] : "？？？"}
                </Text>
                <Text fontSize="xs">
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
