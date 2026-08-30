/**
 * Santali (sat) cardinal number → words, in OL CHIKI (ᱚᱞ ᱪᱮᱢᱮᱫ). **SYSTEM: the NATIVE MUNDA DECIMAL series for
 * 1–99, with the INDO-ARYAN LOAN magnitudes above it** — because Santali itself has no native word for 100 and
 * above, and because the Ol Chiki literary standard is native-decimal below 100.
 *
 * ⚠ THE NATIVE-vs-BORROWED DECISION, stated plainly. Three systems compete in real Santali:
 *   1. **native decimal** — `ᱜᱮᱞ` (gel) 'ten' as the base: 20 = ᱵᱟᱨ ᱜᱮᱞ ('two ten'), 47 = ᱯᱩᱱ ᱜᱮᱞ ᱮᱭᱟᱭ. **This is
 *      what we generate.** It is the modern WRITTEN standard: it is what Wiktionary lemmatises, what sat.wikipedia
 *      running prose uses, and what Ghosh's grammar describes as the productive system ("all numerals are derived
 *      this way until 99").
 *   2. **native vigesimal** — `ᱤᱥᱤ` (isi) 'twenty': ᱢᱤᱫ ᱤᱥᱤ ᱴᱟᱠᱟ '20 rupees'. Alive, but REGISTER-RESTRICTED to
 *      money, market and traditional counting. We ACCEPT it on input (the g2p reads it fine) but never generate
 *      it — a TTS reading a bare digit in prose is not in the market register. (Note: "bisi" is *not* Santali;
 *      that is the Indo-Aryan shape. Santali has `isi`, Mundari/Ho `hisi`.)
 *   3. **Indo-Aryan code-switching** — Ghosh §3.1.8.1: "The younger generation more often uses Indo-Aryan
 *      numerals from seven onwards." So spoken Santali above ~6 is frequently Hindi/Bengali/Odia. We do NOT
 *      follow this: the numerals would have to be written in a different script and a different language, and Ol
 *      Chiki text — the input this engine exists to read — uses the native forms. This is the one place a reader
 *      might reasonably disagree, so it is flagged rather than buried.
 *   Above 99 there is no choice to make: **0, 100, 1000, lakh and crore are all Indo-Aryan loans** and there is no
 *   native alternative. `ᱥᱩᱱ` (0) is from Sanskrit शून्य; `ᱦᱟᱡᱟᱨ` (1000) from Persian هزار.
 *   We deliberately do NOT emit the de-Aryanising revivalist coinages (ᱢᱤᱫ ᱜᱮᱥᱟᱭ 1000, ᱢᱤᱫ ᱥᱟᱥᱟᱭ 10 000): they
 *   appear in one unsourced sat.wikipedia table and are absent from Wiktionary, from Ghosh, and from running text.
 *
 * SOURCES
 *   - **Ghosh, "Santali", in Anderson (ed.), *The Munda Languages*, §3.1.8** — the composition rule and the
 *     native/borrowed split, verbatim on both counts (quoted above).
 *   - **Wiktionary `Category:Santali numerals`** (52 entries) and the individual Ol Chiki lemmas — every form in
 *     the table below is a directly attested Ol Chiki spelling, NOT a transliteration of a Latin or Devanagari
 *     source.
 *   - **sat.wikipedia.org running prose** for the composed goldens: 25 = ᱵᱟᱨ ᱜᱮᱞ ᱢᱚᱬᱮ, 1200 = ᱢᱤᱫ ᱦᱟᱡᱟᱨ ᱵᱟᱨ ᱥᱟᱭ,
 *     5000 = ᱢᱚᱬᱮ ᱦᱟᱡᱟᱨ, plus 21/23/71/1946 spelled out in full; and ᱢᱩᱴ ᱑᱑ (ᱜᱮᱞ ᱢᱤᱫ) 'a total of 11'.
 *   - "Austro-Asiatic Numeration", IJSSHR 6(7) 2023, pp. 4454–4457. Omniglot agrees throughout (unattributed).
 *   - NOT consulted (print-only, so nothing here is quoted from them): Neukom 2001; Bodding 1922/1929.
 *   - **languagesandnumbers.com has NO Santali page** — it 302-redirects to the German one. Not cited.
 *
 * ORTHOGRAPHIC DECISIONS (each one is a real fork in the sources)
 *   - **Everything is SPACED, including 11–19 and 21–99.** Ghosh writes them solid in Latin transcription, but Ol
 *     Chiki practice is spaced: all nine teens are separate Wiktionary lemmas and running text writes ᱜᱮᱞ ᱢᱤᱫ.
 *   - 4 = **ᱯᱩᱱ**. Wiktionary lemmatises ᱯᱳᱱ (with U+1C73), but sat.wikipedia uses ᱯᱩᱱ throughout.
 *   - 8 = **ᱤᱨᱟᱹᱞ** — the ᱹ GAAHLAA is REQUIRED (it is what makes the vowel [ə]: irəl, not iral).
 *   - 5 = **ᱢᱚᱬᱮ** unnasalised; the variant ᱢᱚᱬᱮᱸ has only a handful of insource hits.
 *   - 100 = **ᱥᱟᱭ**, not ᱥᱳ — ᱥᱳ is a homograph meaning 'smell / pierce / jambul'.
 *   - 1 is written as a MULTIPLIER: 100 is ᱢᱤᱫ ᱥᱟᱭ and 1000 is ᱢᱤᱫ ᱦᱟᱡᱟᱨ, never bare ᱥᱟᱭ / ᱦᱟᱡᱟᱨ. (This is the
 *     opposite of the Maltese/Lule Sami habit of dropping the "one", and it is attested both ways round here.)
 *   - Accepted on input but never generated: the ᱤᱥᱤ chains, ᱯᱳᱱ, ᱢᱚᱬᱮᱸ, ᱥᱳ, ᱞᱟᱠ, ᱠᱳᱴᱤ, and the contracted
 *     colloquial register (ᱜᱮᱢᱤᱫ 11, ᱵᱟᱜᱮᱢᱤᱫ 21, ᱢᱤᱫᱥᱟᱭ 100).
 *
 * ⚠ GROUPING IS INDIAN 2-2-3, decisively (᱖,᱐᱐,᱐᱐᱐): thousand → **lakh** (10⁵) → **crore** (10⁷).
 *   **There is no Santali word for "million" or "billion"** — so 10⁶ reads as ᱜᱮᱞ ᱞᱟᱠᱷ (ten lakh) and 10⁹ as
 *   ᱢᱤᱫ ᱥᱟᱭ ᱠᱚᱨᱚᱲ (a hundred crore). That is the correct Santali reading of those figures, not a workaround.
 *
 * ATTESTED RANGE / FALLBACK: 0 … 10⁹ and beyond via crore multiples (the crore multiplier is composed
 * recursively, which is how the Indian system scales: 10¹¹ = ᱜᱮᱞ ᱦᱟᱡᱟᱨ ᱠᱚᱨᱚᱲ). Directly attested: 0–20, all the
 * tens, the four magnitude lexemes, and the spot-checked composites above. The remainder of 21–99 and 101–9999 is
 * RULE-DERIVED from Ghosh's stated rule (which he says holds "until 99") rather than individually attested.
 * Above 10⁷ Santali has no conventionalised vocabulary of its own, so crore-stacking is the honest reading; a
 * non-safe integer falls back to DIGIT-BY-DIGIT.
 */

