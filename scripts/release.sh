#!/usr/bin/env bash
set -euo pipefail

# release.sh — Atomic release: validate, tag, push, and trigger CI/CD pipeline.
#
# Usage:
#   bash scripts/release.sh              # release current package.json version
#   bash scripts/release.sh --dry-run    # show what would happen without doing it
#
# What it does:
#   1. Validates working tree is clean (no uncommitted changes)
#   2. Reads version from package.json
#   3. Validates CHANGELOG.md has an entry for this version
#   4. Validates the git tag doesn't already exist
#   5. Runs test:ci to ensure tests pass
#   6. Creates an annotated git tag vX.Y.Z
#   7. Pushes commit + tag to origin (triggers release.yml → publish.yml)
#
# The GitHub Actions pipeline then:
#   - release.yml: creates GitHub Release from tag
#   - publish.yml: runs tests, builds, publishes to npm with provenance

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN — no changes will be made ==="
  echo ""
fi

# --- 1. Check working tree ---
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree is not clean. Commit or stash changes first."
  echo ""
  git status --short
  exit 1
fi

# --- 2. Read version from package.json ---
VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

echo "Version:  ${VERSION}"
echo "Tag:      ${TAG}"
echo "Branch:   $(git branch --show-current)"
echo ""

# --- 3. Validate CHANGELOG entry ---
if ! grep -q "## \[${VERSION}\]" CHANGELOG.md; then
  echo "ERROR: CHANGELOG.md has no entry for [${VERSION}]"
  echo "Add a ## [${VERSION}] - $(date +%Y-%m-%d) section before releasing."
  exit 1
fi
echo "CHANGELOG: found entry for [${VERSION}]"

# --- 4. Check tag doesn't exist ---
if git tag -l "$TAG" | grep -q "$TAG"; then
  echo "ERROR: Tag ${TAG} already exists."
  echo "If you need to re-release, delete the tag first:"
  echo "  git tag -d ${TAG} && git push origin :refs/tags/${TAG}"
  exit 1
fi
echo "Tag:       ${TAG} does not exist yet"

# --- 5. Check npm version isn't already published ---
NPM_VERSION=$(npm view "@nforma.ai/nforma@${VERSION}" version 2>/dev/null || echo "")
if [[ -n "$NPM_VERSION" ]]; then
  echo "ERROR: Version ${VERSION} is already published on npm."
  echo "Bump the version in package.json first."
  exit 1
fi
echo "npm:       ${VERSION} not yet published"
echo ""

# --- 6. Run tests ---
echo "=== Running tests ==="
npm run test:ci
echo ""
echo "=== Tests passed ==="
echo ""

# --- 7. Extract changelog section for tag body ---
# Grab everything between ## [VERSION] and the next ## [
CHANGELOG_BODY=$(awk "/^## \[${VERSION}\]/{found=1; next} /^## \[/{if(found) exit} found{print}" CHANGELOG.md)

if [[ -z "$CHANGELOG_BODY" ]]; then
  CHANGELOG_BODY="Release ${VERSION}"
fi

# --- 8. Create annotated tag ---
echo "=== Creating tag ${TAG} ==="
if $DRY_RUN; then
  echo "[dry-run] Would create annotated tag: ${TAG}"
  echo "[dry-run] Tag message:"
  echo "  ${TAG}"
  echo ""
  echo "$CHANGELOG_BODY" | sed 's/^/  /'
else
  git tag -a "$TAG" -m "${TAG}

${CHANGELOG_BODY}"
  echo "Created tag ${TAG}"
fi
echo ""

# --- 9. Push commit + tag atomically ---
BRANCH=$(git branch --show-current)
echo "=== Pushing ${BRANCH} + ${TAG} to origin ==="
if $DRY_RUN; then
  echo "[dry-run] Would run: git push origin ${BRANCH} ${TAG}"
else
  git push origin "${BRANCH}" "${TAG}"
  echo ""
  echo "Pushed successfully."
fi

echo ""
echo "=== Release pipeline triggered ==="
echo ""
echo "  1. release.yml  → Creates GitHub Release"
echo "  2. publish.yml  → Tests + publishes to npm"
echo ""
echo "Monitor: gh run list --limit 5"
echo "Check npm: npm view @nforma.ai/nforma version"
