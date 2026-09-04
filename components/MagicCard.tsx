"use client";
import { Box, Text } from "@chakra-ui/react";
import { MAGIC_DESCRIPTIONS, MAGIC_NAMES } from "@/game/cards";
import type { Card } from "@/game/types";

export default function MagicCard({ card, hidden = false, onClick, selected = false }: { card: Card; hidden?: boolean; onClick?: () => void; selected?: boolean }) {
  if (hidden) return <Box w="110px" h="160px" borderRadius="xl" bg="gray.800" border="2px solid" borderColor="gray.600" display="grid" placeItems="center"><Text fontSize="3xl">✦</Text></Box>;
  return (
    <Box onClick={onClick} cursor={onClick ? "pointer" : "default"} w="110px" minH="160px" p="3" borderRadius="xl" bg="white" color="gray.900" border="3px solid" borderColor={selected ? "purple.500" : "gray.200"} boxShadow="md" _hover={onClick ? { transform: "translateY(-4px)", boxShadow: "lg" } : undefined} transition="0.15s">
      <Text fontWeight="bold" fontSize="sm">{MAGIC_NAMES[card.magic]}</Text>
      <Text fontSize="4xl" fontWeight="black" textAlign="center" my="2">{card.number}</Text>
      <Text fontSize="xs" lineHeight="1.3">{MAGIC_DESCRIPTIONS[card.magic]}</Text>
    </Box>
  );
}
