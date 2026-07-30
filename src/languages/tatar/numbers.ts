/**
 * TATAR (tt) cardinal number composition — Kipchak Turkic, Cyrillic. Authored DATA + the compositor; the words are
 * written in Tatar's OWN orthography and phonemized by tatar.ts's g2p (never hand-written IPA).
 *
 * The Turkic decimal shape: a distinct lexeme for every round ten (10 = ун is a `TENS` entry, not a "teen" base),
 * then juxtaposition with NO connector — егерме бер (21), йөз егерме бер (121). Tatar's ONE deviation from the
 * Turkish/Uzbek pattern: the TEENS ARE FUSED INTO ONE WORD (унбер 11, унике 12 … унтугыз 19) while 21-99 stay two
 * words (егерме бер). That matters here because the fused teen is a single stress domain — Tatar's word-final
 * stress lands once, on -бер, not twice.
 *
 * The multiplier "бер" is dropped before both йөз (100 = йөз) and мең (1000 = мең); it is kept before
 * миллион/миллиард (бер миллион), the Turkish/Uzbek convention already used across this fleet.
 *
 * SOURCE: English Wiktionary Module:number list/data/tt (the data behind Appendix:Tatar numerals) — which is also
 * where the fused-teen rule comes from (it concatenates for the i==1 decade and spaces every other) — corroborated
 * by Omniglot "Numbers in Tatar" (Татар теле), whose 11-19 column reads унбер, унике, унөч, ундүрт, унбиш,
 * уналты, унҗиде, унсигез, унтугыз.
 * JUDGMENT CALL — 0: Wiktionary gives ⟨нуль⟩, Omniglot ⟨ноль⟩ (both are the same Russian loan, spelled with either
 * vowel in Tatar practice). Taken as ⟨нуль⟩, the Wiktionary lemma.
 */

const UNITS = ["нуль", "бер", "ике", "өч", "дүрт", "биш", "алты", "җиде", "сигез", "тугыз"];
// 10-19. Тен (ун) alone at index 0; 11-19 are the FUSED ун+unit forms, one word each.
const TEENS = ["ун", "унбер", "унике", "унөч", "ундүрт", "унбиш", "уналты", "унҗиде", "унсигез", "унтугыз"];
const TENS: Record<number, string> = {
    20: "егерме", 30: "утыз", 40: "кырык", 50: "илле", 60: "алтмыш", 70: "җитмеш", 80: "сиксән", 90: "туксан",
};
const HUNDRED = "йөз",
    THOUSAND = "мең",
    MILLION = "миллион",
    BILLION = "миллиард";

/** A non-negative safe integer → the ordered Tatar number WORDS (spellings, not IPA). */
export function numberToWords(n: number): string[] {
    if (n < 10) return [UNITS[n]!];
    if (n < 20) return [TEENS[n - 10]!]; // fused: унбер, унике, …
    if (n < 100) {
        const t = Math.floor(n / 10) * 10,
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
