#!/usr/bin/env bash
# Export the mined per-language lexicons (invert_harakat.ts --lexicon output) into the SHIPPABLE data files that
# live beside each rider's g2p (src/languages/<lang>/lexicon.tsv). Strips to 2 columns (skeleton ⇥ vocalized),
# DROPS identity rows (a bare-skeleton vocalization is a no-op — the g2p already yields that IPA), sorts, and
# prepends a provenance header (loadTsvMap skips #-comment lines). This is the COVERAGE layer of the two-layer
# rider phonemizer (lexicon lookup → default g2p);
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
        if [ "$L" = "ps" ]; then
            # ⚠ ps IS NOT CC-BY-SA LIKE ITS SIBLINGS. Its silver includes espeak-ng dictsource/ps_list
            # (GPL-3.0), which supplies 89.6% of the rows, so the file is fenced GPL-3.0 per
            # LICENSES/PROVENANCE.md §4 item 3. Emitting the sibling header here would mislabel it.
            echo "# ⚠ LICENCE: GPL-3.0 (per-file fence) — NOT CC-BY-SA like the sibling riders."
            echo "# Source: g2p-inversion over espeak-ng dictsource/ps_list (GPL-3.0, Hanif Rahman) + wikipron + kaikki."
            # ⚠ COUNTED, NOT TYPED. This sentence is a LICENCE claim living in a shipped file, and it was hard-coded
            # ("9,588 of 10,698") until the 2026-08-10 re-mine grew the lexicon 30% and left it silently false.
            # espeak-only = the key is in the GPL pool and in NEITHER CC-BY-SA pool, i.e. the row would vanish
            # without espeak. Counted over the exported (non-identity) rows, which is what the file actually ships.
            total=$(awk -F'\t' '$1!=$3' "$src" | wc -l)
            gpl_only=$(awk -F'\t' '
                FNR==NR   { if ($0 !~ /^#/ && NF) esp[$1]=1; next }
                FILENAME ~ /silver\.(tsv|kaikki\.tsv)$/ { if ($0 !~ /^#/ && NF) cc[$1]=1; next }
                $1!=$3 && ($1 in esp) && !($1 in cc) { n++ }
                END { print n+0 }
            ' "$HERE/silver.espeak-ps.tsv" "$HERE/silver.tsv" "$HERE/silver.kaikki.tsv" "$src")
            echo "# ${gpl_only} of ${total} rows are reachable only from the GPL source. Only the SHORT-VOWEL PLACEMENT"
            echo "# derives from it — espeak's phoneme strings are never copied; the consonants are our g2p's."
            echo "# See src/languages/pashto/lexicon.PROVENANCE.md and LICENSES/PROVENANCE.md §4."
        else
            echo "# Source: g2p-inversion over wikipron + kaikki + (ur) Hindi→Urdu real spellings; CC-BY-SA."
        fi
        echo "# Regenerate: tools/perso-arabic/invert_harakat.ts --lexicon → tools/perso-arabic/export_lexicons.sh"
        echo "# Non-identity rows only (a bare-skeleton row is a no-op — g2p already yields that IPA). See PROVENANCE.md."
        awk -F'\t' '$1!=$3{print $1"\t"$3}' "$src" | LC_ALL=C sort
    } > "$out"
    # ⚠ COUNT THE COMMENTS, DON'T ASSUME FOUR. ps prepends a longer licence header than its siblings, so the old
    # fixed `- 4` over-reported ps by exactly the extra comment lines — the reason this script said "13865 rows"
    # for a file holding 13,861.
    echo "$out: $(grep -cv '^#' "$out") rows"
done
