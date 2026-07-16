#!/usr/bin/env bash
# Export the mined per-language lexicons (invert_harakat.ts --lexicon output) into the SHIPPABLE data files that
# live beside each rider's g2p (src/languages/<lang>/lexicon.tsv). Strips to 2 columns (skeleton ⇥ vocalized),
# DROPS identity rows (a bare-skeleton vocalization is a no-op — the g2p already yields that IPA), sorts, and
# prepends a provenance header (loadTsvMap skips #-comment lines). This is the COVERAGE layer of the two-layer
# rider phonemizer (lexicon lookup → default g2p); see PROVENANCE.md and docs/arabic_script_restorer_investigation.md.
#
#   npx tsx invert_harakat.ts --lexicon all   # (re)mine lexicon.<lang>.tsv from all sources
#   ./export_lexicons.sh                       # → src/languages/<lang>/lexicon.tsv
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
declare -A DEST=( [ur]=urdu [fa]=persian [ps]=pashto [pa]=punjabi )
for L in ur fa ps pa; do
    src="$HERE/lexicon.$L.tsv"
    out="$HERE/../../src/languages/${DEST[$L]}/lexicon.tsv"
    [ -f "$src" ] || { echo "skip $L: $src missing"; continue; }
    {
        echo "# Harakat restoration lexicon (COVERAGE layer) — undiacritized skeleton ⇥ our vocalization."
        echo "# Source: g2p-inversion over wikipron + kaikki + (ur) Hindi→Urdu real spellings; CC-BY-SA."
        echo "# Regenerate: tools/arabic-restorer/invert_harakat.ts --lexicon → tools/arabic-restorer/export_lexicons.sh"
        echo "# Non-identity rows only (a bare-skeleton row is a no-op — g2p already yields that IPA). See PROVENANCE.md."
        awk -F'\t' '$1!=$3{print $1"\t"$3}' "$src" | LC_ALL=C sort
    } > "$out"
    echo "$out: $(($(wc -l < "$out") - 4)) rows"
done
