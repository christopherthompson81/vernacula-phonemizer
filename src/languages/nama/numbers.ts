/**
 * Nama / Khoekhoegowab (naq) cardinal number → words. **SYSTEM: NATIVE Khoe decimal for 1–999 999, with the two
 * NATURALISED LOAN magnitudes `miljun` (10⁶) and `biljun` (10⁹) that published Khoekhoegowab actually uses.**
 * This is the native-vs-borrowed call for naq, and it lands in an unusual place: the native series is alive and
 * uncontested all the way to 1000, so nothing is borrowed below 10⁶; but there is no native 10⁶ word, and the
 * language's own newspapers write the Afrikaans/Dutch-shaped loans with native Khoekhoegowab suffixes. So: native
 * where native exists, loan only where it does not, and nothing invented in between.
 *
 * SOURCES
 *   - **1–10, 11–19, 20–90, 21–99**: Wiktionary `Category:Khoekhoe numerals` (which contains exactly the ten unit
 *     stems below and nothing else — https://en.wiktionary.org/wiki/Category:Khoekhoe_numerals), Omniglot "Numbers
 *     in Khoekhoe" (https://www.omniglot.com/language/numbers/khoekhoe.htm), the Peace Corps *Khoekhoegowab Made
 *     Simple* ch. 14 (https://www.livelingua.com/peace-corps/Khoekhoegowab/Khoekhoegowab.pdf), and the Universal
 *     Dependencies Khoekhoe treebank's NUM tokens (corpus-attested ǀgui, ǀgam, ǃnona, koro, dīsi, korodīsi,
 *     ǃnanidīsi, hakadīsi). The Peace Corps chapter lists the teens verbatim: Disiǀguiǀa 11 · Disiǀgamǀa 12 ·
 *     Disiǃnonaǀa 13 · Disihakaǀa 14 · Disikoroǀa 15 · Disiǃnaniǀa 16 · Disihûǀa 17 · Disiǁkhaisaǀa 18.
 *     WORKED GOLDEN, from a real sentence: **26 = ǀgamdisiǃnaniǀa** ("Tita ge ǀgamdisiǃnaniǀa (26) kurixa" = 'I am
 *     26 years old"), which pins the whole 21–99 shape in one attestation.
 *   - **100 = `kaidisi`** (Peace Corps + Omniglot agree). **1000 = `ǀoadisi`** (Omniglot + UD; and the New Era
 *     corpus below has the inflected `ǀoadisidi`). The rival `kaiǀoadisi` for 1000 occurs in the Peace Corps
 *     manual only and reads as a manual-internal quirk, so it is not used here.
 *   - **10⁶ `miljun` / 10⁹ `biljun`**: attested in PUBLISHED KHOEKHOEGOWAB RUNNING TEXT — the Khoekhoegowab
 *     section of Namibia's *New Era* (https://neweralive.na/category/khoekhoegowab/), which yields the bare stem
 *     plus the ordinary Khoekhoegowab case/PGN suffixes: "N$47 miljunsa", "N$65 miljuns", "N$737 miljunsa",
 *     "N$357.3 miljunmarisa", "N$1 biljunmaris". This is why we ship these two and NOT Omniglot's
 *     `ǀoadisiǀoadisi` for a million, which is credited there to a single unvetted individual contributor.
 *     (Incidental but useful finding from the same corpus: Khoekhoegowab news writes the FIGURE as digits and
 *     spells only the magnitude word — exactly the input this compositor has to handle.)
 *
 * ⚠ ORTHOGRAPHY — the engine's own conventions, and they matter here:
 *   - **TONE IS NOT WRITTEN** in standard Khoekhoegowab, so no tone diacritics appear below (nama.ts drops them
 *     anyway). The diacritics that DO appear are segmental: a CIRCUMFLEX is nasalisation, so 7 `hû` keeps it. A
 *     MACRON is length; the sources vary between `disi` and `dīsi` for 10, and we use the unmarked **`disi`**
 *     consistently — including inside every compound — since Wiktionary, Omniglot and the Peace Corps manual all
 *     write it bare.
 *   - The four CLICK letters ⟨ǀ ǁ ǂ ǃ⟩ are Unicode click letters, not ASCII punctuation. Every numeral here
 *     phonemizes through nama.ts's click scanner: a BARE ⟨ǀ⟩ before a vowel is the glottalised nasal click
 *     [ᵑ̊ǀˀ] (so ǀgui → [ᵏǀui] with the ⟨g⟩ tenuis accompaniment, while the connector ǀa → [ᵑ̊ǀˀa]).
 *   - 9 is **`khoese`**, not `khoesa`. The Peace Corps manual is internally inconsistent (khoesa in its 1–10 list
 *     but khoese-disi for 90); Wiktionary, Omniglot and UD all support khoese, so khoese it is.
 *
 * · COMPOSITION
 *   - 11–19: `disi` + UNIT + `ǀa`, written SOLID as one word (Disiǀguiǀa). No published analysis of the `-ǀa`
 *     connector was found — "and" is the obvious guess but is NOT asserted here.
 *   - round tens: UNIT + `disi`, and the multiplier **starts at TWO** — 20 is `ǀgamdisi`, never *ǀguidisi.
 *   - 21–99: `[unit]disi` + `[unit]` + `ǀa`, solid (ǀgamdisiǃnaniǀa 26).
 *
 * SIMPLIFICATIONS / EXTENSIONS BY ANALOGY (flagged, because they are not directly attested):
 *   - **MULTIPLES of 100 and 1000** (200, 300, 2000 …) are composed as UNIT + `kaidisi` / UNIT + `ǀoadisi`, by
 *     direct analogy with the attested UNIT + `disi` tens. The sources attest `kaidisi` and `ǀoadisi` as words
 *     and describe them as ordinary multiplicands, but no source spells out a multiple of either. No new lexeme
 *     is introduced — only the existing multiplier pattern is extended one level.
 *   - The seam between a MAGNITUDE and its remainder is rendered as a WORD BREAK (101 → `kaidisi ǀgui`), whereas
 *     the attested 1–99 patterns are solid. Spacing at that seam is the conservative choice: it commits to no
 *     morphology the sources do not show, and the corpus does write magnitude words as free words.
 *   - ⚠ **ZERO = `nul`, AN UNATTESTED AFRIKAANS CONTACT-LOAN STOPGAP — NOT a Khoekhoegowab numeral.** Label it
 *     as such wherever it surfaces. **No native zero could be sourced.** Searched, all clean negatives:
 *     Wiktionary `Category:Khoekhoe numerals` (contains exactly the ten unit stems, no zero), Omniglot, the UD
 *     Khoekhoe treebank corpus + lexicon, a full-text extraction of the Peace Corps manual grepped for
 *     zero|nought|nul|niks|noll (its only "zero" is English prose in the introduction), and ~3 MB of New Era
 *     Khoekhoegowab articles grepped for the same set — the 75 `null` hits there are page-script substrings, not
 *     Khoekhoegowab text, and none occurs in a numeric context. Haacke & Eiseb's 25 000-entry dictionary is not
 *     online, so this is "not found", not "does not exist"; it remains a TODO for a dictionary or native-speaker
 *     check.
 *     WHY EMIT ANYTHING AT ALL: emitting nothing is silent content loss — a Nama sentence containing "0" would
 *     lose the character with no downstream signal, which is the exact defect class this work exists to remove.
 *     An honest audible fallback beats a silent hole. Afrikaans `nul` is the chosen stopgap because Afrikaans is
 *     Namibia's dominant contact language and Khoekhoegowab borrows from it heavily and visibly (the `miljun` /
 *     `biljun` above are the same borrowing route, only those two ARE corpus-attested). It also phonemizes
 *     correctly now that ⟨l⟩ is in nama.ts's letter map. This mirrors how the sibling engines in this fanout
 *     handle the same gap (Umbundu `zero`, Totontepec Mixe `sero`) — flagged as a loan, never laundered into the
 *     numeral table.
 *   - ATTESTED RANGE / CEILING: 1 … 10¹²−1 composes natively. At 10¹² and above (and for any non-safe integer)
 *     the number is read DIGIT-BY-DIGIT over the attested units 1–9 plus the `nul` stopgap for 0 — audible and
 *     unambiguous, rather than dropped. There is no attested Khoekhoegowab scale word beyond `biljun`.
 */

