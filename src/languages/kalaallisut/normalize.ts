/**
 * Kalaallisut (kl) TEXT NORMALIZATION — Eskimo-Aleut, ~56k speakers in Greenland.
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
 * ⚠ `kl.wikipedia` EXISTS BUT IS CLOSED AND REPORTS ZERO ARTICLES, which is why there is no corpus
 * despite the language being well documented. ⚠ AND THIS IS THE RESIDUAL WITH THE MOST TO GAIN: espeak
 * ships 20 letter names AND a decimal-point word (`_dpt kom:a`), so a fuller layer is within reach as soon
 * as anything supplies running text to check the separator conventions against.
 *
 * SOURCING — none is claimed, because no word is emitted. That is the point.
 */
import { separatorHygiene } from "../../core/separatorHygiene.ts";

/** Normalize one Kalaallisut input string. Pure text→text; emits no word. See the header. */
export function normalizeKalaallisut(input: string): string {
    return separatorHygiene(input);
}
