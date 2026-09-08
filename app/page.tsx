"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import GameScreen from "./game/GameScreen";
import OnlineBattle from "@/components/online/OnlineBattle";
import { createInitialState, startGame } from "@/game/engine";
import type { GameState, PlayerSetup } from "@/game/types";

type GameMode = "cpu" | "local" | "online";

const goldButtonProps = {
  bg: "linear-gradient(180deg, #392A16, #171008)",
  color: "#F3E3B9",
  border: "1px solid #9E7A3C",
  borderRadius: "6px",
  _hover: {
    borderColor: "#D7B56D",
    boxShadow: "0 0 18px rgba(215,181,109,.20)",
  },
};

export default function Home() {
  const [game, setGame] = useState<GameState>(createInitialState());
  const [mode, setMode] = useState<GameMode>("cpu");
  const [count, setCount] = useState(2);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [cpuLevels, setCpuLevels] = useState([5, 5, 5]);
  const [names, setNames] = useState([
    "あなた",
    "プレイヤー2",
    "プレイヤー3",
    "プレイヤー4",
  ]);

  if (onlineOpen) {
    return <OnlineBattle onExit={() => setOnlineOpen(false)} />;
  }

  if (game.phase !== "setup") {
    return (
      <GameScreen
        game={game}
        setGame={setGame}
        onRestart={() => setGame(createInitialState())}
      />
    );
  }

  const start = () => {
    let setups: PlayerSetup[];

    if (mode === "cpu") {
      setups = [
        { name: names[0].trim() || "あなた", kind: "human" },
        ...Array.from({ length: count - 1 }, (_, i) => ({
          name: `CPU ${i + 1}`,
          kind: "cpu" as const,
          cpuLevel: cpuLevels[i],
        })),
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
    <Box
      minH="100vh"
      position="relative"
      color="#F5EFE2"
      py={{ base: "10", md: "16" }}
      bg="#07080B"
      backgroundImage={`
        radial-gradient(circle at 50% 18%, rgba(221,174,78,.13), transparent 24%),
        radial-gradient(circle at 12% 58%, rgba(93,39,22,.14), transparent 30%),
        radial-gradient(circle at 88% 55%, rgba(30,58,91,.12), transparent 28%),
        linear-gradient(180deg, #0B0C10 0%, #050608 100%)
      `}
      _before={{
        content: '""',
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        opacity: 0.25,
        backgroundImage:
          "repeating-linear-gradient(125deg, transparent 0 34px, rgba(215,181,109,.035) 35px, transparent 36px)",
      }}
    >
      <Container maxW="4xl" position="relative" zIndex="1">
        <VStack gap={{ base: "7", md: "10" }}>
          <VStack textAlign="center" gap="2">
            <Text
              fontSize={{ base: "12px", md: "sm" }}
              letterSpacing="0.42em"
              color="#B89758"
            >
              THE SEVEN MAGICS
            </Text>
            <Heading
              fontSize={{ base: "4xl", md: "6xl" }}
              fontWeight="500"
              letterSpacing="0.12em"
              color="#F3E5BF"
              textShadow="0 0 28px rgba(215,181,109,.20)"
            >
              7つの魔法
            </Heading>
            <Box
              w={{ base: "180px", md: "260px" }}
              h="1px"
              bg="linear-gradient(90deg, transparent, #D7B56D, transparent)"
            />
            <Text mt="2" color="#AFA594" fontSize={{ base: "sm", md: "md" }}>
              7種類×1〜7の49枚で戦うドラフト式カードゲーム
            </Text>
          </VStack>

          <Box
            w="full"
            bg="linear-gradient(180deg, rgba(22,19,14,.94), rgba(8,9,12,.94))"
            p={{ base: "5", md: "8" }}
            border="1px solid rgba(215,181,109,.48)"
            borderRadius="10px"
            boxShadow="inset 0 0 34px rgba(0,0,0,.64), 0 16px 48px rgba(0,0,0,.38)"
          >
            <VStack align="stretch" gap="7">
              <Box>
                <Text mb="3" fontSize="md" color="#B89758" letterSpacing="0.28em">
                  GAME MODE
                </Text>
                <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3">
                  <Button
                    {...goldButtonProps}
                    opacity={mode === "cpu" ? 1 : 0.62}
                    boxShadow={mode === "cpu" ? "0 0 18px rgba(215,181,109,.18)" : "none"}
                    onClick={() => setMode("cpu")}
                  >
                    コンピュータ対戦
                  </Button>
                  <Button
                    {...goldButtonProps}
                    opacity={mode === "local" ? 1 : 0.62}
                    boxShadow={mode === "local" ? "0 0 18px rgba(215,181,109,.18)" : "none"}
                    onClick={() => setMode("local")}
                  >
                    ローカル対戦
                  </Button>
                  <Button
                    {...goldButtonProps}
                    opacity={mode === "online" ? 1 : 0.62}
                    boxShadow={mode === "online" ? "0 0 18px rgba(215,181,109,.18)" : "none"}
                    onClick={() => setMode("online")}
                  >
                    オンライン対戦
                  </Button>
                </SimpleGrid>
              </Box>

              {mode !== "online" && (
              <Box>
                <Text mb="3" fontSize="md" color="#B89758" letterSpacing="0.28em">
                  PLAYERS
                </Text>
                <SimpleGrid columns={3} gap="3">
                  {[2, 3, 4].map((n) => (
                    <Button
                      key={n}
                      {...goldButtonProps}
                      opacity={count === n ? 1 : 0.58}
                      boxShadow={count === n ? "0 0 18px rgba(215,181,109,.18)" : "none"}
                      onClick={() => setCount(n)}
                    >
                      {n}人
                    </Button>
                  ))}
                </SimpleGrid>
              </Box>
              )}

              {mode !== "online" && (
              <Box>
                <Text mb="3" fontSize="md" color="#B89758" letterSpacing="0.28em">
                  PLAYER NAME
                </Text>

                {mode === "cpu" ? (
                  <VStack align="stretch" gap="3">
                    <Input
                      value={names[0]}
                      bg="rgba(255,255,255,.035)"
                      color="#F5EFE2"
                      borderColor="rgba(215,181,109,.34)"
                      borderRadius="6px"
                      _focus={{ borderColor: "#D7B56D", boxShadow: "0 0 0 1px #D7B56D" }}
                      onChange={(e) => {
                        const next = [...names];
                        next[0] = e.target.value;
                        setNames(next);
                      }}
                    />
                    <HStack color="#AFA594" fontSize="md" flexWrap="wrap">
                      <Text>対戦相手：</Text>
                      <Text>
                        {Array.from({ length: count - 1 }, (_, i) => `CPU ${i + 1}`).join(" / ")}
                      </Text>
                    </HStack>
                    <VStack align="stretch" gap="4" pt="2">
                      <Text fontSize="md" color="#B89758" letterSpacing="0.22em">
                        CPU DIFFICULTY
                      </Text>
                      {Array.from({ length: count - 1 }, (_, cpuIndex) => (
                        <Box
                          key={cpuIndex}
                          p="3"
                          border="1px solid rgba(215,181,109,.24)"
                          borderRadius="6px"
                          bg="rgba(0,0,0,.22)"
                        >
                          <HStack justify="space-between" mb="2" flexWrap="wrap">
                            <Text color="#E8D7B2">CPU {cpuIndex + 1}</Text>
                            <Text color="#F3D48A" fontWeight="600">Lv.{cpuLevels[cpuIndex]}</Text>
                          </HStack>
                          <SimpleGrid columns={{ base: 5, md: 10 }} gap="2">
                            {Array.from({ length: 10 }, (_, levelIndex) => {
                              const level = levelIndex + 1;
                              const active = cpuLevels[cpuIndex] === level;
                              return (
                                <Button
                                  key={level}
                                  size="xs"
                                  minW="0"
                                  px="1"
                                  border="1px solid"
                                  borderColor={active ? "#D7B56D" : "rgba(215,181,109,.24)"}
                                  bg={active ? "rgba(215,181,109,.18)" : "rgba(0,0,0,.22)"}
                                  color={active ? "#F3D48A" : "#B6AA97"}
                                  onClick={() => {
                                    const next = [...cpuLevels];
                                    next[cpuIndex] = level;
                                    setCpuLevels(next);
                                  }}
                                >
                                  {level}
                                </Button>
                              );
                            })}
                          </SimpleGrid>
                        </Box>
                      ))}
                      <Text color="#8F8370" fontSize="sm">
                        Lv.1が最も易しく、Lv.10が最も強い設定です。CPUごとに個別設定できます。
                      </Text>
                    </VStack>
                  </VStack>
                ) : (
                  <VStack gap="3">
                    {Array.from({ length: count }, (_, i) => (
                      <Input
                        key={i}
                        value={names[i]}
                        bg="rgba(255,255,255,.035)"
                        color="#F5EFE2"
                        borderColor="rgba(215,181,109,.34)"
                        borderRadius="6px"
                        _focus={{ borderColor: "#D7B56D", boxShadow: "0 0 0 1px #D7B56D" }}
                        onChange={(e) => {
                          const next = [...names];
                          next[i] = e.target.value;
                          setNames(next);
                        }}
                      />
                    ))}
                  </VStack>
                )}
              </Box>
              )}

              <Button
                {...goldButtonProps}
                w="full"
                size="lg"
                mt="1"
                letterSpacing="0.12em"
                onClick={() => {
                  if (mode === "online") {
                    setOnlineOpen(true);
                    return;
                  }
                  start();
                }}
              >
                {mode === "online" ? "オンラインロビーへ" : "ゲーム開始"}
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