// Unit stems 1–10. 10 = disi, the element that also builds the teens and the tens. Index 0 is deliberately NOT a
// numeral — see ZERO_STOPGAP below.
const UNITS = ["", "ǀgui", "ǀgam", "ǃnona", "haka", "koro", "ǃnani", "hû", "ǁkhaisa", "khoese", "disi"];
/** ⚠ NOT a Khoekhoegowab numeral: an unattested Afrikaans contact-loan stopgap for 0. See the header. */
const ZERO_STOPGAP = "nul";
const TEN = "disi";
const TEEN_CONNECTOR = "ǀa"; // the 11–19 / 21–99 final element; its gloss is unpublished
const HUNDRED = "kaidisi";
const THOUSAND = "ǀoadisi";
const MILLION = "miljun"; // naturalised loan — New Era corpus
const BILLION = "biljun"; // naturalised loan — New Era corpus

/** 1 ≤ n < 100, written SOLID as one word (the attested shape). */
function below100(n: number): string {
    if (n <= 10) return UNITS[n]!;
    if (n < 20) return TEN + UNITS[n - 10]! + TEEN_CONNECTOR; // disiǀguiǀa 11
    const t = Math.floor(n / 10),
        u = n % 10;
    if (u === 0) return UNITS[t]! + TEN; // ǀgamdisi 20 — multiplier starts at TWO
    return UNITS[t]! + TEN + UNITS[u]! + TEEN_CONNECTOR; // ǀgamdisiǃnaniǀa 26
}

