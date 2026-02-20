import argparse
import email
import email.message
import email.utils
import hashlib
import imaplib
import json
import os
from datetime import datetime
from pathlib import Path

from tqdm import tqdm

from utils import setup_logging

logger = setup_logging("download")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download emails from Gmail via IMAP")
    parser.add_argument("--since", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--before", required=True, help="End date (YYYY-MM-DD)")
    parser.add_argument("--output-dir", default="raw_emails/", help="Directory to save .eml files")
    return parser.parse_args()


def msg_id_hash(msg_id: str) -> str:
    return hashlib.sha256(msg_id.encode()).hexdigest()[:12]


def date_to_imap(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return dt.strftime("%d-%b-%Y")


def get_attachment_names(msg: email.message.Message) -> list[str]:
    names = []
    for part in msg.walk():
        fn = part.get_filename()
        if fn:
            names.append(fn)
    return names


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    email_address = os.environ["EMAIL_ADDRESS"]
    app_password = os.environ["APP_PASSWORD"]

    existing_files = {f.stem for f in output_dir.glob("*.eml")}

    logger.info("Connecting to IMAP...")
    imap = imaplib.IMAP4_SSL("imap.gmail.com", 993)
    imap.login(email_address, app_password)
    imap.select('"[Gmail]/All Mail"')

    criteria = f'(SINCE {date_to_imap(args.since)} BEFORE {date_to_imap(args.before)})'
    logger.info("Searching with criteria: %s", criteria)
    _, data = imap.search(None, criteria)
    msg_nums = data[0].split()
    logger.info("Found %d messages", len(msg_nums))

    metadata_path = output_dir / "metadata.jsonl"
    metadata_file = open(metadata_path, "a", encoding="utf-8")

    saved = 0
    skipped = 0
    for num in tqdm(msg_nums, desc="Downloading"):
        try:
            _, msg_data = imap.fetch(num, "(RFC822)")
            raw: bytes = msg_data[0][1]  # type: ignore[index]
            msg = email.message_from_bytes(raw)

            message_id = msg.get("Message-ID", "")
            if not message_id:
                message_id = f"no-id-{num.decode()}"
            mid_hash = msg_id_hash(message_id)

            date_str = msg.get("Date", "")
            try:
                parsed_date = email.utils.parsedate_to_datetime(date_str)
                date_prefix = parsed_date.strftime("%Y-%m-%d")
            except Exception:
                date_prefix = "unknown-date"

            filename = f"{date_prefix}_{mid_hash}"

            if filename in existing_files:
                skipped += 1
                continue

            eml_path = output_dir / f"{filename}.eml"
            eml_path.write_bytes(raw)
            existing_files.add(filename)

            attachment_names = get_attachment_names(msg)
            meta = {
                "filename": f"{filename}.eml",
                "subject": msg.get("Subject", ""),
                "from": msg.get("From", ""),
                "date": date_str,
                "attachment_names": attachment_names,
            }
            metadata_file.write(json.dumps(meta, ensure_ascii=False) + "\n")
            metadata_file.flush()
            saved += 1
        except Exception:
            logger.exception("Error processing message %s", num)

    metadata_file.close()
    imap.logout()
    logger.info("Done. Saved: %d, Skipped: %d", saved, skipped)


if __name__ == "__main__":
    main()
