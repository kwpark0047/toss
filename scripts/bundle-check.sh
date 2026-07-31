#!/bin/bash
# Bundle size monitoring script
# Usage: npm run bundle:check

set -e

DIST_DIR="frontend/dist"

if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Build directory not found: $DIST_DIR"
  echo "   Run: npm run cloudflare-build first"
  exit 1
fi

echo "=== Bundle Size Report ==="
echo ""

# Get total size
TOTAL_SIZE=$(du -sb "$DIST_DIR" | cut -f1)
TOTAL_KB=$((TOTAL_SIZE / 1024))

echo "📊 Total dist size: ${TOTAL_KB}KB (${TOTAL_SIZE} bytes)"
echo ""

# Analyze individual files
echo "📁 File breakdown:"
echo "─────────────────────────────────"

for file in "$DIST_DIR"/assets/*.js "$DIST_DIR"/assets/*.css; do
  if [ -f "$file" ]; then
    SIZE=$(du -b "$file" | cut -f1)
    SIZE_KB=$((SIZE / 1024))
    NAME=$(basename "$file")
    if [ ${#NAME} -gt 30 ]; then
      NAME="${NAME:0:27}..."
    fi
    printf "  %-30s %6dKB\n" "$NAME" "$SIZE_KB"
  fi
done

echo "─────────────────────────────────"

# Check main bundle against limit
# index.html의 <script type="module"> 엔트리 스크립트를 기준으로 main 번들을 측정한다.
# (lazy chunk가 더 클 수 있으므로 단순 "가장 큰 index-*.js"로는 오판 가능)
ENTRY_JS=$(grep -oP '<script type="module"[^>]*src="[^"]*"' "$DIST_DIR/index.html" | grep -oP 'src="\K[^"]*')
MAIN_BUNDLE=""
if [ -n "$ENTRY_JS" ]; then
  MAIN_BUNDLE="${DIST_DIR}/${ENTRY_JS#/}"
fi

if [ -n "$MAIN_BUNDLE" ] && [ -f "$MAIN_BUNDLE" ]; then
  MAIN_SIZE=$(du -b "$MAIN_BUNDLE" | cut -f1)
  MAIN_KB=$((MAIN_SIZE / 1024))
  LIMIT_KB=600

  echo ""
  echo "🎯 Main bundle: ${MAIN_KB}KB (${MAIN_BUNDLE#$DIST_DIR/}, limit: ${LIMIT_KB}KB)"
else
  echo ""
  echo "❌ Main bundle (entry script) not found in $DIST_DIR/index.html"
  exit 1
fi

  if [ "$MAIN_SIZE" -gt $((LIMIT_KB * 1024)) ]; then
    echo "❌ Main bundle exceeds ${LIMIT_KB}KB limit by $(( (MAIN_KB - LIMIT_KB) ))KB"
    exit 1
  elif [ "$MAIN_SIZE" -gt $((LIMIT_KB * 1024 * 90 / 100)) ]; then
    echo "⚠️  Main bundle is approaching limit (${MAIN_KB}KB / ${LIMIT_KB}KB)"
  else
    echo "✅ Main bundle within limits"
  fi

  # Percentage
  PERCENT=$((MAIN_SIZE * 100 / (LIMIT_KB * 1024)))
  echo "   Progress: ${PERCENT}% of limit"
fi

echo ""
echo "=== Report Complete ==="
