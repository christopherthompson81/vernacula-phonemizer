/**
 * CRIMEAN TATAR (crh) cardinal number composition — Kipchak Turkic with heavy Oghuz overlay, standard (Turkish-based)
 * LATIN alphabet. Authored DATA + the compositor; words in Crimean Tatar's own orthography, phonemized by
 * crimeantatar.ts.
 *
 * The Turkic decimal shape: one lexeme per round ten (10 = on), then juxtaposition with no connector — yigirmi bir
 * (21), yüz yigirmi bir (121); teens are two words (on bir). The Oghuz overlay is visible in the tens (elli,
 * altmış, yetmiş, seksen — Turkish-shaped) while the Kipchak layer shows in ⟨eki⟩ 2 (not Turkish iki), the uvular
 * ⟨q⟩ of qırq / doquz / doqsan (Turkish kırk, dokuz, doksan), and ⟨biñ⟩ 1000 with the velar nasal (Turkish bin).
 *
 * The multiplier "bir" is dropped before both yüz (100 = yüz) and biñ (1000 = biñ) — the Turkish convention — and
 * kept before million/milliard.
 *
 * SOURCE: English Wiktionary Module:number list/data/crh (the data behind the crh number boxes: sıfır, bir, eki, üç,
 * dört, beş, altı, yedi, sekiz, doquz, on, yigirmi, otuz, qırq, elli, altmış, yetmiş, seksen, doqsan, yüz) plus the
 * attested crh numeral lemmas in Category:Crimean Tatar numerals (which is where ⟨biñ⟩ 1000 and the round hundreds
 * eki yüz … doquz yüz come from — the module itself stops at 100). Second witness: Omniglot "Numbers in Crimean
 * Tatar (Qırımtatar tili)", which gives the identical list plus biñ, million, milliard.
 * JUDGMENT CALL — 1000: Category:Crimean Tatar numerals carries BOTH ⟨biñ⟩ and ⟨miñ⟩ as "thousand". Taken as ⟨biñ⟩,
 * the standard literary form Omniglot also lists; ⟨miñ⟩ is the Kipchak/steppe-dialect variant (cf. Kazakh мың).
 */

const UNITS = ["sıfır", "bir", "eki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "doquz"];
const TENS: Record<number, string> = {
    10: "on", 20: "yigirmi", 30: "otuz", 40: "qırq", 50: "elli", 60: "altmış", 70: "yetmiş", 80: "seksen", 90: "doqsan",
};
const HUNDRED = "yüz",
    THOUSAND = "biñ",
    MILLION = "million",
    BILLION = "milliard";

/** A non-negative safe integer → the ordered Crimean Tatar number WORDS (Latin spellings, not IPA). */
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
