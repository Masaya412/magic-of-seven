"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";

import MagicCard from "@/components/MagicCard";
import FieldStackView from "@/components/FieldStackView";
import { MAGIC_NAMES } from "@/game/cards";
import {
  cpuDraftPick,
  cpuStatus,
  cpuTakeTurn,
} from "@/game/cpu";
import { calculatePlayerScore } from "@/game/scoring";
import {
  draftPick,
  placeAsPoint,
  stackEffect,
  useDestroy,
  useMoratorium,
  useRevive,
  useTruth,
} from "@/game/engine";
import type { Card, GameState } from "@/game/types";

export default function GameScreen({
  game,
  setGame,
  onRestart,
}: {
  game: GameState;
  setGame: (g: GameState) => void;
  onRestart: () => void;
}) {
  const [selected, setSelected] = useState<Card | null>(null);
  const [mode, setMode] = useState<
    "none" | "stack" | "destroy" | "truth" | "revive"
  >("none");
  const [awaitingCpuContinue, setAwaitingCpuContinue] =
    useState(false);

  useEffect(() => {
    if (game.phase !== "playing") {
      setAwaitingCpuContinue(false);
      return;
    }

    const currentId = game.turnOrder[game.currentTurn];
    const player = game.players.find((p) => p.id === currentId);

    if (player?.kind === "cpu" && !awaitingCpuContinue) {
      const timer = window.setTimeout(() => {
        const next = cpuTakeTurn(game);
        setGame(next);

        // CPUの行動結果を人間が確認するまで次のCPU処理へ進めない
        setAwaitingCpuContinue(next.phase === "playing");
      }, 700);

      return () => window.clearTimeout(timer);
    }
  }, [awaitingCpuContinue, game, setGame]);

  useEffect(() => {
    if (game.phase === "draft") {
      const player = game.players[game.draftPlayerIndex];

      if (player?.kind === "cpu") {
        const timer = window.setTimeout(
          () => setGame(cpuDraftPick(game)),
          450
        );

        return () => window.clearTimeout(timer);
      }
    }
  }, [game, setGame]);

  if (game.phase === "draft") {
    const p = game.draftPlayerIndex;
    const player = game.players[p];
    const isCpu = player.kind === "cpu";

    return (
      <Shell>
        <Heading>
          ドラフト {game.draftRound + 1}/7
        </Heading>

        <Text>
          {isCpu
            ? cpuStatus(game)
            : `${player.name}：1枚選んでください`}
        </Text>

        {isCpu ? (
          <Box
            p="10"
            bg="whiteAlpha.100"
            borderRadius="2xl"
            textAlign="center"
          >
            <Text fontSize="5xl" mb="3">
              ✦
            </Text>
            <Text color="gray.300">
              CPUの手札は非公開です
            </Text>
          </Box>
        ) : (
          <HStack wrap="wrap" justify="center">
            {game.draftPacks[p].map((c) => (
              <MagicCard
                key={c.id}
                card={c}
                onClick={() =>
                  setGame(draftPick(game, c.id))
                }
              />
            ))}
          </HStack>
        )}

        <Text>
          選択済み: {game.draftSelections[p].length}枚
        </Text>
      </Shell>
    );
  }

  if (game.phase === "result") {
    return (
      <Shell>
        <Heading>ゲーム終了</Heading>

        <VStack>
          {[...game.players]
            .sort(
              (a, b) =>
                calculatePlayerScore(b) -
                calculatePlayerScore(a)
            )
            .map((p, i) => (
              <Box
                key={p.id}
                p="4"
                bg="whiteAlpha.100"
                borderRadius="xl"
                minW="300px"
              >
                <Text
                  fontSize="xl"
                  fontWeight="bold"
                >
                  {i + 1}位 {p.name}
                  {p.kind === "cpu" ? " 🤖" : ""}
                </Text>
                <Text>{calculatePlayerScore(p)}点</Text>
              </Box>
            ))}
        </VStack>

        <Heading size="xl">
          勝者：
          {game.players
            .filter((p) =>
              game.winnerIds.includes(p.id)
            )
            .map((p) => p.name)
            .join(" / ")}
        </Heading>

        <Button onClick={onRestart}>
          最初から
        </Button>
      </Shell>
    );
  }

  const currentId =
    game.turnOrder[game.currentTurn];
  const current = game.players.find(
    (p) => p.id === currentId
  )!;
  const isCpuTurn = current.kind === "cpu";
  const interactionsLocked =
    isCpuTurn || awaitingCpuContinue;

  const lastActor = game.lastActionActorId
    ? game.players.find(
        (p) => p.id === game.lastActionActorId
      )
    : null;

  const showCpuActionPanel =
    awaitingCpuContinue &&
    lastActor?.kind === "cpu";

  const chooseCard = (card: Card) => {
    if (interactionsLocked) return;

    setSelected(card);
    setMode("none");
  };

  const useMagic = () => {
    if (!selected || interactionsLocked) return;

    if (
      ["guard", "double", "betray"].includes(
        selected.magic
      )
    ) {
      setMode("stack");
    } else if (selected.magic === "destroy") {
      setMode("destroy");
    } else if (selected.magic === "truth") {
      setMode("truth");
    } else if (
      selected.magic === "moratorium"
    ) {
      setGame(
        useMoratorium(
          game,
          current.id,
          selected.id
        )
      );
      setSelected(null);
    } else if (selected.magic === "revive") {
      setMode("revive");
    }
  };

  const selectTarget = (stackId: string) => {
    if (!selected || interactionsLocked) return;

    if (mode === "stack") {
      setGame(
        stackEffect(
          game,
          current.id,
          selected.id,
          stackId
        )
      );
    }

    if (mode === "destroy") {
      setGame(
        useDestroy(
          game,
          current.id,
          selected.id,
          stackId
        )
      );
    }

    if (mode === "truth") {
      setGame(
        useTruth(
          game,
          current.id,
          selected.id,
          stackId
        )
      );
    }

    setSelected(null);
    setMode("none");
  };

  const reviveTargets = selected
    ? game.graveyard.filter(
        (c) =>
          c.number === selected.number &&
          c.id !== selected.id
      )
    : [];

  return (
    <Shell>
      <HStack
        w="full"
        justify="space-between"
      >
        <Heading>7つの魔法</Heading>
        <Text>
          山札 {game.deck.length} / 墓場{" "}
          {game.graveyard.length}
        </Text>
      </HStack>

      <Box
        p="4"
        bg={isCpuTurn ? "gray.800" : "purple.900"}
        borderRadius="xl"
      >
        <Heading size="lg">
          {current.name} のターン{" "}
          {isCpuTurn ? "🤖" : ""}
        </Heading>

        <Text>
          {showCpuActionPanel
            ? "コンピュータの行動内容を確認して「次へ」を押してください。"
            : isCpuTurn
              ? cpuStatus(game)
              : "手札からカードを1枚選択してください。"}
        </Text>
      </Box>

      {game.lastAction && !showCpuActionPanel && (
        <Box
          px="4"
          py="3"
          borderRadius="xl"
          bg="whiteAlpha.100"
        >
          <Text fontSize="sm">
            直前の行動：{game.lastAction}
          </Text>
        </Box>
      )}

      <SimpleGrid
        columns={{ base: 1, md: 2 }}
        gap="4"
        w="full"
      >
        {game.players.map((p) => (
          <Box
            key={p.id}
            bg="whiteAlpha.100"
            p="4"
            borderRadius="2xl"
          >
            <HStack justify="space-between">
              <Heading size="md">
                {p.name}
                {p.kind === "cpu" ? " 🤖" : ""}
              </Heading>
              <Text color="gray.300">
                ポイント非公開
              </Text>
            </HStack>

            <Text
              fontSize="xs"
              color="gray.400"
              mt="1"
            >
              手札 {p.hand.length}枚
            </Text>

            <HStack mt="3" wrap="wrap">
              {p.field.length ? (
                p.field.map((s) => (
                  <FieldStackView
                    key={s.id}
                    stack={s}
                    selectable={
                      !interactionsLocked &&
                      mode !== "none" &&
                      mode !== "revive"
                    }
                    onClick={() =>
                      selectTarget(s.id)
                    }
                  />
                ))
              ) : (
                <Text color="gray.400">
                  場にカードなし
                </Text>
              )}
            </HStack>
          </Box>
        ))}
      </SimpleGrid>

      <Box w="full">
        <Heading size="md" mb="3">
          {current.name} の手札
        </Heading>

        {isCpuTurn ? (
          <HStack wrap="wrap">
            {current.hand.map((c) => (
              <MagicCard
                key={c.id}
                card={c}
                hidden
              />
            ))}
          </HStack>
        ) : (
          <HStack
            wrap="wrap"
            opacity={
              awaitingCpuContinue ? 0.5 : 1
            }
          >
            {current.hand.map((c) => (
              <MagicCard
                key={c.id}
                card={c}
                selected={
                  selected?.id === c.id
                }
                onClick={() => chooseCard(c)}
              />
            ))}
          </HStack>
        )}
      </Box>

      {selected && !interactionsLocked && (
        <Box
          w="full"
          bg="whiteAlpha.100"
          p="5"
          borderRadius="2xl"
        >
          <Heading size="md">
            {MAGIC_NAMES[selected.magic]}{" "}
            {selected.number}
          </Heading>

          <HStack mt="4" wrap="wrap">
            <Button
              onClick={() => {
                setGame(
                  placeAsPoint(
                    game,
                    current.id,
                    selected.id
                  )
                );
                setSelected(null);
              }}
            >
              ポイントとして置く
            </Button>

            <Button onClick={useMagic}>
              特殊効果として使う
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setSelected(null);
                setMode("none");
              }}
            >
              取消
            </Button>
          </HStack>

          {mode !== "none" &&
            mode !== "revive" && (
              <Text mt="3">
                対象にする場のカードを選択してください。
              </Text>
            )}

          {mode === "revive" && (
            <VStack
              align="stretch"
              mt="4"
            >
              <Text>
                墓場から同じ数字のカードを選択:
              </Text>

              {reviveTargets.length === 0 ? (
                <Text color="gray.400">
                  復活できるカードがありません。
                </Text>
              ) : (
                reviveTargets.map((c) => (
                  <Button
                    key={c.id}
                    variant="outline"
                    onClick={() => {
                      setGame(
                        useRevive(
                          game,
                          current.id,
                          selected.id,
                          c.id
                        )
                      );
                      setSelected(null);
                      setMode("none");
                    }}
                  >
                    {MAGIC_NAMES[c.magic]}{" "}
                    {c.number}
                  </Button>
                ))
              )}
            </VStack>
          )}
        </Box>
      )}

      <Text
        fontSize="sm"
        color="gray.400"
      >
        手番順:{" "}
        {game.turnOrder
          .map(
            (id) =>
              game.players.find(
                (p) => p.id === id
              )?.name
          )
          .join(" → ")}
      </Text>

      {/* CPU行動確認オーバーレイ */}
      {showCpuActionPanel && (
        <Box
          position="fixed"
          inset="0"
          zIndex="1000"
          bg="rgba(0, 0, 0, 0.66)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          px="4"
          py="6"
          backdropFilter="blur(2px)"
        >
          <Box
            w={{ base: "100%", md: "560px" }}
            maxW="560px"
            maxH="90vh"
            overflowY="auto"
            bg="gray.900"
            borderWidth="1px"
            borderColor="whiteAlpha.300"
            borderRadius="3xl"
            boxShadow="2xl"
            p={{ base: "6", md: "8" }}
          >
            <VStack gap="6">
              <VStack gap="1">
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  color="purple.200"
                  letterSpacing="0.22em"
                >
                  CPU ACTION
                </Text>

                <Heading
                  size="lg"
                  textAlign="center"
                >
                  🤖 {lastActor?.name} の行動
                </Heading>
              </VStack>

              {game.lastActionCard && (
                <MagicCard
                  card={game.lastActionCard}
                  hidden={
                    game.lastActionCardHidden
                  }
                />
              )}

              <Box
                w="full"
                px="4"
                py="4"
                borderRadius="2xl"
                bg="whiteAlpha.100"
              >
                <Text
                  fontSize={{
                    base: "md",
                    md: "lg",
                  }}
                  lineHeight="1.8"
                  textAlign="center"
                >
                  {game.lastAction}
                </Text>
              </Box>

              {game.lastActionCardHidden && (
                <Text
                  fontSize="sm"
                  color="gray.400"
                  textAlign="center"
                >
                  伏せられたカードの正体は公開されません
                </Text>
              )}

              <Button
                size="lg"
                w="full"
                colorPalette="purple"
                onClick={() =>
                  setAwaitingCpuContinue(false)
                }
              >
                次へ
              </Button>
            </VStack>
          </Box>
        </Box>
      )}
    </Shell>
  );
}

function Shell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box
      minH="100vh"
      bgGradient="to-br"
      gradientFrom="gray.950"
      gradientTo="purple.950"
      color="white"
      py="8"
    >
      <Container maxW="7xl">
        <VStack
          gap="6"
          align="stretch"
        >
          {children}
        </VStack>
      </Container>
    </Box>
  );
}
