/**
 * BASHKIR (ba) cardinal number composition — Kipchak Turkic (Tatar's closest sibling), Cyrillic. Authored DATA +
 * the compositor; the words are in Bashkir's OWN orthography and phonemized by bashkir.ts's g2p (never hand IPA).
 *
 * The Turkic decimal shape: one lexeme per round ten (10 = ун), then juxtaposition with no connector —
 * егерме бер (21), йөҙ егерме бер (121). Bashkir is NOT Tatar with a spelling filter, and the numerals show it:
 * where Tatar has ⟨өч биш җиде сигез тугыз … кырык җитмеш сиксән туксан⟩, Bashkir has ⟨өс биш ете һигеҙ туғыҙ …
 * ҡырҡ етмеш һикһән туҡһан⟩ — the ҫ/ҙ interdentals, the ҡ/ғ uvulars, and Bashkir's initial ⟨һ⟩ for Tatar ⟨с⟩ in
 * 8/80 (һигеҙ vs сигез, һикһән vs сиксән) and its ⟨ете⟩ for Tatar ⟨җиде⟩. Bashkir also does NOT fuse its teens:
 * 11 is TWO words, ун бер (vs Tatar's fused унбер).
 *
 * The multiplier "бер" is dropped before both йөҙ (100 = йөҙ) and мең (1000 = мең), kept before миллион/миллиард.
 *
 * SOURCE: English Wiktionary Module:number list/data/ba (the data behind Appendix:Bashkir numerals; it also
 * supplies the explicit round-hundreds ике йөҙ … туғыҙ йөҙ and spaces every tens+unit pair, i.e. ун бер), with
 * Omniglot "Numbers in Bashkir" (Башҡорт теле) as the second witness — it states outright that 11-19 are written
 * as two words.
 * JUDGMENT CALL — 0: Wiktionary's module gives ⟨нүл⟩, Omniglot ⟨нуль⟩. Taken as ⟨нуль⟩ (the Russian loan as spelled
 * in Bashkir Wikipedia and school orthography); ⟨нүл⟩ is a harmonised respelling that also circulates.
 * NOT USED — ⟨төмән⟩ "ten thousand" (in the Wiktionary module): an archaic/Mongolic myriad word, not the modern
 * decimal grouping, so 10 000 composes as ун мең.
 */

const UNITS = ["нуль", "бер", "ике", "өс", "дүрт", "биш", "алты", "ете", "һигеҙ", "туғыҙ"];
const TENS: Record<number, string> = {
    10: "ун", 20: "егерме", 30: "утыҙ", 40: "ҡырҡ", 50: "илле", 60: "алтмыш", 70: "етмеш", 80: "һикһән", 90: "туҡһан",
};
const HUNDRED = "йөҙ",
    THOUSAND = "мең",
    MILLION = "миллион",
    BILLION = "миллиард";

/** A non-negative safe integer → the ordered Bashkir number WORDS (spellings, not IPA). */
export function numberToWords(n: number): string[] {
    if (n < 10) return [UNITS[n]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10, // ROUND value — tens is keyed "10".."90", not "1".."9"
            u = n % 10;
        return [TENS[t]!, ...(u ? [UNITS[u]!] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return [...(h > 1 ? [UNITS[h]!] : []), HUNDRED, ...(r ? numberToWords(r) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return [...(th > 1 ? numberToWords(th) : []), THOUSAND, ...(r ? numberToWords(r) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000),
            r = n % 1_000_000;
        return [...numberToWords(m), MILLION, ...(r ? numberToWords(r) : [])];
    }
    const b = Math.floor(n / 1_000_000_000),
        r = n % 1_000_000_000;
    return [...numberToWords(b), BILLION, ...(r ? numberToWords(r) : [])];
}
