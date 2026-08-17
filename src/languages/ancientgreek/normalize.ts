/**
 * Ancient Greek (grc) TEXT NORMALIZATION — Hellenic, the reconstructed 5th-c. BCE Classical Attic reading.
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
 * ⚠ THE NORMALIZATION SURFACE HERE IS THE APPARATUS, NOT THE GREEK. Greek prose carries almost no Arabic
 * digits because its numerals are ALPHABETIC (`αʹ`, `ιβʹ`, `͵βκδ`), and those read as bare letters today — a
 * NUMBERS question (an alphabetic-numeral pass), already recorded as deferred, and not one this pass
 * touches. What it does reach is the CITATION: `Ἡρόδοτος 2.35.1` produced two false full stops inside one
 * reference. ⚠ And as with Nogai, the Latin siglum goes to an English phonemizer — `Il.` reads *dɹaɪv* —
 * which is a routing question this pass leaves alone.
 *
 * SOURCING — none is claimed, because no word is emitted. That is the point.
 */
import { separatorHygiene } from "../../core/separatorHygiene.ts";

/** Normalize one Ancient Greek input string. Pure text→text; emits no word. See the header. */
export function normalizeAncientGreek(input: string): string {
    return separatorHygiene(input);
}
