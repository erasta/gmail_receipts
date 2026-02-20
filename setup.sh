#!/bin/bash
set -e

mkdir -p src raw_emails output

cat > .env << 'EOF'
EMAIL_ADDRESS=your_email@gmail.com
APP_PASSWORD=xxxx xxxx xxxx xxxx
EOF

cat > encrypt.sh << 'EOF'
#!/bin/bash
gpg -c .env && rm .env && echo "Encrypted."
EOF

cat > run.sh << 'EOF'
#!/bin/bash
export $(gpg -d .env.gpg 2>/dev/null | xargs)
src/.venv/bin/python src/download.py "$@"
unset EMAIL_ADDRESS APP_PASSWORD
EOF

cat > .gitignore << 'EOF'
.env
.env.gpg
src/.venv/
raw_emails/
output/
classification_results.json
EOF

cat > src/requirements.txt << 'EOF'
python-dotenv
requests
tqdm
weasyprint
EOF

python3 -m venv src/.venv
src/.venv/bin/pip install -r src/requirements.txt

echo "Done. Edit .env, then: sh encrypt.sh"
