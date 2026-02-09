#!/bin/bash
# merge-to-main.sh - Automatikus merge feature branch → main és push/PR
# Használat: bash scripts/merge-to-main.sh [feature-branch-neve]
#            bash scripts/merge-to-main.sh --pr [feature-branch-neve]
#
# Módok:
#   Direkt merge (alapértelmezett):
#     Checkout main → merge → push main → GitHub Actions deploy
#   PR mód (--pr flag):
#     Létrehoz egy Pull Request-et a feature branch-ből a main-be
#     Használd ha branch protection van beállítva

set -e

# Színek
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

# Paraméterek feldolgozása
PR_MODE=false
FEATURE_BRANCH=""

for arg in "$@"; do
    if [ "$arg" = "--pr" ]; then
        PR_MODE=true
    else
        FEATURE_BRANCH="$arg"
    fi
done

# Ha nincs megadva branch, az aktuálist használjuk
FEATURE_BRANCH="${FEATURE_BRANCH:-$(git branch --show-current)}"

if [ "$FEATURE_BRANCH" = "main" ] || [ "$FEATURE_BRANCH" = "master" ]; then
    echo -e "${RED}HIBA: Már a main/master branchen vagy. Válts feature branchre először.${NC}"
    exit 1
fi

if [ "$PR_MODE" = true ]; then
    echo "============================================"
    echo -e "${YELLOW}  PR LÉTREHOZÁS → MAIN${NC}"
    echo "  Feature branch: $FEATURE_BRANCH"
    echo "============================================"
else
    echo "============================================"
    echo -e "${YELLOW}  DIREKT MERGE → MAIN${NC}"
    echo "  Feature branch: $FEATURE_BRANCH"
    echo "  (Használd --pr flaget ha branch protection van)"
    echo "============================================"
fi

# 1. Ellenőrzés: nincs-e commitolatlan változás
echo ""
echo "[1/3] Commitolatlan változások ellenőrzése..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}HIBA: Commitolatlan változások vannak! Commitold először.${NC}"
    git status --short
    exit 1
fi
echo -e "  ${GREEN}✓ Tiszta working directory${NC}"

# 2. Ellenőrzés: feature branch pusholva van-e
echo ""
echo "[2/3] Feature branch push állapot ellenőrzése..."
LOCAL_HASH=$(git rev-parse "$FEATURE_BRANCH")
REMOTE_HASH=$(git rev-parse "origin/$FEATURE_BRANCH" 2>/dev/null || echo "none")
if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
    echo -e "${RED}HIBA: A feature branch nincs pusholva! Pushhold először:${NC}"
    echo "  git push -u origin $FEATURE_BRANCH"
    exit 1
fi
echo -e "  ${GREEN}✓ Feature branch naprakész a remote-tal${NC}"

# ==========================================
# PR MÓD: Pull Request létrehozása
# ==========================================
if [ "$PR_MODE" = true ]; then
    echo ""
    echo "[3/3] Pull Request létrehozása..."

    # gh CLI ellenőrzése
    if ! command -v gh &> /dev/null; then
        echo -e "${RED}HIBA: gh CLI nincs telepítve!${NC}"
        echo "  Telepítés: https://cli.github.com/"
        exit 1
    fi

    # gh auth ellenőrzése
    if ! gh auth status &> /dev/null 2>&1; then
        echo -e "${RED}HIBA: gh CLI nincs bejelentkezve!${NC}"
        echo "  Futtasd: gh auth login"
        exit 1
    fi

    # PR létrehozása
    PR_URL=$(gh pr create \
        --base main \
        --head "$FEATURE_BRANCH" \
        --title "Merge: $FEATURE_BRANCH → main" \
        --body "Automatikus merge request a \`$FEATURE_BRANCH\` branch-ből.

## Tartalom
A feature branch összes változtatása.

## Ellenőrzések
- Pre-push hook: build + teszt + formázás ✓
- Deploy: a merge után GitHub Actions automatikusan deployol" 2>&1)

    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}✓ PR létrehozva:${NC}"
        echo "    $PR_URL"
        echo ""
        echo "============================================"
        echo -e "${GREEN}  PR LÉTREHOZVA!${NC}"
        echo "============================================"
        echo ""
        echo "  Következő lépések:"
        echo "    1. Nézd át a PR-t a GitHub-on"
        echo "    2. Merge-öld a PR-t (Merge pull request gomb)"
        echo "    3. GitHub Actions automatikusan deployol"
        echo ""
        echo "  Vagy CLI-ből:"
        echo "    gh pr merge --merge"
        echo "============================================"
    else
        echo -e "${RED}HIBA: PR létrehozása sikertelen:${NC}"
        echo "  $PR_URL"
        exit 1
    fi

    exit 0
fi

# ==========================================
# DIREKT MÓD: Lokális merge + push
# ==========================================
echo ""
echo "[3/5] Main branch frissítése..."
git checkout main
git pull origin main
echo -e "  ${GREEN}✓ Main branch naprakész${NC}"

echo ""
echo "[4/5] Feature branch mergelése a main-be..."
if git merge "$FEATURE_BRANCH" --no-edit; then
    echo -e "  ${GREEN}✓ Merge sikeres${NC}"
else
    echo -e "${RED}HIBA: Merge konfliktus! Oldd fel manuálisan:${NC}"
    echo "  git status     # konfliktusos fájlok"
    echo "  # ... javítsd ki a konfliktusokat ..."
    echo "  git add ."
    echo "  git commit"
    echo "  git push origin main"
    exit 1
fi

echo ""
echo "[5/5] Push main → origin (pre-push hook ellenőriz)..."
MAX_RETRIES=4
RETRY_DELAY=2

for i in $(seq 1 $MAX_RETRIES); do
    if git push origin main; then
        echo -e "  ${GREEN}✓ Push sikeres${NC}"
        break
    else
        if [ $i -lt $MAX_RETRIES ]; then
            echo -e "${YELLOW}  Push sikertelen, újrapróbálkozás ${RETRY_DELAY}s múlva... ($i/$MAX_RETRIES)${NC}"
            sleep $RETRY_DELAY
            RETRY_DELAY=$((RETRY_DELAY * 2))
        else
            echo -e "${RED}HIBA: Push sikertelen $MAX_RETRIES próbálkozás után.${NC}"
            echo ""
            echo -e "${YELLOW}  Lehetséges ok: branch protection van a main-en.${NC}"
            echo "  Próbáld PR módban:"
            echo "    bash scripts/merge-to-main.sh --pr $FEATURE_BRANCH"
            # Visszaváltás feature branchre
            git checkout "$FEATURE_BRANCH"
            exit 1
        fi
    fi
done

# Visszaváltás a feature branchre
echo ""
git checkout "$FEATURE_BRANCH"

echo ""
echo "============================================"
echo -e "${GREEN}  MERGE ÉS PUSH SIKERES!${NC}"
echo "============================================"
echo ""
echo "  A GitHub Actions most automatikusan deployolja"
echo "  az alkalmazást a mail.mindenes.org szerverre."
echo ""
echo "  Deploy állapot ellenőrzése:"
echo "    gh run list --limit 1"
echo "============================================"
