#!/usr/bin/env bash
#
# slidessoca on the VPS: the steps only a person can do (GitHub secrets, DNS, nginx blocks +
# certificates), the first deploy of develop (slides-dev) and main (slides), and the final HTTPS
# proof. Generated with /wizard. Run from the repo root: bash deploy/wizard.sh
#
# Everything above the "STAGES" marker is the wizard library: do not hand-edit
# it. Author the per-step stages below the marker.


set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Wizard library: delightful, consistent UX, identical across every wizard.
# ──────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""
fi

# Author sets this at the top of the stages section.
TOTAL_STAGES=0

_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-.env}"
WRITTEN_ENV=()    # KEYs written to ENV_FILE this run
WRITTEN_SECRET=() # secret NAMEs set this run
SKIPPED=()        # things we couldn't do (e.g. gh missing)

# _clear wipes the terminal so only the current step is on screen. No-op when
# output isn't a terminal, so piped logs stay readable.
_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1 && tput clear 2>/dev/null; then return 0; fi
  printf '\033[2J\033[3J\033[H'
}

# banner "Title" shows the opening frame: what this wizard does.
banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  printf '%s  You drive the browser; this wizard tells you exactly what to do and\n' "$DIM"
  printf '  captures the values you copy back. Stop any time with Ctrl-C and re-run\n'
  printf '  later, since it remembers values already saved.%s\n' "$RESET"
  pause "Ready to start?"
}

# stage "Name" clears the screen, then announces a stage and shows progress.
# Clearing keeps only the current step on screen.
stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

# say "..." prints a plain instruction line.
say()  { printf '  %s\n' "$1"; }
# step "..." is a numbered-feeling action the human takes in the browser.
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

# open_url URL opens it in the human's browser, cross-platform incl. WSL.
open_url() {
  local url="$1"
  printf '  %s↗ opening%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview     >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open    >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open        >/dev/null 2>&1; then open "$url"
    else false; fi
  } >/dev/null 2>&1 || warn "couldn't open a browser, so visit it manually: $url"
}

# pause "msg" waits for the human to confirm they've done the manual part.
pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

# confirm "question" is a y/N gate; returns success on yes.
confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

