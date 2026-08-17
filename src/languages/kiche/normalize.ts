/**
 * K'iche' (quc) TEXT NORMALIZATION — the largest Mayan language, ~1.1M speakers in Guatemala.
 *
 * ⚠ THIS LANGUAGE HAS NO CORPUS, AND THIS LAYER IS THEREFORE THE CORPUS-INDEPENDENT SUBSET AND NOTHING
 * ELSE. There is no FLEURS split, no mined artifact, and no usable wiki, so not one rule here is argued
 * from instances — which is why not one of them emits a WORD. `core/separatorHygiene.ts` spends the
 * separators that cannot be anything but separators, and every class that needs evidence stays open:
 * `%`, currency, degrees, the clock, the hyphen, the era marker and every abbreviation are untouched and
 * still visible to the leak gates.
 *
 * ⚠ THIS LANGUAGE IS NOT "TREATED". A grouped figure no longer reads as two or three sentences; nothing
 * else has been decided. Read `core/separatorHygiene.ts`'s header for exactly which four shapes are
 * claimed and for why the single ambiguous group (`1.234`), the hyphen and the colon are all left alone.
 *
 * ⚠ THE SPANISH TO MEASURE AGAINST IS `es-419`, NOT `es` — Latin-American Spanish is the contact language
 * for the indigenous languages of the region, and it is a treated row in this repo. ⚠ BUT IT CANNOT BE
 * PORTED, AND THE REASON IS MEASURED: `es-419` DOES NOT USE THE CONVENTION CLDR
 * ASCRIBES TO IT. CLDR formats it `1,234,567.89`, but its own 1,948-utterance FLEURS corpus writes
 * dot-grouping ×5 (`17.000 islas`), comma-decimals ×10, dot-decimals ×15 and comma-grouping ZERO — both
 * marks decimate, only the dot groups, and the three-digit test is what separates them (fixed there, see
 * `src/languages/spanish/normalize.ts` step 0b, which was reading `2.3 millones` as *veintitrés millones*).
 * Guatemala's own practice is a third question again: Mexico and Central America group with the COMMA
 * while Argentina and Chile do not, so neither CLDR nor `es-419`'s corpus answers it for K'iche'.
 *
 * That is the single most valuable thing a K'iche' corpus would settle, and it is exactly why the shared
 * pass leaves an ambiguous single group (`1.234`, `1,234`) ALONE rather than joining it: guessing the
 * orientation here carries a 1000× error. Modern written K'iche' also carries Spanish-style abbreviations
 * and the quetzal sign (`Q100` reads *qʰ xokʼal* today), neither claimable without instances.
 *
 * SOURCING — none is claimed, because no word is emitted. That is the point.
 */
import { separatorHygiene } from "../../core/separatorHygiene.ts";

/** Normalize one K'iche' input string. Pure text→text; emits no word. See the header. */
export function normalizeKiche(input: string): string {
    return separatorHygiene(input);
}
