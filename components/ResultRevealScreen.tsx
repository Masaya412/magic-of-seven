"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Image,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";

import MagicCard from "@/components/MagicCard";
import { getCardImagePath, MAGIC_NAMES } from "@/game/cards";
import {
  calculatePlayerScore,
  getStackScoreSteps,
  type StackScoreStep,
} from "@/game/scoring";
import type { Card, FieldStack, GameState, Player } from "@/game/types";

type RevealStage =
  | "playerIntro"
  | "base"
  | "revealEffect"
  | "calculate"
  | "addStack"
  | "playerDone"
  | "final";

type RevealFrame = {
  stage: RevealStage;
  playerIndex: number;
  stackIndex: number;
  revealedEffectIds: string[];
  calculationStep: number;
  activeEffectId: string | null;
  stackScore: number;
  playerTotal: number;
  message: string;
  duration: number;
};

const GOLD = "#D7B56D";
const GOLD_BRIGHT = "#F3D48A";
const TEXT = "#F5EFE2";
const MUTED = "#A99E8B";

type RevealSpeed = "slow" | "normal" | "fast";

const SPEED_MULTIPLIERS: Record<RevealSpeed, number> = {
  slow: 1.45,
  normal: 1,
  fast: 0.62,
};

const SPEED_LABELS: Record<RevealSpeed, string> = {
  slow: "ゆっくり",
  normal: "標準",
  fast: "速い",
};

