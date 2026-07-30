/**
 * Maltese (mt) cardinal number → words. **SYSTEM: NATIVE Semitic (Siculo-Arabic) throughout.** Unlike most of
 * this batch, Maltese needs no native-vs-borrowed decision: the whole 0–999 999 999 range is native Maltese. The
 * only loans are the magnitude words `miljun`/`biljun` (Italian milione/bilione), which are the ordinary Maltese
 * words for those magnitudes — there is no rival Semitic form in use.
 *
 * ★ THE ONE REAL JUDGMENT CALL — **counting form, not attributive form.** Maltese has two numeral series and the
 *   split is the classic Maltese textbook point: the ABSOLUTE/COUNTING form (`tnejn` 2, `tlieta` 3, `erbgħa` 4 …)
 *   used when counting aloud, doing arithmetic, or citing a bare figure, versus the ATTRIBUTIVE/construct form
 *   (`żewġ` 2, `tliet` 3, `erba'` 4 …) used immediately before a counted noun. A digit in running text is a bare
 *   numeral with no noun attached in the token stream, so this engine emits the **ABSOLUTE** series: `2` → tnejn,
 *   `3` → tlieta. The attributive series is still carried in the data, because it is obligatory as the MULTIPLIER
 *   of a magnitude word — 200 is `mitejn`, 300 is `tliet mija`, never *tlieta mija. This is a real limitation to
 *   name: "2 kotba" ('2 books') would ideally read `żewġ kotba`, and this composer cannot know that a noun
 *   follows. Reading the counting form there is the standard TTS compromise (and is how a Maltese speaker reads a
 *   figure aloud out of context).
 *
 * ★ SOURCES
 *   - **GF Resource Grammar Library, `NumeralMlt.gf`** (John J. Camilleri, 2011–2013, LGPL) —
 *     https://raw.githubusercontent.com/GrammaticalFramework/gf-rgl/master/src/maltese/NumeralMlt.gf. A complete
 *     published generator for Maltese 1–999 999; every composition rule below is read off it: the unit/attributive/
 *     teen/ten four-way table per digit (`mkNum`), the units-first `pot1plus` (unit ++ "u" ++ ten), the hundred
 *     table (Num1 → mija / NumAdj mitt; Num2 → mitejn; else adjectival ++ mija), and `pot3`'s thousand selection
 *     (1 → elf, 2 → elfejn, a unit-final multiplier → …elef, an 11+ multiplier → …elf).
 *   - **Wiktionary Maltese numerals** (the `mt-numeral` data, absolute vs attributive vs -t series) for the
 *     attributive-long set żewġt/tlitt/erbat/ħamest/sitt/sebat/tmint/disat/għaxart and for `żero`.
 *   - Attested composed forms used as goldens: `tliet mija u ħdax-il elf` (311 000, Maltese broadcast text) and
 *     Camilleri's own `elf, erba' mija u għoxrin` (1420) — both reproduced exactly by this composer.
 *
 * ★ STRUCTURE — three things make Maltese not a Western decimal:
 *   1. **Units-first inside 21–99** with the connector `u`: 21 = `wieħed u għoxrin` ("one and twenty"), 45 =
 *      `ħamsa u erbgħin`. (Semitic order, same as Arabic waːħid wa ʕiʃruːn and German einundzwanzig.)
 *   2. **DUAL forms** for exactly 2× a magnitude: 200 `mitejn`, 2000 `elfejn` — not *żewġ mija, not *żewġt elef.
 *      `miljun` has no dual, so 2 000 000 is the regular `żewġ miljuni`.
 *   3. **`u` marks only the FINAL constituent** of the whole numeral; the higher constituents simply juxtapose.
 *      1420 = `elf` + `erba' mija` + `u għoxrin`; 12 345 = `tnax-il elf` `tliet mija` `u ħamsa u erbgħin` (the
 *      second `u` there is the internal units-first one from rule 1). This is what the attested forms show, and
 *      it is why this is a constituent-list composer rather than a per-magnitude recursion.
 *   Plus the smaller stem alternations: `mija` free vs construct `mitt` before a monosyllable (100 000 = `mitt
 *   elf`), `elf` singular vs plural `elef` after 3–10 (`tlitt elef` 3000) but singular again after 11+
 *   (`tnax-il elf` 12 000), and the `-il` linker that a teen takes as a multiplier.
 *
 * SIMPLIFICATIONS (documented, none invented):
 *   - A magnitude multiplier in the 101–999 range that ENDS in a bare unit takes the absolute unit and the
 *     singular magnitude (305 000 → `tliet mija u ħamsa elf`). The GF grammar's own branch for that slot is
 *     visibly buggy (its `pot2` else-branch drops the hundred entirely, yielding *`tlett elf` for 300 000), so
 *     rather than copy a bug or invent a form we use the regular absolute phrase there. Round hundreds of
 *     thousands DO get the attested construct: 100 000 `mitt elf`, 200 000 `mitejn elf`, 300 000 `tliet mitt elf`.
 *   - `-il` before `miljun`/`biljun` (12 000 000 → `tnax-il miljun`) is by analogy with the attested `tnax-il elf`;
 *     the sources only document the linker before `elf`.
 *   - ATTESTED RANGE / FALLBACK: 0 … 10¹²−1 (`biljun` = 10⁹, the Maltese/European short-scale value used in
 *     Maltese official texts). At 10¹² and above, and for any non-safe integer, this falls back to
 *     DIGIT-BY-DIGIT, because Maltese has no settled word beyond `biljun` in the sources consulted.
 */

