#!/bin/sh
# Monit "exec" hook: emails the event via the email API.
# Installed to /usr/local/bin/monit-alert by Jenkins. Token is written to /etc/monit/alert-token (root-only) from Jenkins credential monit-alert-token.
TOKEN=$(cat /etc/monit/alert-token) || exit 1

python3 - <<'EOF' | curl -sS --max-time 20 https://email.sherifs.de/send-email \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @-
import json, os
e = os.environ.get
print(json.dumps({
    "to": ["info@sherifs.de"],
    "subject": f"[monit] {e('MONIT_SERVICE')}: {e('MONIT_EVENT')}",
    "body": f"{e('MONIT_DESCRIPTION')}\n\nHost: {e('MONIT_HOST')}\nDate: {e('MONIT_DATE')}",
    "fromName": "Monit",
}))
EOF
