"""Create fake .eml files for testing classify.py and extract.py."""
import email.mime.multipart
import email.mime.text
import email.mime.base
import email.utils
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path("test_raw_emails")
OUTPUT_DIR.mkdir(exist_ok=True)

emails = [
    {
        "from": "noreply@store.apple.com",
        "to": "user@gmail.com",
        "subject": "Your receipt from Apple",
        "date": datetime(2025, 6, 15, 10, 30),
        "body_html": "<h1>Receipt</h1><p>MacBook Air M3 - $1,299.00</p><p>Tax: $107.17</p><p>Total: $1,406.17</p><p>Payment: Visa ending in 4242</p>",
        "body_text": "Receipt\nMacBook Air M3 - $1,299.00\nTax: $107.17\nTotal: $1,406.17\nPayment: Visa ending in 4242",
        "filename": "2025-06-15_apple_receipt.eml",
    },
    {
        "from": "billing@electricity.co.il",
        "to": "user@gmail.com",
        "subject": "חשבונית חשמל - יוני 2025",
        "date": datetime(2025, 7, 1, 8, 0),
        "body_html": "<p>חשבונית מס/קבלה</p><p>סכום לתשלום: ₪342.50</p><p>תאריך: 01/07/2025</p>",
        "body_text": "חשבונית מס/קבלה\nסכום לתשלום: ₪342.50\nתאריך: 01/07/2025",
        "filename": "2025-07-01_electric_bill.eml",
    },
    {
        "from": "newsletter@techblog.com",
        "to": "user@gmail.com",
        "subject": "This week in AI - Newsletter #47",
        "date": datetime(2025, 6, 20, 14, 0),
        "body_html": "<h1>Weekly AI News</h1><p>Here are the top stories this week in artificial intelligence...</p><p>1. New breakthrough in language models</p><p>2. Robotics update</p>",
        "body_text": "Weekly AI News\nHere are the top stories this week in artificial intelligence...\n1. New breakthrough in language models\n2. Robotics update",
        "filename": "2025-06-20_newsletter.eml",
    },
    {
        "from": "order-confirm@amazon.com",
        "to": "user@gmail.com",
        "subject": "Order Confirmation #112-9876543-2109876",
        "date": datetime(2025, 5, 10, 16, 45),
        "body_html": "<h2>Order Confirmation</h2><p>Your order has been placed.</p><p>USB-C Hub - $29.99</p><p>Shipping: Free</p><p>Total: $29.99</p><p>Estimated delivery: May 14, 2025</p>",
        "body_text": "Order Confirmation\nYour order has been placed.\nUSB-C Hub - $29.99\nShipping: Free\nTotal: $29.99\nEstimated delivery: May 14, 2025",
        "filename": "2025-05-10_amazon_order.eml",
    },
    {
        "from": "john.smith@company.com",
        "to": "user@gmail.com",
        "subject": "Re: Meeting tomorrow at 3pm",
        "date": datetime(2025, 6, 18, 9, 15),
        "body_html": "<p>Sure, 3pm works for me. See you in the conference room.</p>",
        "body_text": "Sure, 3pm works for me. See you in the conference room.",
        "filename": "2025-06-18_meeting_reply.eml",
    },
]

for e in emails:
    msg = email.mime.multipart.MIMEMultipart("alternative")
    msg["From"] = e["from"]
    msg["To"] = e["to"]
    msg["Subject"] = e["subject"]
    msg["Date"] = email.utils.format_datetime(e["date"])
    msg["Message-ID"] = f"<fake-{e['filename']}@mock>"

    msg.attach(email.mime.text.MIMEText(e["body_text"], "plain", "utf-8"))
    msg.attach(email.mime.text.MIMEText(e["body_html"], "html", "utf-8"))

    (OUTPUT_DIR / e["filename"]).write_bytes(msg.as_bytes())
    print(f"Created {e['filename']}")

print(f"\nDone. {len(emails)} emails in {OUTPUT_DIR}/")
