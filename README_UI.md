# 7つの魔法 ダークファンタジーUI修正版

カード画像の「黒・金・魔法陣・重厚な装飾」の雰囲気に合わせて、UIを黒大理石風＋金装飾に変更した差し替え用ファイルです。

## 変更対象

- `app/page.tsx`
- `app/game/GameScreen.tsx`
- `app/layout.tsx`
- `app/globals.css`（新規）
- `components/MagicCard.tsx`
- `components/FieldStackView.tsx`

## 主な変更

- セットアップ画面を黒＋金の魔導書・祭壇風UIへ変更
- ドラフト画面を同じ世界観へ統一
- ゲーム盤面を黒大理石風背景＋金枠パネルへ変更
- タイトル、プレイヤー、DECK/GRAVE表示を重厚な見た目へ変更
- 選択カードを金色に発光させて浮き上がる表示へ変更
- CPU ACTIONを黒背景＋金枠のオーバーレイへ変更
- 結果画面をVICTORY/RESULT表示付きの金装飾UIへ変更
- CPUの🤖絵文字を世界観に合わせて `◇ CPU` 表示へ変更
- `MagicCard.tsx` のカード裏面パスを `NEXT_PUBLIC_BASE_PATH` に統一
- `loading="lazy"` / `decoding="async"` を追加

## 適用方法

ZIPを解凍して、プロジェクト直下へ同じフォルダ構成のまま上書きしてください。

その後、ローカルで確認します。

```bash
npm run dev
```

問題なければGitHubへ反映します。

```bash
git add .
git commit -m "Update fantasy game UI"
git push origin main
```

## 注意

ゲームロジック、CPUロジック、得点計算、カード画像そのものは変更していません。
