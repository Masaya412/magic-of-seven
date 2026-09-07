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
import ResultRevealScreen from "@/components/ResultRevealScreen";
import { MAGIC_NAMES } from "@/game/cards";
import {
  cpuDraftPick,
  cpuStatus,
  cpuTakeTurn,
} from "@/game/cpu";
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
        <VStack gap="1" textAlign="center">
          <Text fontSize="xs" letterSpacing="0.38em" color="#B89758">
            DRAFT PHASE
          </Text>
          <Heading fontWeight="500" letterSpacing="0.08em" color="#F3E5BF" textShadow="0 0 20px rgba(215,181,109,0.18)">
            ドラフト {game.draftRound + 1}/7
          </Heading>
          <Box w="180px" h="1px" bg="linear-gradient(90deg, transparent, #D7B56D, transparent)" />
        </VStack>

        <Text textAlign="center" color="#D8D0C2">
          {isCpu
            ? cpuStatus(game)
            : `${player.name}：1枚選んでください`}
        </Text>

        {isCpu ? (
          <Box
            p="10"
            bg="rgba(8, 9, 12, 0.88)"
            border="1px solid rgba(215,181,109,0.42)"
            borderRadius="10px"
            boxShadow="inset 0 0 30px rgba(0,0,0,.7), 0 10px 35px rgba(0,0,0,.45)"
            textAlign="center"
          >
            <Text fontSize="5xl" mb="3">
              ✦
            </Text>
            <Text color="#BDB4A3">
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

        <Text textAlign="center" color="#9F927C" fontSize="sm" letterSpacing="0.08em">
          SELECTED {game.draftSelections[p].length} / 7
        </Text>
      </Shell>
    );
  }

  if (game.phase === "result") {
    return (
      <Shell>
        <ResultRevealScreen game={game} onRestart={onRestart} />
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
      <HStack w="full" justify="space-between" align="center" gap="4" flexWrap="wrap" pb="3" borderBottom="1px solid rgba(215,181,109,.34)">
        <VStack align="start" gap="0">
          <Text fontSize="10px" letterSpacing="0.35em" color="#A98A52">THE SEVEN MAGICS</Text>
          <Heading fontWeight="500" letterSpacing="0.10em" color="#F3E5BF" textShadow="0 0 18px rgba(215,181,109,.18)">7つの魔法</Heading>
        </VStack>
        <HStack gap="5">
          <VStack gap="0"><Text fontSize="9px" letterSpacing="0.22em" color="#8F7952">DECK</Text><Text color="#F0DFC0" fontSize="lg">{game.deck.length}</Text></VStack>
          <Box w="1px" h="30px" bg="rgba(215,181,109,.3)" />
          <VStack gap="0"><Text fontSize="9px" letterSpacing="0.22em" color="#8F7952">GRAVE</Text><Text color="#F0DFC0" fontSize="lg">{game.graveyard.length}</Text></VStack>
        </HStack>
      </HStack>

      <Box
        p="4"
        bg="linear-gradient(180deg, rgba(21,18,13,.94), rgba(8,9,12,.94))"
        border="1px solid rgba(215,181,109,.42)"
        borderRadius="8px"
        boxShadow="inset 0 0 24px rgba(0,0,0,.6)"
      >
        <Heading size="lg">
          {current.name} のターン{" "}
          {isCpuTurn ? " ◇ CPU" : ""}
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
          borderRadius="8px"
          bg="rgba(10,10,13,.78)"
          border="1px solid rgba(215,181,109,.24)"
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
            bg="rgba(8, 9, 12, 0.88)"
            p="4"
            border="1px solid rgba(215,181,109,.34)"
            borderRadius="10px"
            boxShadow="inset 0 0 26px rgba(0,0,0,.55), 0 8px 26px rgba(0,0,0,.24)"
          >
            <HStack justify="space-between">
              <Heading size="md">
                {p.name}
                {p.kind === "cpu" ? " ◇ CPU" : ""}
              </Heading>
              <Text color="#BDB4A3">
                ポイント非公開
              </Text>
            </HStack>

            <Text
              fontSize="xs"
              color="#8E877A"
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
                <Text color="#8E877A">
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
          bg="linear-gradient(180deg, rgba(22,18,12,.94), rgba(8,9,12,.94))"
          p="5"
          border="1px solid rgba(215,181,109,.48)"
          borderRadius="8px"
          boxShadow="inset 0 0 24px rgba(0,0,0,.58)"
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
                <Text color="#8E877A">
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
        color="#8E877A"
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
            borderWidth="1px"
            borderColor="rgba(215,181,109,.58)"
            borderRadius="10px"
            boxShadow="2xl"
            p={{ base: "6", md: "8" }}
          >
            <VStack gap="6">
              <VStack gap="1">
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  color="#D7B56D"
                  letterSpacing="0.22em"
                >
                  CPU ACTION
                </Text>

                <Heading
                  size="lg"
                  textAlign="center"
                >
                  ◇ {lastActor?.name} の行動
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
                borderRadius="8px"
                bg="rgba(255,255,255,.04)"
                border="1px solid rgba(215,181,109,.20)"
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
                  color="#8E877A"
                  textAlign="center"
                >
                  伏せられたカードの正体は公開されません
                </Text>
              )}

              <Button
                size="lg"
                w="full"
                bg="linear-gradient(180deg, #392A16, #171008)"
                color="#F3E3B9"
                border="1px solid #9E7A3C"
                borderRadius="6px"
                _hover={{ borderColor: "#D7B56D", boxShadow: "0 0 18px rgba(215,181,109,.22)" }}
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
      position="relative"
      color="#F5EFE2"
      py={{ base: "5", md: "8" }}
      bg="#07080B"
      backgroundImage={`
        radial-gradient(circle at 50% 24%, rgba(218,173,82,.10), transparent 28%),
        radial-gradient(circle at 15% 60%, rgba(82,36,23,.12), transparent 30%),
        radial-gradient(circle at 85% 55%, rgba(30,50,76,.10), transparent 28%),
        linear-gradient(180deg, rgba(11,12,16,.98), rgba(4,5,7,1))
      `}
      _before={{
        content: '""',
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        opacity: 0.28,
        backgroundImage: "repeating-linear-gradient(125deg, transparent 0 36px, rgba(215,181,109,.035) 37px, transparent 38px)",
      }}
    >
      <Container maxW="7xl" position="relative" zIndex="1">
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
