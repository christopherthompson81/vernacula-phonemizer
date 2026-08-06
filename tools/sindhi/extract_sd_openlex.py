#!/usr/bin/env python3
"""
Extract the two mineable signals from the Sindhi Open Lexicon Master Dataset.

Source (attribution mandatory — see PROVENANCE.md):
  Sindhi Open Lexicon Master Dataset, published at SindhiLanguage.org,
  prepared and curated by Amar Fayaz Buriro (امر فياض ٻرڙو).
  https://sindhilanguage.org/dataset/download/sindhi_open_lexicon_master_223k_final.zip

Writes:
  sd_deva_pairs.json  {perso-arabic: [devanagari, ...]}  → input to ingest_sd_openlex.ts (THE signal we use:
                      Devanagari is a full abugida, so it writes every vowel the abjad drops)
  sd_airab.json       {bare: harakat-marked}             → input to train_sd_airab.py (the WEAKER signal:
                      `word_with_airab_or_variant` is only PARTIALLY marked, so "unmarked" conflates
                      "no vowel" with "unwritten vowel" — kept because the comparison is documented)

  python3 extract_sd_openlex.py /path/to/sindhi_open_lexicon_master_223342.jsonl
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT = Path(os.environ.get("DUMPS", ".")) / "sindhi_open_lexicon_master_223342.jsonl"

DEVA = re.compile(r"[ऀ-ॿ]+")
ARAB_ONLY = re.compile(r"^[؀-ۿݐ-ݿ]+$")
HARAKAT = set("ًٌٍَُِّْ")
TATWEEL = "ـ"  # U+0640, used in this dataset as a DIACRITIC SEAT (ابـُو) — must be stripped or the
               # bare form never matches real text.


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    if not src.exists():
        sys.exit(f"dataset not found: {src}\nPass the path to sindhi_open_lexicon_master_223342.jsonl")

    pairs: dict[str, set[str]] = {}
    airab: dict[str, str] = {}
    n = 0
    with src.open(encoding="utf8") as f:
        for line in f:
            if not line.strip():
                continue
            d = json.loads(line)
            n += 1

            # ── Devanagari pairing: the `extra` field of the "Devanagari/Sindhi → English" section carries the
            # Devanagari headword alongside POS tags and S/L source markers; take the longest Devanagari run.
            w = (d.get("normalized_word") or d.get("word") or "").strip()
            ex = (d.get("extra") or "").strip()
            if w and ex and ARAB_ONLY.match(w):
                toks = DEVA.findall(ex)
                if toks:
                    dv = max(toks, key=len)
                    if len(dv) >= 2:
                        pairs.setdefault(w, set()).add(dv)

            # ── harakat ("airab") field: strip the trailing colon, take the first comma-separated variant.
            a = (d.get("word_with_airab_or_variant") or "").strip().strip(":：").strip()
            a = a.split("،")[0].split(",")[0].strip().replace(TATWEEL, "")
            if a and any(c in HARAKAT for c in a) and ARAB_ONLY.match(a):
                bare = "".join(c for c in a if c not in HARAKAT)
                if bare:
                    airab.setdefault(bare, a)

    (HERE / "sd_deva_pairs.json").write_text(
        json.dumps({k: sorted(v) for k, v in pairs.items()}, ensure_ascii=False), encoding="utf8")
    (HERE / "sd_airab.json").write_text(json.dumps(airab, ensure_ascii=False), encoding="utf8")
    print(f"entries read: {n}")
    print(f"  Perso-Arabic ↔ Devanagari pairs : {len(pairs)}  -> sd_deva_pairs.json")
    print(f"  unique harakat-marked words     : {len(airab)}  -> sd_airab.json")


if __name__ == "__main__":
    main()
