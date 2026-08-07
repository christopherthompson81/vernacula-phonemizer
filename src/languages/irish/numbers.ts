/**
 * Irish number → words. A real compositor for 0–999,999,999 (a digit-by-digit stub reads every multi-digit number
 * digit-by-digit: 25 → "dó cúig", 1998 → "aon naoi naoi ocht").
 *
 * Irish is not a plain units/tens/hundreds language, so this cannot use `westernNumberWords`:
 *
 *  1. **Two numeral series.** The COUNTING form (standalone, and after the particle `a`) differs from the
 *     ATTRIBUTIVE form used before a counted noun — ceathair vs ceithre, dó vs dhá. Magnitude words are counted
 *     attributively: 200 is `dhá chéad`, never *a dó chéad.
 *  2. **The particle `a`** introduces a bare counting numeral: `a haon`, `fiche a cúig`, `céad a hocht`.
 *  3. **Initial mutation after a numeral.** 2–6 LENITE the following magnitude (dhá chéad, sé chéad), 7–10
 *     ECLIPSE it (seacht gcéad, naoi gcéad). The referee corroborates all three shapes: céad [c eː d̪ˠ],
 *     chéad [ç eː d̪ˠ], gcéad [ɟ eː d̪ˠ]. `míle` is m-initial and has no eclipsed form, so 7–10 leave it bare.
 *  4. **h-prefix** on the vowel-initial counting forms after `a`: aon → `a haon`, ocht → `a hocht`.
 *  5. **déag lenites after dó** only: a haon déag, `a dó dhéag`, a trí déag. Referee: dhéag [j eː ɡ].
 *
 * Uses the DECIMAL series (fiche/tríocha/daichead/…), not the traditional vigesimal one (dhá fhichead = 40):
 * decimal is what modern written Irish uses for bare figures, and every word here is attested in the wikipron
 * referee (ga.wikipron-gle-broad.tsv).
 *
 * KNOWN LIMITATION — a magnitude count in the TEENS. Idiomatic Irish puts `déag` after the counted noun:
 * 11,000 is `aon mhíle dhéag`, not the `a haon déag míle` this emits. Implementing it needs the lenition
 * rule for `déag` after each magnitude (mhíle dhéag, but chéad déag?), which the wikipron referee cannot
 * corroborate — it has no `mhíle` entry and no multi-word numerals at all. Rather than guess at mutation
 * rules with nothing to check them against, the composed-count form is emitted: unambiguous and
 * understandable, just not idiomatic. Wants a native check or a grammar reference before changing.
 *
 * NOT handled, deliberately: YEAR reading. 1998 as a year is colloquially `naoi déag nócha a hocht`
 * (pair-wise), but nothing in a bare digit string distinguishes a year from a quantity, so this always
 * produces the unambiguous cardinal `míle naoi gcéad nócha a hocht`, which is correct for both.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;
const ONES = N.ones; // counting series: náid, aon, dó, trí, ceathair, …
const ATTR = N.attributive; // attributive series: —, aon, dhá, trí, ceithre, …

/** Lenition: insert `h` after the initial consonant (céad → chéad, míle → mhíle). */
function lenite(w: string): string {
    return /^[bcdfgmpt]/i.test(w) ? w[0] + "h" + w.slice(1) : w;
}

/** Eclipsis: prefix the voiced/nasal counterpart (céad → gcéad). `m` has no eclipsed form. */
const ECLIPSE: Record<string, string> = { c: "g", p: "b", t: "d", b: "m", d: "n", g: "n", f: "bhf" };
function eclipse(w: string): string {
    const e = ECLIPSE[w[0]!.toLowerCase()];
    return e === undefined ? w : e + w; // g → "n" + gcéad-style prefix, i.e. ng-

}

/** Mutate a magnitude word after the numeral `k`: 2–6 lenite, 7–10 eclipse, 1 (bare magnitude) unchanged. */
function afterNumeral(k: number, word: string): string {
    if (k >= 2 && k <= 6) return lenite(word);
    if (k >= 7 && k <= 10) return eclipse(word);
    return word;
}

/** The counting form with its `a` particle and h-prefix (aon → "a haon", ocht → "a hocht"). */
function counting(u: number): string {
    const w = ONES[u]!;
    return "a " + (/^[aeiouáéíóú]/i.test(w) ? "h" + w : w);
}

/** 1–99 in the counting series. */
function underHundred(n: number): string {
    if (n <= 10) return counting(n);
    if (n < 20) {
        const u = n - 10;
        // déag lenites after dó ONLY (a dó dhéag); every other teen keeps it bare.
        return `${counting(u)} ${u === 2 ? lenite(N.teenWord) : N.teenWord}`;
    }
    const t = Math.floor(n / 10) * 10;
    const u = n % 10;
    return N.tens[String(t)]! + (u ? ` ${counting(u)}` : "");
}

/** A magnitude group: `count` × `word` (e.g. 9 × céad → "naoi gcéad"; 1 × míle → bare "míle"). */
function magnitude(count: number, word: string): string {
    if (count === 1) return word; // bare magnitude: céad, míle — no "aon"
    if (count <= 10) return `${ATTR[count]!} ${afterNumeral(count, word)}`;
    // A count above ten is itself composed — via `compose`, not `underHundred`, so a three-digit count works
    // (999,999 needs "naoi gcéad nócha a naoi míle"; underHundred alone yielded tens["990"] = undefined).
    // The magnitude then stays unmutated: mutation is triggered by a simple numeral, not by a phrase.
    return `${compose(count)} ${word}`;
}

function compose(n: number): string {
    if (n < 100) return underHundred(n);
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        return magnitude(h, N.magnitudes.hundred) + (r ? ` ${compose(r)}` : "");
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000), r = n % 1000;
        return magnitude(th, N.magnitudes.thousand) + (r ? ` ${compose(r)}` : "");
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000), r = n % 1_000_000;
        return magnitude(m, N.magnitudes.million) + (r ? ` ${compose(r)}` : "");
    }
    const b = Math.floor(n / 1_000_000_000), r = n % 1_000_000_000;
    return magnitude(b, N.magnitudes.billion) + (r ? ` ${compose(r)}` : "");
}

/** Non-negative integer → Irish words. Out-of-range/non-integer input falls back to digit-by-digit. */
export function numberToWords(n: number): string {
    // Out of range → digit-by-digit over the DIGITS only; a stray "-" or "." must not reach the g2p as a word.
    // (Unreachable from the text path — the tokenizer matches \d+ — but this is an exported entry point.)
    if (!Number.isSafeInteger(n) || n < 0) {
        return [...String(n)].filter((c) => c >= "0" && c <= "9").map((d) => ONES[Number(d)]!).join(" ");
    }
    if (n === 0) return ONES[0]!; // náid — a bare zero takes no "a" particle
    return compose(n).replace(/\s+/g, " ").trim();
}
