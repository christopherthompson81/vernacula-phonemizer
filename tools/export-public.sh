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
# docs/investigations/ IS published (decided with the tree reorganisation into <lang>/ and <topic>/ folders):
# the root-level logs always were, and 200+ code comments cite them by path.
echo "exported $(find "$DEST" -type f | wc -l) files to $DEST"
echo
echo
echo "verifying the export:"
# corpus/mined carries Wikipedia text that legitimately contains these shapes; this script is excluded
# from its own check.
SKIP='corpus/mined|export-public.sh'
# (The `docs/investigations` and `Run N` patterns that stood here guarded a tree that deleted the logs;
# with the logs published, a citation of one is a link, not a leak.)
for pat in '/home/[a-z]|/mnt/data|~/Programming' 'espeak-ng-portable'; do
    n=$( { grep -rInE "$pat" "$DEST" 2>/dev/null || true; } | { grep -vE "$SKIP" || true; } | wc -l)
    if [ "$n" -eq 0 ]; then echo "  ok    no $pat"; else
        echo "  FAIL  $n hits for $pat"
        { grep -rInE "$pat" "$DEST" 2>/dev/null || true; } | { grep -vE "$SKIP" || true; } | head -5 | sed "s|^|        |"
    fi
done
