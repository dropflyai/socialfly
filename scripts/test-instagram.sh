#!/bin/bash
# Quick test script to check if Instagram API connection is working
# Run: bash scripts/test-instagram.sh

TOKEN="EAAUKhXTK0FYBQZBIAS2JpAz3afiN5xONPT7mdnsSPk7QHqzZA6ItZAmBOMRZCeu5cs2nuo5XT6dTlZCu3cyxEgYEpuj2HEbZBglB1ZAZAdisAr20ZAigCu0M4cD4eV5uIydm8LZBm19vtGS8PjZAM7S2YIuNEG3IVQ7PaG0E4ncZC9Nx7hTbpcOfhZBToX358XoOGZCCVo20bArnXbNePaCednF1A9IfXFNkl0koem4VAx6EENrdkZBBdcoOjDKdQSGnGpvSWe5CCbkF30kZCd9b2ZBnSXgZDZD"
PAGE_ID="759992503856032"

echo "=== Testing Instagram API Connection ==="
echo ""

echo "1. Getting page info and Instagram business account..."
RESULT=$(curl -s "https://graph.facebook.com/v21.0/$PAGE_ID?fields=name,instagram_business_account&access_token=$TOKEN")
echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
echo ""

# Check if instagram_business_account exists in response
if echo "$RESULT" | grep -q "instagram_business_account"; then
  IG_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['instagram_business_account']['id'])" 2>/dev/null)
  echo "SUCCESS! Instagram Account ID: $IG_ID"
  echo ""

  echo "2. Getting Instagram profile..."
  curl -s "https://graph.facebook.com/v21.0/$IG_ID?fields=id,username,name,profile_picture_url,followers_count&access_token=$TOKEN" | python3 -m json.tool
  echo ""
  echo "Instagram API is READY! You can now publish posts."
else
  echo "NOT READY YET - Instagram business account not linked in API."
  echo "The Meta link between dropfly.ai and DropFly.AI page may still be propagating."
  echo "Try again in a few minutes."
fi
