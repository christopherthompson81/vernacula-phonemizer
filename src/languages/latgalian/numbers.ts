/**
 * Latgalian (ltg) cardinal number compositor. Returns composed Latgalian TEXT (space-separated) that
 * latgalian.ts runs through the g2p, so the IPA stays consistent with the word engine. The numeral tables
 * stay HERE, beside the counted-noun compositor that is their only reader (latgalian.jsonc carries the
 * grapheme tables) — the Somali/Irish shape.
 *
 * SOURCES
 *   • "SKAITĻA VĀRDS", Latgalīšu daslēdzis škola (lynuojs.wordpress.com/gramatika/skaitla-vards/) — the
 *     Latgalian school grammar's numeral chapter. It supplies the masculine series (vīns, div/divi, treis,
 *     četri, pīci, seši, septeni, ostoni, deveni, desmit), the teens (vīnpadsmit … deveņpadsmit), the round tens
 *     (divdesmit, treisdesmit, četrudesmit, pīcdesmit, sešdesmit, septeņdesmit, ostoņdesmit, deveņdesmit),
 *     symts / tyukstūša / miļjons / miļjards, AND the separate FEMININE series (vīna, divi, treis, četrys,
 *     pīcys, sešys, septenis, ostonis, devenis) — which this compositor needs — see GENDER below.
 *   • Omniglot "Numbers in Latgalian" (omniglot.com/language/numbers/latgalian.htm) — independent confirmation,
 *     incl. the compounds "divdesmit vīns" (21), "div(i) symti" (200) and "pīci symti pīcdesmit pīci" (555).
 *
 * JUDGMENT CALLS a reviewer should know:
 *   • 40 / 14: the grammar gives "četrudesmit" / "četrupadsmit" (with the genitive-plural stem četru-), Omniglot
 *     gives "četrdesmit". Both are in use; the grammar is followed here because it is internally consistent
 *     across both the ten and the teen, and it is the prescriptive source of the two.
 *   • 0: neither source lists it. "nulle" is used, the form Latvian (the closest relative, and the source of
 *     Latgalian's modern technical vocabulary) has. Flagged as UNATTESTED for Latgalian specifically.
 *   • ⚠ GENDER: unlike Latvian, whose tūkstotis is MASCULINE, Latgalian "tyukstūša" is FEMININE (grammar: a 4th-
 *     declension noun, with the example "sešys tyukstūšys"). A numeral agrees with its counted noun, so the
 *     thousands multiplier must use the FEMININE unit forms (sešys tyukstūšys, not *seši tyukstūšys) while
 *     symts / miļjons / miļjards, being masculine, take the masculine ones. That is modelled. CASE concord
 *     (beyond nominative) is context-dependent and is deferred, as in the sibling Latvian engine.
 */

/** Masculine unit series (index 0 = zero). Used everywhere except a thousands multiplier. */
const UNITS = ["nulle", "vīns", "divi", "treis", "četri", "pīci", "seši", "septeni", "ostoni", "deveni"];
/** ⚠ FEMININE unit series — the multiplier of the feminine noun "tyukstūša" (grammar: sešys tyukstūšys). */
const UNITS_F = ["nulle", "vīna", "divi", "treis", "četrys", "pīcys", "sešys", "septenis", "ostonis", "devenis"];
/** 10–19: the -padsmit teens (one word), gender-invariant. */
const TEENS = [
    "desmit", "vīnpadsmit", "divpadsmit", "treispadsmit", "četrupadsmit",
    "pīcpadsmit", "sešpadsmit", "septeņpadsmit", "ostoņpadsmit", "deveņpadsmit",
];
/** Round tens, indexed by the tens digit (0/1 unused — 10–19 are the teens above); gender-invariant. */
const TENS = [
    "", "", "divdesmit", "treisdesmit", "četrudesmit",
    "pīcdesmit", "sešdesmit", "septeņdesmit", "ostoņdesmit", "deveņdesmit",
];

/** A counted magnitude noun: `one` after a count ending in …1 (but not …11), `many` otherwise. */
interface Forms {
    one: string;
    many: string;
}
const HUNDRED: Forms = { one: "symts", many: "symti" }; // masculine, 1st declension
const THOUSAND: Forms = { one: "tyukstūša", many: "tyukstūšys" }; // ⚠ FEMININE, 4th declension
const MILLION: Forms = { one: "miļjons", many: "miļjoni" }; // masculine
const MILLIARD: Forms = { one: "miļjards", many: "miļjardi" }; // masculine

/** The East-Baltic count form (as Latvian): SINGULAR after a count ending in …1 except …11 — 21, 101 →
 *  tyukstūša; the plural otherwise (11 tyukstūšys, 25 tyukstūšys). */
function agree(count: number, forms: Forms): string {
    return count % 10 === 1 && count % 100 !== 11 ? forms.one : forms.many;
}

/** 0–99 → Latgalian text. `fem` switches ONLY the final unit word to the feminine series (tens and teens do
 *  not inflect for gender), so 26 → "divdesmit seši" (m) / "divdesmit sešys" (f). */
function sub100(n: number, fem: boolean): string {
    const U = fem ? UNITS_F : UNITS;
    if (n < 10) return U[n]!;
    if (n < 20) return TEENS[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]} ${U[u]}`;
}

/** 0–999 → Latgalian text. The hundred is a MASCULINE counted noun (symts / divi symti), so its own multiplier
 *  stays masculine even inside a feminine thousands group (divi symti tyukstūšys). */
function sub1000(n: number, fem: boolean): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return sub100(n, fem);
    const hw = h === 1 ? HUNDRED.one : `${UNITS[h]} ${HUNDRED.many}`;
    return r ? `${hw} ${sub100(r, fem)}` : hw;
}

/** One magnitude group. `keepOne` = whether a count of exactly 1 keeps the numeral: 1000 is read as the bare
 *  noun "tyukstūša" (as Latvian reads tūkstotis), while 1 000 000 keeps it — "vīns miļjons". */
function magnitude(count: number, forms: Forms, fem: boolean, keepOne: boolean): string {
    if (count === 1) return keepOne ? `${(fem ? UNITS_F : UNITS)[1]} ${forms.one}` : forms.one;
    return `${sub1000(count, fem)} ${agree(count, forms)}`;
}

/** Read a raw digit STRING digit-by-digit — the fallback beyond the miļjards group (n ≥ 10^12). */
export function readDigits(digits: string): string {
    return digits
        .split("")
        .map((d) => UNITS[Number(d)] ?? d)
        .join(" ");
}

/** A non-negative integer (< 10^12) → space-separated Latgalian cardinal words. */
export function numberToWords(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return UNITS[0]!; // nulle
    if (n >= 1e12) return readDigits(String(n));
    const parts: string[] = [];
    const bil = Math.floor(n / 1e9);
    n %= 1e9;
    if (bil) parts.push(magnitude(bil, MILLIARD, false, true));
    const mil = Math.floor(n / 1e6);
    n %= 1e6;
    if (mil) parts.push(magnitude(mil, MILLION, false, true));
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(magnitude(th, THOUSAND, true, false)); // ⚠ feminine multiplier; 1000 → bare tyukstūša
    if (n) parts.push(sub1000(n, false));
    return parts.join(" ");
}
