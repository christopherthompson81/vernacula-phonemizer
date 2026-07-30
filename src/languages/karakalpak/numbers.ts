/**
 * KARAKALPAK (kaa) cardinal number composition — Kipchak Turkic (Aral-Caspian, closest to Kazakh), 2016 LATIN
 * orthography. Authored DATA + the compositor; words in Karakalpak's own script, phonemized by karakalpak.ts.
 *
 * The Turkic decimal shape: one lexeme per round ten (10 = on), then juxtaposition with no connector — jigirma bir
 * (21), júz jigirma bir (121); teens are two words (on bir). Karakalpak is Kipchak like Nogai but NOT identical to
 * it: Karakalpak has ⟨jeti / jetpis / eliw / toǵız / mıń⟩ where Nogai has ⟨ети / етпис / элли / тогыз / мынъ⟩ —
 * i.e. Karakalpak keeps the Kipchak j- that Nogai lost, and its 50 is the ⟨-w⟩ form eliw (cf. Kazakh елу), not elli.
 *
 * The multiplier "bir" is dropped before both júz (100 = júz) and mıń (1000 = mıń), kept before million/milliard.
 *
 * SOURCE: Karakalpak Wikipedia, article "Sanlıq" (the parts-of-speech article on numerals), which enumerates the
 * canonical set verbatim in the 2016 Latin orthography: "nol, bir, eki, úsh, tórt, bes, altı, jeti, segiz, toǵız,
 * on, jigirma, otız, qırq, eliw, alpıs, jetpis, seksen, toqsan, júz, mıń, million, milliard". Corroborated
 * grapheme-for-grapheme by Omniglot "Numbers in Karakalpak (Қарақалпақ тили)", whose Cyrillic column reads ноль,
 * бир, еки, үш, тѳрт, бес, алты, жети, сегиз, тоғыз, он, жигирма, отыз, қырық, елли/елиў, алпыс, жетпис, сексен,
 * тоқсан, жүз, мың — the same lexemes under the pre-2016 Cyrillic.
 * NOT USED — English Wiktionary's Module:number list/data/kaa: it is a verbatim copy of the Crimean Tatar table
 * (sıfır, iki→eki, üç, dört, beş, yüz …) written with ⟨ı ü ö ş ç⟩, letters that are NOT in the Karakalpak alphabet
 * at all. It is not Karakalpak data and was rejected.
 * JUDGMENT CALL — 50: Omniglot lists "елли/елиў". Taken as ⟨eliw⟩, the form the Karakalpak-Wikipedia numeral
 * article uses and the one that matches Kazakh елу; ⟨elli⟩ (the Oghuz-shaped variant) also circulates.
 * JUDGMENT CALL — 40: ⟨qırq⟩ per the Wikipedia article; Omniglot's Cyrillic ⟨қырық⟩ implies the epenthesised
 * ⟨qırıq⟩. The written standard is qırq.
 */

const UNITS = ["nol", "bir", "eki", "úsh", "tórt", "bes", "altı", "jeti", "segiz", "toǵız"];
const TENS: Record<number, string> = {
    10: "on", 20: "jigirma", 30: "otız", 40: "qırq", 50: "eliw", 60: "alpıs", 70: "jetpis", 80: "seksen", 90: "toqsan",
};
const HUNDRED = "júz",
    THOUSAND = "mıń",
    MILLION = "million",
    BILLION = "milliard";

/** A non-negative safe integer → the ordered Karakalpak number WORDS (2016 Latin spellings, not IPA). */
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
