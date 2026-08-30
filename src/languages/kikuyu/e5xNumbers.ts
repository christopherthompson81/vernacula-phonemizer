/**
 * SHARED cardinal compositor for the Central-Kenya Bantu E5x pair — Kikuyu / Gĩkũyũ (ki, E51) and Kamba /
 * Kĩkamba (kam, E55). The two languages have the SAME numeral SHAPE (only the words differ), so the algorithm
 * lives here once and each language supplies its own table: kamba/numbers.ts imports this module (a
 * cross-language import inside src/languages/, the house pattern — src/core/ is untouched).
 *
 * THE SHAPE (E5x multiplicative Bantu):
 *   • units 1–5 are ADJECTIVAL (they take noun-class concord); 6–9 are uninflected nouns/stems.
 *   • tens = the class-4 plural of "ten" + a multiplier:  mĩrongo ĩrĩ (ki) / miongo ĩlĩ (kam) = 20.
 *   • hundreds = class-5 "hundred" singular vs its class-6 plural + a multiplier: igana rĩmwe / magana meerĩ (ki),
 *     ĩana yĩmwe / maana elĩ (kam).
 *   • thousands + millions are INVARIANT class-9/10 nouns followed by the multiplier rendered recursively:
 *     ngili ĩmwe (1 000), ngili ĩkũmi (10 000), ngiri igana rĩmwe (100 000) — so a BILLION needs no new word,
 *     it is "a thousand million" (milioni ngili ĩmwe). Nothing falls back to digit-by-digit.
 *   • the components are JUXTAPOSED and the connective "na" appears only before the LAST one. This is not a
 *     guess: the Peace Corps Kikamba manual writes 1957 as "ngili ĩmwe maana kenda mĩongo ĩtano na mũonza"
 *     and 250 as "maana elĩ na mĩongo ĩtano" — exactly what this composer reproduces.
 *
 * NUMERAL FORM CHOSEN: the CITATION / COUNTING series (the manual's own kũtala "to count" list — ĩmwe, ĩlĩ,
 * itatũ …), i.e. the class-5/8 i-/ĩ- shape a speaker uses when counting aloud with no noun present. A TTS
 * reading a bare integer has no noun to agree with, so a concord form for some arbitrary class would be wrong.
 */
import { digitIndex } from "../../core/numbers.ts";

/** The per-language word table for the shared E5x composer. Index 0 of the *Mult arrays is unused. */
export interface E5xNumberTable {
    /** zero (a bare "0"). */
    zero: string;
    /** citation/counting forms 1–9 at indices 1–9; index 0 unused. */
    units: string[];
    /** "ten" (class 5): ikũmi / ĩkũmi. */
    ten: string;
    /** "tens" (class 4 plural): mĩrongo / miongo. */
    tens: string;
    /** multiplier after `tens`, 2–9 (2 takes concord: ĩrĩ / ĩlĩ). */
    tensMult: string[];
    /** exactly 100: igana rĩmwe / ĩana yĩmwe. */
    hundredOne: string;
    /** 100 followed by a remainder — Kamba drops the concord word (ĩana na mĩongo ĩtano = 150). */
    hundredRest: string;
    /** "hundreds" (class 6 plural): magana / maana. */
    hundreds: string;
    /** multiplier after `hundreds`, 2–9 (class-6 concord on 2–5). */
    hundredsMult: string[];
    /** "thousand" (invariant): ngiri / ngili. */
    thousand: string;
    /** "million" (invariant): mĩrioni / milioni. */
    million: string;
    /** the additive connective: na. */
    and: string;
}

/** The magnitude components of 1 ≤ n < 10⁹⁺, outermost first (million, thousand, hundred, ten, unit). */
function components(n: number, T: E5xNumberTable): string[] {
    const parts: string[] = [];
    const m = Math.floor(n / 1e6);
    if (m > 0) parts.push(`${T.million} ${render(m, T)}`);
    const th = Math.floor((n % 1e6) / 1000);
    if (th > 0) parts.push(`${T.thousand} ${render(th, T)}`);
    const h = Math.floor((n % 1000) / 100);
    if (h === 1) parts.push(n % 100 === 0 ? T.hundredOne : T.hundredRest);
    else if (h > 1) parts.push(`${T.hundreds} ${T.hundredsMult[h]!}`);
    const t = Math.floor((n % 100) / 10);
    if (t === 1) parts.push(T.ten);
    else if (t > 1) parts.push(`${T.tens} ${T.tensMult[t]!}`);
    const u = n % 10;
    if (u > 0) parts.push(T.units[u]!);
    return parts;
}

/** 1 ≤ n → the components juxtaposed, with the connective `na` before the LAST one only (the attested rule). */
function render(n: number, T: E5xNumberTable): string {
    const parts = components(n, T);
    if (parts.length === 1) return parts[0]!;
    return `${parts.slice(0, -1).join(" ")} ${T.and} ${parts[parts.length - 1]!}`;
}

/** A non-negative integer → space-separated E5x cardinal words. Composes every value up to 2⁵³ (billions are
 *  "thousands of millions"); only a digit string too long to be an exact double degrades to digit-by-digit. */
export function renderE5xNumber(n: number, T: E5xNumberTable, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0)
        return [...(raw ?? String(Math.abs(n)))].map((d) => (d === "0" ? T.zero : (T.units[digitIndex(d)] ?? d))).join(" ");
    if (n === 0) return T.zero;
    return render(n, T);
}