/** 1 ≤ n < 1000. The hundred and its remainder are separate words (see the header's spacing note). */
function below1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return below100(n);
    const head = h === 1 ? HUNDRED : UNITS[h]! + HUNDRED;
    return r === 0 ? head : `${head} ${below100(r)}`;
}

/** 1 ≤ n < 10⁶. */
function below1e6(n: number): string {
    const th = Math.floor(n / 1000),
        r = n % 1000;
    if (th === 0) return below1000(n);
    const head = th === 1 ? THOUSAND : `${below1000(th)} ${THOUSAND}`;
    return r === 0 ? head : `${head} ${below1000(r)}`;
}

/**
 * Read a digit string one digit at a time — the ≥10¹² / non-safe-integer fallback. Uses the attested units 1–9
 * plus the `nul` STOPGAP for 0 (see the header): audible and unambiguous, never silently dropped.
 */
export function readDigits(digits: string): string {
    return [...digits].map((d) => (d === "0" ? ZERO_STOPGAP : (UNITS[Number(d)] ?? d))).join(" ");
}

/**
 * Non-negative integer → Khoekhoegowab cardinal words. 0 yields the flagged Afrikaans stopgap `nul` (no native
 * zero is attested); ≥10¹² or non-safe falls back to digit-by-digit. Never returns "".
 */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) return readDigits(raw ?? String(n));
    if (n === 0) return ZERO_STOPGAP;
    if (n < 1e6) return below1e6(n);
    if (n < 1e9) {
        const m = Math.floor(n / 1e6),
            r = n % 1e6;
        const head = m === 1 ? MILLION : `${below1000(m)} ${MILLION}`;
        return r === 0 ? head : `${head} ${below1e6(r)}`;
    }
    const b = Math.floor(n / 1e9),
        r = n % 1e9;
    const head = b === 1 ? BILLION : `${below1000(b)} ${BILLION}`;
    return r === 0 ? head : `${head} ${numberToWords(r)}`;
}
