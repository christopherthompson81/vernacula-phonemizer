/**
 * Lule Sami (smj) TEXT NORMALIZATION — Uralic (Sami), ~2k speakers in Sweden and Norway.
 *
 * ⚠ THIS LANGUAGE HAS NO CORPUS, AND THIS LAYER IS THEREFORE THE CORPUS-INDEPENDENT SUBSET AND NOTHING
 * ELSE. There is no FLEURS split, no mined artifact, and no usable wiki, so not one rule here is argued
 * from instances — which is why not one of them emits a WORD. `core/separatorHygiene.ts` spends the
 * separators that cannot be anything but separators, and every class that needs evidence stays open:
 * `%`, currency, degrees, the clock, the hyphen, the era marker and every abbreviation are untouched.
 *
 * ⚠ AND "UNTOUCHED" IS NOT THE SAME AS "VISIBLE", WHICH THIS HEADER USED TO CLAIM (#1214). The SIGNS are
 * dropped and could in principle be seen as a drop — `20 °` → *guoktalåhke*, `10 %` → *lågev*. The LETTERS
 * beside them are not: they are read as NATIVE PHONEMES, because the tokenizer takes any Latin run and the
 * g2p has a rule for every letter in it. `20°C` is *guoktalåhke k* — ⟨C⟩ is a real Lule Sami grapheme
 * reading [k] — `5 kg` is *vihtta kʰk*, a stressed nonsense word, and `nr. 5` adds a spurious sentence
 * break on top. Nothing is dropped and nothing raw survives, so there is no DROP and no RAW-LATIN residue:
 * the output is well-formed IPA that means something else, which is the trap-56 shape Lithuanian's layer
 * exists to close and this language has no corpus to close it with. Stated rather than implied, because a
 * reader who believes these classes are being watched will not go looking.
 *
 * ⚠ THIS LANGUAGE IS NOT "TREATED". A grouped figure no longer reads as two or three sentences; nothing
 * else has been decided. Read `core/separatorHygiene.ts`'s header for exactly which four shapes are
 * claimed and for why the single ambiguous group (`1.234`), the hyphen and the colon are all left alone.
 *
 * ⚠ espeak IS THIS LANGUAGE'S ONLY RESOURCE — 0 wikipron, 0 kaikki, 0 epitran — and it is a rich one:
 * 2,907 lines carrying 23 letter names, a decimal-point word (`_dpt kOmmA`), a percent word, a plus and
 * `€ euro`. ⚠ BUT espeak IS PHONETIC AND CANNOT HAND YOU ORTHOGRAPHY: a spelling derived from it must be
 * round-tripped through this repo's own g2p and checked against the mnemonic, and the one time that method
 * was measured (the Punjabi run) it scored 19/36 exact and 8/36 wrong-but-plausible. A lead generator.
 *
 * SOURCING — none is claimed, because no word is emitted. That is the point.
 */
import { separatorHygiene } from "../../core/separatorHygiene.ts";

/** Normalize one Lule Sami input string. Pure text→text; emits no word. See the header. */
export function normalizeLuleSami(input: string): string {
    return separatorHygiene(input);
}
