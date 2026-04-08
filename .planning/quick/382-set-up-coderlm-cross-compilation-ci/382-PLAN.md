---
phase: quick-382
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/382-set-up-coderlm-cross-compilation-ci/coderlm-ci-release.yml
autonomous: true
formal_artifacts: none
requirements: [INTENT-01]

must_haves:
  truths:
    - "Workflow triggers on tag push matching v* pattern only"
    - "Four platform targets are compiled: darwin-arm64, darwin-x64, linux-x64, linux-arm64"
    - "Compiled binaries are uploaded as GitHub Release assets on tag push"
    - "macOS cross-compilation uses appropriate runner (macos-latest for native arm64, macos-13 for x64)"
    - "Linux cross-compilation uses cross-rs for arm64 and native build for x64"
    - "Workflow is idempotent: re-running on same tag does not fail"
  artifacts:
    - path: ".planning/quick/382-set-up-coderlm-cross-compilation-ci/coderlm-ci-release.yml"
      provides: "GitHub Actions workflow for cross-compiled Rust binary releases"
      contains: "on:\n  push:\n    tags:"
  key_links:
    - from: "coderlm-ci-release.yml build jobs"
      to: "release job"
      via: "needs: [build-macos, build-linux]"
      pattern: "needs:.*build"
---

<objective>
Create a GitHub Actions workflow file for the nForma-AI/coderlm repository that cross-compiles the Rust binary for four platforms (darwin-arm64, darwin-x64, linux-x64, linux-arm64) and publishes them as GitHub Release assets on tag push.

Purpose: Enable automated binary distribution so nForma can fetch pre-built coderlm binaries instead of requiring users to have a Rust toolchain installed.

Output: A ready-to-commit workflow YAML file at `.planning/quick/382-set-up-coderlm-cross-compilation-ci/coderlm-ci-release.yml` with instructions for deploying to the coderlm repo.
</objective>

<execution_context>
@./.claude/nf/workflows/execute-plan.md
@./.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@docs/coderlm-integration.md
@.github/workflows/release.yml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create cross-compilation CI workflow for coderlm</name>
  <files>.planning/quick/382-set-up-coderlm-cross-compilation-ci/coderlm-ci-release.yml</files>
  <action>
Create a GitHub Actions workflow YAML file that will be placed at `.github/workflows/release.yml` in the coderlm repo. The workflow must:

**Trigger:** `on: push: tags: ['v*']` -- only fires on version tags.

**Strategy -- use a matrix with 4 platform entries:**

| target-triple | runner | cargo-tool | binary-suffix |
|---|---|---|---|
| aarch64-apple-darwin | macos-latest (arm64 native) | cargo (native) | coderlm-darwin-arm64 |
| x86_64-apple-darwin | macos-13 (Intel runner) | cargo (native) | coderlm-darwin-x64 |
| x86_64-unknown-linux-gnu | ubuntu-latest | cargo (native) | coderlm-linux-x64 |
| aarch64-unknown-linux-gnu | ubuntu-latest | cross | coderlm-linux-arm64 |

**Build job (`build`):**
1. `actions/checkout@v4`
2. Install Rust stable via `dtolnay/rust-toolchain@stable` with the matrix target added
3. For linux-arm64 only: install `cross-rs/cross-action@v1` (provides `cross` binary)
4. Build:
   - If matrix has `use_cross: true`: `cross build --release --target ${{ matrix.target }}`
   - Otherwise: `cargo build --release --target ${{ matrix.target }}`
5. Rename binary: `cp target/${{ matrix.target }}/release/coderlm ${{ matrix.binary_name }}`
6. Upload artifact: `actions/upload-artifact@v4` with `name: ${{ matrix.binary_name }}` and `path: ${{ matrix.binary_name }}`