export interface MalteseNumbers {
    units: string[]; // 0–9 ABSOLUTE (counting) forms
    ten: string; // 10 absolute (għaxra)
    teens: string[]; // 11–19
    tens: Record<string, string>; // "20".."90"
    attributiveShort: string[]; // 2–10 pre-mija / pre-miljuni (żewġ, tliet, …, għaxar)
    attributiveLong: string[]; // 2–10 pre-elf/elef (żewġt, tlitt, …, għaxart)
    magnitudes: {
        hundred: string;
        hundredConstruct: string;
        hundredDual: string;
        thousand: string;
        thousandDual: string;
        thousandPlural: string;
        million: string;
        millionPlural: string;
        billion: string;
        billionPlural: string;
    };
    connector: string; // "u"
    teenLinker: string; // "-il"
}

/** One magnitude's singular / plural / (optional) dual, plus which attributive series its multiplier takes. */
interface Magnitude {
    sg: string;
    pl: string;
    dual?: string;
    /** true → the multiplier uses the LONG -t attributive series (elf is monosyllabic: tlitt elef). */
    longAttributive: boolean;
}

/** 1 ≤ n < 100, ABSOLUTE series. Units-first with `u` inside 21–99 (ħamsa u erbgħin). */
function below100(n: number, N: MalteseNumbers): string {
    if (n < 10) return N.units[n]!;
    if (n === 10) return N.ten;
    if (n < 20) return N.teens[n - 11]!;
    const t = Math.floor(n / 10) * 10,
        u = n % 10;
    const ten = N.tens[String(t)]!;
    return u === 0 ? ten : `${N.units[u]} ${N.connector} ${ten}`;
}

/** The round-hundred constituent of an ABSOLUTE number: 100 mija, 200 mitejn (dual), 300 tliet mija. */
function hundredPhrase(h: number, N: MalteseNumbers): string {
    if (h === 1) return N.magnitudes.hundred;
    if (h === 2) return N.magnitudes.hundredDual;
    return `${N.attributiveShort[h]} ${N.magnitudes.hundred}`;
}

/**
 * A magnitude COUNT (the multiplier phrase + the correctly-inflected magnitude word): `elf`, `elfejn`,
 * `tlitt elef`, `tnax-il elf`, `wieħed u għoxrin elf`, `mitt elf`, `tliet mija u ħdax-il elf`.
 */
function magnitudePhrase(count: number, m: Magnitude, N: MalteseNumbers): string {
    if (count === 1) return m.sg; // elf / miljun — no leading wieħed
    if (count === 2) return m.dual ?? `${N.attributiveShort[2]} ${m.pl}`; // elfejn | żewġ miljuni
    if (count <= 10) {
        // 3–10: the magnitude goes PLURAL and the multiplier takes the attributive series (tlitt elef, tliet miljuni)
        const attr = m.longAttributive ? N.attributiveLong[count]! : N.attributiveShort[count]!;
        return `${attr} ${m.pl}`;
    }
    if (count < 20) return `${N.teens[count - 11]}${N.teenLinker} ${m.sg}`; // tnax-il elf — singular again from 11 up
    if (count < 100) return `${below100(count, N)} ${m.sg}`; // wieħed u għoxrin elf
    const h = Math.floor(count / 100),
        r = count % 100;
    // A round hundred of magnitudes takes the CONSTRUCT mitt before the monosyllable: mitt elf, tliet mitt elf.
    if (r === 0) {
        const head =
            h === 1
                ? N.magnitudes.hundredConstruct
                : h === 2
                  ? N.magnitudes.hundredDual
                  : `${N.attributiveShort[h]} ${N.magnitudes.hundredConstruct}`;
        return `${head} ${m.sg}`;
    }
    // …and the free mija when a remainder follows: tliet mija u ħdax-il elf.
    const tail = r > 10 && r < 20 ? `${N.teens[r - 11]}${N.teenLinker}` : below100(r, N);
    return `${hundredPhrase(h, N)} ${N.connector} ${tail} ${m.sg}`;
}

/** Read a digit string one digit at a time (the ≥10¹² / unsafe-integer fallback). */
export function readDigits(digits: string, N: MalteseNumbers): string {
    return [...digits].map((d) => N.units[Number(d)] ?? d).join(" ");
}

/**
 * Non-negative integer → Maltese cardinal words (space-separated). Builds the numeral as a list of
 * CONSTITUENTS (billions, millions, thousands, hundreds, tens-and-units) and joins them with the connector `u`
 * before the LAST one only — the attested Maltese pattern (`elf erba' mija u għoxrin`). ≥10¹² or non-safe →
 * digit-by-digit.
 */
export function numberToWords(n: number, N: MalteseNumbers): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) return readDigits(String(n), N);
    if (n === 0) return N.units[0]!; // żero
    const M = N.magnitudes;
    const BILLION: Magnitude = { sg: M.billion, pl: M.billionPlural, longAttributive: false };
    const MILLION: Magnitude = { sg: M.million, pl: M.millionPlural, longAttributive: false };
    const THOUSAND: Magnitude = { sg: M.thousand, pl: M.thousandPlural, dual: M.thousandDual, longAttributive: true };

    const parts: string[] = [];
    let rest = n;
    for (const [scale, mag] of [
        [1e9, BILLION],
        [1e6, MILLION],
        [1e3, THOUSAND],
    ] as [number, Magnitude][]) {
        const c = Math.floor(rest / scale);
        if (c > 0) {
            parts.push(magnitudePhrase(c, mag, N));
            rest -= c * scale;
        }
    }
    if (rest >= 100) {
        parts.push(hundredPhrase(Math.floor(rest / 100), N));
        rest %= 100;
    }
    if (rest > 0) parts.push(below100(rest, N));
    // `u` attaches to the FINAL constituent only; the rest simply juxtapose.
    if (parts.length === 1) return parts[0]!;
    return `${parts.slice(0, -1).join(" ")} ${N.connector} ${parts[parts.length - 1]}`;
}
