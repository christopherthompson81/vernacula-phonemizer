/**
 * Aromanian / armãneashti cardinal number → words. Emits SPACE-separated words so each element reads through the
 * aromanian.ts g2p (Cunia orthography). Covers 0 … <10¹²; larger / unsafe values read digit-by-digit.
 *
 * SOURCES (the numeral tables stay here, beside the compositor that is their only reader; aromanian.jsonc
 * carries the grapheme tables):
 *   - Tiberius Cunia, "Dictsiunar a Limbãljei Armãneascã" (2008), consulted via dixionline.net, for the magnitude
 *     and zero lexemes: ⟨nulã⟩ "numirlu 0" (zero), ⟨sutã⟩ "hundred", ⟨njilji⟩ "thousand", and ⟨miliunã⟩ (pl.
 *     ⟨miliunj⟩) glossed "numir multu mari tsi easti isea cu-unã njilji di njilj" — a thousand thousands;
 *   - omniglot.com/language/numbers/aromanian.htm for 1–20 and the tens 30–90;
 *   - en.wiktionary.org Category:Aromanian_numerals for the hundreds series (⟨dau suti⟩, ⟨trei suti⟩, ⟨shasi
 *     suti⟩, ⟨shapti suti⟩ are attested entries) and for the FUSED twenties (derived terms at ⟨yinghits⟩:
 *     unsprãyinghits 21, doisprãyinghits 22, treisprãyinghits 23, patrusprãyinghits 24, shasprãyinghits 26,
 *     shaptisprãyinghits 27, optusprãyinghits 28, noauãsprãyinghits 29).
 *
 * ⚠ THE BALKAN CONTACT VOCABULARY is what makes this table not just "Romanian with different spelling":
 *   - 20 ⟨yinghits⟩ — inherited Latin *vīgintī* but through the contracted *vintī → *yintsi with syllable
 *     reduplication/metathesis, so it is opaque where Romanian rebuilt a transparent decade (douăzeci "two tens");
 *   - 100 ⟨sutã⟩ — the SLAVIC loan (cf. сто / Albanian *qind* alongside), not a Latin *centum* reflex; the Latin
 *     ⟨tsentu⟩ survives only as a regional variant and is not used here;
 *   - the teens/twenties keep the Balkan-Romance ⟨-sprã-⟩ "over" infix (unãsprãdzatsi = one-over-ten), and the
 *     twenties extend it over ⟨yinghits⟩ rather than taking a connector — a genuinely irregular fused series.
 *
 * Pattern B (bespoke): the fused ⟨-sprãyinghits⟩ twenties, the ⟨shi⟩ connector, and the pluralising hundred
 * (sutã → suti) are all outside the shared `westernNumberWords` data schema.
 */

// 0–9. ⟨nao⟩ (9) is the Cunia/Omniglot form (variants nau, nauã, noauã); ⟨doi⟩ is the masculine.
const ONES = ["nulã", "unu", "doi", "trei", "patru", "tsintsi", "shasi", "shapti", "optu", "nao"];
// 10–19: the ⟨-sprã-dzatsi⟩ "over-ten" series (Omniglot's primary spellings).
const TEENS = ["dzatsi", "unãsprãdzatsi", "dosprãdzatsi", "tresprãdzatsi", "patrusprãdzatsi", "tsisprãdzatsi",
    "shasprãdzatsi", "shaptisprãdzatsi", "optusprãdzatsi", "noauãsprãdzatsi"];
// 21–29: the same infix over ⟨yinghits⟩ (20) instead of ⟨dzatsi⟩ (10) — one fused word, no connector.
// 25 ⟨tsinsprãyinghits⟩ is filled in by the series pattern (the Wiktionary derived-terms list skips it).
const TWENTIES = ["", "unsprãyinghits", "doisprãyinghits", "treisprãyinghits", "patrusprãyinghits",
    "tsinsprãyinghits", "shasprãyinghits", "shaptisprãyinghits", "optusprãyinghits", "noauãsprãyinghits"];
