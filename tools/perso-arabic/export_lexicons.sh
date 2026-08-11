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
    # ⚠ BUILD TO A TEMP FILE AND MOVE ONLY ON SUCCESS. `{ … } > "$out"` TRUNCATES $out the moment the block opens,
    # so under `set -e` any failure inside it — a missing input to the licence count, a bad awk — leaves the
    # SHIPPED lexicon destroyed rather than merely unchanged. That is not hypothetical: it was reproduced here by
    # renaming silver.espeak-ps.tsv away, which is the deliberately-uncommitted file, i.e. the state of every
    # fresh checkout. pashto/lexicon.tsv came out as three header lines and ZERO rows, with a clean-looking run.
    tmp="$(mktemp)"; body="$(mktemp)"
    trap 'rm -f "$tmp" "$body"' EXIT
    # ⚠ BODY FIRST, HEADER SECOND. The licence sentence counts rows, so it has to count the rows that actually
    # SHIP — i.e. after the identity-drop and the dedup below, not the miner's raw output. Built the other way
    # round, the header claimed "13861" for a file holding 13,828.
    # ⚠ ONE ROW PER KEY, ENFORCED HERE — the miner's own `seenSkel` dedup is PER-PROCESS and `--shard=k/N`
    # runs N processes, so a skeleton occurring twice in the input can land in two shards and survive the
    # concatenation twice. Measured on the 2026-08-10 ps re-mine: 24 duplicate keys, and 6 of them carried
    # two DIFFERENT vocalizations — so which reading shipped depended on the loader's last-wins behaviour
    # over an arbitrary sort order. `sort -u` would not have caught those six; it only drops identical rows.
    # Keeping the first after a full sort makes the export deterministic and idempotent under any sharding.
    awk -F'\t' '$1!=$3{print $1"\t"$3}' "$src" | LC_ALL=C sort | awk -F'\t' '!seen[$1]++' > "$body"
    {
        echo "# Harakat restoration lexicon (COVERAGE layer) — undiacritized skeleton ⇥ our vocalization."
        if [ "$L" = "ps" ]; then
            # ⚠ ps IS NOT CC-BY-SA LIKE ITS SIBLINGS. Its silver includes espeak-ng dictsource/ps_list
            # (GPL-3.0), which supplies 89.6% of the rows, so the file is fenced GPL-3.0 per
            # LICENSES/PROVENANCE.md §4 item 3. Emitting the sibling header here would mislabel it.
            echo "# ⚠ LICENCE: GPL-3.0 (per-file fence) — NOT CC-BY-SA like the sibling riders."
            echo "# Source: g2p-inversion over espeak-ng dictsource/ps_list (GPL-3.0, Hanif Rahman) + wikipron + kaikki."
            # ⚠ COUNTED, NOT TYPED. This sentence is a LICENCE claim living in a shipped file, and it was hard-coded
            # ("9,588 of 10,698") until the 2026-08-10 re-mine grew the lexicon 29% and left it silently false.
            # espeak-only = the key is in the GPL pool and in NO CC-BY-SA pool, i.e. the row would vanish without
            # espeak. Counted over the exported (non-identity) rows, which is what the file actually ships.
            # ⚠ THE CC POOLS ARE FILTERED TO $2=="pus", WHICH IS NOT PEDANTRY. `silver.tsv` is MULTI-LANGUAGE, and
            # Perso-Arabic spellings collide across ur/fa/pa/ps — counting every language's keys marked 860 rows as
            # CC-reachable that the ps miner could never have produced from them (it filters lang=="pus"), and
            # understated the GPL share as 12,512 where it is 13,372. A licence sentence has to count the rows this
            # build could actually reach. (silver.espeak-ps.tsv is single-language, so it needs no filter.)
            # ⚠ THE CC POOL IS THREE FILES, NOT TWO. ps.wiktionary (silver.pswikt-ps.tsv, CC-BY-SA) joined in
            # 2026-08-10; until it was added here, a word reachable from BOTH espeak and ps.wiktionary counted as
            # espeak-only and overstated the GPL share — a licence claim drifting because a source was added
            # elsewhere. Any new ps tranche must be added to this regex and to the guard above.
            total=$(wc -l < "$body")
            # ⚠ AND THE COUNT NEEDS ITS INPUTS, WHICH THE COMMON CASE DOES NOT HAVE. silver.espeak-ps.tsv is
            # deliberately not committed (2.5 MB of GPL-derived intermediate), so a fresh checkout cannot
            # substantiate this licence claim. Say that, rather than crash or — far worse — print a plausible
            # wrong number into a file whose whole job is to state its provenance accurately.
            if [ -f "$HERE/silver.espeak-ps.tsv" ] && [ -f "$HERE/silver.tsv" ] && [ -f "$HERE/silver.kaikki.tsv" ] && [ -f "$HERE/silver.pswikt-ps.tsv" ]; then
                gpl_only=$(awk -F'\t' '
                    FNR==NR   { if ($0 !~ /^#/ && NF) esp[$1]=1; next }
                    FILENAME ~ /silver\.(tsv|kaikki\.tsv|pswikt-ps\.tsv)$/ { if ($0 !~ /^#/ && $2 == "pus") cc[$1]=1; next }
                    ($1 in esp) && !($1 in cc) { n++ }
                    END { print n+0 }
                ' "$HERE/silver.espeak-ps.tsv" "$HERE/silver.tsv" "$HERE/silver.kaikki.tsv" \
                  "$HERE/silver.pswikt-ps.tsv" "$body")
                echo "# ${gpl_only} of ${total} rows are reachable only from the GPL source. Only the SHORT-VOWEL PLACEMENT"
            else
                echo "⚠ ps: silver pools missing — the GPL-only row count cannot be recomputed; header says so." >&2
                echo "# MOST of these ${total} rows are reachable only from the GPL source (the exact count could not"
                echo "# be recomputed at export: the silver pools were absent). Only the SHORT-VOWEL PLACEMENT"
            fi
            echo "# derives from it — espeak's phoneme strings are never copied; the consonants are our g2p's."
            echo "# See src/languages/pashto/lexicon.PROVENANCE.md and LICENSES/PROVENANCE.md §4."
        else
            echo "# Source: g2p-inversion over wikipron + kaikki + (ur) Hindi→Urdu real spellings; CC-BY-SA."
        fi
        echo "# Regenerate: tools/perso-arabic/invert_harakat.ts --lexicon → tools/perso-arabic/export_lexicons.sh"
        echo "# Non-identity rows only (a bare-skeleton row is a no-op — g2p already yields that IPA). See PROVENANCE.md."
        cat "$body"
    } > "$tmp"
    # ⚠ REFUSE TO SHIP AN EMPTY ONE. A lexicon with no rows is always a build accident, never an intent, and it
    # fails SILENTLY at runtime — `restoreHarakat` just stops correcting anything and the engine quietly reverts
    # to bare g2p. Same reasoning as the miner's missing-tranche guard.
    if [ "$(grep -cv '^#' "$tmp")" -eq 0 ]; then
        echo "⚠ $L: export produced ZERO rows — $out left untouched. Check $src." >&2
        continue
    fi
    mv "$tmp" "$out"
    # ⚠ COUNT THE COMMENTS, DON'T ASSUME FOUR. ps prepends a longer licence header than its siblings, so the old
    # fixed `- 4` over-reported ps by exactly the extra comment lines — the reason this script said "13865 rows"
    # for a file holding 13,828.
    echo "$out: $(grep -cv '^#' "$out") rows"
done
