# カード画像の配置

アプリでは以下の固定パスを使用します。

```text
public/
└─ cards/
   ├─ destroy/      1.png ～ 7.png
   ├─ guard/        1.png ～ 7.png
   ├─ double/       1.png ～ 7.png
   ├─ betray/       1.png ～ 7.png
   ├─ moratorium/   1.png ～ 7.png
   ├─ revive/       1.png ～ 7.png
   └─ truth/        1.png ～ 7.png
```

対応:
- destroy = 破壊の魔法
- guard = 守護の魔法
- double = 増大の魔法
- betray = 裏切りの魔法
- moratorium = モラトリアムの魔法
- revive = 復活の魔法
- truth = 真実の魔法

画像を差し替える場合も、同じフォルダ名と `1.png` ～ `7.png` を維持すれば
プログラムの変更は不要です。


## Chakra UI
`MagicCard.tsx` は `Box as="img"` ではなく `Image` を使用しています。Chakra UI v3 の型エラーを回避するためです。
