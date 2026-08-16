/**
 * TURKMEN (tk) cardinal number composition — Oghuz Turkic, Latin script. Moved out of `turkmen.ts` so that
 * `normalize.ts` can build ORDINALS on the same words without a circular import: turkmen.ts imports the
 * composer, normalize.ts imports the bound `numberToWords`, and neither imports the other. That is the
 * same split ba/tt/chv already have, and the reason gd's fraction rule had to emit bare digits instead.
 *
 * The DATA and its provenance live in `turkmen.jsonc` under `numbers`.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { NumbersDef } from "../../core/numbers.ts";

const DEF = loadManifest<{ numbers: NumbersDef }>(import.meta.url, "turkmen.jsonc");

/**
 * TURKMEN number composition (Oghuz Turkic, thousands-scaled decimal). Every round ten is its own lexeme (10 = on
 * sits in `tens`), and the parts are simply JUXTAPOSED with no connector: on bir (11), ýigrimi bäş (25),
 * ýüz ýigrimi bir (121). The multiplier "bir" is DROPPED before ýüz (100 = ýüz) but KEPT before müň and
 * million/milliard — the cited grammar's worked example is "bir müň dokuz ýüz togsan iki" (1992), the same
 * asymmetry Kazakh shows (жүз vs бір мың). Data + provenance: turkmen.jsonc `numbers`.
 */
export function turkmenNumberWords(n: number, d: NumbersDef): (string | null)[] {
    if (n < 10) return [d.units[n]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10,
            u = n % 10;
        return [d.tens[String(t)]!, ...(u ? [d.units[u]!] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return [...(h > 1 ? [d.units[h]!] : []), d.magnitudes.hundred, ...(r ? turkmenNumberWords(r, d) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return [...turkmenNumberWords(th, d), d.magnitudes.thousand, ...(r ? turkmenNumberWords(r, d) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000),
            r = n % 1_000_000;
        return [...turkmenNumberWords(m, d), d.magnitudes.million!, ...(r ? turkmenNumberWords(r, d) : [])];
    }
    const b = Math.floor(n / 1_000_000_000),
        r = n % 1_000_000_000;
    return [...turkmenNumberWords(b, d), d.magnitudes.billion!, ...(r ? turkmenNumberWords(r, d) : [])];
}


/** A non-negative safe integer → the ordered Turkmen number WORDS (spellings, not IPA). */
export function numberToWords(n: number): string[] {
    return turkmenNumberWords(n, DEF.numbers).filter((w): w is string => w !== null);
}
