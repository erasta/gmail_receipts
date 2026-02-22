"""Create fake .eml files for testing classify.py and extract.py."""
import email.mime.multipart
import email.mime.text
import email.utils
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path("test_raw_emails")
OUTPUT_DIR.mkdir(exist_ok=True)

emails = [
    # === RECEIPTS (should be true) ===
    {
        "from": "noreply@store.apple.com",
        "subject": "Your receipt from Apple",
        "date": datetime(2025, 6, 15, 10, 30),
        "body_text": "Receipt\nMacBook Air M3 - $1,299.00\nTax: $107.17\nTotal: $1,406.17\nPayment: Visa ending in 4242",
        "filename": "2025-06-15_apple_receipt.eml",
    },
    {
        "from": "billing@electricity.co.il",
        "subject": "חשבונית חשמל - יוני 2025",
        "date": datetime(2025, 7, 1, 8, 0),
        "body_text": "חשבונית מס/קבלה\nסכום לתשלום: ₪342.50\nתאריך: 01/07/2025",
        "filename": "2025-07-01_electric_bill.eml",
    },
    {
        "from": "order-confirm@amazon.com",
        "subject": "Order Confirmation #112-9876543-2109876",
        "date": datetime(2025, 5, 10, 16, 45),
        "body_text": "Order Confirmation\nYour order has been placed.\nUSB-C Hub - $29.99\nShipping: Free\nTotal: $29.99\nEstimated delivery: May 14, 2025",
        "filename": "2025-05-10_amazon_order.eml",
    },
    {
        "from": "receipts@uber.com",
        "subject": "Your trip with Uber - $18.45",
        "date": datetime(2025, 8, 3, 22, 15),
        "body_text": "Thanks for riding with Uber\nTrip on Aug 3, 2025\nPickup: 123 Main St\nDropoff: 456 Oak Ave\nDistance: 5.2 mi\nFare: $14.00\nService fee: $2.45\nTip: $2.00\nTotal: $18.45\nPaid with Visa •••• 4242",
        "filename": "2025-08-03_uber_ride.eml",
    },
    {
        "from": "noreply@spotify.com",
        "subject": "Your Spotify Premium receipt",
        "date": datetime(2025, 7, 1, 0, 0),
        "body_text": "Payment confirmation\nSpotify Premium Individual\nBilling period: Jul 1 - Jul 31, 2025\nAmount: $10.99\nPayment method: PayPal\nNext billing date: Aug 1, 2025",
        "filename": "2025-07-01_spotify_sub.eml",
    },
    {
        "from": "no-reply@bolt.eu",
        "subject": "Вашата разписка за пътуване",
        "date": datetime(2025, 6, 20, 19, 30),
        "body_text": "Благодарим ви, че пътувахте с Bolt\nДата: 20.06.2025\nМаршрут: ул. Витошка → Летище София\nЦена: 24.50 лв.\nПлатено с: Visa •••• 1234",
        "filename": "2025-06-20_bolt_ride_bg.eml",
    },
    {
        "from": "kvittering@telenor.no",
        "subject": "Kvittering for betaling - Telenor",
        "date": datetime(2025, 5, 15, 12, 0),
        "body_text": "Kvittering\nTelenor Mobilabonnement\nPeriode: Mai 2025\nBeløp: 399,00 kr\nBetalt med: Visa\nFakturanummer: 987654321",
        "filename": "2025-05-15_telenor_no.eml",
    },
    {
        "from": "rechnung@telekom.de",
        "subject": "Ihre Rechnung für Juni 2025",
        "date": datetime(2025, 6, 5, 9, 0),
        "body_text": "Sehr geehrter Kunde,\nIhre Rechnung für Juni 2025 ist verfügbar.\nRechnungsbetrag: 39,99 €\nVertragsnummer: DE-12345678\nZahlungsart: Lastschrift\nFälligkeitsdatum: 15.06.2025",
        "filename": "2025-06-05_telekom_de.eml",
    },
    {
        "from": "noreply@paypal.com",
        "subject": "You sent a payment of $50.00 to John Doe",
        "date": datetime(2025, 4, 22, 14, 30),
        "body_text": "Transaction ID: 5XY12345AB678901C\nYou sent $50.00 USD to John Doe (john@example.com)\nDate: April 22, 2025\nFunding source: Bank account ••••6789",
        "filename": "2025-04-22_paypal_payment.eml",
    },
    {
        "from": "donations@wikipedia.org",
        "subject": "Thank you for your donation to Wikipedia",
        "date": datetime(2025, 3, 10, 8, 0),
        "body_text": "Dear supporter,\nThank you for your generous donation of $25.00 to the Wikimedia Foundation.\nTransaction ID: WMF-2025-0310-1234\nThis donation is tax-deductible.\nDate: March 10, 2025",
        "filename": "2025-03-10_wikipedia_donation.eml",
    },
    {
        "from": "noreply@wolt.com",
        "subject": "הזמנה שלך מ-Wolt הגיעה!",
        "date": datetime(2025, 9, 1, 20, 0),
        "body_text": "פרטי הזמנה\nמסעדת שווארמה הכפר\nשווארמה בפיתה x2 - ₪56.00\nצ'יפס - ₪18.00\nמשלוח - ₪10.99\nסה\"כ: ₪84.99\nשולם ב: ויזה •••• 5678",
        "filename": "2025-09-01_wolt_order.eml",
    },
    {
        "from": "billing@netlify.com",
        "subject": "Your Netlify invoice for September 2025",
        "date": datetime(2025, 9, 1, 0, 0),
        "body_text": "Invoice #INV-2025-09-4567\nNetlify Pro Plan\nPeriod: Sep 1 - Sep 30, 2025\nUsage: 150GB bandwidth\nAmount due: $19.00\nPaid via credit card ending in 9012",
        "filename": "2025-09-01_netlify_invoice.eml",
    },
    {
        "from": "refunds@amazon.com",
        "subject": "Your refund of $29.99 has been processed",
        "date": datetime(2025, 5, 20, 10, 0),
        "body_text": "Refund Confirmation\nWe've processed your refund for Order #112-9876543-2109876\nItem: USB-C Hub\nRefund amount: $29.99\nRefund to: Visa ending in 4242\nExpected within 3-5 business days",
        "filename": "2025-05-20_amazon_refund.eml",
    },
    {
        "from": "alerts@bank.co.il",
        "subject": "התראת חיוב בכרטיס אשראי",
        "date": datetime(2025, 8, 15, 11, 0),
        "body_text": "חיוב בכרטיס ויזה •••• 5678\nסכום: ₪250.00\nבית עסק: סופר פארם\nתאריך: 15/08/2025\nיתרה נותרת: ₪3,450.00",
        "filename": "2025-08-15_bank_alert.eml",
    },
    # === NOT RECEIPTS (should be false) ===
    {
        "from": "john.smith@company.com",
        "subject": "Re: Meeting tomorrow at 3pm",
        "date": datetime(2025, 6, 18, 9, 15),
        "body_text": "Sure, 3pm works for me. See you in the conference room.",
        "filename": "2025-06-18_meeting_reply.eml",
    },
    {
        "from": "newsletter@techblog.com",
        "subject": "This week in AI - Newsletter #47",
        "date": datetime(2025, 6, 20, 14, 0),
        "body_text": "Weekly AI News\nHere are the top stories this week in artificial intelligence...\n1. New breakthrough in language models\n2. Robotics update",
        "filename": "2025-06-20_newsletter.eml",
    },
    {
        "from": "noreply@linkedin.com",
        "subject": "You have 5 new connection requests",
        "date": datetime(2025, 7, 10, 8, 0),
        "body_text": "Hi there,\nYou have 5 pending connection requests on LinkedIn.\n1. Sarah Johnson - Product Manager at Google\n2. Mike Chen - Software Engineer at Meta\nView your connections at linkedin.com",
        "filename": "2025-07-10_linkedin_notif.eml",
    },
    {
        "from": "shipping@amazon.com",
        "subject": "Your package has been delivered",
        "date": datetime(2025, 5, 14, 16, 0),
        "body_text": "Your package was delivered today at 3:42 PM.\nDelivered to: Front door\nOrder #112-9876543-2109876\nTrack your deliveries in the Amazon app.",
        "filename": "2025-05-14_amazon_delivery.eml",
    },
    {
        "from": "security@google.com",
        "subject": "Security alert: new sign-in on your account",
        "date": datetime(2025, 8, 1, 3, 0),
        "body_text": "Someone just signed in to your Google account from a new device.\nDevice: Linux desktop\nLocation: Tel Aviv, Israel\nTime: Aug 1, 2025, 3:00 AM\nIf this was you, no action needed.",
        "filename": "2025-08-01_google_security.eml",
    },
    {
        "from": "promo@zara.com",
        "subject": "Summer Sale - Up to 50% off!",
        "date": datetime(2025, 7, 15, 10, 0),
        "body_text": "SUMMER SALE\nUp to 50% off selected items\nShop now at zara.com\nFree shipping on orders over $50\nOffer valid until July 31, 2025",
        "filename": "2025-07-15_zara_promo.eml",
    },
    {
        "from": "hr@company.com",
        "subject": "Updated vacation policy - please review",
        "date": datetime(2025, 4, 1, 9, 0),
        "body_text": "Hi team,\nPlease review the updated vacation policy attached.\nKey changes:\n- Increased annual leave from 18 to 22 days\n- New remote work guidelines\nPlease acknowledge by April 15.",
        "filename": "2025-04-01_hr_policy.eml",
    },
    {
        "from": "noreply@github.com",
        "subject": "[my-repo] Pull request #42 merged",
        "date": datetime(2025, 6, 25, 15, 30),
        "body_text": "Pull request #42 has been merged into main.\nTitle: Fix login bug\nMerged by: johndoe\n2 files changed, 15 insertions(+), 3 deletions(-)",
        "filename": "2025-06-25_github_pr.eml",
    },
]

for e in emails:
    msg = email.mime.multipart.MIMEMultipart("alternative")
    msg["From"] = e["from"]
    msg["To"] = "user@gmail.com"
    msg["Subject"] = e["subject"]
    msg["Date"] = email.utils.format_datetime(e["date"])
    msg["Message-ID"] = f"<fake-{e['filename']}@mock>"

    msg.attach(email.mime.text.MIMEText(e["body_text"], "plain", "utf-8"))

    (OUTPUT_DIR / e["filename"]).write_bytes(msg.as_bytes())
    print(f"Created {e['filename']}")

print(f"\nDone. {len(emails)} emails in {OUTPUT_DIR}/")
