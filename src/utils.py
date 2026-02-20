import argparse
import logging
import sys
from pathlib import Path


def setup_logging(name: str, log_file: str | None = None) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    stderr_handler = logging.StreamHandler(sys.stderr)
    stderr_handler.setLevel(logging.INFO)
    stderr_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(stderr_handler)

    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        logger.addHandler(file_handler)

    return logger


def sanitize_filename(s: str, max_len: int = 80) -> str:
    safe = []
    for c in s:
        if c.isalnum() or c in ("-", "_", "."):
            safe.append(c)
        elif c in (" ", "/", "\\"):
            safe.append("_")
    return "".join(safe)[:max_len]