**Release job (`release`):**
1. `needs: [build]`
2. `runs-on: ubuntu-latest`
3. `permissions: contents: write`
4. Download all artifacts: `actions/download-artifact@v4` with `merge-multiple: true`
5. Create GitHub Release with all 4 binaries attached:
   ```
   gh release create ${{ github.ref_name }} \
     --title "${{ github.ref_name }}" \
     --generate-notes \
     coderlm-darwin-arm64 \
     coderlm-darwin-x64 \
     coderlm-linux-x64 \
     coderlm-linux-arm64
   ```
   Uses `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.
6. Add a check: if release already exists, use `gh release upload` instead of `create` (idempotency).

**Matrix definition in the build job:**
```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - target: aarch64-apple-darwin
        runner: macos-latest
        binary_name: coderlm-darwin-arm64
        use_cross: false
      - target: x86_64-apple-darwin
        runner: macos-13
        binary_name: coderlm-darwin-x64
        use_cross: false
      - target: x86_64-unknown-linux-gnu
        runner: ubuntu-latest
        binary_name: coderlm-linux-x64
        use_cross: false
      - target: aarch64-unknown-linux-gnu
        runner: ubuntu-latest
        binary_name: coderlm-linux-arm64
        use_cross: true
```

**Important details:**
- Set `fail-fast: false` so one platform failure does not cancel others.
- The `GITHUB_TOKEN` permissions only need `contents: write` (for release creation).
- Use `dtolnay/rust-toolchain@stable` (not `actions-rs/toolchain` which is archived).
- Use `cross-rs/cross-action@v1` to install cross (not cargo install which is slow).
- Binary name in release asset must NOT include path prefix -- just the bare name.
- Add a concurrency group `release-${{ github.ref }}` with `cancel-in-progress: false` to prevent duplicate release runs.
  </action>
  <verify>
Validate the YAML is syntactically correct:

```bash
node << 'NF_EVAL'
const fs = require('fs');
const path = '.planning/quick/382-set-up-coderlm-cross-compilation-ci/coderlm-ci-release.yml';
const content = fs.readFileSync(path, 'utf8');

// Check required patterns
const checks = [
  ['tag trigger', /on:\s*\n\s+push:\s*\n\s+tags:/],
  ['4 matrix entries', /aarch64-apple-darwin[\s\S]*x86_64-apple-darwin[\s\S]*x86_64-unknown-linux-gnu[\s\S]*aarch64-unknown-linux-gnu/],
  ['cross for arm64 linux', /use_cross:\s*true/],
  ['upload-artifact', /actions\/upload-artifact/],
  ['download-artifact', /actions\/download-artifact/],
  ['gh release create', /gh release create/],
  ['rust-toolchain', /dtolnay\/rust-toolchain/],
  ['fail-fast false', /fail-fast:\s*false/],
  ['contents write', /contents:\s*write/],
  ['4 binary names', /coderlm-darwin-arm64[\s\S]*coderlm-darwin-x64[\s\S]*coderlm-linux-x64[\s\S]*coderlm-linux-arm64/],
];

let pass = 0;
for (const [name, re] of checks) {
  if (re.test(content)) { pass++; console.log('PASS: ' + name); }
  else { console.log('FAIL: ' + name); }
}
console.log('\n' + pass + '/' + checks.length + ' checks passed');
process.exit(pass === checks.length ? 0 : 1);
NF_EVAL
```
  </verify>
  <done>
A complete GitHub Actions workflow YAML exists at `.planning/quick/382-set-up-coderlm-cross-compilation-ci/coderlm-ci-release.yml` that:
- Triggers on v* tag push
- Builds coderlm for all 4 platform targets using appropriate runners and toolchains
- Publishes all 4 binaries as GitHub Release assets
- Is idempotent (handles pre-existing releases)
  </done>
</task>

<task type="auto">
  <name>Task 2: Write deployment instructions and update integration docs</name>
  <files>
    .planning/quick/382-set-up-coderlm-cross-compilation-ci/DEPLOY-INSTRUCTIONS.md
    docs/coderlm-integration.md
  </files>
  <action>
**DEPLOY-INSTRUCTIONS.md:** Create a short deployment guide with exact steps to push the workflow to the coderlm repo:

```markdown
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

