"use client";

import { useState } from "react";
import { Box, Button, Container, Heading, HStack, Input, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import GameScreen from "./game/GameScreen";
import { createInitialState, startGame } from "@/game/engine";
import type { GameState, PlayerSetup } from "@/game/types";

type GameMode = "cpu" | "local";

export default function Home() {
  const [game, setGame] = useState<GameState>(createInitialState());
  const [mode, setMode] = useState<GameMode>("cpu");
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(["あなた", "プレイヤー2", "プレイヤー3", "プレイヤー4"]);

  if (game.phase !== "setup") {
    return <GameScreen game={game} setGame={setGame} onRestart={() => setGame(createInitialState())} />;
  }

  const start = () => {
    let setups: PlayerSetup[];
    if (mode === "cpu") {
      setups = [
        { name: names[0].trim() || "あなた", kind: "human" },
        ...Array.from({ length: count - 1 }, (_, i) => ({ name: `CPU ${i + 1}`, kind: "cpu" as const })),
      ];
    } else {
      setups = Array.from({ length: count }, (_, i) => ({
        name: names[i].trim() || `プレイヤー${i + 1}`,
        kind: "human" as const,
      }));
    }
    setGame(startGame(setups));
  };

  return (
    <Box minH="100vh" bgGradient="to-br" gradientFrom="purple.950" gradientTo="gray.950" color="white" py="16">
      <Container maxW="4xl">
        <VStack gap="8">
          <Box textAlign="center">
            <Text fontSize="lg" color="purple.200">MAGICAL CARD GAME</Text>
            <Heading size="4xl">7つの魔法</Heading>
            <Text mt="4" color="gray.300">7種類×1〜7の49枚で戦うドラフト式カードゲーム</Text>
          </Box>

          <Box w="full" bg="whiteAlpha.100" p="8" borderRadius="2xl" backdropFilter="blur(14px)">
            <Text mb="3" fontWeight="bold">ゲームモード</Text>
            <SimpleGrid columns={2} gap="3" mb="7">
              <Button variant={mode === "cpu" ? "solid" : "outline"} onClick={() => setMode("cpu")}>コンピュータ対戦</Button>
              <Button variant={mode === "local" ? "solid" : "outline"} onClick={() => setMode("local")}>ローカル対戦</Button>
            </SimpleGrid>

            <Text mb="3" fontWeight="bold">参加人数</Text>
            <SimpleGrid columns={3} gap="3" mb="6">
              {[2, 3, 4].map((n) => (
                <Button key={n} variant={count === n ? "solid" : "outline"} onClick={() => setCount(n)}>{n}人</Button>
              ))}
            </SimpleGrid>

            {mode === "cpu" ? (
              <VStack align="stretch" gap="3">
                <Text fontWeight="bold">プレイヤー名</Text>
                <Input value={names[0]} bg="whiteAlpha.100" onChange={(e) => {
                  const next = [...names];
                  next[0] = e.target.value;
                  setNames(next);
                }} />
                <HStack color="gray.300" fontSize="sm">
                  <Text>対戦相手：</Text>
                  <Text>{Array.from({ length: count - 1 }, (_, i) => `CPU ${i + 1}`).join(" / ")}</Text>
                </HStack>
              </VStack>
            ) : (
              <VStack gap="3">
                {Array.from({ length: count }, (_, i) => (
                  <Input key={i} value={names[i]} bg="whiteAlpha.100" onChange={(e) => {
                    const next = [...names];
                    next[i] = e.target.value;
                    setNames(next);
                  }} />
                ))}
              </VStack>
            )}

            <Button w="full" mt="6" size="lg" onClick={start}>ゲーム開始</Button>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
