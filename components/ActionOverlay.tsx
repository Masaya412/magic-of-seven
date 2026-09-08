"use client";

import { useEffect } from "react";
import { Box, Button, Heading, Text, VStack } from "@chakra-ui/react";
import MagicCard from "@/components/MagicCard";
import type { Card } from "@/game/types";

const HIDDEN_CARD: Card = { id: "action-hidden", number: 1, magic: "truth" };

export default function ActionOverlay({
  actorName,
  action,
  card,
  hidden = false,
  label = "PLAYER ACTION",
  onContinue,
  autoContinueMs,
  showContinueButton = true,
  continueLabel = "次へ",
}: {
  actorName: string;
  action: string;
  card?: Card | null;
  hidden?: boolean;
  label?: string;
  onContinue: () => void;
  autoContinueMs?: number;
  showContinueButton?: boolean;
  continueLabel?: string;
}) {
  useEffect(() => {
    if (!autoContinueMs || autoContinueMs <= 0) return;
    const timer = window.setTimeout(onContinue, autoContinueMs);
    return () => window.clearTimeout(timer);
  }, [autoContinueMs, onContinue]);

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="1000"
      bg="rgba(0, 0, 0, 0.78)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px="4"
      py="6"
      backdropFilter="blur(4px)"
    >
      <Box
        w={{ base: "100%", md: "560px" }}
        maxW="560px"
        maxH="90vh"
        overflowY="auto"
        bg="linear-gradient(180deg, rgba(23,19,13,.99), rgba(6,7,9,.99))"
        border="1px solid rgba(215,181,109,.58)"
        borderRadius="10px"
        boxShadow="2xl"
        p={{ base: "6", md: "8" }}
      >
        <VStack gap="6">
          <VStack gap="1">
            <Text
              fontSize="md"
              fontWeight="bold"
              color="#D7B56D"
              letterSpacing="0.22em"
            >
              {label}
            </Text>
            <Heading size="lg" textAlign="center">
              ◇ {actorName} の行動
            </Heading>
          </VStack>

          {(card || hidden) && (
            <MagicCard
              card={card ?? HIDDEN_CARD}
              hidden={hidden}
            />
          )}

          <Box
            w="full"
            px="4"
            py="4"
            borderRadius="8px"
            bg="rgba(255,255,255,.04)"
            border="1px solid rgba(215,181,109,.20)"
          >
            <Text
              fontSize={{ base: "md", md: "lg" }}
              lineHeight="1.8"
              textAlign="center"
            >
              {action}
            </Text>
          </Box>

          {hidden && (
            <Text fontSize="md" color="#9B9284" textAlign="center">
              伏せられたカードの正体は公開されません
            </Text>
          )}

          {showContinueButton && (
            <Button
              size="lg"
              w="full"
              bg="linear-gradient(180deg, #392A16, #171008)"
              color="#F3E3B9"
              border="1px solid #9E7A3C"
              borderRadius="6px"
              _hover={{
                borderColor: "#D7B56D",
                boxShadow: "0 0 18px rgba(215,181,109,.22)",
              }}
              onClick={onContinue}
            >
              {continueLabel}
            </Button>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
