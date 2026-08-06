import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * Māori (mi) text normalization — the pre-tokenizer pass, pure text→text. Runs inside maori.ts's `text()`.
 *
 * Symbol tier only. Number FORMATTING is not handled here: the tokenizer's `(\d+)` stops at a comma and `,` is a
 * clause mark, so comma-grouped numerals, decimals, ranges and clock times still pass through unnormalized.
 * Squares, cubes, percent and rates are POSTPOSED in Māori.
 *
 * ⚠ `tapawhā` and `tapatoru` are the SHAPES, not the powers — tapawhā is a square as in a plaza, tapatoru a
 * triangle. Both outnumber the correct words in running text, so frequency alone picks wrong here. Same trap as
 * fr *carré*, tr *kare*, gu *વર્ગ*.
 *
 * ⚠ `m/h` is MILES per hour, declared as its own key rather than left to the rate path: with only `m` plus an `h`
 * denominator the tier would read it as *metres* per hour. The slashed key sorts first because `unitAlt` is
 * longest-first.
 *
 * Deliberately absent: `mm`, `t` and `kg` have no attested Māori word, so their abbreviations leak rather than be
 * invented — and a digit-adjacent `t` here is usually `tāngata` ("people"), not a tonne.
 */
const SYMBOLS = makeSymbolNormalizer({
    multiply: { times: "whakarea" },
    percent: ["ōrau"],
    // Prefixed forms are their own keys, longest-first: with only a bare `$`, `AUD$45` read its letters as a word
    // and dropped the sign. `NZ$` is declared because it is this language's own currency, not on frequency; the
    // other four do not depend on it.
    currency: { "US$": ["tāra"], "AUD$": ["tāra"], "NZ$": ["tāra"], $: ["tāra"], "£": ["pauna"] },
    // ⚠ A magnitude must be declared or the currency word lands INSIDE the number: without these, `$2.3 piriona`
    // read "rua . toru TĀRA piriona" — the sign is adjacent to the digits, so the word is emitted there and the
    // magnitude stranded behind it. Māori writes the magnitude first and takes no connective.
    magnitudes: ["miriona", "piriona", "mano"],
    units: { km: ["kiromita"], m: ["mita"], "m/h": ["maero ia hāora"] },
    unitPer: "ia",
    rateDenominators: { h: "hāora", s: "hēkona" },
    exponentWords: { squared: ["pūrua"], cubed: ["pūtoru"], position: "after" },
});

/** The Māori normalization pass — the shared symbol tier plus the local sign rules below. */
export function normalizeMaori(input: string): string {
    // The entity must go before the bare sign, or `&amp;` becomes "me amp ;". Spaced both sides so `B&B` stays
    // two initialisms rather than fusing into one token.
    let s = input.replace(/&amp;/giu, "&").replace(/&/gu, " me ");
    // Māori has no /l/ or /s/, so `plus` and `minus` are unsayable natively; they reach the English reader by the
    // engine's routing path (`isNativeWord` walks the word as the g2p does, and both fail at the `l`). Guarded
    // against a spaced range, which would otherwise read as a sign.
    s = s.replace(/(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)/gu, (m0: string, off: number, whole: string) =>
        /\d\s*$/u.test(whole.slice(0, off)) ? m0 : "minus ",
    );
    // `tāpiri` is the arithmetic verb (append / sum), so it reads the OPERATOR only — as a polarity sign it would
    // say "thirty degrees APPEND". Digits on BOTH sides keep a UTC offset or signed temperature away from it.
    s = s.replace(/(\d)\s?\+\s?(?=\d)/gu, "$1 tāpiri ");

    // ⚠ ORDER IS LOAD-BEARING: the operator arm above must claim `3 + 4` first, or the leading-sign arm below
    // matches its space and reads *toru plus whā*. Two sign arms are needed — `(\S)\+` for a glued `UTC+1`, the
    // boundary arm for `+5` / `+30°C`.
    s = s.replace(/±/gu, " plus minus ");
    s = s.replace(/(\S)\+\s?(?=\d)/gu, "$1 plus ");
    s = s.replace(/(^|[\s(])\+\s?(?=\d)/gu, "$1plus ");

    // Relational and division signs have native words, so unlike the loans above they stay on the native branch.
    // ⚠ All four are INFIX despite Māori being VSO: each construction puts its preposition before the second
    // operand (`A < B` → "A iti iho i B"), so the operands keep written order and need no reordering.
    s = s.replace(/\s?=\s?/gu, " rite ki ");
    s = s.replace(/\s?<\s?/gu, " iti iho i ");
    s = s.replace(/\s?>\s?/gu, " nui ake i ");
    s = s.replace(/\s?÷\s?/gu, " whakawehe ki ");

    // ⚠ `putu` (degree) and `pūtu` (boots) differ only by vowel length — the macron is the whole distinction.
    // °F is not declared: no Māori form for Fahrenheit, and this file does not invent one (cf. `mm` above).
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gu, "$1 putu Herehiūhu");
    s = s.replace(/(\d)\s?°/gu, "$1 putu");

    // Everything else this language needs is declared data, not a local rule.
    return SYMBOLS(s);
}