// 0–10. Directly attested Ol Chiki spellings (see the header for the per-form editorial choices).
const UNITS = [
    "ᱥᱩᱱ", // 0 sun (IA loan — no native Munda zero)
    "ᱢᱤᱫ", // 1 mit' (the checked final is not written in Ol Chiki)
    "ᱵᱟᱨ", // 2 bar
    "ᱯᱮ", // 3 pe
    "ᱯᱩᱱ", // 4 pun
    "ᱢᱚᱬᱮ", // 5 mɔɽe
    "ᱛᱩᱨᱩᱭ", // 6 turuy
    "ᱮᱭᱟᱭ", // 7 eyay
    "ᱤᱨᱟᱹᱞ", // 8 irəl — the ᱹ GAAHLAA is required
    "ᱟᱨᱮ", // 9 are
    "ᱜᱮᱞ", // 10 gel — also the base of the teens and the tens
];
const TEN = "ᱜᱮᱞ";
const HUNDRED = "ᱥᱟᱭ"; // say (IA loan)
const THOUSAND = "ᱦᱟᱡᱟᱨ"; // hazar (< Persian هزار)
const LAKH = "ᱞᱟᱠᱷ"; // 10⁵
const CRORE = "ᱠᱚᱨᱚᱲ"; // 10⁷

/** 1 ≤ n < 100. Purely additive, descending, SPACED, no conjunction: ᱵᱟᱨ ᱜᱮᱞ ᱢᱚᱬᱮ = 25. */
function below100(n: number): string {
    if (n <= 10) return UNITS[n]!;
    if (n < 20) return `${TEN} ${UNITS[n - 10]}`; // ᱜᱮᱞ ᱢᱤᱫ = 11
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? `${UNITS[t]} ${TEN}` : `${UNITS[t]} ${TEN} ${UNITS[u]}`;
}

/** 1 ≤ n < 1000. The multiplier 1 IS written: 100 = ᱢᱤᱫ ᱥᱟᱭ. */
function below1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return below100(n);
    const head = `${UNITS[h]} ${HUNDRED}`;
    return r === 0 ? head : `${head} ${below100(r)}`;
}

/** 1 ≤ n < 10⁵ (thousands; the multiplier is 1–99). */
function below1e5(n: number): string {
    const th = Math.floor(n / 1000),
        r = n % 1000;
    if (th === 0) return below1000(n);
    const head = `${below100(th)} ${THOUSAND}`;
    return r === 0 ? head : `${head} ${below1000(r)}`;
}

/** 1 ≤ n < 10⁷ (lakhs; the multiplier is 1–99 — the Indian 2-2-3 grouping). */
function below1e7(n: number): string {
    const l = Math.floor(n / 1e5),
        r = n % 1e5;
    if (l === 0) return below1e5(n);
    const head = `${below100(l)} ${LAKH}`;
    return r === 0 ? head : `${head} ${below1e5(r)}`;
}

/** Read a digit string one digit at a time (the non-safe-integer fallback). */
export function readDigits(digits: string): string {
    return [...digits].map((d) => UNITS[digitIndex(d)] ?? d).join(" ");
}

/**
 * Non-negative integer → Santali cardinal words in Ol Chiki, space-separated. Indian 2-2-3 grouping with
 * lakh/crore; the crore multiplier recurses, so 10⁹ reads ᱢᱤᱫ ᱥᱟᱭ ᱠᱚᱨᱚᱲ ('a hundred crore'). Non-safe → digits.
 */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0) return readDigits(raw ?? String(n));
    if (n === 0) return UNITS[0]!;
    if (n < 1e7) return below1e7(n);
    const c = Math.floor(n / 1e7),
        r = n % 1e7;
    const head = `${numberToWords(c)} ${CRORE}`;
    return r === 0 ? head : `${head} ${below1e7(r)}`;
}import { digitIndex } from "../../core/numbers.ts";

