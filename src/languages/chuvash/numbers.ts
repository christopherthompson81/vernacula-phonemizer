/**
 * CHUVASH (chv) cardinal number composition — the SOLE surviving OGHUR (Bulgaric) Turkic language, Cyrillic.
 * Authored DATA + the compositor; words in Chuvash's own orthography, phonemized by chuvash.ts.
 *
 * ★ Chuvash is researched SEPARATELY from the Common-Turkic seven, and it needed to be — its numerals are not the
 *   Kipchak/Oghuz set with a sound-shift applied, and its composition has two features none of tr/tk/tt/ba/kaa/crh/
 *   nog has:
 *
 *   1. TWO SERIES per unit. Each of 1-10 (and 50) has a FULL/emphatic form with a lengthened medial consonant, used
 *      substantivally — when the numeral stands alone, i.e. when you are simply counting — and a SHORT form with the
 *      single consonant, used ATTRIBUTIVELY, before the thing counted. пӗрре/пӗр, иккӗ/икӗ~ик, виҫҫӗ/виҫ,
 *      тӑваттӑ/тӑват, пиллӗк/пилӗк, улттӑ/улт, ҫиччӗ/ҫич, саккӑр/сакӑр, тӑххӑр/тӑхӑр, вуннӑ/вун, аллӑ/алӑ. A digit
 *      run read aloud is the counting context, so the FULL form is the default here; the SHORT form appears exactly
 *      where the numeral multiplies a following magnitude word (ик ҫӗр 200, виҫ пин 3000) — that IS an attributive
 *      slot — and in the teens, where вун- is the short ten (вун ҫиччӗ 17).
 *   2. UNIT-TIMES-TEN 80 and 90. Chuvash has no *seksen/*toqsan: 80 is сакӑрвуннӑ (8×10) and 90 тӑхӑрвуннӑ (9×10),
 *      short unit + the ten, written as one word. 20-70 are ordinary lexemes (ҫирӗм, вӑтӑр, хӗрӗх, аллӑ, утмӑл,
 *      ҫитмӗл) — note 40 хӗрӗх and 60 утмӑл have no Common-Turkic cognate shape at all.
 *
 * The multiplier is dropped before ҫӗр (100 = ҫӗр) and пин (1000 = пин), kept before миллион/миллиард (пӗр миллион).
 *
 * SOURCE: Chuvash Wikipedia, article "Хисеп ячĕ" (numeral), which lists the root numerals — "пӗрре, иккӗ, виҫҫӗ,
 * тӑваттӑ, пиллӗк, улттӑ, ҫиччӗ, саккӑр, тӑххӑр, вуннӑ, ҫирӗм, вӑтӑр, хӗрӗх, аллӑ, утмӑл, ҫитмӗл, ҫӗр, пин" — and
 * states the composition rule with its own worked examples: "Ытти мĕнпур хисепсене çак тымарсен çыхăнăвĕпе
 * кăтартаççĕ (вун çиччĕ, çирĕм тăваттă, çĕр вăтăр саккăр)" = all other numbers are shown by combining these roots
 * (17, 24, 138). Second witness for the two series, for 80/90 and for the round hundreds: Omniglot "Numbers in
 * Chuvash", which prints both columns (пӗрре/пӗр, иккӗ/икӗ, ик …), сакӑрвуннӑ, тӑхӑрвуннӑ and "ик ҫӗр" 200;
 * English Wiktionary Module:number list/data/cv agrees on every lexeme (including 80/90) and supplies ноль.
 * JUDGMENT CALL — 60: the Chuvash-Wikipedia numeral article prints ⟨упшăл⟩, which is a typo (or a deep dialect
 * form); Omniglot and the Wiktionary data module both give ⟨утмӑл⟩, taken here.
 * JUDGMENT CALL — orthography: Chuvash Wikipedia writes the reduced vowels with the Latin-lookalike ⟨ă ĕ⟩ (U+0103 /
 * U+0115). This table uses the proper Cyrillic ⟨ӑ ӗ⟩ (U+04D1 / U+04D7), which is what the g2p reads.
 * JUDGMENT CALL — the round hundreds are written SPACED (ик ҫӗр), following Omniglot; fused spellings (икҫӗр) also
 * occur in print. Spacing is the safer choice for a phonemizer: each element keeps its own stress domain.
 * SIMPLIFICATION — attributive shortening is applied to the UNITS and to the ten (вуннӑ→вун) only. A round ten in a
 * multiplier slot keeps its full form (10 000 = вун пин, but 50 000 = аллӑ пин rather than алӑ пин); that case is
 * rare and the sources do not attest the shortened variant.
 */

// FULL (substantival / counting) forms — the default for a digit run read aloud.
const FULL = ["ноль", "пӗрре", "иккӗ", "виҫҫӗ", "тӑваттӑ", "пиллӗк", "улттӑ", "ҫиччӗ", "саккӑр", "тӑххӑр"];
// SHORT (attributive) forms — used when the unit multiplies a following magnitude word (ик ҫӗр, виҫ пин).
const SHORT = ["ноль", "пӗр", "ик", "виҫ", "тӑват", "пилӗк", "улт", "ҫич", "сакӑр", "тӑхӑр"];
const TEN_FULL = "вуннӑ", // 10 standing alone
    TEN_SHORT = "вун"; // the teens prefix and the attributive ten (вун ҫиччӗ, вун пин)
const TENS: Record<number, string> = {
    20: "ҫирӗм", 30: "вӑтӑр", 40: "хӗрӗх", 50: "аллӑ", 60: "утмӑл", 70: "ҫитмӗл",
    80: "сакӑрвуннӑ", 90: "тӑхӑрвуннӑ", // 8×10 and 9×10 — the Oghur pattern, one word each
};
const HUNDRED = "ҫӗр",
    THOUSAND = "пин",
    MILLION = "миллион",
    BILLION = "миллиард";

/** One unit 1-9 in the series the slot calls for: SHORT when it modifies a following magnitude word, else FULL. */
const unit = (u: number, attr: boolean): string => (attr ? SHORT[u]! : FULL[u]!);

/**
 * A non-negative safe integer → the ordered Chuvash number WORDS (spellings, not IPA).
 * `attr` = this group MULTIPLIES a magnitude word that follows it, so its final unit takes the short/attributive
 * series (3000 → виҫ пин, not виҫҫӗ пин). Top-level calls are substantival → `attr` false.
 */
export function numberToWords(n: number, attr = false): string[] {
    if (n < 10) return [unit(n, attr)];
    if (n === 10) return [attr ? TEN_SHORT : TEN_FULL];
    if (n < 20) return [TEN_SHORT, unit(n - 10, attr)]; // вун ҫиччӗ (17) — the cited example
    if (n < 100) {
        const t = Math.floor(n / 10) * 10, // ROUND value — TENS is keyed 20..90
            u = n % 10;
        return [TENS[t]!, ...(u ? [unit(u, attr)] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        // the hundred-multiplier is an attributive slot → SHORT form (ик ҫӗр); 100 itself drops it (ҫӗр)
        return [...(h > 1 ? [SHORT[h]!] : []), HUNDRED, ...(r ? numberToWords(r, attr) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return [...(th > 1 ? numberToWords(th, true) : []), THOUSAND, ...(r ? numberToWords(r, attr) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000),
            r = n % 1_000_000;
        return [...numberToWords(m, true), MILLION, ...(r ? numberToWords(r, attr) : [])];
    }
    const b = Math.floor(n / 1_000_000_000),
        r = n % 1_000_000_000;
    return [...numberToWords(b, true), BILLION, ...(r ? numberToWords(r, attr) : [])];
}