# _existing KEY: current value of KEY in ENV_FILE, if any, with write_env's single
# quotes or a plain dotenv double-quoted value undone.
_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line value sq="'\\''"; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  value="${line#*=}"
  if [[ "$value" == \'*\' ]]; then value="${value:1:${#value}-2}"; value="${value//"$sq"/\'}"
  elif [[ "$value" == \"*\" ]]; then
    value="${value:1:${#value}-2}"
    [[ "$value" == *[\\\$\"]* ]] && return 1   # escapes, $ or ": can't decode safely; ask again
  fi
  printf '%s' "$value"
}

# ask KEY "Prompt" reads a value into $KEY. Offers the existing .env value as
# a default on re-runs (Enter keeps it). Visible input (non-secret), edited
# with Readline. Fails at EOF with no input.
ask() {
  local key="$1" prompt="$2" current input s=$'\001' e=$'\002' p rc=0
  current=$(_existing "$key" || true)
  # Readline needs the colour codes wrapped in \001..\002 to place the cursor.
  p="  $s$BOLD$e$prompt$s$RESET$e "
  [[ -n "$current" ]] && p+="$s$DIM$e[Enter keeps current]$s$RESET$e "
  read -e -r -p "$p" input || rc=1
  if (( rc )) && [[ -z "$input" ]]; then return 1; fi
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# ask_secret KEY "Prompt" is like ask, but input is hidden.
ask_secret() {
  local key="$1" prompt="$2" current input rc=0
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || rc=1
  printf '\n'
  if (( rc )) && [[ -z "$input" ]]; then return 1; fi
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# write_env KEY VALUE upserts KEY='VALUE' into ENV_FILE (replaces any existing
# line) and sets $KEY. Idempotent. Creates ENV_FILE at mode 0600; writes through
# a symlink and keeps an existing file's mode.
write_env() {
  local key="$1" value="$2" tmp sq="'\\''"
  [[ -e "$ENV_FILE" ]] || (umask 077 && : > "$ENV_FILE")
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf "%s='%s'\n" "$key" "${value//\'/$sq}" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
  printf -v "$key" '%s' "$value"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

# set_secret NAME VALUE sets a GitHub Actions repo secret via gh. Falls back
# to a warning (and records it) if gh is unavailable or unauthenticated.
set_secret() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
      WRITTEN_SECRET+=("$name")
      printf '  %s✓ set%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub secret $name (set it manually: gh secret set $name)")
  warn "skipped GitHub secret $name: gh not ready; set it later"
}

# set_var NAME VALUE sets a GitHub Actions repo variable (non-secret).
set_var() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh variable set "$name" --body "$value" >/dev/null 2>&1; then
      printf '  %s✓ set%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub variable $name")
  warn "skipped GitHub variable $name, gh not ready; set it later"
}

# finish clears, then shows a closing summary of everything configured.
finish() {
  _clear
  printf '\n%s%s  ✓ Setup complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} ))    && note "wrote ${#WRITTEN_ENV[@]} value(s) to $ENV_FILE: ${WRITTEN_ENV[*]}"
  (( ${#WRITTEN_SECRET[@]} )) && note "set ${#WRITTEN_SECRET[@]} GitHub secret(s): ${WRITTEN_SECRET[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "still to do by hand:"
    for s in "${SKIPPED[@]}"; do note "  - $s"; done
  fi
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# STAGES: author this section. One stage() per step the human takes.
# Replace the example below. Set TOTAL_STAGES to match the stages you write.
# Keep every stage inside run_wizard and the last line as is: bash then parses
# the whole file before the first prompt, so an edit mid-run can't break it.
# ──────────────────────────────────────────────────────────────────────────


run_wizard() {

TOTAL_STAGES=6
PROD_DOMAIN="slides.passoca.dev"
DEV_DOMAIN="slides-dev.passoca.dev"
PROD_PORT=3004
DEV_PORT=3005
REPO="httpassoca/slidessoca"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
# The wizard's own answers (SSH host/user/key path) go here, not into the app's .env.
ENV_FILE="${WIZARD_ENV_FILE:-deploy/.wizard.env}"

gh_ready() { command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; }

banner "slidessoca on $PROD_DOMAIN and $DEV_DOMAIN"

# ── 1. SSH secrets ────────────────────────────────────────────────────────
stage "GitHub: the deploy workflow's three SSH secrets"
say "deploy.yml builds the image in CI, copies it to the VPS and starts the container over SSH."
say "It reads SSH_HOST, SSH_USER and SSH_KEY from this repo's secrets: the same values as guessoca."
note "Without them every Deploy run ends as \"skipped deploy (no secrets)\", which is harmless."
[[ -f "$HOME/dev/guessoca/.env" ]] && note "guessoca's wizard saved its answers in ~/dev/guessoca/.env, if you want to copy them."
ask SSH_HOST "VPS host (IP or hostname):"
ask SSH_USER "SSH user on that host:"
ask SSH_KEY_PATH "Private key that logs into the VPS (e.g. ~/.ssh/id_ed25519):"
SSH_KEY_PATH="${SSH_KEY_PATH/#\~/$HOME}"
if [[ ! -r "$SSH_KEY_PATH" ]]; then
  warn "can't read $SSH_KEY_PATH; check the path and run again"
  exit 1
fi
write_env SSH_HOST "$SSH_HOST"
write_env SSH_USER "$SSH_USER"
write_env SSH_KEY_PATH "$SSH_KEY_PATH"
if ! gh_ready; then
  open_url "https://github.com/$REPO/settings/secrets/actions"
  step "New repository secret, three times: SSH_HOST, SSH_USER and SSH_KEY (all of $SSH_KEY_PATH)."
  pause "Pasted all three? Enter to continue."
fi
set_secret SSH_HOST "$SSH_HOST"
set_secret SSH_USER "$SSH_USER"
set_secret SSH_KEY "$(cat "$SSH_KEY_PATH")"$'\n'  # $(…) eats the final newline; OpenSSH wants it
say "Testing access: ssh $SSH_USER@$SSH_HOST"
if ssh -i "$SSH_KEY_PATH" -o BatchMode=yes -o ConnectTimeout=10 "$SSH_USER@$SSH_HOST" \
  "docker --version && npm --version >/dev/null && echo 'npm ok' && test -d /etc/nginx && echo 'nginx ok' && for p in $PROD_PORT $DEV_PORT; do if ss -ltn | grep -q \":\$p \"; then echo \"WARNING: port \$p is already taken\"; else echo \"port \$p free\"; fi; done" 2>&1 | sed 's/^/    /'; then
  say "${GREEN}✓${RESET} SSH, docker, npm and nginx answer on the VPS."
else
  warn "SSH didn't get in (or docker/npm/nginx are missing). Deploys fail until that's fixed."
  confirm "Carry on anyway?" || exit 1
fi
pause

# ── 2. DNS ────────────────────────────────────────────────────────────────
stage "DNS: $PROD_DOMAIN and $DEV_DOMAIN point at the VPS"
say "certbot validates over HTTP, so both names must resolve before the certificates."
step "In the passoca.dev DNS panel (where guess.passoca.dev already is), create two A records:"
say "    name: slides       type: A    value: the VPS IP (same as guess)    TTL: lowest"
say "    name: slides-dev   type: A    value: the VPS IP (same as guess)    TTL: lowest"
note "If guess.passoca.dev has an AAAA record, add the matching AAAA records too; otherwise don't."
pause "Created both? Enter to check propagation."
for domain in "$PROD_DOMAIN" "$DEV_DOMAIN"; do
  resolved=""
  for _ in 1 2 3 4 5 6; do
    resolved="$(getent ahostsv4 "$domain" 2>/dev/null | awk '{print $1; exit}' || true)"
    [[ -n "$resolved" ]] && break
    say "$domain doesn't resolve yet, waiting 10 s…"; sleep 10
  done
  if [[ -n "$resolved" ]]; then
    say "${GREEN}✓${RESET} $domain → $resolved"
    [[ "$resolved" != "$SSH_HOST" ]] && note "(differs from SSH_HOST=$SSH_HOST; fine if the host is a name, not the IP)"
  else
    warn "$domain doesn't resolve from here yet; certbot in stage 4 fails until it does."
    confirm "Carry on anyway?" || exit 1
  fi
done

# ── 3. nginx ──────────────────────────────────────────────────────────────
stage "nginx: one server block per domain"
say "The blocks live in deploy/*.nginx (proxy to 127.0.0.1:$PROD_PORT / :$DEV_PORT, 16 MB bodies, X-Real-IP)."
say "The wizard copies them to /tmp on the VPS; the rest needs sudo, so you run it."
for domain in "$PROD_DOMAIN" "$DEV_DOMAIN"; do
  if scp -i "$SSH_KEY_PATH" -o BatchMode=yes "deploy/$domain.nginx" "$SSH_USER@$SSH_HOST:/tmp/$domain" >/dev/null 2>&1; then
    say "${GREEN}✓${RESET} copied to /tmp/$domain on the VPS"
  else
    warn "scp failed; copy deploy/$domain.nginx to /tmp/$domain on the VPS by hand"
  fi
done
step "In another terminal: ssh $SSH_USER@$SSH_HOST and run:"
printf '\n'
cat <<CMDS
    for d in $PROD_DOMAIN $DEV_DOMAIN; do
      sudo mv /tmp/\$d /etc/nginx/sites-available/\$d
      sudo ln -sfn /etc/nginx/sites-available/\$d /etc/nginx/sites-enabled/\$d
    done
    sudo nginx -t && sudo systemctl reload nginx
CMDS
printf '\n'
note "Same layout as guess.passoca.dev (sites-available/sites-enabled)."
pause "Ran it without errors? Enter to check."
for domain in "$PROD_DOMAIN" "$DEV_DOMAIN"; do
  http_status="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "http://$domain/health" 2>/dev/null || true)"
  case "$http_status" in
    200) say "${GREEN}✓${RESET} $domain: nginx reaches the container (200)" ;;
    502|504) say "${GREEN}✓${RESET} $domain: block is live (nginx said $http_status: no container yet, the deploy comes later)" ;;
    *) warn "http://$domain/health returned '$http_status': the block isn't live (symlink, nginx -t, DNS?)"
       confirm "Carry on anyway?" || exit 1 ;;
  esac
done

# ── 4. certificates ───────────────────────────────────────────────────────
stage "HTTPS: Let's Encrypt certificates"
say "The containers get ORIGIN=https://…; SvelteKit rejects form posts from any other origin."
step "In the same VPS terminal:"
printf '\n'
cat <<CMDS
    sudo certbot --nginx -d $PROD_DOMAIN
    sudo certbot --nginx -d $DEV_DOMAIN
CMDS
printf '\n'
note "certbot adds listen 443 and the 80 → 443 redirect to each block, as it did for guess.passoca.dev."
pause "Both certificates issued and nginx reloaded? Enter for the first deploys."

# ── 5. first deploys ──────────────────────────────────────────────────────
stage "Deploy: develop → $DEV_DOMAIN, main → $PROD_DOMAIN"
say "Deploy runs on every push to develop and main; it can also be started by hand."
say "develop deploys first (container slidessoca-dev), then main (container slidessoca)."
if gh_ready; then
  for branch in develop main; do
    if confirm "Run the Deploy workflow on $branch now and watch it?"; then
      gh workflow run deploy.yml --repo "$REPO" --ref "$branch" >/dev/null 2>&1 \
        || { warn "couldn't start it; is deploy.yml on $branch yet?"; continue; }
      sleep 8
      run_id="$(gh run list --repo "$REPO" --workflow=deploy.yml --branch "$branch" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)"
      if [[ -n "$run_id" && "$run_id" != null ]]; then
        gh run watch "$run_id" --repo "$REPO" --exit-status \
          || warn "the run failed; see: gh run view $run_id --log-failed (a 504 in scp/ssh-action: just rerun it)"
      fi
    fi
  done
else
  step "Start Deploy for develop and for main: https://github.com/$REPO/actions/workflows/deploy.yml (Run workflow)"
  pause "Both green? Enter to prove them from outside."
fi

# ── 6. proof ──────────────────────────────────────────────────────────────
stage "Proof: both sites answer over HTTPS"
for domain in "$DEV_DOMAIN" "$PROD_DOMAIN"; do
  say "https://$domain:"
  if curl -fsS --max-time 10 "https://$domain/health" >/dev/null; then
    say "  ${GREEN}✓${RESET} /health answers"
  else
    warn "  https://$domain/health didn't answer"; SKIPPED+=("https://$domain/health: check nginx and the container")
    continue
  fi
  if curl -fsS --max-time 10 "https://$domain/" | grep -q '__sveltekit'; then
    say "  ${GREEN}✓${RESET} the app shell loads"
  else
    warn "  https://$domain/ didn't return the app"; SKIPPED+=("https://$domain/ did not return the app shell")
  fi
  # A 2 MB junk body: nginx would answer 413 if client_max_body_size were missing; the app answers 400.
  big_status="$(head -c 2000000 /dev/zero | tr '\0' 'a' | curl -sS --max-time 20 -o /dev/null -w '%{http_code}' \
    -H 'content-type: application/json' -H "origin: https://$domain" --data-binary @- "https://$domain/api/decks" 2>/dev/null || true)"
  if [[ "$big_status" == "413" ]]; then
    warn "  a 2 MB publish got 413: client_max_body_size isn't in the live block"
    SKIPPED+=("$domain: nginx rejects 2 MB bodies (413), re-copy deploy/$domain.nginx")
  else
    say "  ${GREEN}✓${RESET} large publishes reach the app (status $big_status, not 413)"
  fi
done
say "Open https://$DEV_DOMAIN, make a deck, Share it and open the link on your phone."
pause

finish
}

run_wizard "$@"; exit
