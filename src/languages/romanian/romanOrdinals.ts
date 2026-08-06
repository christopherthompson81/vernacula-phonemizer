/**
 * Romanian Roman-numeral reading — ORDINAL, in the `al …-lea` construction.
 *
 * Romanian's own orthography writes the century that way: "secolul al XIX-lea", with the ordinal article and
 * suffix spelled around the numeral, read *secolul al nouăsprezecelea*. Regnal names take the same shape
 * (`Carol al II-lea` = *al doilea*).
 *
 * THE ARTICLE IS IN THE TABLE (`al nouăsprezecelea`, not `nouăsprezecelea`) because the input this serves is
 * the ARTICLE-LESS spelling `secolul XVIII`, which is what occurs in transcripts and running prose. Nothing
 * else in that sentence supplies the `al`.
 *
 * KNOWN GAP: the fully-written form `secolul al XIX-lea` still reads as a cardinal. Handling it means
 * consuming the `-lea` suffix, which only the shared pass can do (compare French's `XIVe`). Adding `al` to
 * `ordinalBefore` instead would emit *secolul al al nouăsprezecelea* plus a dangling `lea` — strictly worse.
 *
 * AGREEMENT: `al …-lea` is masculine/neuter, and `secol` is neuter, so the century reading is correct. A
 * feminine head needs `a …-a` (*a doua ediție*, *Elisabeta a II-a*), so feminine nouns and female regnal
 * names are kept OUT of the trigger lists and keep the cardinal rather than acquiring a wrong-gender ordinal.
 *
 * ⚠ `ro` stoplists `vii` (= "alive" / "vines") in core/roman.ts, re-exported below so the wiring cannot lose
 * it. Consequence: `secolul VII` is not converted at all — the intended trade, since `exclude` is checked
 * before any ordinal logic and the context rules here cannot re-enable it.
 */
import { ROMAN_EXCLUSIONS, type RomanPolicy } from "../../core/roman.ts";
import { numberWords } from "./romanian.ts";

/** Romanian masculine/neuter ordinal (`al …-lea`) for any n a Roman numeral can encode. */
function romanianOrdinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1) return undefined;
    if (n === 1) return "întâi"; // secolul I = secolul întâi; there is no *al unulea*
    // `stem: true` — the ordinal is built on the bare numeral, without the phrasal article or the `de` linker
    // the CARDINAL takes before a magnitude noun (100 = "o sută" spoken, but "al sutălea", not *al o sutălea).
    const card = numberWords(n, { stem: true });
    const words = card.split(" ");
    const last = words[words.length - 1]!;
    // -lea after a vowel (doi → doilea, nouăsprezece → nouăsprezecelea, sută → sutălea),
    // -ulea after a consonant (opt → optulea, milion → milionulea).
    words[words.length - 1] = /[aeiouăâîy]$/u.test(last) ? `${last}lea` : `${last}ulea`;
    return `al ${words.join(" ")}`;
}

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    exclude: ROMAN_EXCLUSIONS.ro, // "vii" = alive/vines — preserved here so the wiring cannot drop it
    ordinal: romanianOrdinal,
    /**
     * Noun BEFORE the numeral: the century noun in its attested forms, the enumeration heads that take the
     * same construction, and the male regnal given names — in "Carol II" the word before the numeral is the
     * NAME, not a title. That name list is the one heuristic part of this file; a miss just leaves the
     * cardinal. `al`/`a` are deliberately absent (see KNOWN GAP).
     */
    ordinalBefore:
        /^(secolul|secolele|secolelor|secole|secol|mileniul|mileniile|capitolul|volumul|tomul|cântul|actul|articolul|paragraful|regele|papa|împăratul|țarul|sultanul|carol|mihai|ferdinand|alexandru|constantin|nicolae|ștefan|mircea|vlad|petru|radu|iancu|ioan|paul|pius|benedict|francisc|leon|grigore|clement|inocențiu|urban|sixt|celestin|adrian|bonifaciu|honoriu|ludovic|filip|henric|frederic|wilhelm|george|eduard|iacob|richard|alfons|iosif|leopold|maximilian|otto|napoleon|petre)$/iu,
    /**
     * Noun AFTER the numeral. Narrow by design: Romanian normally puts the ordinal after its noun, so this
     * fires only for the postposed order that occurs with event names — and it is where the range escapes
     * the century (`al L-lea aniversar`). Masculine/neuter only (see AGREEMENT).
     */
    ordinalAfter: /^(secol|secole|aniversar|congres|campionat|volum|capitol|articol)$/iu,
};
