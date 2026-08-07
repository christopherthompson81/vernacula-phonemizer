#!/usr/bin/env bash
# Export a clean tree for the public repository.
#
# Use this rather than copying the working directory: the working tree carries ~5.5 GB of .venv,
# a 66 MB tools/corpus/.cache, gitignored model intermediates, and any *.scratch.* handoff files.
# `git archive` emits exactly the tracked set, which is what the licensing map and NOTICE describe.
#
#   tools/export-public.sh ../vernacula-phonemizer-public
set -euo pipefail
DEST="${1:?usage: export-public.sh <destination-dir>}"
[ -e "$DEST" ] && { echo "refusing: $DEST already exists" >&2; exit 1; }
mkdir -p "$DEST"
git archive HEAD | tar -x -C "$DEST"
rm -rf "$DEST/docs/investigations"          # per-language bring-up logs — not published
echo "exported $(find "$DEST" -type f | wc -l) files to $DEST"
echo
echo
echo "verifying the export:"
# corpus/mined carries Wikipedia text that legitimately contains these shapes; this script and
# packaging.test.ts name docs/investigations on purpose, so both are excluded from their own check.
SKIP='corpus/mined|export-public.sh|packaging.test.ts'
# `Run N` cites docs/investigations, which the line above deletes — so every such reference is a
# pointer to something the published tree does not contain. Checked here because nothing else can:
# they accumulated to 107 across src/, tools/ and test/ (37 of them inside test NAMES) unnoticed.
for pat in '/home/[a-z]|/mnt/data|~/Programming' 'espeak-ng-portable' 'docs/investigations' '\bRun[ -][0-9]+'; do
    n=$( { grep -rInE "$pat" "$DEST" 2>/dev/null || true; } | { grep -vE "$SKIP" || true; } | wc -l)
    if [ "$n" -eq 0 ]; then echo "  ok    no $pat"; else
        echo "  FAIL  $n hits for $pat"
        { grep -rInE "$pat" "$DEST" 2>/dev/null || true; } | { grep -vE "$SKIP" || true; } | head -5 | sed "s|^|        |"
    fi
done
