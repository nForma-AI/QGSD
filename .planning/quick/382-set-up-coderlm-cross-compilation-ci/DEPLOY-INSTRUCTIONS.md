# Deploying coderlm CI Workflow

## Steps

1. Clone the coderlm repo (or use existing checkout):
   ```bash
   git clone https://github.com/nForma-AI/coderlm.git
   cd coderlm
   ```

2. Copy the workflow file:
   ```bash
   mkdir -p .github/workflows
   cp /path/to/382-set-up-coderlm-cross-compilation-ci/coderlm-ci-release.yml .github/workflows/release.yml
   ```

3. Commit and push:
   ```bash
   git checkout -b ci/cross-compilation-release
   git add .github/workflows/release.yml
   git commit -m "ci: add cross-compilation release workflow for 4 platforms"
   git push -u origin ci/cross-compilation-release
   ```

4. Open PR and merge to main.

5. Test by creating a tag:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

6. Verify: Go to https://github.com/nForma-AI/coderlm/releases -- the v0.1.0 release should appear with 4 binary assets and 4 checksum files.

## Binary Asset Names

| Asset | Platform |
|---|---|
| coderlm-darwin-arm64 | macOS Apple Silicon |
| coderlm-darwin-x64 | macOS Intel |
| coderlm-linux-x64 | Linux x86_64 |
| coderlm-linux-arm64 | Linux ARM64 |

## Checksum Files

Each binary has an associated SHA256 checksum file (e.g., `coderlm-darwin-arm64.sha256`). You can verify binary integrity:

```bash
sha256sum -c coderlm-darwin-arm64.sha256
```

## Downloading in nForma (future)

Once published, binaries can be fetched via:

```bash
VERSION="v0.1.0"  # Replace with actual version tag
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')

gh release download "$VERSION" --repo nForma-AI/coderlm \
  --pattern "coderlm-${OS}-${ARCH}" \
  --output coderlm

chmod +x coderlm
```

## Workflow Details

The workflow:
- **Triggers**: On any git tag matching `v*` (e.g., `v0.1.0`, `v1.0.0-rc.1`)
- **Builds**: Cross-compiles for all 4 platforms in parallel with `fail-fast: false`
- **Artifacts**: Generates SHA256 checksums alongside each binary
- **Release**: Creates a GitHub Release with all 4 binaries and checksum files
- **Idempotent**: Re-running on the same tag tag uses `gh release upload --clobber` instead of create
