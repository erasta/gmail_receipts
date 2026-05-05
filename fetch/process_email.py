from typing import Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from fetch_emails import Attachment


def process_email(
    subject: str,
    from_: str,
    date_: str,
    body: str,
    download_attachments: Callable[[], list["Attachment"]],
):
    print(f"Date:    {date_}")
    print(f"From:    {from_}")
    print(f"Subject: {subject}")
    print("-" * 60)
