"""Discloud-compatible launcher for the src-layout application."""

from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parent
SOURCE_DIR = PROJECT_ROOT / "src"
sys.path.insert(0, str(SOURCE_DIR))

from orla_bot.__main__ import main  # noqa: E402


if __name__ == "__main__":
    main()
