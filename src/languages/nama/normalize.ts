/**
 * Nama (Khoekhoe) (naq) TEXT NORMALIZATION — Khoe-Kwadi, ~250k speakers in Namibia and South Africa.
 *
 * ⚠ THIS LANGUAGE HAS NO CORPUS, AND THIS LAYER IS THEREFORE THE CORPUS-INDEPENDENT SUBSET AND NOTHING
 * ELSE. There is no FLEURS split, no mined artifact, and no usable wiki, so not one rule here is argued
 * from instances — which is why not one of them emits a WORD. `core/separatorHygiene.ts` spends the
 * separators that cannot be anything but separators, and every class that needs evidence stays open:
 * `%`, currency, degrees, the clock, the hyphen, the era marker and every abbreviation are untouched.
 *
 * ⚠ AND "UNTOUCHED" IS NOT THE SAME AS "VISIBLE", WHICH THIS HEADER USED TO CLAIM (#1214). The SIGNS are
 * dropped and could in principle be seen as a drop. The LETTERS beside them are not: the tokenizer takes
 * any letter run and the g2p has a rule for every letter in it, so a scale letter or a unit symbol is READ
 * as a native phoneme — Lule Sami's `20°C` is *guoktalåhke k*, ⟨C⟩ being a real grapheme there. Nothing is
 * dropped and nothing raw survives, so there is no DROP and no RAW-LATIN residue: the output is well-formed
 * IPA that means something else, which is trap 56 rather than a leak. Stated rather than implied, because a
 * reader who believes these classes are being watched will not go looking.
 *
 * ⚠ THIS LANGUAGE IS NOT "TREATED". A grouped figure no longer reads as two or three sentences; nothing
 * else has been decided. Read `core/separatorHygiene.ts`'s header for exactly which four shapes are
 * claimed and for why the single ambiguous group (`1.234`), the hyphen and the colon are all left alone.
 *
 * ⚠ espeak-ng DOES NOT SHIP THIS LANGUAGE AT ALL, so even the letter-name and decimal-point tier that
 * `sources.ts` reaches for is empty here. The referee is 46 entries dominated by the click-letter
 * DEFINITIONS, so the g2p's own uncertainty dominates whatever this pass leaves unfixed.
 *
 * SOURCING — none is claimed, because no word is emitted. That is the point.
 */
import { separatorHygiene } from "../../core/separatorHygiene.ts";

/** Normalize one Nama (Khoekhoe) input string. Pure text→text; emits no word. See the header. */
export function normalizeNama(input: string): string {
    return separatorHygiene(input);
}
