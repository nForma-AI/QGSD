# Decimal Phase Calculation

Calculate the next decimal phase number for urgent insertions.

## Find Existing Decimals

For a given integer phase, find all existing decimal phases:

```bash
# Find decimal phases after integer phase N (e.g., 06.1, 06.2)
AFTER_PHASE=$1  # e.g., 6

# Pad to 2 digits
PADDED=$(printf "%02d" "$AFTER_PHASE")

# Find existing decimals
EXISTING=$(ls -d .planning/phases/${PADDED}.*-* 2>/dev/null | \
  xargs -I{} basename {} | \
  grep -oE '^[0-9]+\.[0-9]+' | \
  sort -V)
```

## Calculate Next Decimal

Find the highest decimal suffix and increment:

```bash
if [ -z "$EXISTING" ]; then
  # No decimals exist, start at .1
  NEXT_DECIMAL="1"
else
  # Get highest decimal suffix
  MAX_SUFFIX=$(echo "$EXISTING" | tail -1 | grep -oE '\.[0-9]+$' | tr -d '.')
  NEXT_DECIMAL=$((MAX_SUFFIX + 1))
fi

# Format: 06.1, 06.2, etc.
DECIMAL_PHASE="${PADDED}.${NEXT_DECIMAL}"
```

## Examples

| Existing Phases | Next Phase |
|-----------------|------------|
| 06 only | 06.1 |
| 06, 06.1 | 06.2 |
| 06, 06.1, 06.2 | 06.3 |

## Directory Naming

Decimal phase directories use the full decimal number:

```bash
SLUG=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
PHASE_DIR=".planning/phases/${DECIMAL_PHASE}-${SLUG}"
mkdir -p "$PHASE_DIR"
```

Example: `.planning/phases/06.1-fix-critical-auth-bug/`