6. Verify: Go to https://github.com/nForma-AI/coderlm/releases -- the v0.1.0 release should appear with 4 binary assets.

## Binary Asset Names

| Asset | Platform |
|---|---|
| coderlm-darwin-arm64 | macOS Apple Silicon |
| coderlm-darwin-x64 | macOS Intel |
| coderlm-linux-x64 | Linux x86_64 |
| coderlm-linux-arm64 | Linux ARM64 |

## Downloading in nForma (future)

Once published, binaries can be fetched via:
```bash
gh release download v0.1.0 --repo nForma-AI/coderlm --pattern "coderlm-$(uname -s | tr A-Z a-z)-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')"
```
```

**docs/coderlm-integration.md update:** Append a new section `## Binary Distribution` before the existing `## Future Enhancements` section. Content:

```markdown
## Binary Distribution

Pre-built coderlm binaries are published to GitHub Releases in the [coderlm repository](https://github.com/nForma-AI/coderlm/releases) via CI. The release workflow cross-compiles for four platforms:

| Binary Asset | Target | Runner |
|---|---|---|
| `coderlm-darwin-arm64` | macOS Apple Silicon (aarch64) | macos-latest |
| `coderlm-darwin-x64` | macOS Intel (x86_64) | macos-13 |
| `coderlm-linux-x64` | Linux x86_64 | ubuntu-latest |
| `coderlm-linux-arm64` | Linux ARM64 (aarch64) | ubuntu-latest + cross |

Releases are triggered automatically when a version tag (`v*`) is pushed to the coderlm repo.

To download the binary for your platform:

\`\`\`bash
# Determine platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')

# Download latest release
gh release download --repo nForma-AI/coderlm --pattern "coderlm-${OS}-${ARCH}" --output coderlm
chmod +x coderlm
\`\`\`
```

Do NOT remove or modify any existing content in `docs/coderlm-integration.md` -- only insert the new section.
  </action>
  <verify>
```bash
# Verify DEPLOY-INSTRUCTIONS.md exists and has key content
grep -q "git clone" .planning/quick/382-set-up-coderlm-cross-compilation-ci/DEPLOY-INSTRUCTIONS.md && echo "PASS: deploy instructions exist" || echo "FAIL"

# Verify docs/coderlm-integration.md has new section
grep -q "## Binary Distribution" docs/coderlm-integration.md && echo "PASS: binary distribution section added" || echo "FAIL"

# Verify existing content preserved (spot check)
grep -q "## Architecture" docs/coderlm-integration.md && echo "PASS: existing content preserved" || echo "FAIL"
grep -q "## Future Enhancements" docs/coderlm-integration.md && echo "PASS: future section preserved" || echo "FAIL"
```
  </verify>
  <done>
- DEPLOY-INSTRUCTIONS.md exists with exact steps to push the workflow to coderlm repo
- docs/coderlm-integration.md has a new "Binary Distribution" section documenting the 4 platform binaries and download instructions
- All existing content in coderlm-integration.md is preserved
  </done>
</task>

</tasks>

<verification>
1. `coderlm-ci-release.yml` passes all 10 structural checks (tag trigger, 4 targets, cross usage, artifact upload/download, release creation, toolchain, fail-fast, permissions, binary names)
2. DEPLOY-INSTRUCTIONS.md provides actionable steps for a human to push the workflow to the coderlm repo
3. `docs/coderlm-integration.md` documents binary distribution without modifying existing content
</verification>

<success_criteria>
- A production-ready GitHub Actions workflow YAML exists that will cross-compile coderlm for 4 platforms and publish to GitHub Releases
- Clear deployment instructions exist for pushing to the coderlm repo
- Integration docs are updated to reflect the new binary distribution channel
</success_criteria>

<output>
After completion, create `.planning/quick/382-set-up-coderlm-cross-compilation-ci/382-SUMMARY.md`
</output>
