#!/bin/bash
# CORS tesztelő script
# Használat: ./test-cors.sh [base-url]
# Példa: ./test-cors.sh https://mail.mindenes.org

BASE_URL="${1:-https://mail.mindenes.org}"
ORIGINS=("https://mindenes.org" "https://mail.mindenes.org")

echo "🧪 CORS Teszt - ${BASE_URL}"
echo "================================"
echo ""

for ORIGIN in "${ORIGINS[@]}"; do
  echo "📍 Teszt origin: ${ORIGIN}"
  echo "---"

  # Test 1: Health check (GET - nincs session kell)
  echo "  ✓ Testing /api/health ..."
  curl -s -X GET "${BASE_URL}/api/health" \
    -H "Origin: ${ORIGIN}" \
    -H "Access-Control-Request-Method: GET" \
    -w "\n  Status: %{http_code}\n" \
    -o /dev/null

  # Test 2: Auth session (OPTIONS preflight)
  echo "  ✓ Testing /api/auth/session (preflight) ..."
  RESPONSE=$(curl -s -X OPTIONS "${BASE_URL}/api/auth/session" \
    -H "Origin: ${ORIGIN}" \
    -H "Access-Control-Request-Method: GET" \
    -i)

  if echo "$RESPONSE" | grep -q "Access-Control-Allow-Origin: ${ORIGIN}"; then
    echo "    ✅ CORS header OK"
  else
    echo "    ❌ CORS header MISSING"
  fi

  if echo "$RESPONSE" | grep -q "Access-Control-Allow-Credentials: true"; then
    echo "    ✅ Credentials OK"
  else
    echo "    ❌ Credentials header MISSING"
  fi

  # Test 3: Labels endpoint (OPTIONS preflight)
  echo "  ✓ Testing /api/labels (preflight) ..."
  RESPONSE2=$(curl -s -X OPTIONS "${BASE_URL}/api/labels" \
    -H "Origin: ${ORIGIN}" \
    -H "Access-Control-Request-Method: GET" \
    -i)

  if echo "$RESPONSE2" | grep -q "Access-Control-Allow-Origin: ${ORIGIN}"; then
    echo "    ✅ CORS header OK"
  else
    echo "    ❌ CORS header MISSING"
  fi

  # Test 4: Reminders count (OPTIONS preflight)
  echo "  ✓ Testing /api/reminders/count (preflight) ..."
  RESPONSE3=$(curl -s -X OPTIONS "${BASE_URL}/api/reminders/count" \
    -H "Origin: ${ORIGIN}" \
    -H "Access-Control-Request-Method: GET" \
    -i)

  if echo "$RESPONSE3" | grep -q "Access-Control-Allow-Origin: ${ORIGIN}"; then
    echo "    ✅ CORS header OK"
  else
    echo "    ❌ CORS header MISSING"
  fi

  echo ""
done

echo "================================"
echo "✅ CORS teszt befejezve!"
echo ""
echo "Megjegyzés: Az authentikációs endpoint-ok 401-et adnak vissza"
echo "session nélkül, de a CORS header-eknek jelen kell lenniük!"
