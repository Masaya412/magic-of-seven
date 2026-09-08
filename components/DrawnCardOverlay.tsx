"use client";

import { Box, Button, Heading, Text, VStack } from "@chakra-ui/react";
import MagicCard from "@/components/MagicCard";
import { MAGIC_NAMES } from "@/game/cards";
import type { Card } from "@/game/types";

export default function DrawnCardOverlay({ card, onContinue }: { card: Card; onContinue: () => void }) {
  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="1450"
      bg="rgba(0,0,0,.76)"
      backdropFilter="blur(4px)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p="4"
    >
      <VStack
        gap="4"
        maxW="520px"
        w="full"
        p={{ base: "6", md: "8" }}
        bg="linear-gradient(180deg, rgba(25,20,13,.98), rgba(6,7,9,.98))"
        border="1px solid rgba(215,181,109,.56)"
        borderRadius="12px"
        boxShadow="0 24px 80px rgba(0,0,0,.72)"
      >
        <Text fontSize="12px" letterSpacing=".3em" color="#A98A52">MORATORIUM DRAW</Text>
        <Heading size="lg" color="#F3E5BF">引いたカード</Heading>
        <Text color="#CFC0A6" fontSize="md" textAlign="center">
          モラトリアムの魔法で山札からこのカードを引きました。
        </Text>
        <MagicCard card={card} />
        <Text color="#F0DFC0" fontSize={{ base: "lg", md: "xl" }} fontWeight="600">
          {MAGIC_NAMES[card.magic]} {card.number}
        </Text>
        <Button
          minW="160px"
          bg="linear-gradient(180deg, #392A16, #171008)"
          color="#F3E3B9"
          border="1px solid #9E7A3C"
          onClick={onContinue}
        >
          次へ
        </Button>
      </VStack>
    </Box>
  );
}
