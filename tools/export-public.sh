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
echo "verify before pushing:"
echo "  grep -rIn '/home/\|/mnt/data\|espeak-ng-portable' $DEST | grep -v corpus/mined   # expect none"
echo "  grep -rIn 'docs/investigations' $DEST                                            # expect none"
