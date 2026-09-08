"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { Box, Button, Heading, HStack, Input, Text, VStack } from "@chakra-ui/react";
import OnlineGameScreen from "./OnlineGameScreen";
import { isFirebaseConfigured } from "@/online/firebase";
import {
  createOnlineRoom,
  joinOnlineRoom,
  normalizeRoomCode,
  startOnlineGame,
  subscribeRoom,
  subscribeRoomPlayers,
} from "@/online/room";
import type { OnlineRoom, OnlineRoomPlayer, OnlineSession } from "@/online/types";
import type { TurnOrderPreference } from "@/game/types";

const goldButtonProps = {
  bg: "linear-gradient(180deg, #392A16, #171008)",
  color: "#F3E3B9",
  border: "1px solid #9E7A3C",
  borderRadius: "6px",
  _hover: { borderColor: "#D7B56D", boxShadow: "0 0 18px rgba(215,181,109,.20)" },
};

export default function OnlineBattle({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [room, setRoom] = useState<OnlineRoom | null>(null);
  const [players, setPlayers] = useState<OnlineRoomPlayer[]>([]);
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [name, setName] = useState("あなた");
  const [code, setCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(2);
  const [turnOrderPreference, setTurnOrderPreference] = useState<TurnOrderPreference>("random");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    const unRoom = subscribeRoom(session.roomCode, setRoom);
    const unPlayers = subscribeRoomPlayers(session.roomCode, setPlayers);
    return () => { unRoom(); unPlayers(); };
  }, [session]);

  if (!isFirebaseConfigured) {
    return (
      <LobbyShell>
        <Heading size="lg" color="#F3E5BF">オンライン対戦の設定が必要です</Heading>
        <Text color="#C8BBA3" fontSize={{ base: "md", md: "lg" }}>.env.local にFirebase Web Appの設定値を追加してください。</Text>
        <Button {...goldButtonProps} onClick={onExit}>戻る</Button>
      </LobbyShell>
    );
  }

  if (session && room?.status !== "waiting") {
    return <OnlineGameScreen session={session} onLeave={onExit} />;
  }

  if (session) {
    const needed = room?.maxPlayers ?? 2;
    const canStart = session.isHost && players.length === needed;
    return (
      <LobbyShell>
        <VStack gap="2" textAlign="center">
          <Text fontSize="sm" color="#B89758" letterSpacing=".30em">WAITING ROOM</Text>
          <Heading color="#F3E5BF" fontWeight="500">対戦相手を待っています</Heading>
          <Text color="#C8BBA3" fontSize={{ base: "md", md: "lg" }}>{players.length} / {needed} 人参加</Text>
        </VStack>
        <Box w="full" p="6" textAlign="center" bg="rgba(0,0,0,.30)" border="1px solid rgba(215,181,109,.35)" borderRadius="8px">
          <Text color="#9E917B" fontSize="md" letterSpacing=".22em">合言葉</Text>
          <Text mt="2" fontSize={{ base: "4xl", md: "6xl" }} letterSpacing=".18em" color="#F0D58E" fontWeight="600">{session.roomCode}</Text>
          <Text mt="3" color="#AFA594" fontSize={{ base: "md", md: "lg" }}>この6文字を対戦相手に伝えてください</Text>
        </Box>
        <VStack w="full" align="stretch" gap="2">
          {Array.from({ length: needed }).map((_, index) => {
            const player = players[index];
            return player ? (
              <HStack key={player.uid} justify="space-between" p="4" border="1px solid rgba(215,181,109,.20)" bg="rgba(255,255,255,.025)" borderRadius="6px">
                <Text color="#E5D7BC" fontSize={{ base: "md", md: "lg" }}>{index + 1}. {player.name}</Text>
                <Text color="#9E917B" fontSize="md">{player.uid === session.uid ? "あなた" : "参加済み"}</Text>
              </HStack>
            ) : (
              <Box key={`empty-${index}`} p="4" border="1px dashed rgba(215,181,109,.22)" borderRadius="6px"><Text color="#766D60" fontSize="md">{index + 1}. 参加待ち…</Text></Box>
            );
          })}
        </VStack>
        {session.isHost ? (
          <Button {...goldButtonProps} w="full" size="lg" disabled={!canStart || busy} onClick={async () => {
            setBusy(true); setError("");
            try { await startOnlineGame(session.roomCode); }
            catch (e) { setError(e instanceof Error ? e.message : "開始できませんでした。"); }
            finally { setBusy(false); }
          }}>{canStart ? "ゲーム開始" : `${needed}人そろうまで待機`}</Button>
        ) : (
          <Text textAlign="center" color="#C8BBA3" fontSize={{ base: "md", md: "lg" }} lineHeight="1.8">部屋を作ったプレイヤーが開始するまでお待ちください。</Text>
        )}
        {error && <Text color="#E6A3A3" fontSize="md">{error}</Text>}
        <Button variant="outline" borderColor="rgba(215,181,109,.28)" color="#D8C7A8" onClick={onExit}>退出</Button>
      </LobbyShell>
    );
  }

  return (
    <LobbyShell>
      <VStack textAlign="center" gap="1">
        <Text fontSize="sm" color="#B89758" letterSpacing=".30em">ONLINE BATTLE</Text>
        <Heading color="#F3E5BF" fontWeight="500">合言葉で対戦</Heading>
        <Text color="#C8BBA3" fontSize={{ base: "md", md: "lg" }} lineHeight="1.8">2〜4人で、別の端末から同じ部屋に参加できます</Text>
      </VStack>

      {mode === "menu" && (
        <VStack w="full" gap="3">
          <Button {...goldButtonProps} w="full" size="lg" onClick={() => setMode("create")}>部屋を作る</Button>
          <Button {...goldButtonProps} w="full" size="lg" onClick={() => setMode("join")}>合言葉で参加</Button>
          <Button variant="outline" borderColor="rgba(215,181,109,.28)" color="#D8C7A8" w="full" onClick={onExit}>戻る</Button>
        </VStack>
      )}

      {mode !== "menu" && (
        <VStack w="full" gap="4" align="stretch">
          <Box>
            <Text mb="2" color="#B89758" fontSize="md" letterSpacing=".16em">PLAYER NAME</Text>
            <Input value={name} fontSize="lg" onChange={(e) => setName(e.target.value)} bg="rgba(255,255,255,.035)" borderColor="rgba(215,181,109,.34)" color="#F5EFE2" />
          </Box>
          {mode === "create" && (
            <Box>
              <Text mb="2" color="#B89758" fontSize="md" letterSpacing=".16em">PLAYER COUNT</Text>
              <HStack gap="2">
                {([2, 3, 4] as const).map((count) => (
                  <Button key={count} flex="1" size="lg" {...(maxPlayers === count ? goldButtonProps : {})} variant={maxPlayers === count ? undefined : "outline"} borderColor="rgba(215,181,109,.34)" color="#F3E3B9" onClick={() => setMaxPlayers(count)}>{count}人</Button>
                ))}
              </HStack>
            </Box>
          )}
          {mode === "create" && (
            <Box>
              <Text mb="2" color="#B89758" fontSize="md" letterSpacing=".16em">TURN ORDER</Text>
              <HStack gap="2">
                {[
                  { value: "first" as const, label: "先攻" },
                  { value: "last" as const, label: "後攻" },
                  { value: "random" as const, label: "ランダム" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    flex="1"
                    size="lg"
                    {...(turnOrderPreference === option.value ? goldButtonProps : {})}
                    variant={turnOrderPreference === option.value ? undefined : "outline"}
                    borderColor="rgba(215,181,109,.34)"
                    color="#F3E3B9"
                    onClick={() => setTurnOrderPreference(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </HStack>
              <Text mt="2" color="#8F8370" fontSize="sm" lineHeight="1.7">
                部屋を作ったプレイヤーを基準に、先攻＝最初、後攻＝最後、ランダム＝全員の順番を抽選します。
              </Text>
            </Box>
          )}
          {mode === "join" && (
            <Box>
              <Text mb="2" color="#B89758" fontSize="md" letterSpacing=".16em">ROOM CODE</Text>
              <Input value={code} maxLength={6} textTransform="uppercase" letterSpacing=".18em" fontSize="xl" onChange={(e) => setCode(normalizeRoomCode(e.target.value))} bg="rgba(255,255,255,.035)" borderColor="rgba(215,181,109,.34)" color="#F5EFE2" placeholder="ABC123" />
            </Box>
          )}
          <Button {...goldButtonProps} size="lg" disabled={busy || (mode === "join" && code.length !== 6)} onClick={async () => {
            setBusy(true); setError("");
            try {
              const next = mode === "create" ? await createOnlineRoom(name, maxPlayers, turnOrderPreference) : await joinOnlineRoom(code, name);
              setSession(next);
            } catch (e) { setError(e instanceof Error ? e.message : "オンライン対戦を開始できませんでした。"); }
            finally { setBusy(false); }
          }}>{mode === "create" ? `${maxPlayers}人部屋を作成` : "参加する"}</Button>
          {error && <Text color="#E6A3A3" fontSize="md">{error}</Text>}
          <Button variant="outline" borderColor="rgba(215,181,109,.28)" color="#D8C7A8" onClick={() => { setMode("menu"); setError(""); }}>戻る</Button>
        </VStack>
      )}
    </LobbyShell>
  );
}

function LobbyShell({ children }: { children: React.ReactNode }) {
  return (
    <Box minH="100vh" py={{ base: "10", md: "16" }} px="4" color="#F5EFE2" bg="#07080B" backgroundImage="radial-gradient(circle at 50% 18%, rgba(221,174,78,.13), transparent 25%), linear-gradient(180deg,#0B0C10,#050608)">
      <VStack maxW="620px" mx="auto" gap="6" p={{ base: "5", md: "8" }} bg="linear-gradient(180deg, rgba(22,19,14,.94), rgba(8,9,12,.94))" border="1px solid rgba(215,181,109,.45)" borderRadius="10px">{children}</VStack>
    </Box>
  );
}
