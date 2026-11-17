#!/usr/bin/env bash
# Optional helper: commit & push directly from Ubuntu /home/ubuntu/trc if git credentials/SSH key are configured
set -euo pipefail
REPO_URL="${1:-https://github.com/westwins/ai-tiger-history-colloquium.git}"
SRC_DIR="/home/ubuntu/trc"
WORK_DIR="$(mktemp -d /tmp/gh-sync-v31-XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

git clone "$REPO_URL" "$WORK_DIR"
cd "$WORK_DIR"
git checkout main

# Update tracked application directories from live /home/ubuntu/trc
for folder in backend frontend tools; do
  if [ -d "$SRC_DIR/$folder" ]; then
    rm -rf "$WORK_DIR/$folder"
    cp -a "$SRC_DIR/$folder" "$WORK_DIR/$folder"
    find "$WORK_DIR/$folder" -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
  fi
done

git add -A
if [ -n "$(git status --porcelain)" ]; then
  git commit -m "feat(v3.1): 네온 KDE·3D HGIS, 제주 4·3 다층 DB(15,218명), 실측 보정 ABM 및 선흘1리 무지개 에필로그 통합"
  git push origin main
  echo "[완료] GitHub main 브랜치 업로드 성공"
else
  echo "[안내] 변경 사항이 없습니다."
fi
