from typing import Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from fetch_emails import Attachment


def process_email(
    uid: str,
    subject: str,
    from_: str,
    date_: str,
    body: str,
    download_attachments: Callable[[], list["Attachment"]],
):
    attachments = download_attachments()
    attachment_names = [a.filename for a in attachments]

    print(f"UID:     {uid}")
    print(f"Date:    {date_}")
    print(f"From:    {from_}")
    print(f"Subject: {subject}")
    print(f"Body:    {body[:100]}")
    if attachment_names:
        print(f"Files:   {', '.join(attachment_names)}")
    print("-" * 60)
