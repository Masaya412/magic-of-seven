"use client";

import { Box, Button, Heading, Image, Text, VStack } from "@chakra-ui/react";
import { getCardImagePath, MAGIC_NAMES } from "@/game/cards";
import type { Card } from "@/game/types";

export default function CardInspectOverlay({
  card,
  title = "カードを確認",
  subtitle,
  onClose,
}: {
  card: Card;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="1400"
      bg="rgba(0,0,0,.78)"
      backdropFilter="blur(4px)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p="4"
      onClick={onClose}
    >
      <VStack
        gap="4"
        maxW="520px"
        w="full"
        p={{ base: "5", md: "7" }}
        bg="linear-gradient(180deg, rgba(24,20,14,.98), rgba(6,7,9,.98))"
        border="1px solid rgba(215,181,109,.55)"
        borderRadius="12px"
        boxShadow="0 24px 80px rgba(0,0,0,.72)"
        onClick={(e) => e.stopPropagation()}
      >
        <Text fontSize="12px" letterSpacing=".28em" color="#A98A52">CARD VIEW</Text>
        <Heading size="lg" color="#F3E5BF" fontWeight="500">{title}</Heading>
        <Image
          src={getCardImagePath(card)}
          alt={`${MAGIC_NAMES[card.magic]} ${card.number}`}
          w={{ base: "220px", md: "300px" }}
          maxH="68vh"
          objectFit="contain"
          borderRadius="10px"
          boxShadow="0 18px 48px rgba(0,0,0,.55)"
        />
        <Text fontSize={{ base: "lg", md: "xl" }} color="#F0DFC0" textAlign="center">
          {MAGIC_NAMES[card.magic]} {card.number}
        </Text>
        {subtitle && <Text color="#BDAE94" fontSize="md" textAlign="center">{subtitle}</Text>}
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
