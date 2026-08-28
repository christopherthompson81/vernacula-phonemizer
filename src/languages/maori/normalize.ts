import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST as DEF } from "./manifest.ts";
import { tr } from "../../core/provenance.ts";

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
 * ⚠ THE "NO ATTESTED WORD" NOTE THAT USED TO NAME `mm` HERE WAS WRONG, and it is worth seeing why. It read
 * "`mm`, `t` and `kg` have no attested Māori word, so their abbreviations leak rather than be invented".
 * `t` and `kg` still stand. `mm` did not survive a look: Te Aka lists ⟨mirimita⟩ as a headword — *noun,
 * (loan) millimetre* — and mi.wikipedia writes it in the unit slot twice in one climate table,
 * *"E 688 mirimita te toharite o te ua o te tau"* ("688 mm is the annual average rainfall") and
 * *"E 194.3 mirimita te ua nui rawa i te rā kotahi"*. The mined artifact has the abbreviation in the same
 * slot — `5 mm (1/5 inihi)` — so the key had an instance too. A unit is not unattested because the first
 * reader did not look; the SI words are the ones every written language settles.
 *
 * ⚠ AND THE TWO REGISTERS DISAGREE, so the choice is recorded rather than assumed. Paekupu (Te Ine, the
 * measurement topic of the Ministry of Education / Te Taura Whiri terminology bank) gives a COINED series —
 * `mitamano` (mm), `mitarau` (cm), `manomita` (km) — built on `mano` "thousand" and `rau` "hundred". The
 * running-text register is the TRANSLITERATION — `kiromita` ×38, `mirimita` ×2, `henimita` ×1 — and all
 * three coined forms probe **0 token / 0 substring** on mi.wikipedia. This file already reads `kiromita`
 * for ⟨km⟩, so `mirimita` is the register-consistent choice AND the attested one; taking Paekupu's series
 * would mean re-reading ⟨km⟩ as `manomita` against 38 counter-instances. Paekupu's value here is that it
 * confirms the CONCEPT has a settled Māori form and pairs each with its symbol.
 *
 * ⚠ `heketea` AND `rita` ARE AGREED BY BOTH REGISTERS, which is why they need no such argument. Te Aka:
 * *heketea, noun, (loan) hectare — a metric unit of square measure equal to 2.471 acres or 10,000 square
 * metres*; *rita, noun, (loan) litre*, "the main unit for measuring capacity". Paekupu pairs `heketea` with
 * ⟨ha⟩ and `rita` with ⟨l⟩. mi.wikipedia writes `heketea` ×5 across 5 articles, every one an area after a
 * number and one glossed against the symbols it is being declared for: `200 heketea (2.0 km2; 490 eka)`.
 *
 * ⚠ `rita` IS THE ONE WHOSE WIKI HITS ARE A TRAP, and the dictionary is what rescues it. Both mi.wikipedia
 * tokens are **Rita Lee**, the Brazilian singer — the `bar`/`ti`/`ht` failure mode exactly, where an
 * `attested` verdict is a proper noun. The verdict is therefore taken from Te Aka and Paekupu, which gloss
 * the sense, and NOT from the hit count.
 *
 * ⚠ THE ONE-LETTER KEYS ⟨l⟩/⟨L⟩ SHIP, and in this language the usual trap-46 argument runs the other way:
 * ⟨l⟩ IS NOT A LETTER OF THE MĀORI ALPHABET. Māori has no /l/, so a digit-adjacent `l` in Māori text cannot
 * be the tail of a native word or a bound clitic — it is a symbol or it is foreign. Measured on the mined
 * artifact: digit-adjacent bare `l` ×0, i.e. no counter-example to find. Unread it was not even silent —
 * `10 l` reached the IPA as *tekau ˈɛɫ*, the ENGLISH LETTER NAME, routed there by `isNativeWord` failing on
 * the `l` exactly as `plus`/`minus` do below. Both cases are declared because BIPM makes both official.
 *
 * Deliberately absent: `t` and `kg` have no attested Māori word, so their abbreviations leak rather than be
 * invented — and a digit-adjacent `t` here is usually `tāngata` ("people"), not a tonne.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: DEF.symbolTier.percent,
    currency: DEF.symbolTier.currency,
    units: DEF.symbolTier.units,
    rateDenominators: DEF.symbolTier.rateDenominators,
    unitPer: DEF.symbolTier.unitPer,
    exponentWords: DEF.symbolTier.exponentWords,
    magnitudes: DEF.symbolTier.magnitudes,
    multiply: DEF.symbolTier.multiply,
});

/** The Māori normalization pass — the shared symbol tier plus the local sign rules below. */
export function normalizeMaori(input: string): string {
    // The entity must go before the bare sign, or `&amp;` becomes "me amp ;". Spaced both sides so `B&B` stays
    // two initialisms rather than fusing into one token.
    let s = input.replace(/&amp;/giu, "&").replace(/&/gu, " me ");
    // Māori has no /l/ or /s/, so `plus` and `minus` are unsayable natively; they reach the English reader by the
    // engine's routing path (`isNativeWord` walks the word as the g2p does, and both fail at the `l`). Guarded
    // against a spaced range, which would otherwise read as a sign.
    s = tr(s, /(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)/gu, (m0: string, off: number, whole: string) =>
        /\d\s*$/u.test(whole.slice(0, off)) ? m0 : "minus ",
    );
    // `tāpiri` is the arithmetic verb (append / sum), so it reads the OPERATOR only — as a polarity sign it would
    // say "thirty degrees APPEND". Digits on BOTH sides keep a UTC offset or signed temperature away from it.
    s = tr(s, /(\d)\s?\+\s?(?=\d)/gu, "$1 tāpiri ");

    // ⚠ ORDER IS LOAD-BEARING: the operator arm above must claim `3 + 4` first, or the leading-sign arm below
    // matches its space and reads *toru plus whā*. Two sign arms are needed — `(\S)\+` for a glued `UTC+1`, the
    // boundary arm for `+5` / `+30°C`.
    s = tr(s, /±/gu, " plus minus ");
    s = tr(s, /(\S)\+\s?(?=\d)/gu, "$1 plus ");
    s = tr(s, /(^|[\s(])\+\s?(?=\d)/gu, "$1plus ");

    // Relational and division signs have native words, so unlike the loans above they stay on the native branch.
    // ⚠ All four are INFIX despite Māori being VSO: each construction puts its preposition before the second
    // operand (`A < B` → "A iti iho i B"), so the operands keep written order and need no reordering.
    s = tr(s, /\s?=\s?/gu, " rite ki ");
    s = tr(s, /\s?<\s?/gu, " iti iho i ");
    s = tr(s, /\s?>\s?/gu, " nui ake i ");
    s = tr(s, /\s?÷\s?/gu, " whakawehe ki ");

    // ⚠ `putu` (degree) and `pūtu` (boots) differ only by vowel length — the macron is the whole distinction.
    // °F is not declared: no Māori form for Fahrenheit, and this file does not invent one (cf. `mm` above).
    s = tr(s, /(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 putu Herehiūhu");
    s = tr(s, /(\d)\s?°/gu, "$1 putu");

    // Everything else this language needs is declared data, not a local rule.
    return SYMBOLS(s);
}
