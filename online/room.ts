import { signInAnonymously } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Transaction,
  type Unsubscribe,
} from "firebase/firestore";
import {
  draftPick,
  placeAsPoint,
  stackEffect,
  startGame,
  useDestroy,
  useMoratorium,
  useRevive,
  useTruth,
} from "@/game/engine";
import type { Card, GameState, TurnOrderPreference } from "@/game/types";
import { auth, db } from "./firebase";
import type {
  HostGameState,
  OnlineAction,
  OnlineActionPreview,
  OnlineActionPreviewPhase,
  OnlineActionPayload,
  OnlineActionType,
  OnlineRoom,
  OnlineRoomPlayer,
  OnlineSession,
  PrivateGameSnapshot,
  PublicGameSnapshot,
} from "./types";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type StoredHostGameState = {
  revision: number;
  gameJson: string;
  playerUids: Record<string, string>;
  pendingDraftPicks?: Record<string, string>;
  privateDrawNotices?: Record<string, Card | null>;
};

type StoredPublicGameSnapshot = Omit<PublicGameSnapshot, "resultGameState"> & {
  resultGameStateJson: string | null;
};

function encodeHostGameState(state: HostGameState): StoredHostGameState {
  return {
    revision: state.revision,
    gameJson: JSON.stringify(state.game),
    playerUids: state.playerUids,
    pendingDraftPicks: state.pendingDraftPicks,
    privateDrawNotices: state.privateDrawNotices,
  };
}

function decodeHostGameState(value: StoredHostGameState): HostGameState {
  return {
    revision: value.revision,
    game: JSON.parse(value.gameJson) as GameState,
    playerUids: value.playerUids,
    pendingDraftPicks: value.pendingDraftPicks ?? {},
    privateDrawNotices: value.privateDrawNotices ?? {},
  };
}

function requireFirebase() {
  if (!auth || !db) {
    throw new Error("Firebaseの設定がありません。.env.local を確認してください。");
  }
  return { auth, db };
}

export async function ensureAnonymousUser(): Promise<string> {
  const { auth } = requireFirebase();
  if (auth.currentUser) return auth.currentUser.uid;
  const result = await signInAnonymously(auth);
  return result.user.uid;
}

function normalizeName(name: string) {
  return name.trim().slice(0, 20) || "プレイヤー";
}

export function normalizeRoomCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
}