// 20–90. 20 is the opaque ⟨yinghits⟩; 30–90 are transparent unit + ⟨dzãts⟩ "tens".
const TENS = ["", "", "yinghits", "treidzãts", "patrudzãts", "tsindzãts", "shaidzãts", "shaptidzãts", "opdzãts",
    "noauãdzãts"];
// 200–900: unit + the PLURAL ⟨suti⟩ (sutã is feminine, so 2 takes the feminine ⟨dau⟩ — Wiktionary "dau suti").
const HUNDREDS = ["", "", "dau suti", "trei suti", "patru suti", "tsintsi suti", "shasi suti", "shapti suti",
    "optu suti", "nao suti"];
const HUNDRED = "unã sutã"; // 100 — feminine ⟨unã⟩ + sutã (cf. Romanian "o sută")
const THOUSAND = "unã njilji"; // 1000 — feminine ⟨unã⟩ + njilji
const THOUSANDS = "njilj"; // the plural (Cunia: "unã njilji di njilj") — dau njilj, trei njilj
const MILLION = "unã miliunã"; // 10⁶ (Cunia miliunã, sf)
const MILLIONS = "miliunj"; // its plural — dau miliunj … and 10⁹ = "unã njilji miliunj"
const AND = "shi"; // the additive connector: treidzãts shi unu (31) — Aromanian "shi" = and

/** 0 ≤ n < 100. 21–29 are the FUSED ⟨-sprãyinghits⟩ series; 31–99 take the ⟨shi⟩ connector. */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    if (n < 20) return TEENS[n - 10]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    if (u === 0) return TENS[t]!;
    return t === 2 ? TWENTIES[u]! : `${TENS[t]} ${AND} ${ONES[u]}`;
}

/**
 * The magnitude nouns ⟨sutã⟩, ⟨njilji⟩ and ⟨miliunã⟩ are all FEMININE, so a multiplier of 2 agrees with them in
 * the feminine ⟨dau⟩, not the masculine ⟨doi⟩ — which is why Wiktionary lemmatises 200 as ⟨dau suti⟩ (and the
 * Wikivoyage phrasebook gives 2000 as ⟨dau njilje⟩). The hundreds table spells this out directly; the thousand and
 * million multipliers are composed, so their trailing ⟨doi⟩ is swapped here.
 */
function feminine(words: string): string {
    return words.replace(/(^|\s)doi$/u, "$1dau");
}

/** 1 ≤ n < 1000. unã sutã / dau suti … + the remainder juxtaposed (101 → unã sutã unu, cf. Romanian o sută unu). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const head = h === 1 ? HUNDRED : HUNDREDS[h]!;
    return r ? `${head} ${below100(r)}` : head;
}

/** 1 ≤ n < 10⁶. njilji is a feminine NOUN, so it pluralises (unã njilji, dau njilj, dzatsi njilj). */
function below1e6(n: number): string {
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    const thousand = th === 1 ? THOUSAND : `${feminine(below1000(th))} ${THOUSANDS}`;
    return r ? `${thousand} ${below1000(r)}` : thousand;
}

/** Non-negative integer → Aromanian words. Out-of-range / unsafe values read digit-by-digit (never empty). */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((d) => ONES[digitIndex(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!; // nulã
    if (n < 1e6) return below1e6(n);
    const m = Math.floor(n / 1e6),
        r = n % 1e6;
    // miliunã is a feminine NOUN like njilji: it keeps its ⟨unã⟩ and pluralises. Only 10⁶ is authored, so 10⁹
    // composes as Cunia's own gloss of the word — "unã njilji [di] miliunj", a thousand millions.
    const head = m === 1 ? MILLION : `${feminine(below1e6(m))} ${MILLIONS}`;
    return r ? `${head} ${numberToWords(r)}` : head;
}import { digitIndex } from "../../core/numbers.ts";

