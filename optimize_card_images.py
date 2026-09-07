from __future__ import annotations

from pathlib import Path
from shutil import copy2
from PIL import Image

# =========================
# 設定
# =========================

# このスクリプトを seven-magic プロジェクト直下で実行する前提
CARDS_DIR = Path("public/cards")

# 元画像のバックアップ先
BACKUP_DIR = Path("public/cards_backup")

# カード画像の最大サイズ
# 縦長カードを想定し、長辺を最大 900px に制限
MAX_WIDTH = 600
MAX_HEIGHT = 900

# PNG圧縮レベル: 0〜9
# 9が最も圧縮率が高い
COMPRESS_LEVEL = 9

# 対象拡張子
TARGET_SUFFIX = ".png"


def format_bytes(size: int) -> str:
    """ファイルサイズを見やすく表示する。"""
    units = ["B", "KB", "MB", "GB"]
    value = float(size)

    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.2f} {unit}"
        value /= 1024

    return f"{size} B"


def backup_image(source: Path, cards_dir: Path, backup_dir: Path) -> None:
    """元画像を同じフォルダ構成のままバックアップする。"""
    relative = source.relative_to(cards_dir)
    destination = backup_dir / relative

    destination.parent.mkdir(parents=True, exist_ok=True)

    # すでにバックアップがある場合は上書きしない
    if not destination.exists():
        copy2(source, destination)


def optimize_png(path: Path) -> tuple[int, int, tuple[int, int], tuple[int, int]]:
    """
    PNGを縮小・最適化する。
    戻り値:
      元サイズ(byte)
      新サイズ(byte)
      元画像サイズ
      新画像サイズ
    """
    original_file_size = path.stat().st_size

    with Image.open(path) as img:
        original_dimensions = img.size

        # EXIFの向きがある場合に備えて通常方向へ変換
        img.load()

        # カラーモードを保持しつつ、不要なモードを整理
        if img.mode not in ("RGB", "RGBA", "L", "LA", "P"):
            if "A" in img.getbands():
                img = img.convert("RGBA")
            else:
                img = img.convert("RGB")

        # アスペクト比を保ったまま縮小
        img.thumbnail(
            (MAX_WIDTH, MAX_HEIGHT),
            Image.Resampling.LANCZOS,
        )

        new_dimensions = img.size

        # 一時ファイルへ保存してから置換
        temp_path = path.with_suffix(".optimized.tmp.png")

        img.save(
            temp_path,
            format="PNG",
            optimize=True,
            compress_level=COMPRESS_LEVEL,
        )

    temp_path.replace(path)

    optimized_file_size = path.stat().st_size

    return (
        original_file_size,
        optimized_file_size,
        original_dimensions,
        new_dimensions,
    )


def main() -> None:
    if not CARDS_DIR.exists():
        print(f"エラー: {CARDS_DIR} が見つかりません。")
        print("seven-magic プロジェクト直下で実行してください。")
        return

    image_paths = sorted(
        p
        for p in CARDS_DIR.rglob(f"*{TARGET_SUFFIX}")
        if p.is_file()
    )

    if not image_paths:
        print("PNG画像が見つかりませんでした。")
        return

    print("=" * 70)
    print("7つの魔法 カード画像最適化")
    print("=" * 70)
    print(f"対象フォルダ : {CARDS_DIR}")
    print(f"バックアップ : {BACKUP_DIR}")
    print(f"最大サイズ   : {MAX_WIDTH} x {MAX_HEIGHT}px")
    print(f"対象枚数     : {len(image_paths)}")
    print()

    total_before = 0
    total_after = 0
    success = 0
    failed = 0

    for index, path in enumerate(image_paths, start=1):
        try:
            backup_image(path, CARDS_DIR, BACKUP_DIR)

            before, after, before_dim, after_dim = optimize_png(path)

            total_before += before
            total_after += after
            success += 1

            reduction = (
                (1 - after / before) * 100
                if before > 0
                else 0
            )

            print(
                f"[{index:02}/{len(image_paths):02}] "
                f"{path.as_posix()}"
            )
            print(
                f"    {before_dim[0]}x{before_dim[1]} "
                f"→ {after_dim[0]}x{after_dim[1]}"
            )
            print(
                f"    {format_bytes(before)} "
                f"→ {format_bytes(after)} "
                f"({reduction:.1f}%削減)"
            )

        except Exception as e:
            failed += 1
            print(
                f"[{index:02}/{len(image_paths):02}] "
                f"失敗: {path}"
            )
            print(f"    {e}")

    print()
    print("=" * 70)
    print("完了")
    print("=" * 70)
    print(f"成功: {success}枚")
    print(f"失敗: {failed}枚")
    print(
        f"合計: {format_bytes(total_before)} "
        f"→ {format_bytes(total_after)}"
    )

    if total_before > 0:
        total_reduction = (
            1 - total_after / total_before
        ) * 100
        print(f"削減率: {total_reduction:.1f}%")

    print()
    print("元画像は public/cards_backup/ に保存されています。")
    print()
    print("確認後、問題なければ以下でGitHubへ反映できます:")
    print("  git add .")
    print('  git commit -m "Optimize card images"')
    print("  git push origin main")


if __name__ == "__main__":
    main()
