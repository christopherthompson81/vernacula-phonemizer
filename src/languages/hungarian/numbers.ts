/**
 * Hungarian cardinal number → words. Hungarian writes a number as ONE concatenated word (kétszázharmincnégy);
 * the tens 20 use the bound form "huszon-" (huszonegy) and "tíz" the "tizen-" teens; "2" is "két" before a scale
 * (kétszáz, kétezer) but "kettő" standalone/final. Covers 0 … <10⁹ (a space precedes millió/ezer groups only at
 * the millió boundary). Larger / non-finite → digit-by-digit.
 */
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** 1 ≤ n < 100 (one word: huszonegy, harmincnégy). */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n < 20) return N.teens[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    if (t === 2) return u === 0 ? N.tens[2]! : `${N.tensPrefix["20"]}${N.units[u]}`;
    return u === 0 ? N.tens[t]! : `${N.tens[t]}${N.units[u]}`;
}

/** ATTRIBUTIVE form: *kettő* → *két* before a noun or a scale word (két·száz, huszonkét·ezer, huszonkét
 *  millió). Hungarian's one cardinal with a distinct attributive form. */
const attributive = (w: string): string => (w.endsWith("kettő") ? `${w.slice(0, -5)}két` : w);

/**
 * STEM SHORTENING before a VOWEL-INITIAL suffix — the ordinary Hungarian alternations, needed because the
 * hyphen-suffix rule concatenates onto the spoken numeral: `2022-es` is *kétezerhuszonkettes* (not
 * *kettőes*), `1943-as` *…negyvenhármas* (not *hármas*'s stem being optional — *háromas* is not a word),
 * `1907-es` *…hetes*, `36-an` *harminchatan* (no change), `1000-es` *ezres*. Only these four morphs
 * alternate; every other cardinal takes the suffix unchanged (négyes, ötös, hatos, tízes, húszas,
 * százas, harmincas …).
 */
const VOWEL_SUFFIX_STEM: Readonly<Record<string, string>> = {
    "kettő": "kett", "három": "hárm", "hét": "het", "ezer": "ezr",
};
const VOWEL_INITIAL = /^[aáeéiíoóöőuúüű]/u;

/** Apply the stem shortening above, if `suffix` is vowel-initial and `word` ends in an alternating morph. */
export function stemForSuffix(word: string, suffix: string): string {
    if (!VOWEL_INITIAL.test(suffix)) return word;
    for (const [morph, stem] of Object.entries(VOWEL_SUFFIX_STEM))
        if (word.endsWith(morph)) return word.slice(0, word.length - morph.length) + stem;
    return word;
}

/** 1 ≤ n < 1000 (kétszázharmincnégy). "2" before száz → "két". */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = h === 1 ? N.hundred : `${h === 2 ? "két" : N.units[h]}${N.hundred}`;
    return r ? `${hundred}${below100(r)}` : hundred;
}

/** Non-negative integer (< 10¹²) → Hungarian words; larger / non-finite → digit-by-digit. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...String(Math.abs(n))].map((d) => N.units[Number(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!; // nulla
    const parts: string[] = [];
    const mrd = Math.floor(n / 1e9),
        mil = Math.floor((n % 1e9) / 1e6),
        thg = Math.floor((n % 1e6) / 1000),
        r = n % 1000;
    // The multiplier before a scale word: 1→"egy", else the composed group in its ATTRIBUTIVE form —
    // *kettő* becomes *két* before a noun, and that holds for a compound multiplier too: 22 000 is
    // huszon**két**ezer, not *huszonkettőezer*, and 22 million huszonkét millió. Only `c === 2` was
    // handled before, so every multiplier ENDING in 2 read the free-standing form.
    const mult = (c: number): string => (c === 1 ? "egy" : attributive(below1000(c)));
    if (mrd) parts.push(`${mult(mrd)} ${N.milliard}`);
    if (mil) parts.push(`${mult(mil)} ${N.million}`);
    // thousands + remainder concatenate into one word (kétezer-…); "2" before ezer → "két".
    let word = "";
    if (thg) word += thg === 1 ? N.thousand : `${attributive(below1000(thg))}${N.thousand}`;
    if (r) word += below1000(r);
    if (word) parts.push(word);
    return parts.join(" ");
}

/** Read from the manifest — LONGEST FIRST, and the order is load-bearing (see the jsonc). */
const ORDINAL_MORPH: Readonly<Record<string, string>> = MANIFEST.ordinalMorphs;

// LONGEST FIRST: `kilencven` must beat nothing, but `negyven` must not be shadowed by `négy` — matching
// is by suffix, so the longest matching key is the real final morph.
const ORDINAL_KEYS = Object.keys(ORDINAL_MORPH).sort((a, b) => b.length - a.length);

/**
 * Non-negative integer → the Hungarian ORDINAL word, or `undefined` where the cardinal itself could not
 * be composed (≥10¹², where `numberToWords` falls back to digit-by-digit). 1 and 2 standing alone are
 * the suppletive *első* / *második*; everything else is the cardinal with its final morph replaced.
 */
/** Read from the manifest — see the jsonc. */
const MULTIPLICATIVE_MORPH: Readonly<Record<string, string>> = MANIFEST.multiplicativeMorphs;

// LONGEST FIRST, for the reason ORDINAL_KEYS gives: `negyven` must not be shadowed by `négy`.
const MULTIPLICATIVE_KEYS = Object.keys(MULTIPLICATIVE_MORPH).sort((a, b) => b.length - a.length);

/**
 * Non-negative integer → the Hungarian MULTIPLICATIVE word (hatszor, ötvenhatszor), or `undefined` where the
 * cardinal could not be composed. The suffix fuses onto the LAST morph of the compound, which is why
 * `ötvenhat` yields *ötvenhatszor* — the same last-morph replacement `ordinalWords` performs.
 */
export function multiplicativeWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 0) return undefined;
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const parts = card.split(" ");
    const last = parts[parts.length - 1]!;
    const key = MULTIPLICATIVE_KEYS.find((k) => last.endsWith(k));
    if (key === undefined) return undefined;
    parts[parts.length - 1] = last.slice(0, last.length - key.length) + MULTIPLICATIVE_MORPH[key]!;
    return parts.join(" ");
}

export function ordinalWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 0) return undefined;
    if (n === 1) return "első";
    if (n === 2) return "második";
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const parts = card.split(" ");
    const last = parts[parts.length - 1]!;
    const key = ORDINAL_KEYS.find((k) => last.endsWith(k));
    if (key === undefined) return undefined;
    parts[parts.length - 1] = last.slice(0, last.length - key.length) + ORDINAL_MORPH[key]!;
    return parts.join(" ");
}
