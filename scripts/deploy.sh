#!/usr/bin/env bash
# Installed at /usr/local/sbin/mafia-deploy, called by a restricted SSH key.
set -Eeuo pipefail
umask 077
[[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([0-9a-f]{40})$ ]] || { echo 'Only deploy <commit SHA> is allowed'; exit 64; }
sha=${BASH_REMATCH[1]}
exec 9>/run/lock/mafia-deploy.lock
flock -w 600 9
release="/opt/mafia/releases/$sha"
install -d -m 700 "$release"
archive=$(mktemp /opt/mafia/releases/incoming-XXXXXXXX.tar.gz)
trap 'rm -f "$archive"' EXIT
cat > "$archive"
tar -tzf "$archive" >/dev/null
(umask 022; tar -xzf "$archive" -C "$release" --no-same-owner --no-same-permissions)
test -f "$release/src/server.js"
# Build before replacing the running bot.
docker build -t "mafia-app:$sha" "$release"
# Verify non-root imports before touching the running application.
docker run --rm --entrypoint node "mafia-app:$sha" --input-type=module -e "await import('./src/server.js'); console.log('Runtime imports OK');"
cd /opt/mafia
docker compose config --quiet
previous=$(docker image inspect mafia-app:latest --format '{{.Id}}' 2>/dev/null || true)
if docker compose ps --status running -q app | grep -q .; then
 docker compose exec -T app node --input-type=module -e 'import {DatabaseSync} from "node:sqlite";import {mkdirSync} from "node:fs";mkdirSync("/app/data/backups",{recursive:true});const path="/app/data/backups/pre-deploy-"+Date.now()+".sqlite";new DatabaseSync("/app/data/mafia.sqlite").exec("VACUUM INTO "+String.fromCharCode(39)+path+String.fromCharCode(39));' 
fi
rollback() {
 trap - ERR
 if [[ -n "$previous" ]]; then
  docker tag "$previous" mafia-app:latest
  docker compose up -d --no-build app
 fi
 echo 'Deployment failed' >&2
 exit 1
}
trap rollback ERR
docker tag "mafia-app:$sha" mafia-app:latest
docker compose up -d --wait --wait-timeout 180
docker compose exec -T app node scripts/setup-bot.mjs
printf '%s\n' "$sha" > /opt/mafia/last-deployed-commit
trap - ERR
echo "Deployment healthy: $sha"
