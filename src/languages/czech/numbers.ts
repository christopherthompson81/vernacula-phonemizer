/**
 * Czech (cs) cardinal number compositor. Returns composed Czech TEXT (space-separated) that the phonemizer runs
 * through the g2p, so the IPA stays consistent with the word engine. Tens+units concatenate (dvacetjeden = 21);
 * hundreds and thousands are space-separated. Czech thousand agreement: 1 tisíc, 2–4 tisíce, 5+ tisíc (likewise
 * milion/miliony/milionů).
 */

import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in czech.jsonc; the composition logic below is the algorithm.
const {
    units: UNITS,
    teens: TEENS,
    tens: TENS,
    hundreds: HUNDREDS,
    magnitudes: MAG,
} = MANIFEST.numbers;

/** 0–99 → Czech text (tens and units concatenated). */
function sub100(n: number): string {
    if (n < 10) return UNITS[n]!;
    if (n < 20) return TEENS[n - 10]!;
    return TENS[Math.floor(n / 10)]! + (n % 10 ? UNITS[n % 10]! : "");
}

/** 0–999 → Czech text (hundreds space-separated from the sub-hundred remainder). */
function sub1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return sub100(r);
    return HUNDREDS[h]! + (r ? ` ${sub100(r)}` : "");
}

/** Czech agreement form for a magnitude count: 1 → sg, 2–4 → paucal, else → genitive-plural. */
function agree(
    count: number,
    forms: { sg: string; paucal: string; plural: string },
): string {
    return count === 1
        ? forms.sg
        : count >= 2 && count <= 4
          ? forms.paucal
          : forms.plural;
}

/** Read a raw digit STRING digit-by-digit — the fallback above the declared top magnitude. */
function readDigits(digits: string): string {
    return [...digits].map((d) => UNITS[Number(d)] ?? d).join(" ");
}

/**
 * A non-negative integer → space-separated Czech cardinal words.
 *
 * ⚠ THE TOP MAGNITUDE IS A HARD CEILING, and it used to be silent. `sub1000` is only defined to 999, so a
 * millions count of 1,000 or more — i.e. any n ≥ 10⁹ — indexed past its table and the template literal
 * stringified the `undefined` INTO the text: `1000000000` read *ˈundɛfˌɪnɛt mˈɪlɪjˌonuː*, the engine
 * SPEAKING the word "undefined". The billion is now declared (miliarda/miliardy/miliard, corpus-attested),
 * and anything above the declared top falls back to digit-at-a-time — the fleet's convention for
 * out-of-range, and what fi and fr already do at this size.
 *
 * ⚠ THE FALLBACK READS `raw`, THE TOKEN STRING, NOT THE DOUBLE (#1059). `n` reached here via
 * `Number(token)`, so above 2^53 its digits have already rounded and above 1e21 `String(n)` is EXPONENT
 * form — `1000000000000000000001` read as *jˈɛdɛn dvˈa jˈɛdɛn* ("1 e+ 2 1", the `e` and `+` silently
 * dropped as undefined table lookups). The caller has the digits; it passes them.
 */
export function numberToWords(n: number, raw?: string): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return UNITS[0]!; // nula
    if (n >= 1e12) return readDigits(raw ?? String(n));
    const parts: string[] = [];
    const bil = Math.floor(n / 1000000000);
    n %= 1000000000;
    if (bil)
        parts.push(
            (bil === 1 ? "" : `${sub1000(bil)} `) + agree(bil, MAG.billion),
        );
    const mil = Math.floor(n / 1000000);
    n %= 1000000;
    if (mil)
        parts.push(
            (mil === 1 ? "" : `${sub1000(mil)} `) + agree(mil, MAG.million),
        );
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th)
        parts.push(
            th === 1
                ? MAG.thousand.sg
                : `${sub1000(th)} ${agree(th, MAG.thousand)}`,
        );
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
