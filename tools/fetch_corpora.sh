#!/usr/bin/env bash
# Fetch the training corpora that are NOT committed. See tools/CORPORA.md for licences and rebuild commands.
#
# ⚠ Exists because on 2026-08-19 four models could not be retrained for a known defect purely for want of a
#   download URL (investigation Run 45). Verifies checksums where upstream is a stable archive; the two that
#   are living sources (a git HEAD, a "latest" wiki dump) are flagged as such rather than pinned by hash.
#
#   bash tools/fetch_corpora.sh nb da he fa km        # or with no args: list what each would do
set -euo pipefail
DEST="${CORPORA_DIR:-/tmp/corpora}"
mkdir -p "$DEST"

get() {  # url sha256|SKIP name
    local url="$1" want="$2" out="$DEST/$3"
    [ -f "$out" ] || curl -fsSL -o "$out" "$url"
    if [ "$want" != "SKIP" ]; then
        local got; got=$(sha256sum "$out" | cut -d' ' -f1)
        [ "$got" = "$want" ] || { echo "CHECKSUM MISMATCH $3: want $want got $got" >&2; exit 1; }
        echo "  ok  $3 (sha256 verified)"
    else
        echo "  ok  $3 (living source — no pinned checksum)"
    fi
}

for lang in "${@:-none}"; do case "$lang" in
  nb) echo "nb — NST Norwegian (CC0) + OpenSubtitles freq (CC BY-SA)"
      get https://www.nb.no/sbfil/leksikalske_databaser/leksikon/no.leksikon.tar.gz \
          cef2a5f9690d058331f0f814f175109887bcdc7415e802e1523043b9c36e455b no.leksikon.tar.gz
      get https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/no/no_50k.txt SKIP no_50k.txt
      tar xzf "$DEST/no.leksikon.tar.gz" -C "$DEST"
      # ⚠ -type f: the tarball extracts a DIRECTORY named nor030224NST.pron that CONTAINS the .pron file
      echo "  → $(find "$DEST" -type f -name 'nor*NST.pron' | head -1)" ;;
  da) echo "da — NST Danish (CC0) + OpenSubtitles freq (CC BY-SA)"
      get https://www.nb.no/sbfil/leksikalske_databaser/leksikon/da_leksikon.tar.gz \
          c54a27fa45ea0773bc05ecdfd362044f59e7a9538d142e71b245b81e1bd40102 da_leksikon.tar.gz
      get https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/da/da_50k.txt SKIP da_50k.txt
      tar xzf "$DEST/da_leksikon.tar.gz" -C "$DEST"
      # ⚠ -type f: likewise a DIRECTORY named dan030224NST.pron containing the .pron file
      echo "  → $(find "$DEST" -type f -name 'dan*NST.pron' | head -1)" ;;
  he) echo "he — Nakdimon hebrew_diacritized (MIT; PERMISSIVE SUBSET ONLY — see CORPORA.md)"
      # ⚠ CHECK OUT THE PIN, do not merely print it. The first draft cloned HEAD and echoed the recorded hash
      # beside it, which reads like verification and is not: a corpus that has moved since would rebuild a
      # DIFFERENT model under the same instructions. HE_REF=HEAD to deliberately take current upstream.
      ref="${HE_REF:-1211c8f3edafd601922d4be473f678ff79c5a12c}"
      [ -d "$DEST/hebrew_diacritized" ] || git clone -q https://github.com/elazarg/hebrew_diacritized "$DEST/hebrew_diacritized"
      git -C "$DEST/hebrew_diacritized" fetch -q --depth 1 origin "$ref" 2>/dev/null || git -C "$DEST/hebrew_diacritized" fetch -q origin
      git -C "$DEST/hebrew_diacritized" checkout -q "$ref"
      echo "  ok  hebrew_diacritized @ $(git -C "$DEST/hebrew_diacritized" rev-parse --short HEAD) (pin checked out)" ;;
  fa) echo "fa — HomoRich (CC0)"
      # ⚠ `huggingface-cli` was RENAMED to `hf`; the old name now prints help and EXITS 0, so a script that
      # only checks the exit status reports success having downloaded nothing. Prefer `hf`, and assert a
      # parquet actually landed rather than trusting the return code.
      hfcli=$(command -v hf || command -v huggingface-cli || true)
      [ -n "$hfcli" ] || { echo "  need: pip install 'huggingface_hub[cli]'" >&2; exit 3; }
      "$hfcli" download MahtaFetrat/HomoRich-G2P-Persian --repo-type dataset --local-dir "$DEST/homorich" >/dev/null
      pq=$(find "$DEST/homorich" -name '*.parquet' | head -1)
      [ -n "$pq" ] || { echo "  FAILED: no .parquet under $DEST/homorich" >&2; exit 4; }
      echo "  ok  $pq" ;;
  km) echo "km — kmwiki dump (CC BY-SA). ⚠ 'latest' is NOT the dump the committed model saw."
      get https://dumps.wikimedia.org/kmwiki/latest/kmwiki-latest-pages-articles.xml.bz2 SKIP kmwiki-latest.xml.bz2 ;;
  none) sed -n '/^for lang/,$p' "$0" | grep -oE '^  [a-z]{2}\)' | tr -d ' )' | tr '\n' ' '; echo "— pass one or more" ;;
  *) echo "unknown corpus: $lang (see tools/CORPORA.md)" >&2; exit 2 ;;
esac; done
