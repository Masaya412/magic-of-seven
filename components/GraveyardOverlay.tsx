"use client";

import { Box, Button, Heading, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import MagicCard from "@/components/MagicCard";
import type { Card } from "@/game/types";

export default function GraveyardOverlay({
  cards,
  onClose,
  onCardClick,
}: {
  cards: Card[];
  onClose: () => void;
  onCardClick?: (card: Card) => void;
}) {
  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="1350"
      bg="rgba(0,0,0,.78)"
      backdropFilter="blur(4px)"
      overflowY="auto"
      p={{ base: "4", md: "8" }}
      onClick={onClose}
    >
      <VStack
        maxW="1100px"
        mx="auto"
        gap="5"
        p={{ base: "5", md: "7" }}
        bg="linear-gradient(180deg, rgba(22,18,13,.98), rgba(6,7,9,.98))"
        border="1px solid rgba(215,181,109,.48)"
        borderRadius="12px"
        onClick={(e) => e.stopPropagation()}
      >
        <VStack gap="1">
          <Text fontSize="12px" letterSpacing=".3em" color="#A98A52">GRAVEYARD</Text>
          <Heading size="lg" color="#F3E5BF">墓場</Heading>
          <Text color="#BDAE94" fontSize="md">{cards.length}枚</Text>
        </VStack>

        {cards.length === 0 ? (
          <Text color="#8E877A" py="10">墓場にカードはありません。</Text>
        ) : (
          <SimpleGrid columns={{ base: 2, sm: 3, md: 5, lg: 7 }} gap="4" w="full" justifyItems="center">
            {cards.map((card) => (
              <MagicCard
                key={card.id}
                card={card}
                size="small"
                onClick={onCardClick ? () => onCardClick(card) : undefined}
              />
            ))}
          </SimpleGrid>
        )}

        <Button
          minW="150px"
          bg="linear-gradient(180deg, #392A16, #171008)"
          color="#F3E3B9"
          border="1px solid #9E7A3C"
          onClick={onClose}
        >
          閉じる
        </Button>
      </VStack>
    </Box>
  );
}
