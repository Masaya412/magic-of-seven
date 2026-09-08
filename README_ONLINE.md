# 7つの魔法 オンライン対戦 v1

このパッチは、既存のCPU対戦・ローカル対戦を残したまま、2〜4人用の「合言葉オンライン対戦」を追加します。

## 追加される機能

- オンライン対戦ボタン
- 6文字の合言葉で部屋作成
- 別端末から合言葉で参加
- 待機室
- 部屋作成時に2・3・4人を選択し、設定人数がそろったらホストがゲーム開始
- ドラフト同期
- 手番同期
- ポイント置き、守護/増大/裏切り、破壊、モラトリアム、復活、真実の同期
- 相手の手札は枚数だけ公開
- 伏せ効果カードの `magic` / `number` は公開ドキュメントへ保存しない
- 真実で公開された効果カードだけ全端末へ公開
- ゲーム終了後はリザルト演出を共有

## 重要：v1の方式

この版は **ホスト権威方式** です。
部屋を作った端末が `game/engine.ts` を実行し、参加者から送られた操作を確定します。

そのため、対戦中は **部屋を作った側のブラウザを閉じないでください**。
ホストが閉じると、参加者の操作を処理する端末がなくなるためゲームが止まります。

将来 Cloud Functions / Cloud Run へ判定を移すことで、ホスト切断にも耐える構成へ発展できます。

## 1. Firebaseパッケージを追加

このZIPの `package.json` を上書きするか、既存プロジェクトで次を実行してください。

```bash
pnpm add firebase
```

## 2. Firebase Console

Firebaseプロジェクトで次を有効にします。

1. Authentication
2. Sign-in method
3. Anonymous（匿名）を有効化
4. Firestore Database を作成
5. Web App を追加

## 3. 環境変数

`.env.local.example` をコピーして `.env.local` を作成します。
Firebase Console > Project settings > Your apps の値を入れてください。

GitHub Pagesでも必要なので、GitHubリポジトリの
`Settings > Secrets and variables > Actions > Variables`
にも同じ `NEXT_PUBLIC_FIREBASE_*` を登録してください。

## 4. Firestore Security Rules

`firebase/firestore.rules` の内容をFirebase Consoleの
Firestore Database > Rules に貼り付けて Publish してください。

またはFirebase CLIを使用する場合:

```bash
firebase deploy --only firestore:rules --config firebase/firebase.json
```

## 5. page.tsx

このZIPの `app/page.tsx` はオンライン対戦ボタンを追加した版です。

## 6. ローカル確認

```bash
pnpm install
pnpm dev
```

ブラウザを2つ（通常ウィンドウ＋シークレット等）開き、
片方で「部屋を作る」、もう片方で合言葉を入力して確認できます。

## 7. GitHubへ反映

```bash
git add .
git commit -m "Add online room battle"
git push origin main
```

## GitHub Actionsで環境変数を渡す

`npm/pnpm run build` のstepに `env:` を追加してください。

```yaml
env:
  NEXT_PUBLIC_FIREBASE_API_KEY: ${{ vars.NEXT_PUBLIC_FIREBASE_API_KEY }}
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ vars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN }}
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${{ vars.NEXT_PUBLIC_FIREBASE_PROJECT_ID }}
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ vars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }}
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ vars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }}
  NEXT_PUBLIC_FIREBASE_APP_ID: ${{ vars.NEXT_PUBLIC_FIREBASE_APP_ID }}
```

`NEXT_PUBLIC_*` はブラウザから利用するFirebase Web App設定であり、サービスアカウント秘密鍵ではありません。

### 同梱の deploy.yml

`.github/workflows/deploy.yml` もオンライン対応済みです。
Firebase追加直後のlockfile差分でも止まりにくいよう、依存関係インストールを一時的に `npm install` にしています。
ローカルで `npm install` を一度実行して `package-lock.json` をcommitした後は、必要なら `npm ci` に戻せます。

## v2: Firestore nested arrays fix

Firestore does not allow arrays directly inside arrays. `GameState.draftPacks` and `GameState.draftSelections` are `Card[][]`, so v2 stores the host-only complete game state as JSON text in `system/state.gameJson`. The public result state is also stored as `resultGameStateJson` and decoded in the client. No game rules are changed.


## v3: 同時ドラフト方式

オンライン対戦のドラフトは、各ラウンドで参加者全員が同時に1枚ずつ選びます。
先に選んだプレイヤーは他プレイヤー待ちになり、全員の選択が揃った時点で既存engineのドラフト処理をまとめて確定し、束を隣へ回して次のラウンドへ進みます。

また、説明文・補助表示・ステータス文字を全体的に大きくし、スマートフォンでも読みやすいサイズへ調整しています。


## v5: 2〜4人対戦と相手操作トラッキング

- 部屋作成時に2人 / 3人 / 4人を選択できます。
- 待機室は設定人数が全員そろうまで開始できません。
- ドラフトは各ラウンドで全員同時選択です。
- 通常手番は既存のランダムなturnOrderをそのまま利用します。
- 相手の手番中は裏向きカードで「カード選択中 / 対象選択中 / 確定中」を表示します。
- トラッキング情報にはカードの種類・数字・確定前の対象を含めません。
- 同時参加時の席競合を避けるため `rooms/{code}/seats/{seat}` をトランザクションで予約します。
- v5ではFirestore Rulesの更新が必須です。`firebase/firestore.rules` をFirebase Consoleへ再公開してください。
