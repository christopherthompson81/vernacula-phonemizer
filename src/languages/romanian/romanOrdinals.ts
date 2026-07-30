/**
 * ROMANIAN (ro) Roman-numeral reading — ORDINAL, in the `al …-lea` construction.
 *
 * Romanian reads a century as an ordinal, and its own orthography says so out loud: the century is
 * *written* "secolul al XIX-lea", i.e. with the ordinal article `al` and the ordinal suffix `-lea` spelled
 * around the numeral. Wikipedia's Romanian style guide for dates and numbers requires that form —
 * "secolele se scriu cu cifre romane, cu articol … *secolul al XIX-lea*", not *secolul XIX* —
 *   → https://ro.wikipedia.org/wiki/Wikipedia:Date_%C8%99i_numere
 * and the article titles/categories follow it (`Categorie:Secolul al XIX-lea`). Read aloud that is
 * *secolul al nouăsprezecelea*. Regnal names take the same construction (`Carol al II-lea` = *al doilea*).
 *
 * THE ARTICLE IS IN THE TABLE — `al nouăsprezecelea`, not `nouăsprezecelea` — and that is a deliberate
 * choice about which input we are serving. The form we can actually rewrite is the ARTICLE-LESS spelling
 * `secolul XVIII`, which is what occurs in the FLEURS transcripts (and in plenty of running prose); for
 * that input the correct spoken string is *secolul al optsprezecelea*, so the `al` has to come from us —
 * nothing else in the sentence supplies it. Emitting the bare `optsprezecelea` there would be
 * ungrammatical.
 *   KNOWN GAP, deliberate: for the fully spelled `secolul al XVIII-lea` the word immediately before the
 *   numeral is `al`, which is NOT in `ordinalBefore`, so no ordinal fires and the numeral falls through to
 *   the cardinal — the pre-existing behaviour, unchanged (the trailing `-lea` is already read as a stray
 *   word today). Handling it properly means consuming the `-lea` suffix, which only the shared pass can do
 *   (compare French's `XIVe`); adding `al` to `ordinalBefore` instead would emit *secolul al al
 *   nouăsprezecelea* plus a dangling `lea`, which is strictly worse.
 *
 * FORM: built from Romanian's own cardinal compositor (`numberWords` in romanian.ts) — the ordinal is
 * regular: `al` + cardinal + `-lea`, with `-ulea` after a consonant-final word (opt → al optulea,
 * douăzeci și opt → al douăzeci și optulea). Only 1 is irregular (*întâi*, never *al unulea*), and in
 * practice unreachable anyway: the shared pass never converts the single letter `I`.
 *
 * AGREEMENT: masculine/neuter (`al …-lea`). `secol` is neuter and takes it, so the century reading is
 * correct. LIMITATION: a feminine head needs `a …-a` (*a doua ediție*, *Elisabeta a II-a*), so feminine
 * nouns and female regnal names are kept OUT of the trigger lists and keep the cardinal reading rather
 * than acquiring a wrong-gender ordinal.
 *
 * INTERACTION with the per-language exclusion in core/roman.ts: `ro` already stoplists `vii` (= "alive" /
 * "vines"), and this file re-exports that exclusion rather than restating it, so the wiring cannot lose
 * it. Consequence: `secolul VII` is not converted at all — neither cardinal nor ordinal — which is the
 * intended trade (six false "alive"→7 readings in FLEURS versus one century). The context rules below
 * cannot and do not re-enable it: `exclude` is checked before any ordinal logic runs.
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
     * Noun BEFORE the numeral. The century noun in the forms that actually occur — definite `secolul`
     * (overwhelmingly the attested one), indefinite `secol`, plural `secolele`/`secole`, genitive
     * `secolelor` — plus `mileniul` and the enumeration heads that take the same construction, plus the
     * male regnal given names (the word before the numeral in "Carol II" is the name, not a title; that
     * name list is the one heuristic part of this file, and a miss just leaves the cardinal).
     * `al`/`a` are deliberately absent — see the KNOWN GAP note above.
     */
    ordinalBefore:
        /^(secolul|secolele|secolelor|secole|secol|mileniul|mileniile|capitolul|volumul|tomul|cântul|actul|articolul|paragraful|regele|papa|împăratul|țarul|sultanul|carol|mihai|ferdinand|alexandru|constantin|nicolae|ștefan|mircea|vlad|petru|radu|iancu|ioan|paul|pius|benedict|francisc|leon|grigore|clement|inocențiu|urban|sixt|celestin|adrian|bonifaciu|honoriu|ludovic|filip|henric|frederic|wilhelm|george|eduard|iacob|richard|alfons|iosif|leopold|maximilian|otto|napoleon|petre)$/iu,
    /**
     * Noun AFTER the numeral. Kept narrow: Romanian normally puts the ordinal numeral after its noun, so
     * this fires only for the postposed-noun order that does occur with event names — and it is where the
     * range escapes the century (`al L-lea aniversar`). Masculine/neuter nouns only (see AGREEMENT).
     */
    ordinalAfter: /^(secol|secole|aniversar|congres|campionat|volum|capitol|articol)$/iu,
};
