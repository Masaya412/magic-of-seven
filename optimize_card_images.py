from __future__ import annotations

from pathlib import Path
from shutil import copy2
from PIL import Image


# =========================
# 設定
# =========================

# seven-magic プロジェクト直下で実行する前提
CARDS_DIR = Path("public/cards")

# 元画像のバックアップ先
BACKUP_DIR = Path("public/cards_backup")

# カード画像の最大サイズ
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


def backup_image(
    source: Path,
    cards_dir: Path,
    backup_dir: Path,
) -> None:
    """
    元画像を同じフォルダ構成のままバックアップする。

    例:
      public/cards/revive/1.png
        ↓
      public/cards_backup/revive/1.png
    """
    relative = source.relative_to(cards_dir)
    destination = backup_dir / relative

    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    # すでにバックアップがある場合は上書きしない
    if not destination.exists():
        copy2(source, destination)


def normalize_image_mode(img: Image.Image) -> Image.Image:
    """
    PNG保存に適した画像モードへ変換する。
    """

    if img.mode in ("RGB", "RGBA", "L", "LA", "P"):
        return img

    # アルファチャンネルがある場合
    if "A" in img.getbands():
        return img.convert("RGBA")

    return img.convert("RGB")


def optimize_png(
    path: Path,
) -> tuple[
    int,
    int,
    tuple[int, int],
    tuple[int, int],
]:
    """
    PNGを縮小・最適化する。

    戻り値:
      元ファイルサイズ(byte)
      新ファイルサイズ(byte)
      元画像サイズ
      新画像サイズ
    """

    original_file_size = path.stat().st_size

    temp_path = path.with_suffix(
        ".optimized.tmp.png"
    )

    with Image.open(path) as img:
        img.load()

        original_dimensions = img.size

        img = normalize_image_mode(img)

        # 縦横比を維持したまま縮小
        img.thumbnail(
            (MAX_WIDTH, MAX_HEIGHT),
            Image.Resampling.LANCZOS,
        )

        new_dimensions = img.size

        # 一時ファイルへ保存
        img.save(
            temp_path,
            format="PNG",
            optimize=True,
            compress_level=COMPRESS_LEVEL,
        )

    # 元ファイルと置き換え
    temp_path.replace(path)

    optimized_file_size = path.stat().st_size

    return (
        original_file_size,
        optimized_file_size,
        original_dimensions,
        new_dimensions,
    )


def find_png_images(
    cards_dir: Path,
) -> list[Path]:
    """
    public/cards 以下のPNG画像をすべて取得する。
    """

    return sorted(
        path
        for path in cards_dir.rglob(f"*{TARGET_SUFFIX}")
        if path.is_file()
    )


def main() -> None:
    if not CARDS_DIR.exists():
        print(
            f"エラー: {CARDS_DIR} が見つかりません。"
        )
        print(
            "seven-magic プロジェクト直下で"
            "実行してください。"
        )
        return

    image_paths = find_png_images(CARDS_DIR)

    if not image_paths:
        print(
            "PNG画像が見つかりませんでした。"
        )
        return

    print("=" * 70)
    print("7つの魔法 カード画像最適化")
    print("=" * 70)

    print(
        f"対象フォルダ : {CARDS_DIR}"
    )
    print(
        f"バックアップ : {BACKUP_DIR}"
    )
    print(
        f"最大サイズ   : "
        f"{MAX_WIDTH} x {MAX_HEIGHT}px"
    )
    print(
        f"PNG圧縮      : "
        f"compress_level={COMPRESS_LEVEL}"
    )
    print(
        f"対象枚数     : {len(image_paths)}"
    )

    print()

    total_before = 0
    total_after = 0

    success = 0
    failed = 0

    for index, path in enumerate(
        image_paths,
        start=1,
    ):
        try:
            # 元画像をバックアップ
            backup_image(
                path,
                CARDS_DIR,
                BACKUP_DIR,
            )

            (
                before,
                after,
                before_dim,
                after_dim,
            ) = optimize_png(path)

            total_before += before
            total_after += after

            success += 1

            if before > 0:
                reduction = (
                    1 - after / before
                ) * 100
            else:
                reduction = 0

            print(
                f"[{index:02}/{len(image_paths):02}] "
                f"{path.as_posix()}"
            )

            print(
                "    "
                f"{before_dim[0]}x{before_dim[1]}"
                " → "
                f"{after_dim[0]}x{after_dim[1]}"
            )

            print(
                "    "
                f"{format_bytes(before)}"
                " → "
                f"{format_bytes(after)}"
                f" ({reduction:.1f}%削減)"
            )

        except Exception as e:
            failed += 1

            print(
                f"[{index:02}/{len(image_paths):02}] "
                f"失敗: {path}"
            )

            print(
                f"    {e}"
            )

    print()
    print("=" * 70)
    print("完了")
    print("=" * 70)

    print(
        f"成功: {success}枚"
    )

    print(
        f"失敗: {failed}枚"
    )

    print(
        "合計: "
        f"{format_bytes(total_before)}"
        " → "
        f"{format_bytes(total_after)}"
    )

    if total_before > 0:
        total_reduction = (
            1 - total_after / total_before
        ) * 100

        print(
            f"削減率: "
            f"{total_reduction:.1f}%"
        )

    print()

    print(
        "元画像は"
        " public/cards_backup/"
        " に保存されています。"
    )

    print()

    print(
        "画像を確認して問題なければ、"
        "GitHubへ反映できます。"
    )

    print()

    print("git add .")
    print(
        'git commit -m "Optimize card images"'
    )
    print(
        "git push origin main"
    )


if __name__ == "__main__":
    main()