/**
 * NOGAI (nog) cardinal number composition — Kipchak-Nogai (South-Kipchak) Turkic, Cyrillic. Authored DATA + the
 * compositor; words in Nogai's own orthography (including the soft-sign front-vowel digraphs ⟨уь оь⟩ and the
 * hard-sign ⟨нъ⟩), phonemized by nogai.ts.
 *
 * The Turkic decimal shape: one lexeme per round ten (10 = он), then juxtaposition with no connector — йырма бир
 * (21), юз йырма бир (121); teens are two words (он бир). Nogai sits next to Karakalpak in the Kipchak-Nogai
 * subgroup but its numerals are its OWN: Nogai has ⟨эки ети етпис элли тогыз мынъ⟩ where Karakalpak has ⟨eki jeti
 * jetpis eliw toǵız mıń⟩ — Nogai has lost the initial j- (ети vs jeti, етпис vs jetpis) and its 20 is the
 * contracted ⟨йырма⟩, not Karakalpak's ⟨jigirma⟩ / Kazakh's жиырма.
 *
 * The multiplier "бир" is dropped before both юз (100 = юз) and мынъ (1000 = мынъ), kept before миллион/миллиард.
 *
 * SOURCE: the attested Nogai numeral lemmas in English Wiktionary Category:Nogai numerals — алпыс (60), алты (6),
 * бес (5), бир (1), доьрт (4), ети (7), етпис (70), йырма (20), кырк (40), мынъ (1000), отыз (30), сегиз (8),
 * сексен (80), тогыз (9), токсан (90), уьш (3), эки (2), элли (50), юз (100) — i.e. every unit and every round ten
 * except 10 itself. Second witness for он (10), ноль (0) and миллион: Omniglot "Numbers in Nogai".
 * JUDGMENT CALL — 50: Wiktionary's lemma is ⟨элли⟩ (initial э), Omniglot prints ⟨елли⟩. Taken as ⟨элли⟩ — the
 * Wiktionary lemma, and the one the g2p reads correctly, since word-initial ⟨е⟩ iotates to [je] in Nogai while ⟨э⟩
 * is the plain [e] this word has.
 * JUDGMENT CALL — 40: ⟨кырк⟩ with plain ⟨к⟩, per both sources. One might expect the uvular digraph ⟨къырк⟩ (Nogai
 * writes [q] as ⟨къ⟩), but neither source spells it that way, so the attested plain-⟨к⟩ spelling is kept and the
 * engine renders it [k].
 */

const UNITS = ["ноль", "бир", "эки", "уьш", "доьрт", "бес", "алты", "ети", "сегиз", "тогыз"];
const TENS: Record<number, string> = {
    10: "он", 20: "йырма", 30: "отыз", 40: "кырк", 50: "элли", 60: "алпыс", 70: "етпис", 80: "сексен", 90: "токсан",
};
const HUNDRED = "юз",
    THOUSAND = "мынъ",
    MILLION = "миллион",
    BILLION = "миллиард";

/** A non-negative safe integer → the ordered Nogai number WORDS (Cyrillic spellings, not IPA). */
export function numberToWords(n: number): string[] {
    if (n < 10) return [UNITS[n]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10, // ROUND value — TENS is keyed 10..90
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
