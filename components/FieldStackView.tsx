"use client";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { MAGIC_NAMES } from "@/game/cards";
import type { FieldStack } from "@/game/types";

export default function FieldStackView({ stack, onClick, selectable = false }: { stack: FieldStack; onClick?: () => void; selectable?: boolean }) {
  return (
    <Box onClick={onClick} cursor={selectable ? "pointer" : "default"} p="3" borderWidth="2px" borderRadius="xl" bg="whiteAlpha.200" minW="135px" _hover={selectable ? { borderColor: "purple.300" } : undefined}>
      <Text fontWeight="bold">{MAGIC_NAMES[stack.baseCard.magic]} {stack.baseCard.number}</Text>
      <Text fontSize="sm" color="gray.300">得点はゲーム終了まで非公開</Text>
      <VStack align="stretch" mt="2" gap="1">
        {stack.effects.map((effect, i) => (
          <HStack key={`${effect.card.id}-${i}`} justify="space-between" bg="blackAlpha.300" px="2" py="1" borderRadius="md">
            <Text fontSize="xs">{effect.isFaceUp ? MAGIC_NAMES[effect.card.magic] : "？？？"}</Text>
            <Text fontSize="xs">{effect.isFaceUp ? effect.card.number : "裏"}</Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
}
