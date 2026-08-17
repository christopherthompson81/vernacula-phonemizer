/**
 * Aromanian (rup) TEXT NORMALIZATION — Eastern Romance, ~250k speakers in the Balkans.
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
 * ⚠ THIS IS THE ONE RESIDUAL LANGUAGE STILL REACHABLE BY THE ORDINARY METHOD: `roa-rup.wikipedia` is
 * open with 1,389 articles. It is thin but real, and mining it would replace this pass with an argued
 * layer. Recorded here so the cheap route is not forgotten.
 *
 * SOURCING — none is claimed, because no word is emitted. That is the point.
 */
import { separatorHygiene } from "../../core/separatorHygiene.ts";

/** Normalize one Aromanian input string. Pure text→text; emits no word. See the header. */
export function normalizeAromanian(input: string): string {
    return separatorHygiene(input);
}
