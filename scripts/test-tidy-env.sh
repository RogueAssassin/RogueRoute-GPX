#!/usr/bin/env bash
# Runs tidy_env from ./rogueroute-gpx against sample .env files, under the same
# `set -euo pipefail` as the script, so a setting that is missing cannot stop it silently.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

script="$repo/rogueroute-gpx"
start="$(grep -n '^OBSOLETE_KEYS=(' "$script" | cut -d: -f1)"
fn="$(grep -n '^tidy_env()' "$script" | cut -d: -f1)"
end="$(awk -v s="$fn" 'NR > s && /^}/ { print NR; exit }' "$script")"
{
  echo 'set -euo pipefail'
  sed -n "${start},${end}p" "$script"
  echo 'tidy_env'
} > "$work/tidy.sh"
cp "$repo/.env.example" "$work/.env.example"

failed=0
check() {
  local name="$1" want_password="$2" output password
  if ! output="$(cd "$work" && ROOT="$work" ENV="$work/.env" bash tidy.sh 2>&1)"; then
    echo "FAIL $name: tidy_env exited with an error"; echo "$output"; failed=1; return
  fi
  password="$(grep -E '^ADMIN_PASSWORD=' "$work/.env" | cut -d= -f2-)"
  if [[ "$password" != "$want_password" ]]; then
    echo "FAIL $name: ADMIN_PASSWORD is '$password', expected '$want_password'"; failed=1
  elif grep -qE '^ADMIN_TOKEN=' "$work/.env"; then
    echo "FAIL $name: ADMIN_TOKEN was not removed"; failed=1
  else
    echo "ok   $name"
  fi
}

# A v13.4 .env: the token becomes the password.
grep -v '^ADMIN_PASSWORD=' "$repo/.env.example" > "$work/.env"
echo 'ADMIN_TOKEN=old-token' >> "$work/.env"
check "ADMIN_TOKEN moves to ADMIN_PASSWORD" old-token

# The next start: no ADMIN_TOKEN line at all.
check "no ADMIN_TOKEN line" old-token

# A password that is already set wins over a leftover token.
sed -i 's/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=chosen/' "$work/.env"
echo 'ADMIN_TOKEN=leftover' >> "$work/.env"
check "existing ADMIN_PASSWORD is kept" chosen

# A fresh .env from the template.
cp "$repo/.env.example" "$work/.env"
check "fresh .env from .env.example" ""

exit "$failed"
