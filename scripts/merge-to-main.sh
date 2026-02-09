#!/bin/bash
# merge-to-main.sh - Automatikus merge feature branch → main és push
# Használat: bash scripts/merge-to-main.sh [feature-branch-neve]
#
# Ha nem adsz meg branch nevet, az aktuális branchet használja.
# A script a teljes pipeline-t végrehajtja:
#   1. Ellenőrzi, hogy van-e commitolatlan változás
#   2. Megjegyzi az aktuális feature branch nevet
#   3. Checkout main + pull latest
#   4. Merge feature branch → main
#   5. Push main → origin (ez triggereli a GitHub Actions deploy-t)
#   6. Visszavált a feature branchre

set -e

# Színek
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

# Feature branch meghatározása
FEATURE_BRANCH="${1:-$(git branch --show-current)}"

if [ "$FEATURE_BRANCH" = "main" ] || [ "$FEATURE_BRANCH" = "master" ]; then
    echo -e "${RED}HIBA: Már a main/master branchen vagy. Válts feature branchre először.${NC}"
    exit 1
fi

echo "============================================"
echo -e "${YELLOW}  MERGE TO MAIN PIPELINE${NC}"
echo "  Feature branch: $FEATURE_BRANCH"
echo "============================================"

# 1. Ellenőrzés: nincs-e commitolatlan változás
echo ""
echo "[1/5] Commitolatlan változások ellenőrzése..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}HIBA: Commitolatlan változások vannak! Commitold először.${NC}"
    git status --short
    exit 1
fi
echo -e "  ${GREEN}✓ Tiszta working directory${NC}"

# 2. Ellenőrzés: feature branch pusholva van-e
echo ""
echo "[2/5] Feature branch push állapot ellenőrzése..."
LOCAL_HASH=$(git rev-parse "$FEATURE_BRANCH")
REMOTE_HASH=$(git rev-parse "origin/$FEATURE_BRANCH" 2>/dev/null || echo "none")
if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
    echo -e "${RED}HIBA: A feature branch nincs pusholva! Pushhold először:${NC}"
    echo "  git push -u origin $FEATURE_BRANCH"
    exit 1
fi
echo -e "  ${GREEN}✓ Feature branch naprakész a remote-tal${NC}"

# 3. Checkout main és pull
echo ""
echo "[3/5] Main branch frissítése..."
git checkout main
git pull origin main
echo -e "  ${GREEN}✓ Main branch naprakész${NC}"

# 4. Merge
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

# 5. Push main (pre-push hook automatikusan fut: build + teszt + formázás)
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
            echo "Próbáld manuálisan: git push origin main"
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
