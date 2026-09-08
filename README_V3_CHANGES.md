# Online Battle v3 changes

## 1. ドラフトをラウンドごとの同時選択に変更

- 各プレイヤーは同じドラフトラウンドで同時に1枚選べます。
- 先に選んだプレイヤーは「相手の選択待ち」になります。
- 2人とも選択するまでは `GameState` のドラフトラウンドを進めません。
- 2人分が揃った時点で既存 `draftPick()` を正規順でまとめて実行し、束を交換して次ラウンドへ進みます。
- 相手が選んだカードの内容は公開しません。

## 2. 文字サイズを読みやすく調整

- アプリ全体の本文基準を17pxへ。
- 説明文・補助表示・ステータス表示を一段階大きくしました。
- モバイルのフォーム文字を16px以上にしています。

## 主な変更ファイル

- `online/types.ts`
- `online/room.ts`
- `components/online/OnlineGameScreen.tsx`
- `components/online/OnlineBattle.tsx`
- `app/globals.css`
- `app/page.tsx`
- `app/game/GameScreen.tsx`
- `components/FieldStackView.tsx`
- `components/ResultRevealScreen.tsx`
