import argparse
import email
import email.message
import email.utils
import json
import sys
from pathlib import Path

from tqdm import tqdm
from weasyprint import HTML

from utils import sanitize_filename, setup_logging

logger = setup_logging("extract")

RELEVANT_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract receipts from classified emails")
    parser.add_argument("--input-dir", default="raw_emails/", help="Directory with .eml files")
    parser.add_argument("--output-dir", default="output/", help="Directory to save extracted receipts")
    parser.add_argument("--results-file", default="classification_results.json", help="Classification results JSONL")
    return parser.parse_args()


def get_date_prefix(msg: email.message.Message) -> str:
    date_str = msg.get("Date", "")
    try:
        parsed = email.utils.parsedate_to_datetime(date_str)
        return parsed.strftime("%Y-%m-%d")
    except Exception:
        return "unknown-date"


def get_html_body(msg: email.message.Message) -> str | None:
    for part in msg.walk():
        if part.get_content_type() == "text/html":
            try:
                payload = part.get_payload(decode=True)
                if isinstance(payload, bytes):
                    return payload.decode(errors="replace")
            except Exception:
                continue
    return None


def extract_receipt(eml_path: Path, output_dir: Path) -> None:
    msg = email.message_from_bytes(eml_path.read_bytes())
    date_prefix = get_date_prefix(msg)
    subject = sanitize_filename(msg.get("Subject", "no-subject"))
    base_name = f"{date_prefix}_{subject}"

    relevant_parts = []
    for part in msg.walk():
        fn = part.get_filename()
        if not fn:
            continue
        ext = Path(fn).suffix.lower()
        if ext in RELEVANT_EXTENSIONS:
            relevant_parts.append((part, fn, ext))

    if relevant_parts:
        for idx, (part, fn, ext) in enumerate(relevant_parts):
            out_name = f"{base_name}_{idx}{ext}"
            out_path = output_dir / out_name
            if out_path.exists():
                continue
            data = part.get_payload(decode=True)
            if not isinstance(data, bytes):
                continue
            out_path.write_bytes(data)
            logger.info("Saved attachment: %s", out_name)
    else:
        out_path = output_dir / f"{base_name}_0.pdf"
        if out_path.exists():
            return
        html = get_html_body(msg)
        if html:
            HTML(string=html).write_pdf(str(out_path))
            logger.info("Converted HTML to PDF: %s", out_path.name)
        else:
            logger.warning("No relevant attachments or HTML body in %s", eml_path.name)


def main() -> None:
    args = parse_args()
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    results_path = Path(args.results_file)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not results_path.exists():
        logger.error("Results file not found: %s", results_path)
        sys.exit(1)

    receipt_files: list[str] = []
    for line in results_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        if record.get("is_receipt"):
            receipt_files.append(record["filename"])

    logger.info("Found %d receipts to extract", len(receipt_files))

    for filename in tqdm(receipt_files, desc="Extracting"):
        eml_path = input_dir / filename
        if not eml_path.exists():
            logger.warning("Missing .eml file: %s", filename)
            continue
        try:
            extract_receipt(eml_path, output_dir)
        except Exception:
            logger.exception("Error extracting %s", filename)

    logger.info("Done.")


if __name__ == "__main__":
    main()
