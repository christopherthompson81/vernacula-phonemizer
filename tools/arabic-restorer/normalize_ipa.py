#!/usr/bin/env python3
"""Normalize the IPA inventory of silver.tsv → silver.normalized.tsv (the end-to-end EVAL reference).

The model's TARGET is harakat, consumed by each language's deterministic g2p; these wikipron IPA pairs are the
reference we score the full skeleton→harakat→g2p→IPA pipeline against. Normalizing their notation makes that score
measure phonology, not per-editor notation drift.


wikipron IPA carries per-editor notation drift: tone letters, epenthetic-schwa superscripts, ultrashort breves,
tone accents, half-long marks, glyph variants (ä vs a, ɒ vs ɑ), etc. Left in, the model would spend capacity
learning notation noise instead of phonology. This pass HARMONIZES notation while preserving every real contrast —
the same discipline as the referee-eval folds.

KEEP (phonemic): dental ̪ (U+032A), nasalization ̃ (U+0303), tie bar (U+0361; U+035C normalized to it), and the
modifier letters ʰ ʱ ʲ ʷ ˤ ː (aspiration, palatalization, labialization, pharyngealization, length). These encode
contrasts these languages actually make (Arabic emphatics tˤ/sˤ/dˤ, Indo-Aryan aspirates + dentals + retroflexes +
nasal vowels, Pashto labialization).

STRIP (non-contrastive notation): every OTHER combining mark (tone accents, breve, diaeresis→a, lowering ̞,
non-syllabic ̯, unreleased ̚, voiceless ̥/̊, breathy, centralized, syllabic, macron, rhotic hook), the epenthetic ᵊ,
half-long ˑ, glottalized ˀ, prenasal ⁿ/ᵑ, the tone letters ˥˦˧˨˩, and the liaison ties ‿ ~. Glyph folds: ä→a
(via the stripped diaeresis), ɒ→ɑ (rounded back-a = Persian ɑ), ɫ→l (velarization is allophonic), U+035C→U+0361.

Tone is dropped deliberately: it isn't recoverable from the abjad (the restorer's whole premise) and wikipron marks
it erratically. Output = one canonical phone alphabet across all languages; a token that reduces to nothing (a
tone-only token) is dropped from the sequence.
"""
import os
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "silver.tsv")
OUT = os.path.join(HERE, "silver.normalized.tsv")
INV = os.path.join(HERE, "inventory.txt")

KEEP_COMBINING = {"̪", "̃", "͡"}  # dental, nasalization, tie bar
# Codepoints stripped wherever they occur (whitelist-keep for combining marks handled separately).
STRIP = {
    "ᵊ",  # ᵊ epenthetic schwa superscript
    "ˑ",  # ˑ half-long
    "˞",  # ˞ rhotic hook
    "ˀ",  # ˀ glottalized
    "ᵑ",  # ᵑ prenasal (superscript eng)
    "ⁿ",  # ⁿ prenasal (superscript n)
    "˥", "˦", "˧", "˨", "˩",  # ˥˦˧˨˩ Chao tone letters
    "‿",  # ‿ liaison undertie
    "~",  # ~ inline tilde (free-variation marker)
}
MAP = {"͜": "͡", "ɒ": "ɑ", "ɫ": "l"}  # tie variant, ɒ→ɑ, ɫ→l


def normalize_token(tok: str) -> str:
    out = []
    for ch in unicodedata.normalize("NFD", tok):
        ch = MAP.get(ch, ch)
        if ch in STRIP:
            continue
        if unicodedata.combining(ch) and ch not in KEEP_COMBINING:
            continue  # drop every non-phonemic combining mark
        out.append(ch)
    return unicodedata.normalize("NFC", "".join(out))


def main() -> None:
    from collections import Counter

    inv: "Counter[str]" = Counter()
    n_rows = n_emptytok = 0
    with open(SRC, encoding="utf-8") as f, open(OUT, "w", encoding="utf-8") as g:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            skel, lang, ipa = parts[0], parts[1], parts[2]
            toks = []
            for t in ipa.split(" "):
                nt = normalize_token(t)
                # Drop a token with no base phone (only length/modifier marks left — e.g. a stripped tone+length
                # token reducing to a bare ː).
                if not nt or not any(unicodedata.category(ch)[0] == "L" and unicodedata.category(ch) != "Lm"
                                     for ch in nt):
                    n_emptytok += 1
                    continue
                toks.append(nt)
                inv[nt] += 1
            if not toks:
                continue
            g.write(f"{skel}\t{lang}\t{' '.join(toks)}\n")
            n_rows += 1

    with open(INV, "w", encoding="utf-8") as f:
        for tok, c in inv.most_common():
            f.write(f"{c}\t{tok}\n")

    print(f"rows: {n_rows}   dropped tone-only tokens: {n_emptytok}")
    print(f"canonical phone inventory: {len(inv)} symbols  ->  {os.path.relpath(INV, HERE)}")
    print(f"target: {os.path.relpath(OUT, HERE)}")


if __name__ == "__main__":
    main()