function randomRoomCode() {
  return Array.from({ length: 6 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

async function createUniqueRoomCode() {
  const { db } = requireFirebase();
  for (let i = 0; i < 12; i++) {
    const code = randomRoomCode();
    const snap = await getDoc(doc(db, "rooms", code));
    if (!snap.exists()) return code;
  }
  throw new Error("合言葉を生成できませんでした。もう一度お試しください。");
}

export async function createOnlineRoom(
  name: string,
  maxPlayers: 2 | 3 | 4 = 2,
  turnOrderPreference: TurnOrderPreference = "random"
): Promise<OnlineSession> {
  const { db } = requireFirebase();
  const uid = await ensureAnonymousUser();
  const code = await createUniqueRoomCode();
  const roomRef = doc(db, "rooms", code);
  const playerId = "p1";

  await runTransaction(db, async (tx) => {
    tx.set(roomRef, {
      code,
      hostUid: uid,
      status: "waiting",
      maxPlayers,
      turnOrderPreference,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } satisfies OnlineRoom);

    tx.set(doc(db, "rooms", code, "players", uid), {
      uid,
      playerId,
      name: normalizeName(name),
      seat: 0,
      joinedAt: serverTimestamp(),
    } satisfies OnlineRoomPlayer);

    tx.set(doc(db, "rooms", code, "seats", "0"), { uid });
  });

  return { roomCode: code, uid, playerId, isHost: true };
}

export async function joinOnlineRoom(
  rawCode: string,
  name: string
): Promise<OnlineSession> {
  const { db } = requireFirebase();
  const uid = await ensureAnonymousUser();
  const code = normalizeRoomCode(rawCode);
  if (code.length !== 6) throw new Error("6文字の合言葉を入力してください。");

  const roomRef = doc(db, "rooms", code);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error("その合言葉の部屋は見つかりません。");

  const room = roomSnap.data() as OnlineRoom;
  if (room.status !== "waiting") throw new Error("この部屋はすでに対戦中です。");

  const playerRef = doc(db, "rooms", code, "players", uid);
  const seat = await runTransaction(db, async (tx) => {
    const [freshRoomSnap, existingPlayerSnap] = await Promise.all([
      tx.get(roomRef),
      tx.get(playerRef),
    ]);
    if (!freshRoomSnap.exists()) throw new Error("部屋が見つかりません。");
    const freshRoom = freshRoomSnap.data() as OnlineRoom;
    if (freshRoom.status !== "waiting") throw new Error("この部屋はすでに対戦中です。");

    if (existingPlayerSnap.exists()) {
      return (existingPlayerSnap.data() as OnlineRoomPlayer).seat;
    }

    const candidateRefs = Array.from({ length: freshRoom.maxPlayers - 1 }, (_, i) =>
      doc(db, "rooms", code, "seats", String(i + 1))
    );
    const candidateSnaps = await Promise.all(candidateRefs.map((ref) => tx.get(ref)));
    const freeIndex = candidateSnaps.findIndex((snap) => !snap.exists());
    if (freeIndex < 0) throw new Error("この部屋は満員です。");

    const nextSeat = freeIndex + 1;
    const playerId = `p${nextSeat + 1}`;
    tx.set(candidateRefs[freeIndex], { uid });
    tx.set(playerRef, {
      uid,
      playerId,
      name: normalizeName(name),
      seat: nextSeat,
      joinedAt: serverTimestamp(),
    } satisfies OnlineRoomPlayer);
    return nextSeat;
  });

  const playerId = `p${seat + 1}`;

  return { roomCode: code, uid, playerId, isHost: false };
}

export function subscribeRoom(
  roomCode: string,
  callback: (room: OnlineRoom | null) => void
): Unsubscribe {
  const { db } = requireFirebase();
  return onSnapshot(doc(db, "rooms", roomCode), (snap) => {
    callback(snap.exists() ? (snap.data() as OnlineRoom) : null);
  });
}

export function subscribeRoomPlayers(
  roomCode: string,
  callback: (players: OnlineRoomPlayer[]) => void
): Unsubscribe {
  const { db } = requireFirebase();
  return onSnapshot(collection(db, "rooms", roomCode, "players"), (snap) => {
    const players = snap.docs
      .map((d) => d.data() as OnlineRoomPlayer)
      .sort((a, b) => a.seat - b.seat);
    callback(players);
  });
}

export function subscribePublicGame(
  roomCode: string,
  callback: (snapshot: PublicGameSnapshot | null) => void
): Unsubscribe {
  const { db } = requireFirebase();
  return onSnapshot(doc(db, "rooms", roomCode, "system", "public"), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const stored = snap.data() as StoredPublicGameSnapshot;
    const { resultGameStateJson, ...publicData } = stored;
    callback({
      ...publicData,
      resultGameState: resultGameStateJson
        ? (JSON.parse(resultGameStateJson) as GameState)
        : null,
    });
  });
}

export function subscribePrivateGame(
  session: OnlineSession,
  callback: (snapshot: PrivateGameSnapshot | null) => void
): Unsubscribe {
  const { db } = requireFirebase();
  return onSnapshot(doc(db, "rooms", session.roomCode, "private", session.uid), (snap) => {
    callback(snap.exists() ? (snap.data() as PrivateGameSnapshot) : null);
  });
}

export async function startOnlineGame(roomCode: string) {
  const { db } = requireFirebase();
  const uid = await ensureAnonymousUser();
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error("部屋が見つかりません。");
  const room = roomSnap.data() as OnlineRoom;
  if (room.hostUid !== uid) throw new Error("ゲーム開始は部屋を作った人だけが行えます。");

  const playersSnap = await getDocs(collection(db, "rooms", roomCode, "players"));
  const players = playersSnap.docs
    .map((d) => d.data() as OnlineRoomPlayer)
    .sort((a, b) => a.seat - b.seat);
  if (players.length !== room.maxPlayers) {
    throw new Error(`${room.maxPlayers}人そろってから開始してください。`);
  }
  const seats = players.map((p) => p.seat);
  if (new Set(seats).size !== players.length || seats.some((seat, index) => seat !== index)) {
    throw new Error("参加者の席情報が競合しています。全員いったん退出して部屋を作り直してください。");
  }

  const game = startGame(
    players.map((p) => ({ name: p.name, kind: "human" as const })),
    room.turnOrderPreference ?? "random"
  );
  const playerUids: Record<string, string> = {};
  players.forEach((p, index) => {
    playerUids[`p${index + 1}`] = p.uid;
  });
  const hostState: HostGameState = { revision: 0, game, playerUids, pendingDraftPicks: {}, privateDrawNotices: {} };

  await runTransaction(db, async (tx) => {
    tx.set(doc(db, "rooms", roomCode, "system", "state"), encodeHostGameState(hostState));
    writeViews(tx, roomCode, hostState, null);
    tx.update(roomRef, { status: "playing", updatedAt: serverTimestamp() });
  });
}

export async function submitOnlineAction(
  session: OnlineSession,
  type: OnlineActionType,
  payload: OnlineActionPayload
) {
  const { db } = requireFirebase();
  await addDoc(collection(db, "rooms", session.roomCode, "actions"), {
    actorUid: session.uid,
    type,
    payload,
    processed: false,
    createdAt: serverTimestamp(),
  } satisfies OnlineAction);
}

export async function setOnlineActionPreview(
  session: OnlineSession,
  phase: OnlineActionPreviewPhase
) {
  const { db } = requireFirebase();
  const ref = doc(db, "rooms", session.roomCode, "previews", session.uid);
  if (phase === "idle") {
    await deleteDoc(ref).catch(() => undefined);
    return;
  }
  await setDoc(ref, {
    actorUid: session.uid,
    playerId: session.playerId,
    phase,
    updatedAt: serverTimestamp(),
  } satisfies OnlineActionPreview);
}

export function subscribeActionPreviews(
  roomCode: string,
  callback: (previews: OnlineActionPreview[]) => void
): Unsubscribe {
  const { db } = requireFirebase();
  return onSnapshot(collection(db, "rooms", roomCode, "previews"), (snap) => {
    callback(snap.docs.map((d) => d.data() as OnlineActionPreview));
  });
}

export function startHostActionProcessor(roomCode: string): Unsubscribe {
  const { db } = requireFirebase();
  let chain = Promise.resolve();

  return onSnapshot(collection(db, "rooms", roomCode, "actions"), (snap) => {
    const pending = snap.docs
      .filter((d) => !(d.data() as OnlineAction).processed)
      .sort((a, b) => {
        const at = (a.data().createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        const bt = (b.data().createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        return at - bt;
      });

    for (const actionDoc of pending) {
      chain = chain
        .then(() => processAction(roomCode, actionDoc.id))
        .catch((error) => console.error("online action error", error));
    }
  });
}

async function processAction(roomCode: string, actionId: string) {
  const { db } = requireFirebase();
  const actionRef = doc(db, "rooms", roomCode, "actions", actionId);
  const stateRef = doc(db, "rooms", roomCode, "system", "state");
  const roomRef = doc(db, "rooms", roomCode);

  await runTransaction(db, async (tx) => {
    const [actionSnap, stateSnap] = await Promise.all([
      tx.get(actionRef),
      tx.get(stateRef),
    ]);
    if (!actionSnap.exists() || !stateSnap.exists()) return;
    const action = actionSnap.data() as OnlineAction;
    if (action.processed) return;

    const hostState = decodeHostGameState(stateSnap.data() as StoredHostGameState);
    const actorPlayerId = Object.entries(hostState.playerUids).find(
      ([, actorUid]) => actorUid === action.actorUid
    )?.[0];
    if (!actorPlayerId) {
      tx.update(actionRef, { processed: true, error: "not-a-player" });
      return;
    }

    let nextHostState: HostGameState;
    try {
      if (action.type === "draftPick") {
        nextHostState = applySimultaneousDraftPick(
          hostState,
          actorPlayerId,
          action.payload.cardId
        );
      } else {
        const nextGame = applyValidatedAction(
          hostState.game,
          actorPlayerId,
          action.type,
          action.payload
        );

        const privateDrawNotices: Record<string, Card | null> = {};
        // 復活で墓場から戻したモラトリアムを後で使用した場合も、
        // engine側のlastDrawnCardを本人のprivate viewだけへ通知する。
        if (action.type === "moratorium" && nextGame.lastDrawnCard) {
          privateDrawNotices[actorPlayerId] = nextGame.lastDrawnCard;
        }

        nextHostState = {
          ...hostState,
          revision: hostState.revision + 1,
          game: nextGame,
          privateDrawNotices,
        };
      }
    } catch (error) {
      tx.update(actionRef, {
        processed: true,
        error: error instanceof Error ? error.message : "invalid-action",
      });
      return;
    }

    const next = nextHostState.game;
    tx.set(stateRef, encodeHostGameState(nextHostState));
    writeViews(tx, roomCode, nextHostState, action.type);
    tx.update(actionRef, { processed: true, processedAt: serverTimestamp() });

    if (next.phase === "result") {
      tx.update(roomRef, { status: "finished", updatedAt: serverTimestamp() });
    } else {
      tx.update(roomRef, { updatedAt: serverTimestamp() });
    }
  });
}


function applySimultaneousDraftPick(
  state: HostGameState,
  playerId: string,
  cardId: string
): HostGameState {
  const game = state.game;
  if (game.phase !== "draft") throw new Error("ドラフト中ではありません。");
  if (state.pendingDraftPicks[playerId]) {
    throw new Error("このラウンドではすでにカードを選択しています。");
  }

  const playerIndex = game.players.findIndex((player) => player.id === playerId);
  if (playerIndex < 0) throw new Error("プレイヤーが見つかりません。");

  const pack = game.draftPacks[playerIndex] ?? [];
  if (!pack.some((card) => card.id === cardId)) {
    throw new Error("そのカードは選べません。");
  }

  const pendingDraftPicks = {
    ...state.pendingDraftPicks,
    [playerId]: cardId,
  };

  // 全員が選ぶまではGameStateを進めない。
  // これにより各プレイヤーは同じドラフトラウンドで同時に選択できる。
  const everyoneSelected = game.players.every(
    (player) => Boolean(pendingDraftPicks[player.id])
  );

  if (!everyoneSelected) {
    return {
      ...state,
      revision: state.revision + 1,
      pendingDraftPicks,
      privateDrawNotices: {},
    };
  }

  // 全員が選択した時点で、既存engineの正規ドラフト順にまとめて確定する。
  // 1ラウンド分が完了した後にだけ束が交換され、次ラウンドへ進む。
  let nextGame = game;
  const remaining = { ...pendingDraftPicks };

  while (nextGame.phase === "draft") {
    const draftPlayer = nextGame.players[nextGame.draftPlayerIndex];
    if (!draftPlayer) break;
    const selectedCardId = remaining[draftPlayer.id];
    if (!selectedCardId) break;

    nextGame = draftPick(nextGame, selectedCardId);
    delete remaining[draftPlayer.id];

    if (Object.keys(remaining).length === 0) break;
  }

  return {
    ...state,
    revision: state.revision + 1,
    game: nextGame,
    pendingDraftPicks: {},
    privateDrawNotices: {},
  };
}

function currentPlayerId(game: GameState) {
  return game.turnOrder[game.currentTurn] ?? null;
}

function cardInHand(game: GameState, playerId: string, cardId: string): Card {
  const player = game.players.find((p) => p.id === playerId);
  const card = player?.hand.find((c) => c.id === cardId);
  if (!card) throw new Error("そのカードは手札にありません。");
  return card;
}

function ensureTurn(game: GameState, playerId: string) {
  if (game.phase !== "playing" || currentPlayerId(game) !== playerId) {
    throw new Error("あなたの手番ではありません。");
  }
}

function applyValidatedAction(
  game: GameState,
  playerId: string,
  type: OnlineActionType,
  payload: OnlineActionPayload
): GameState {
  ensureTurn(game, playerId);
  const card = cardInHand(game, playerId, payload.cardId);

  if (type === "placePoint") {
    return placeAsPoint(game, playerId, card.id);
  }
  if (type === "stackEffect") {
    if (!["guard", "double", "betray"].includes(card.magic)) throw new Error("重ねて使えないカードです。");
    if (!payload.targetStackId) throw new Error("対象がありません。");
    const next = stackEffect(game, playerId, card.id, payload.targetStackId);
    const target = next.players.flatMap((p) => p.field).find((s) => s.id === payload.targetStackId);
    const added = target?.effects.find((effect) => effect.card.id === card.id);
    if (added) {
      (added as typeof added & { placedByPlayerId?: string }).placedByPlayerId = playerId;
    }
    return next;
  }
  if (type === "destroy") {
    if (card.magic !== "destroy") throw new Error("破壊の魔法ではありません。");
    if (!payload.targetStackId) throw new Error("対象がありません。");
    return useDestroy(game, playerId, card.id, payload.targetStackId);
  }
  if (type === "moratorium") {
    if (card.magic !== "moratorium") throw new Error("モラトリアムの魔法ではありません。");
    return useMoratorium(game, playerId, card.id);
  }
  if (type === "revive") {
    if (card.magic !== "revive") throw new Error("復活の魔法ではありません。");
    if (!payload.targetCardId) throw new Error("墓場の対象がありません。");
    const target = game.graveyard.find((c) => c.id === payload.targetCardId);
    if (!target || target.number !== card.number) throw new Error("復活できないカードです。");
    return useRevive(game, playerId, card.id, target.id);
  }
  if (type === "truth") {
    if (card.magic !== "truth") throw new Error("真実の魔法ではありません。");
    if (!payload.targetStackId) throw new Error("対象がありません。");
    return useTruth(game, playerId, card.id, payload.targetStackId);
  }

  throw new Error("未対応の操作です。");
}

function createPublicSnapshot(
  state: HostGameState,
  actionType: OnlineActionType | null
): StoredPublicGameSnapshot {
  const { game, revision } = state;
  let lastAction = game.lastAction;
  let lastActionCard = game.lastActionCard;
  let lastActionCardHidden = game.lastActionCardHidden;

  // オンラインでは人間同士でも、伏せて重ねたカードの種類を公開しない。
  if (actionType === "stackEffect" && game.lastActionActorId) {
    const actor = game.players.find((p) => p.id === game.lastActionActorId);
    lastAction = `${actor?.name ?? "プレイヤー"}は場のカードにカードを1枚伏せて重ねました。`;
    lastActionCard = null;
    lastActionCardHidden = true;
  }

  return {
    revision,
    phase: game.phase,
    players: game.players.map((player) => ({
      id: player.id,
      name: player.name,
      handCount: player.hand.length,
      field: player.field.map((stack) => ({
        id: stack.id,
        ownerId: stack.ownerId,
        baseCard: stack.baseCard,
        effects: stack.effects.map((effect) => ({
          id: effect.card.id,
          card: effect.isFaceUp ? effect.card : null,
          isFaceUp: effect.isFaceUp,
        })),
      })),
    })),
    deckCount: game.deck.length,
    graveyard: game.graveyard,
    turnOrder: game.turnOrder,
    currentTurn: game.currentTurn,
    draftRound: game.draftRound,
    draftPlayerIndex: game.draftPlayerIndex,
    draftCurrentPlayerId: game.players[game.draftPlayerIndex]?.id ?? null,
    draftSelectedCount: Object.keys(state.pendingDraftPicks).length,
    winnerIds: game.winnerIds,
    lastAction,
    lastActionActorId: game.lastActionActorId,
    lastActionCard,
    lastActionCardHidden,
    resultGameStateJson: game.phase === "result" ? JSON.stringify(game) : null,
  };
}

function createPrivateSnapshot(
  state: HostGameState,
  playerId: string
): PrivateGameSnapshot {
  const index = state.game.players.findIndex((p) => p.id === playerId);
  const player = state.game.players[index];
  return {
    revision: state.revision,
    playerId,
    hand: player?.hand ?? [],
    draftPack: state.game.draftPacks[index] ?? [],
    draftSelectionsCount: state.game.draftSelections[index]?.length ?? 0,
    draftSubmitted: Boolean(state.pendingDraftPicks[playerId]),
    drawnCardNotice: state.privateDrawNotices[playerId] ?? null,
  };
}

function writeViews(
  tx: Transaction,
  roomCode: string,
  state: HostGameState,
  actionType: OnlineActionType | null
) {
  const { db } = requireFirebase();
  tx.set(doc(db, "rooms", roomCode, "system", "public"), createPublicSnapshot(state, actionType));
  for (const [playerId, uid] of Object.entries(state.playerUids)) {
    tx.set(
      doc(db, "rooms", roomCode, "private", uid),
      createPrivateSnapshot(state, playerId)
    );
  }
}
