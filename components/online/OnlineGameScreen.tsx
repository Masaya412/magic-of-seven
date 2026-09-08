"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
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
import ResultRevealScreen from "@/components/ResultRevealScreen";
import ActionOverlay from "@/components/ActionOverlay";
import CardInspectOverlay from "@/components/CardInspectOverlay";
import GraveyardOverlay from "@/components/GraveyardOverlay";
import DrawnCardOverlay from "@/components/DrawnCardOverlay";
import { MAGIC_NAMES } from "@/game/cards";
import type { Card } from "@/game/types";
import {
  setOnlineActionPreview,
  startHostActionProcessor,
  submitOnlineAction,
  subscribeActionPreviews,
  subscribePrivateGame,
  subscribePublicGame,
} from "@/online/room";
import type {
  OnlineActionPreview,
  OnlineActionType,
  OnlineSession,
  PrivateGameSnapshot,
  PublicFieldStack,
  PublicGameSnapshot,
} from "@/online/types";

const HIDDEN_PLACEHOLDER: Card = { id: "hidden", number: 1, magic: "truth" };

export default function OnlineGameScreen({
  session,
  onLeave,
}: {
  session: OnlineSession;
  onLeave: () => void;
}) {
  const [publicGame, setPublicGame] = useState<PublicGameSnapshot | null>(null);
  const [privateGame, setPrivateGame] = useState<PrivateGameSnapshot | null>(null);
  const [selected, setSelected] = useState<Card | null>(null);
  const [mode, setMode] = useState<"none" | "stack" | "destroy" | "truth" | "revive">("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [awaitingOpponentContinue, setAwaitingOpponentContinue] = useState(false);
  const [actionPreviews, setActionPreviews] = useState<OnlineActionPreview[]>([]);
  const [previewCard, setPreviewCard] = useState<Card | null>(null);
  const [graveOpen, setGraveOpen] = useState(false);
  const [drawnCardNotice, setDrawnCardNotice] = useState<Card | null>(null);
  const [syncSlow, setSyncSlow] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [resultRevealReady, setResultRevealReady] = useState(false);
  const previousPublicRef = useRef<{ revision: number; phase: PublicGameSnapshot["phase"] } | null>(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    setSyncError("");
    return subscribePublicGame(
      session.roomCode,
      setPublicGame,
      (e) => setSyncError(`公開対戦データを取得できませんでした: ${e.message}`)
    );
  }, [session.roomCode]);

  useEffect(() => {
    setSyncError("");
    return subscribePrivateGame(
      session,
      setPrivateGame,
      (e) => setSyncError(`自分の対戦データを取得できませんでした: ${e.message}`)
    );
  }, [session]);
  useEffect(() => subscribeActionPreviews(session.roomCode, setActionPreviews), [session.roomCode]);
  useEffect(() => {
    if (!session.isHost) return;
    return startHostActionProcessor(session.roomCode);
  }, [session.isHost, session.roomCode]);

  useEffect(() => {
    if (publicGame && privateGame) {
      setSyncSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSyncSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [publicGame, privateGame, session.roomCode]);

  useEffect(() => {
    if (publicGame?.phase !== "result") {
      setResultRevealReady(false);
      return;
    }

    // 最終手番の内容が見えないまま結果画面へ切り替わらないよう、
    // 最後の行動を約1.7秒表示してから結果発表へ進む。
    const timer = window.setTimeout(() => setResultRevealReady(true), 1700);
    return () => window.clearTimeout(timer);
  }, [publicGame?.phase, publicGame?.revision]);

  useEffect(() => {
    if (privateGame?.drawnCardNotice) {
      setDrawnCardNotice(privateGame.drawnCardNotice);
    }
  }, [privateGame?.revision]);

  useEffect(() => {
    submitLockRef.current = false;
    setSubmitting(false);
    setSelected(null);
    setMode("none");
    if (publicGame?.phase === "playing") {
      setOnlineActionPreview(session, "idle").catch(() => undefined);
    }
  }, [publicGame?.revision, publicGame?.phase, session]);

  useEffect(() => {
    if (!publicGame) return;

    const previous = previousPublicRef.current;
    if (
      previous &&
      previous.revision !== publicGame.revision &&
      previous.phase === "playing" &&
      publicGame.phase === "playing" &&
      publicGame.lastActionActorId &&
      publicGame.lastActionActorId !== session.playerId &&
      publicGame.lastAction
    ) {
      setAwaitingOpponentContinue(true);
    }

    previousPublicRef.current = {
      revision: publicGame.revision,
      phase: publicGame.phase,
    };
  }, [publicGame, session.playerId]);

  useEffect(() => {
    if (!publicGame || publicGame.phase !== "playing") return;
    const current = publicGame.turnOrder[publicGame.currentTurn];
    if (current === session.playerId && !awaitingOpponentContinue) {
      setOnlineActionPreview(session, selected ? (mode === "none" ? "cardSelected" : "targetSelecting") : "thinking").catch(() => undefined);
    } else {
      setOnlineActionPreview(session, "idle").catch(() => undefined);
    }
  }, [publicGame?.currentTurn, publicGame?.phase, session, awaitingOpponentContinue]);

  const send = async (type: OnlineActionType, payload: { cardId: string; targetStackId?: string; targetCardId?: string }) => {
    if (submitting || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      // プレビュー書き込みは表示用なので、行動送信の前に待たない。
      // これだけでFirestoreへの余分な1往復をクリティカルパスから外せる。
      if (type !== "draftPick") {
        setOnlineActionPreview(session, "committing").catch(() => undefined);
      }
      await submitOnlineAction(session, type, payload);
    } catch (e) {
      submitLockRef.current = false;
      setSubmitting(false);
      setOnlineActionPreview(session, "idle").catch(() => undefined);
      setError(e instanceof Error ? e.message : "操作を送信できませんでした。");
    }
  };

  if (!publicGame || !privateGame) {
    return (
      <OnlineShell>
        <VStack gap="4" py="8">
          <Heading size="md" color="#F3E5BF">対戦データを同期しています…</Heading>
          <Text textAlign="center" color="#BDAE94">公開データとあなた専用の対戦データを読み込んでいます。</Text>
          {syncError && (
            <Box w="full" maxW="680px" p="4" border="1px solid rgba(230,120,120,.40)" bg="rgba(80,20,20,.22)" borderRadius="8px">
              <Text color="#F1B4B4" textAlign="center">{syncError}</Text>
            </Box>
          )}
          {syncSlow && !syncError && (
            <Text textAlign="center" color="#D9C8A8">8秒以上かかっています。通信状態またはFirestoreの権限設定を確認してください。</Text>
          )}
          {(syncSlow || syncError) && (
            <HStack>
              <Button
                bg="linear-gradient(180deg, #392A16, #171008)"
                color="#F3E3B9"
                border="1px solid #9E7A3C"
                onClick={() => window.location.reload()}
              >
                再試行
              </Button>
              <Button variant="outline" borderColor="rgba(215,181,109,.28)" color="#D8C7A8" onClick={onLeave}>退出</Button>
            </HStack>
          )}
        </VStack>
      </OnlineShell>
    );
  }

  if (publicGame.phase === "result" && publicGame.resultGameState) {
    const finalActor = publicGame.lastActionActorId
      ? publicGame.players.find((player) => player.id === publicGame.lastActionActorId)
      : null;

    if (!resultRevealReady && finalActor && publicGame.lastAction) {
      return (
        <OnlineShell>
          <ActionOverlay
            actorName={finalActor.name}
            action={publicGame.lastAction}
            card={publicGame.lastActionCard}
            hidden={publicGame.lastActionCardHidden}
            label="FINAL ACTION"
            autoContinueMs={1700}
            showContinueButton={false}
            onContinue={() => setResultRevealReady(true)}
          />
        </OnlineShell>
      );
    }

    return (
      <OnlineShell>
        <ResultRevealScreen game={publicGame.resultGameState} onRestart={onLeave} />
      </OnlineShell>
    );
  }

  if (publicGame.phase === "draft") {
    const hasSubmitted = privateGame.draftSubmitted;
    const playerCount = publicGame.players.length;
    const othersSelected = Math.max(0, publicGame.draftSelectedCount - (hasSubmitted ? 1 : 0));
    const visibleDraftSelections = privateGame.draftSelectedCard
      ? [...privateGame.draftSelections, privateGame.draftSelectedCard].filter(
          (card, index, cards) => cards.findIndex((item) => item.id === card.id) === index
        )
      : privateGame.draftSelections;

    return (
      <OnlineShell>
        <TopBar roomCode={session.roomCode} onLeave={onLeave} />
        <VStack gap="6">
          <Text fontSize="12px" letterSpacing=".30em" color="#B89758">DRAFT PHASE</Text>
          <Heading color="#F3E5BF" fontWeight="500">ドラフト {publicGame.draftRound + 1} / 7</Heading>
          <Text color="#D7C9B1" fontSize={{ base: "md", md: "lg" }} textAlign="center" lineHeight="1.8">
            全員がこのラウンドのカードを1枚ずつ選ぶと、束を隣のプレイヤーへ回して次のラウンドへ進みます。
          </Text>

          {!hasSubmitted ? (
            <>
              <Text color="#F0D58E" fontSize={{ base: "lg", md: "xl" }} fontWeight="600">
                {othersSelected > 0 ? `${othersSelected}人が選択済みです。あなたも1枚選んでください` : "あなたのカードを1枚選んでください"}
              </Text>
              <HStack wrap="wrap" justify="center" gap="3">
                {privateGame.draftPack.map((card) => (
                  <MagicCard
                    key={card.id}
                    card={card}
                    onClick={() => !submitting && send("draftPick", { cardId: card.id })}
                  />
                ))}
              </HStack>
            </>
          ) : (
            <Box
              w="full"
              maxW="640px"
              p={{ base: "7", md: "10" }}
              textAlign="center"
              border="1px solid rgba(215,181,109,.32)"
              bg="rgba(0,0,0,.32)"
              borderRadius="10px"
            >
              <Text color="#F0D58E" fontSize={{ base: "xl", md: "2xl" }} fontWeight="600">選択しました</Text>
              <Text mt="3" color="#C9BDA8" fontSize={{ base: "md", md: "lg" }} lineHeight="1.8">
                他のプレイヤーがこのラウンドのカードを選ぶまでお待ちください。
                全員の選択が完了すると自動で次へ進みます。
              </Text>
              {privateGame.draftSelectedCard && (
                <VStack mt="5" gap="3">
                  <Text color="#F3E5BF" fontWeight="700">このラウンドであなたが選んだカード</Text>
                  <MagicCard card={privateGame.draftSelectedCard} />
                </VStack>
              )}
            </Box>
          )}

          {visibleDraftSelections.length > 0 && (
            <VStack w="full" gap="3">
              <Text color="#D7C9B1" fontWeight="600">あなたが選んだカード</Text>
              <HStack wrap="wrap" justify="center" gap="2">
                {visibleDraftSelections.map((card) => (
                  <MagicCard key={card.id} card={card} size="small" />
                ))}
              </HStack>
            </VStack>
          )}

          <HStack color="#A99A82" fontSize="md" gap="5" wrap="wrap" justify="center">
            <Text>あなたの獲得済み {privateGame.draftSelectionsCount}枚</Text>
            <Text>このラウンド {publicGame.draftSelectedCount} / {playerCount} 選択済み</Text>
          </HStack>
        </VStack>
      </OnlineShell>
    );
  }

  const currentPlayerId = publicGame.turnOrder[publicGame.currentTurn];
  const myTurn = currentPlayerId === session.playerId;
  const currentActionPreview = actionPreviews.find((preview) => preview.playerId === currentPlayerId && preview.actorUid !== session.uid);
  const interactionsLocked = submitting || awaitingOpponentContinue;
  const canAct = myTurn && !interactionsLocked;
  const lastActor = publicGame.lastActionActorId
    ? publicGame.players.find((p) => p.id === publicGame.lastActionActorId)
    : null;
  const reviveTargets = selected
    ? publicGame.graveyard.filter((c) => c.number === selected.number && c.id !== selected.id)
    : [];

  const useSpecial = () => {
    if (!selected || !canAct) return;
    if (["guard", "double", "betray"].includes(selected.magic)) { setMode("stack"); setOnlineActionPreview(session, "targetSelecting").catch(() => undefined); }
    else if (selected.magic === "destroy") { setMode("destroy"); setOnlineActionPreview(session, "targetSelecting").catch(() => undefined); }
    else if (selected.magic === "truth") { setMode("truth"); setOnlineActionPreview(session, "targetSelecting").catch(() => undefined); }
    else if (selected.magic === "moratorium") send("moratorium", { cardId: selected.id });
    else if (selected.magic === "revive") { setMode("revive"); setOnlineActionPreview(session, "targetSelecting").catch(() => undefined); }
  };

  const targetStack = (stackId: string) => {
    if (!selected || !canAct) return;
    if (mode === "stack") send("stackEffect", { cardId: selected.id, targetStackId: stackId });
    if (mode === "destroy") send("destroy", { cardId: selected.id, targetStackId: stackId });
    if (mode === "truth") send("truth", { cardId: selected.id, targetStackId: stackId });
  };

  return (
    <OnlineShell>
      <TopBar roomCode={session.roomCode} onLeave={onLeave} />

      <Box
        p="4"
        bg="linear-gradient(180deg, rgba(26,21,14,.92), rgba(8,9,12,.92))"
        border="1px solid rgba(215,181,109,.35)"
        borderRadius="8px"
      >
        <HStack justify="space-between" wrap="wrap" gap="2">
          <VStack align="start" gap="0">
            <Text fontSize="12px" color="#9C855D" letterSpacing=".25em">CURRENT TURN</Text>
            <Heading size="md" color="#F3E5BF">
              {publicGame.players.find((p) => p.id === currentPlayerId)?.name ?? "-"}
            </Heading>
          </VStack>
          <Text color={myTurn ? "#EBCF8A" : "#9E917B"}>{awaitingOpponentContinue ? "他プレイヤーの行動を確認してください" : myTurn ? "あなたの手番です" : "現在のプレイヤーの行動を待っています"}</Text>
        </HStack>
      </Box>

      {!myTurn && !awaitingOpponentContinue && currentActionPreview && (
        <OpponentActionTracker
          playerName={publicGame.players.find((p) => p.id === currentPlayerId)?.name ?? "プレイヤー"}
          phase={currentActionPreview.phase}
        />
      )}

      <HStack justify="space-between" color="#AFA594" fontSize="md" wrap="wrap">
        <Text>山札 {publicGame.deckCount}枚</Text>
        <Button
          size="sm"
          variant="outline"
          borderColor="rgba(215,181,109,.28)"
          color="#E3D1AF"
          onClick={() => setGraveOpen(true)}
        >
          墓場 {publicGame.graveyard.length}枚を見る
        </Button>
      </HStack>

      {publicGame.lastAction && !awaitingOpponentContinue && (
        <Box px="4" py="3" bg="rgba(0,0,0,.30)" border="1px solid rgba(215,181,109,.18)" borderRadius="6px">
          <Text fontSize="md" color="#D3C6AF">直前の行動：{publicGame.lastAction}</Text>
        </Box>
      )}

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        {publicGame.players.map((player) => (
          <Box key={player.id} p="4" bg="rgba(8,9,12,.78)" border="1px solid rgba(215,181,109,.30)" borderRadius="8px">
            <HStack justify="space-between">
              <Heading size="md" color="#F2E5CB">{player.name}{player.id === session.playerId ? "（あなた）" : ""}</Heading>
              <Text fontSize="md" color="#9E917B">手札 {player.handCount}枚</Text>
            </HStack>
            <Text fontSize="sm" color="#9A8D77" mt="1">ポイントはゲーム終了まで非公開</Text>
            <HStack mt="4" wrap="wrap" align="start">
              {player.field.length === 0 ? (
                <Text color="#746B5E">場にカードなし</Text>
              ) : (
                player.field.map((stack) => (
                  <OnlineFieldStack
                    key={stack.id}
                    stack={stack}
                    selectable={canAct && mode !== "none" && mode !== "revive"}
                    onClick={() => targetStack(stack.id)}
                    onPreviewCard={setPreviewCard}
                  />
                ))
              )}
            </HStack>
          </Box>
        ))}
      </SimpleGrid>

      <Box>
        <Text fontSize="12px" color="#9C855D" letterSpacing=".25em" mb="3">YOUR HAND</Text>
        <HStack wrap="wrap" gap="3" opacity={canAct ? 1 : 0.68}>
          {privateGame.hand.map((card) => (
            <MagicCard
              key={card.id}
              card={card}
              selected={selected?.id === card.id}
              onClick={() => {
                if (!canAct) return;
                setSelected(card);
                setMode("none");
                setOnlineActionPreview(session, "cardSelected").catch(() => undefined);
              }}
            />
          ))}
        </HStack>
      </Box>

      {selected && canAct && (
        <Box p="5" bg="rgba(13,12,10,.94)" border="1px solid rgba(215,181,109,.38)" borderRadius="8px">
          <Heading size="md" color="#F3E5BF">{MAGIC_NAMES[selected.magic]} {selected.number}</Heading>
          <HStack mt="4" wrap="wrap">
            <GoldButton disabled={submitting} onClick={() => send("placePoint", { cardId: selected.id })}>ポイントとして置く</GoldButton>
            <GoldButton disabled={submitting} onClick={useSpecial}>特殊効果として使う</GoldButton>
            <Button variant="outline" borderColor="rgba(215,181,109,.32)" color="#D9C8A8" onClick={() => { setSelected(null); setMode("none"); setOnlineActionPreview(session, "thinking").catch(() => undefined); }}>取消</Button>
          </HStack>
          {mode !== "none" && mode !== "revive" && (
            <Text mt="3" color="#C7B99E">対象にする場のカードを選択してください。</Text>
          )}
          {mode === "revive" && (
            <VStack
              mt="4"
              align="stretch"
              p="4"
              gap="3"
              bg="rgba(0,0,0,.34)"
              border="1px solid rgba(215,181,109,.32)"
              borderRadius="8px"
            >
              <Text color="#FFF0C8" fontSize={{ base: "md", md: "lg" }} fontWeight="700">
                墓場から同じ数字のカードを選択してください
              </Text>
              {reviveTargets.length === 0 ? (
                <Text color="#C6B99F" fontSize="md">復活できるカードがありません。</Text>
              ) : reviveTargets.map((card) => (
                <Button
                  key={card.id}
                  variant="outline"
                  h="auto"
                  minH="48px"
                  py="3"
                  px="4"
                  justifyContent="flex-start"
                  borderColor="rgba(215,181,109,.52)"
                  bg="rgba(28,22,14,.88)"
                  color="#FFF2D0"
                  fontSize={{ base: "md", md: "lg" }}
                  fontWeight="700"
                  textShadow="0 1px 2px rgba(0,0,0,.9)"
                  _hover={{ bg: "rgba(215,181,109,.16)", borderColor: "#D7B56D", color: "#FFF7E6" }}
                  onClick={() => send("revive", { cardId: selected.id, targetCardId: card.id })}
                >
                  {MAGIC_NAMES[card.magic]} {card.number}
                </Button>
              ))}
            </VStack>
          )}
        </Box>
      )}

      {awaitingOpponentContinue && lastActor && (
        <ActionOverlay
          actorName={lastActor.name}
          action={publicGame.lastAction}
          card={publicGame.lastActionCard}
          hidden={publicGame.lastActionCardHidden}
          label="PLAYER ACTION"
          onContinue={() => setAwaitingOpponentContinue(false)}
        />
      )}

      {graveOpen && (
        <GraveyardOverlay
          cards={publicGame.graveyard}
          onClose={() => setGraveOpen(false)}
          onCardClick={setPreviewCard}
        />
      )}

      {previewCard && (
        <CardInspectOverlay card={previewCard} onClose={() => setPreviewCard(null)} />
      )}

      {drawnCardNotice && (
        <DrawnCardOverlay card={drawnCardNotice} onContinue={() => setDrawnCardNotice(null)} />
      )}

      {error && <Text color="#E6A3A3">{error}</Text>}
      {submitting && <Text color="#BDAE94" fontSize="md">操作を同期しています…</Text>}
    </OnlineShell>
  );
}

function OpponentActionTracker({ playerName, phase }: { playerName: string; phase: OnlineActionPreview["phase"] }) {
  const message = phase === "thinking"
    ? "カードを選んでいます…"
    : phase === "cardSelected"
      ? "カードを1枚選択しました…"
      : phase === "targetSelecting"
        ? "対象を選んでいます…"
        : "行動を確定しています…";

  return (
    <Box
      p={{ base: "4", md: "5" }}
      border="1px solid rgba(215,181,109,.28)"
      bg="rgba(0,0,0,.38)"
      borderRadius="8px"
    >
      <HStack gap="5" align="center" wrap="wrap">
        <Box animation="onlineCardFloat 1.5s ease-in-out infinite">
          <MagicCard card={HIDDEN_PLACEHOLDER} hidden size="small" />
        </Box>
        <VStack align="start" gap="1" flex="1" minW="190px">
          <Text color="#9C855D" fontSize="sm" letterSpacing=".18em">LIVE ACTION</Text>
          <Heading size="md" color="#F2E5CB">{playerName} の手番</Heading>
          <Text color="#D7C9B1" fontSize={{ base: "md", md: "lg" }}>{message}</Text>
          <Text color="#8F8370" fontSize="sm">カードの種類・数字・確定前の対象は公開されません。</Text>
        </VStack>
      </HStack>
    </Box>
  );
}

function OnlineFieldStack({
  stack,
  selectable,
  onClick,
  onPreviewCard,
}: {
  stack: PublicFieldStack;
  selectable: boolean;
  onClick: () => void;
  onPreviewCard: (card: Card) => void;
}) {
  return (
    <Box
      p="2"
      border="1px solid"
      borderColor={selectable ? "#C7A45E" : "rgba(215,181,109,.14)"}
      borderRadius="7px"
      cursor={selectable ? "pointer" : "default"}
      onClick={selectable ? onClick : undefined}
    >
      <VStack gap="2">
        <Box
          onClick={(e) => {
            if (selectable) return;
            e.stopPropagation();
            onPreviewCard(stack.baseCard);
          }}
          cursor={selectable ? "pointer" : "zoom-in"}
        >
          <MagicCard card={stack.baseCard} size="small" />
        </Box>
        {stack.effects.length > 0 && (
          <HStack gap="1" wrap="wrap" justify="center">
            {stack.effects.map((effect) => (
              <Box
                key={effect.id}
                cursor={selectable ? "pointer" : effect.card ? "zoom-in" : "default"}
                onClick={(e) => {
                  if (selectable || !effect.card) return;
                  e.stopPropagation();
                  onPreviewCard(effect.card);
                }}
              >
                <MagicCard
                  card={effect.card ?? { ...HIDDEN_PLACEHOLDER, id: effect.id }}
                  hidden={!effect.card}
                  size="small"
                />
              </Box>
            ))}
          </HStack>
        )}
      </VStack>
    </Box>
  );
}

function TopBar({ roomCode, onLeave }: { roomCode: string; onLeave: () => void }) {
  return (
    <HStack justify="space-between" align="center" wrap="wrap">
      <VStack align="start" gap="0">
        <Text fontSize="12px" color="#9C855D" letterSpacing=".3em">ONLINE BATTLE</Text>
        <Heading size="lg" color="#F3E5BF">7つの魔法</Heading>
      </VStack>
      <HStack>
        <Text color="#AFA594" fontSize="md">合言葉 {roomCode}</Text>
        <Button size="sm" variant="outline" borderColor="rgba(215,181,109,.30)" color="#D8C7A8" onClick={onLeave}>退出</Button>
      </HStack>
    </HStack>
  );
}

function GoldButton(props: React.ComponentProps<typeof Button>) {
  return <Button bg="linear-gradient(180deg, #392A16, #171008)" color="#F3E3B9" border="1px solid #9E7A3C" borderRadius="6px" {...props} />;
}

function OnlineShell({ children }: { children: React.ReactNode }) {
  return (
    <Box minH="100vh" color="#F5EFE2" py={{ base: "6", md: "8" }} bg="#07080B" backgroundImage="radial-gradient(circle at 50% 15%, rgba(215,181,109,.10), transparent 28%), linear-gradient(180deg,#0B0C10,#050608)">
      <Container maxW="7xl"><VStack gap="6" align="stretch">{children}</VStack></Container>
    </Box>
  );
}
