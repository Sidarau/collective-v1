#!/usr/bin/env bash
# Deploy a QA surface from the current working tree.
# Usage: scripts/deploy-qa.sh mobile|admin|member
#
# QA projects (no git connection, CLI deploys only — deploys exactly what is
# on disk, so run from the commit you want to test):
#   mobile  → collective-mobile-qa  → https://qa.opencollective.app
#   admin   → collective-admin-qa   → https://qa1.opencollective.app
#   member  → collective-member-qa  → https://qa.myopencollective.com
#
# The .vercel link is swapped for the deploy and always restored.
set -euo pipefail

target="${1:?usage: deploy-qa.sh mobile|admin|member}"
root="$(cd "$(dirname "$0")/.." && pwd)"

case "$target" in
  mobile) dir="$root/mobile"; prod=collective-mobile-ops; qa=collective-mobile-qa ;;
  admin)  dir="$root/admin";  prod=collective-admin;      qa=collective-admin-qa ;;
  member) dir="$root";        prod=collective-v1;         qa=collective-member-qa ;;
  *) echo "unknown target: $target" >&2; exit 1 ;;
esac

cd "$dir"
cp .vercel/project.json /tmp/qa-deploy-backup-$target.json
restore() { cp /tmp/qa-deploy-backup-$target.json .vercel/project.json; rm -f /tmp/qa-deploy-backup-$target.json; }
trap restore EXIT

vercel link --yes --project "$qa" >/dev/null
vercel deploy --prod --yes
echo ">> QA deployed: $qa (link restored to $prod)"
