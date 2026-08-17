/**
 * Totontepec Mixe (mto) TEXT NORMALIZATION — Mixe-Zoquean, ~6k speakers in Oaxaca.
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
 * ⚠ espeak SHIPS THIS LANGUAGE, AND ITS ENTRIES ARE SPANISH — `° grados`, `+ más`, `% porTj'Ento`. That is
 * a lead about contact-language practice, not an attestation of Mixe, and it is exactly the shape Nahuatl's
 * corpus confirmed one round earlier (every measure word Spanish). Unusable as a source without text to
 * check it against. ⚠ AND THE SPANISH TO CHECK IT AGAINST IS `es-419`, not `es` — Latin-American Spanish is
 * the contact language here; note that `es-419` itself currently inherits Spain's separator convention,
 * which is wrong for Mexico, so it is a reference to re-measure and not one to port. The referee is THREE concepts, so the g2p's uncertainty dominates here too.
 *
 * SOURCING — none is claimed, because no word is emitted. That is the point.
 */
import { separatorHygiene } from "../../core/separatorHygiene.ts";

/** Normalize one Totontepec Mixe input string. Pure text→text; emits no word. See the header. */
export function normalizeTotontepecMixe(input: string): string {
    return separatorHygiene(input);
}
