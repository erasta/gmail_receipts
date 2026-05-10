import imaplib, email, json, glob, getpass

user = input("Gmail address: ")
password = getpass.getpass("App password: ")

sample = sorted(f for f in glob.glob("fetch/output/*/*.json") if not f.endswith("_processed.json"))[:10]

print(f"Connecting to Gmail as {user}...")
mail = imaplib.IMAP4_SSL("imap.gmail.com")
mail.login(user, password)
mail.select('"[Gmail]/All Mail"')

print(f"UIDVALIDITY now: {mail.response('UIDVALIDITY')[1]}")
print(f"Spot-checking {len(sample)} receipts\n")

for path in sample:
    with open(path) as f:
        stored = json.load(f)
    uid = stored["uid"]
    _, data = mail.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (FROM DATE)])")
    msg = email.message_from_bytes(data[0][1])
    fetched_from = msg["From"].strip()
    fetched_date = msg["Date"].strip()
    stored_from = stored["from"].strip()
    stored_date = stored["date"].strip()
    if fetched_from == stored_from and fetched_date == stored_date:
        print(f"OK    uid={uid}")
    else:
        print(f"DIFF  uid={uid}")
        print(f"  stored  from={stored_from!r} date={stored_date!r}")
        print(f"  fetched from={fetched_from!r} date={fetched_date!r}")

mail.logout()