export default function ResultRevealScreen({
  game,
  onRestart,
}: {
  game: GameState;
  onRestart: () => void;
}) {
  const frames = useMemo(() => buildRevealFrames(game.players), [game.players]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<RevealSpeed>("normal");

  // リザルト開始時に、これから開示する効果カードの表面画像を先読みする。
  // これによりフリップ途中で表画像の読み込み待ちが発生しにくくなる。
  useEffect(() => {
    const urls = Array.from(
      new Set(
        game.players.flatMap((player) =>
          player.field.flatMap((stack) =>
            stack.effects.map((effect) => getCardImagePath(effect.card))
          )
        )
      )
    );

    urls.forEach((src) => {
      const image = new window.Image();
      image.src = src;
      image.decode?.().catch(() => undefined);
    });
  }, [game.players]);

  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const isFinal = frame.stage === "final";
  const speedMultiplier = SPEED_MULTIPLIERS[speed];
  const frameDuration = Math.round(frame.duration * speedMultiplier);
  const shownStackScore = useAnimatedNumber(
    frame.stackScore,
    Math.round(820 * speedMultiplier)
  );
  const shownPlayerTotal = useAnimatedNumber(
    frame.playerTotal,
    Math.round(1080 * speedMultiplier)
  );

  useEffect(() => {
    if (paused || isFinal) return;

    const timer = window.setTimeout(() => {
      setFrameIndex((current) => Math.min(current + 1, frames.length - 1));
    }, frameDuration);

    return () => window.clearTimeout(timer);
  }, [frameDuration, frames.length, isFinal, paused, frameIndex]);

  if (isFinal) {
    return <FinalRanking game={game} onRestart={onRestart} />;
  }

  const player = game.players[frame.playerIndex];
  const stack = player.field[frame.stackIndex] ?? null;
  const scoreSteps = stack ? getStackScoreSteps(stack) : [];

  return (
    <VStack gap={{ base: "4", md: "6" }} align="stretch" w="full">
      <HStack justify="space-between" align="center" wrap="wrap" gap="3">
        <VStack align="start" gap="0">
          <Text fontSize="12px" letterSpacing="0.38em" color="#B89758">
            SCORE REVEAL
          </Text>
          <Heading
            fontSize={{ base: "2xl", md: "4xl" }}
            fontWeight="500"
            letterSpacing="0.08em"
            color="#F3E5BF"
            textShadow="0 0 24px rgba(215,181,109,.22)"
          >
            最終集計
          </Heading>
        </VStack>

        <VStack align={{ base: "stretch", sm: "end" }} gap="2">
          <HStack gap="1" flexWrap="wrap" justify={{ base: "start", sm: "end" }}>
            <Text fontSize="12px" color="#9C855D" letterSpacing="0.16em" mr="1">
              REVEAL SPEED
            </Text>
            {(["slow", "normal", "fast"] as RevealSpeed[]).map((value) => (
              <Button
                key={value}
                size="xs"
                minW="64px"
                border="1px solid"
                borderColor={speed === value ? GOLD : "rgba(215,181,109,.28)"}
                bg={speed === value ? "rgba(215,181,109,.16)" : "rgba(0,0,0,.26)"}
                color={speed === value ? GOLD_BRIGHT : "#B8AA91"}
                onClick={() => setSpeed(value)}
              >
                {SPEED_LABELS[value]}
              </Button>
            ))}
          </HStack>

          <HStack gap="2">
            <Button
              size="sm"
              variant="outline"
              borderColor="rgba(215,181,109,.48)"
              color="#E8D7B2"
              bg="rgba(0,0,0,.28)"
              onClick={() => setPaused((v) => !v)}
            >
              {paused ? "再開" : "一時停止"}
            </Button>
            <Button
              size="sm"
              bg="linear-gradient(180deg, #392A16, #171008)"
              color="#F3E3B9"
              border="1px solid #9E7A3C"
              onClick={() => setFrameIndex(frames.length - 1)}
            >
              集計をスキップ
            </Button>
          </HStack>
        </VStack>
      </HStack>

      <Box h="1px" bg="linear-gradient(90deg, transparent, #D7B56D, transparent)" />

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap={{ base: "4", md: "6" }}>
        <Box
          p={{ base: "4", md: "6" }}
          bg="linear-gradient(180deg, rgba(20,17,12,.94), rgba(6,7,9,.96))"
          border="1px solid rgba(215,181,109,.38)"
          borderRadius="10px"
          boxShadow="inset 0 0 38px rgba(0,0,0,.60)"
          minH={{ base: "280px", md: "430px" }}
        >
          <VStack gap="4" h="full">
            <VStack gap="0" textAlign="center">
              <Text fontSize="12px" letterSpacing="0.3em" color="#9C855D">
                PLAYER {frame.playerIndex + 1} / {game.players.length}
              </Text>
              <Heading size="lg" color={TEXT} fontWeight="500">
                {player.name}
              </Heading>
              {player.kind === "cpu" && (
                <Text fontSize="md" color="#A99772" letterSpacing="0.2em">
                  ◇ CPU PLAYER
                </Text>
              )}
            </VStack>

            <Box
              w="full"
              py="3"
              px="4"
              bg="rgba(0,0,0,.34)"
              border="1px solid rgba(215,181,109,.18)"
              borderRadius="6px"
              textAlign="center"
            >
              <Text fontSize="md" color={MUTED} letterSpacing="0.18em">
                CURRENT TOTAL
              </Text>
              <Text
                fontSize={{ base: "4xl", md: "6xl" }}
                lineHeight="1"
                mt="2"
                color={shownPlayerTotal < 0 ? "#E6A3A3" : GOLD_BRIGHT}
                fontVariantNumeric="tabular-nums"
                textShadow="0 0 22px rgba(215,181,109,.18)"
              >
                {formatSignedTotal(shownPlayerTotal)}
                <Text as="span" fontSize="md" ml="2" color={MUTED}>
                  pt
                </Text>
              </Text>
            </Box>

            <Text minH="52px" color="#D8CDB9" textAlign="center" lineHeight="1.8">
              {frame.message}
            </Text>

            <ProgressDots players={game.players} activePlayerIndex={frame.playerIndex} />
          </VStack>
        </Box>

        <Box
          p={{ base: "4", md: "6" }}
          bg="radial-gradient(circle at 50% 45%, rgba(215,181,109,.10), transparent 48%), rgba(5,6,8,.86)"
          border="1px solid rgba(215,181,109,.32)"
          borderRadius="10px"
          boxShadow="inset 0 0 44px rgba(0,0,0,.68)"
          minH={{ base: "390px", md: "430px" }}
        >
          {stack ? (
            <StackReveal
              stack={stack}
              frame={frame}
              scoreSteps={scoreSteps}
              shownStackScore={shownStackScore}
            />
          ) : (
            <VStack h="full" justify="center" gap="3">
              <Text fontSize="4xl" color="#8E7954">✦</Text>
              <Text color={MUTED}>場に残っているカードはありません</Text>
            </VStack>
          )}
        </Box>
      </SimpleGrid>

      <HStack justify="center" gap="3" color="#8F826E" fontSize="md" flexWrap="wrap">
        <Text>場カード {Math.min(frame.stackIndex + 1, Math.max(player.field.length, 1))} / {player.field.length}</Text>
        <Text>◆</Text>
        <Text>伏せカードは結果集計で初めて公開されます</Text>
      </HStack>
    </VStack>
  );
}

function StackReveal({
  stack,
  frame,
  scoreSteps,
  shownStackScore,
}: {
  stack: FieldStack;
  frame: RevealFrame;
  scoreSteps: StackScoreStep[];
  shownStackScore: number;
}) {
  const baseVisible = frame.stage !== "playerIntro";
  const calculationText = getCalculationText(scoreSteps, frame.calculationStep);

  return (
    <VStack gap="4" h="full" justify="space-between">
      <VStack gap="0">
        <Text fontSize="12px" color="#9C855D" letterSpacing="0.3em">
          FIELD CARD
        </Text>
        <Text fontSize="md" color="#D6C8AE">
          ベース {stack.baseCard.number}点
        </Text>
      </VStack>

      <HStack align="center" justify="center" gap={{ base: "2", md: "3" }} flexWrap="wrap">
        <Box opacity={baseVisible ? 1 : 0.18} transition="opacity .4s ease">
          <MagicCard card={stack.baseCard} size="small" />
        </Box>

        {stack.effects.map((effect, index) => {
          // ゲーム中に真実の魔法で公開済みでも、リザルトでは一度伏せ直す。
          // ただし、一度リザルトで公開した後は3Dフリップ表示を使い続けず、
          // 通常の表向きカードとして固定する。これにより集計中の表裏混在を防ぐ。
          const revealed = frame.revealedEffectIds.includes(effect.card.id);
          const active = frame.activeEffectId === effect.card.id;
          const isFlipping = frame.stage === "revealEffect" && active;

          return (
            <ResultEffectCard
              key={`${effect.card.id}-${index}`}
              card={effect.card}
              revealed={revealed}
              active={active}
              isFlipping={isFlipping}
            />
          );
        })}
      </HStack>

      <Box
        w="full"
        py="3"
        px="4"
        bg="rgba(0,0,0,.38)"
        border="1px solid rgba(215,181,109,.18)"
        borderRadius="6px"
        textAlign="center"
      >
        <Text fontSize="md" color={MUTED} letterSpacing="0.15em">
          CARD SCORE
        </Text>
        <Text
          fontSize={{ base: "3xl", md: "5xl" }}
          lineHeight="1.1"
          color={shownStackScore < 0 ? "#E5A0A0" : GOLD_BRIGHT}
          fontVariantNumeric="tabular-nums"
          transition="color .25s ease"
        >
          {shownStackScore}
          <Text as="span" fontSize="md" ml="2" color={MUTED}>pt</Text>
        </Text>
        <Text mt="2" minH="24px" fontSize="md" color="#D8CDB9">
          {calculationText}
        </Text>
      </Box>
    </VStack>
  );
}

function ResultEffectCard({
  card,
  revealed,
  active,
  isFlipping,
}: {
  card: Card;
  revealed: boolean;
  active: boolean;
  isFlipping: boolean;
}) {
  return (
    <VStack gap="1">
      <Box
        w="92px"
        h="138px"
        filter={active ? "drop-shadow(0 0 12px rgba(243,212,138,.75))" : "none"}
        transition="filter .18s ease"
      >
        {isFlipping ? (
          <OneShotFlipCard card={card} />
        ) : revealed ? (
          // フリップ完了後は3Dカードを残さず、表面を静的表示する。
          // 以後の計算ステップで裏面が再び見えることを防ぐ。
          <MagicCard card={card} size="small" />
        ) : (
          <MagicCard card={card} size="small" hidden />
        )}
      </Box>

      <Text
        fontSize="9px"
        color={revealed ? (active ? GOLD_BRIGHT : "#B6AA97") : "#746B5D"}
        letterSpacing="0.04em"
        textAlign="center"
        minH="14px"
      >
        {revealed
          ? active && !isFlipping
            ? `計算中：${MAGIC_NAMES[card.magic]} ${card.number}`
            : `${MAGIC_NAMES[card.magic]} ${card.number}`
          : "未公開"}
      </Text>
    </VStack>
  );
}

function OneShotFlipCard({ card }: { card: Card }) {
  const [flipped, setFlipped] = useState(false);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const backPath = `${basePath}/cards/card-back.png`;

  useEffect(() => {
    // 最初の描画では確実に裏面を見せ、次の描画フレームで一度だけ反転する。
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setFlipped(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <Box w="100%" h="100%" style={{ perspective: "900px" }}>
      <Box
        position="relative"
        w="100%"
        h="100%"
        transform={flipped ? "rotateY(180deg)" : "rotateY(0deg)"}
        transition="transform .34s cubic-bezier(.2,.72,.2,1)"
        style={{ transformStyle: "preserve-3d" }}
      >
        <CardFace src={backPath} alt="伏せカード" />
        <CardFace
          src={getCardImagePath(card)}
          alt={`${card.magic}-${card.number}`}
          front
        />
      </Box>
    </Box>
  );
}

function CardFace({
  src,
  alt,
  front = false,
}: {
  src: string;
  alt: string;
  front?: boolean;
}) {
  return (
    <Box
      position="absolute"
      inset="0"
      overflow="hidden"
      borderRadius="6px"
      border="1px solid rgba(215,181,109,.42)"
      bg="#050608"
      transform={front ? "rotateY(180deg)" : "rotateY(0deg)"}
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
    >
      <Image
        src={src}
        alt={alt}
        w="100%"
        h="100%"
        objectFit="cover"
        display="block"
        draggable={false}
        loading="eager"
        decoding="sync"
      />
    </Box>
  );
}

function ProgressDots({
  players,
  activePlayerIndex,
}: {
  players: Player[];
  activePlayerIndex: number;
}) {
  return (
    <HStack gap="2" justify="center" flexWrap="wrap">
      {players.map((player, index) => (
        <Box
          key={player.id}
          w={index === activePlayerIndex ? "22px" : "7px"}
          h="7px"
          borderRadius="999px"
          bg={index < activePlayerIndex ? "#766344" : index === activePlayerIndex ? GOLD : "#39352F"}
          transition="all .3s ease"
        />
      ))}
    </HStack>
  );
}

function FinalRanking({
  game,
  onRestart,
}: {
  game: GameState;
  onRestart: () => void;
}) {
  const ranking = [...game.players].sort(
    (a, b) => calculatePlayerScore(b) - calculatePlayerScore(a)
  );
  const winners = game.players
    .filter((p) => game.winnerIds.includes(p.id))
    .map((p) => p.name)
    .join(" / ");

  return (
    <VStack gap="6" align="stretch" w="full">
      <VStack gap="1" textAlign="center">
        <Text fontSize="md" letterSpacing="0.42em" color={GOLD}>FINAL RESULT</Text>
        <Heading
          fontSize={{ base: "3xl", md: "5xl" }}
          fontWeight="500"
          letterSpacing="0.1em"
          color="#F3E5BF"
          textShadow="0 0 28px rgba(215,181,109,.28)"
        >
          最終結果
        </Heading>
        <Box w="240px" h="1px" bg="linear-gradient(90deg, transparent, #D7B56D, transparent)" />
      </VStack>

      <VStack gap="3">
        {ranking.map((player, index) => {
          const isWinner = game.winnerIds.includes(player.id);
          return (
            <Box
              key={player.id}
              w="full"
              maxW="680px"
              p={{ base: "4", md: "5" }}
              bg={isWinner
                ? "radial-gradient(circle at 50% 0%, rgba(215,181,109,.17), transparent 58%), linear-gradient(180deg, rgba(30,24,14,.98), rgba(7,8,10,.96))"
                : "linear-gradient(180deg, rgba(20,18,14,.94), rgba(7,8,10,.94))"}
              border="1px solid"
              borderColor={isWinner ? "rgba(243,212,138,.72)" : "rgba(215,181,109,.30)"}
              borderRadius="8px"
              boxShadow={isWinner ? "0 0 28px rgba(215,181,109,.12), inset 0 0 24px rgba(0,0,0,.52)" : "inset 0 0 22px rgba(0,0,0,.55)"}
            >
              <HStack justify="space-between" align="center" gap="4">
                <HStack gap="4" minW="0">
                  <Text
                    minW="54px"
                    fontSize={{ base: "2xl", md: "3xl" }}
                    color={index === 0 ? GOLD_BRIGHT : "#B4A68D"}
                    fontFamily="serif"
                  >
                    {index + 1}
                    <Text as="span" fontSize="md" ml="1">位</Text>
                  </Text>
                  <VStack align="start" gap="0" minW="0">
                    <Text fontSize={{ base: "lg", md: "xl" }} color={TEXT} truncate>
                      {player.name}
                    </Text>
                    {player.kind === "cpu" && (
                      <Text fontSize="12px" color="#8F8067" letterSpacing="0.17em">CPU PLAYER</Text>
                    )}
                  </VStack>
                </HStack>
                <Text
                  fontSize={{ base: "2xl", md: "4xl" }}
                  color={calculatePlayerScore(player) < 0 ? "#E5A0A0" : GOLD_BRIGHT}
                  fontVariantNumeric="tabular-nums"
                >
                  {calculatePlayerScore(player)}
                  <Text as="span" fontSize="md" ml="2" color={MUTED}>pt</Text>
                </Text>
              </HStack>
            </Box>
          );
        })}
      </VStack>

      <Box
        maxW="680px"
        w="full"
        mx="auto"
        py="7"
        px="4"
        textAlign="center"
        borderTop="1px solid rgba(215,181,109,.32)"
        borderBottom="1px solid rgba(215,181,109,.32)"
      >
        <Text fontSize="12px" color="#B89758" letterSpacing="0.4em">VICTORY</Text>
        <Heading mt="2" color={GOLD_BRIGHT} fontWeight="500" letterSpacing="0.08em">
          {winners}
        </Heading>
      </Box>

      <Button
        onClick={onRestart}
        alignSelf="center"
        minW="220px"
        bg="linear-gradient(180deg, #392A16, #171008)"
        color="#F3E3B9"
        border="1px solid #9E7A3C"
        borderRadius="6px"
        _hover={{ borderColor: GOLD, boxShadow: "0 0 18px rgba(215,181,109,.22)" }}
      >
        最初から
      </Button>
    </VStack>
  );
}

function buildRevealFrames(players: Player[]): RevealFrame[] {
  const frames: RevealFrame[] = [];

  players.forEach((player, playerIndex) => {
    let playerTotal = 0;

    frames.push({
      stage: "playerIntro",
      playerIndex,
      stackIndex: 0,
      revealedEffectIds: [],
      calculationStep: 0,
      activeEffectId: null,
      stackScore: 0,
      playerTotal: 0,
      message: `${player.name}の場を集計します。`,
      duration: 1600,
    });

    if (player.field.length === 0) {
      frames.push({
        stage: "playerDone",
        playerIndex,
        stackIndex: 0,
        revealedEffectIds: [],
        calculationStep: 0,
        activeEffectId: null,
        stackScore: 0,
        playerTotal: 0,
        message: `${player.name}の場にはカードがありません。合計 0点です。`,
        duration: 1800,
      });
      return;
    }

    player.field.forEach((stack, stackIndex) => {
      const steps = getStackScoreSteps(stack);
      const effectSteps = steps.filter((step) => step.kind !== "base");
      const baseScore = stack.baseCard.number;
      const revealedEffectIds: string[] = [];

      frames.push({
        stage: "base",
        playerIndex,
        stackIndex,
        revealedEffectIds: [],
        calculationStep: 0,
        activeEffectId: null,
        stackScore: baseScore,
        playerTotal,
        message: `ベースカード ${stack.baseCard.number}点を確認します。`,
        duration: 1550,
      });

      // effects はベースカードに近い順に追加され、末尾がいちばん上のカード。
      // リザルトでは「下の伏せカード → 上の伏せカード」の順に、
      // ベースカードに近い側から1枚ずつ開示する。真実で公開済みだった
      // カードもリザルトではいったん裏向きから始め、この順番で改めて公開する。
      const revealOrder = [...stack.effects];

      revealOrder.forEach((effect, revealIndex) => {
        revealedEffectIds.push(effect.card.id);

        frames.push({
          stage: "revealEffect",
          playerIndex,
          stackIndex,
          revealedEffectIds: [...revealedEffectIds],
          calculationStep: 0,
          activeEffectId: effect.card.id,
          stackScore: baseScore,
          playerTotal,
          message: `伏せカード ${revealIndex + 1} / ${revealOrder.length} を公開します。`,
          duration: 1900,
        });
      });

      // 全ての伏せカードを開示し終えてから得点計算へ進む。
      // 計算順はゲームルールどおり 増大 → 裏切り → 守護。
      effectSteps.forEach((step, effectStepIndex) => {
        frames.push({
          stage: "calculate",
          playerIndex,
          stackIndex,
          revealedEffectIds: [...revealedEffectIds],
          calculationStep: effectStepIndex + 1,
          activeEffectId: step.card.id,
          stackScore: step.after,
          playerTotal,
          message: `${step.label}　${step.before} → ${step.after}点`,
          duration: 1900,
        });
      });

      const finalStackScore = steps.at(-1)?.after ?? baseScore;
      playerTotal += finalStackScore;

      frames.push({
        stage: "addStack",
        playerIndex,
        stackIndex,
        revealedEffectIds: stack.effects.map((effect) => effect.card.id),
        calculationStep: effectSteps.length,
        activeEffectId: null,
        stackScore: finalStackScore,
        playerTotal,
        message: `この場カードの ${finalStackScore}点を合計へ加えます。`,
        duration: 2050,
      });
    });

    const lastStack = player.field.at(-1);
    const lastSteps = lastStack ? getStackScoreSteps(lastStack) : [];
    const lastEffects = lastStack?.effects ?? [];

    frames.push({
      stage: "playerDone",
      playerIndex,
      stackIndex: Math.max(player.field.length - 1, 0),
      revealedEffectIds: lastEffects.map((effect) => effect.card.id),
      calculationStep: Math.max(lastSteps.length - 1, 0),
      activeEffectId: null,
      stackScore: lastSteps.at(-1)?.after ?? 0,
      playerTotal,
      message: `${player.name}の集計完了。合計 ${playerTotal}点です。`,
      duration: 2200,
    });
  });

  frames.push({
    stage: "final",
    playerIndex: Math.max(players.length - 1, 0),
    stackIndex: 0,
    revealedEffectIds: [],
    calculationStep: 0,
    activeEffectId: null,
    stackScore: 0,
    playerTotal: 0,
    message: "",
    duration: 0,
  });

  return frames;
}

function getCalculationText(steps: StackScoreStep[], calculationStep: number): string {
  if (calculationStep <= 0) return "ベースカードの数字が基本ポイントです。";
  const effectSteps = steps.filter((step) => step.kind !== "base");
  const step = effectSteps[Math.min(calculationStep - 1, effectSteps.length - 1)];
  if (!step) return "特殊効果はありません。";
  return `${step.label}：${step.before} → ${step.after}`;
}

function useAnimatedNumber(target: number, duration: number): number {
  const [value, setValue] = useState(target);
  const previousTarget = useRef(target);

  useEffect(() => {
    const start = previousTarget.current;
    previousTarget.current = target;

    if (start === target) {
      setValue(target);
      return;
    }

    let animationFrame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (target - start) * eased));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(tick);
      }
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [duration, target]);

  return value;
}

function formatSignedTotal(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
