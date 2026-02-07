# Phase Argument Parsing

Parse and normalize phase arguments for commands that operate on phases.

## Extraction

From `$ARGUMENTS`:
- Extract phase number (first numeric argument)
- Extract flags (prefixed with `--`)
- Remaining text is description (for insert/add commands)

## Normalization

Zero-pad integer phases to 2 digits. Preserve decimal suffixes.

```bash
# Normalize phase number
if [[ "$PHASE" =~ ^[0-9]+$ ]]; then
  # Integer: 8 → 08
  PHASE=$(printf "%02d" "$PHASE")
elif [[ "$PHASE" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  # Decimal: 2.1 → 02.1
  PHASE=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
fi
```

## Auto-Detection

When no phase number provided, detect the next unplanned phase:

```bash
# Find phases without PLAN.md files
for dir in .planning/phases/*/; do
  if ! ls "$dir"/*-PLAN.md 2>/dev/null | head -1 >/dev/null; then
    PHASE=$(basename "$dir" | grep -oE '^[0-9.]+')
    break
  fi
done
```

## Validation

After normalization, verify phase exists in ROADMAP.md:

```bash
grep -q "### Phase ${PHASE}:" .planning/ROADMAP.md || {
  echo "ERROR: Phase ${PHASE} not found in roadmap"
  exit 1
}
```

## Directory Lookup

Find the phase directory using the normalized phase number:

```bash
PHASE_DIR=$(ls -d .planning/phases/${PHASE}-* 2>/dev/null | head -1)
```
