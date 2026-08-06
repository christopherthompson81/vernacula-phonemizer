import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/amharic/amharic.ts";

// Canonical-IPA goldens for Amharic / አማርኛ (am) — Ethiopian Semitic, the Ge'ez/Fidäl SYLLABARY-abugida: each
// codepoint is a whole CV syllable (vowel baked into the glyph), so the g2p is a flat fidel→CV lookup (not a
// Brahmic matra/virama engine). Guttural 1st-order → [a] (ሀ→ha), ejectives kʼ tʼ t͡ʃʼ pʼ t͡sʼ. Two features are
// UNWRITTEN: GEMINATION (folded vs the referee) and the 6th-order [ɨ] (epenthetic — kept only as the word's first
// vowel, else deleted: ሁለት→hulət). Validated against wikipron amh (80.1%) + kaikki amh (78.3%), both human.
describe("amharic canonical IPA", () => {
    test("fidel syllabary, gutturals, ejectives, 6th-order ɨ deletion", () => {
        const cases: [string, string][] = [
            ["ሰላም", "səlam"], // hello — 1st-order lə, 4th-order la
            ["ኢትዮጵያ", "itjopʼja"], // Ethiopia — ejective pʼ, glides, ɨ deleted
            ["አዲስ", "adis"], // new (Addis)
            ["አበባ", "abəba"], // flower (Ababa)
            ["ውሃ", "wɨha"], // water — word-initial ɨ kept
            ["ቤት", "bet"], // house — 5th-order e
            ["ሁለት", "hulət"], // two — final 6th-order ɨ deleted
            ["ልጅ", "lɨd͡ʒ"], // child — ɨ kept, final ɨ deleted (ጅ → d͡ʒ, affricate = one C)
            ["መጽሐፍ", "mət͡sʼhaf"], // book — ejective t͡sʼ, guttural ሐ→ha
            ["ቀን", "kʼən"], // day — ejective kʼ
            // Epenthetic-ɨ phonotactics: kept to break an illegal cluster, deleted where the cluster is legal.
            ["አምስት", "amɨst"], // 'five' — ɨ KEPT: deleting → word-final 'mst', an illegal ≥3 complex coda
            ["አምስተኛ", "amstəɲa"], // 'fifth' — same letters but MEDIAL (before ə) → the cluster resyllabifies, ɨ deleted
            ["እግር", "ɨɡɨɾ"], // 'foot' — word-initial ɨ kept; medial ɨ kept before ɾ (stop + ɾ illegal)
            ["አሥራራት", "asɾaɾat"], // ɨ deleted — a fricative + ɾ (sɾ) is a legal cluster
            ["አርመንኛ", "aɾmənɨɲa"], // ɨ kept before ɲ (nasal + nasal illegal); aɾm/mən legal
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("numbers (Amharic; decimal)", () => {
        expect(phonemize("2", "am")).toBe("hulət"); // hulätt
        expect(phonemize("10", "am")).toBe("asɾ"); // assɨr
        expect(phonemize("100", "am")).toBe("məto"); // mäto
    });
});

// Tens (found by the #562 impact audit): NUM.tens is keyed "20".."90" but the lookup used String(t) —
// "2".."9" — so EVERY ten was silently dropped: 25 → "amɨst", 1998 → thousand-nine-hundred-EIGHT.
// 21.7% of FLEURS am_et utterances contain digits.
describe("Amharic tens", () => {
    test("tens are read", () => {
        expect(phonemize("25", "am")).toBe("haja amɨst"); // ሃያ አምስት
        expect(phonemize("90", "am")).toBe("zətʼəna");
        expect(phonemize("1998", "am")).toBe("ʃi zətʼəɲ məto zətʼəna sɨmɨnt"); // the 90 is back
    });
});

// Scales above ሺ (thousand) were missing entirely — nothing above 999 999 was composed, so 10⁶+ fell through to
// the digit string and the fidel g2p rendered it as EMPTY IPA. ሚሊዮን / ቢሊዮን are the European loans Amharic uses
// (Omniglot "Numbers in Amharic" cites 10⁶ as አንድ ሚሊዮን; Abyssinica dictionary for ቢሊዮን) — see amharic.jsonc.
describe("Amharic magnitudes above thousand", () => {
    test("ሚሊዮን / ቢሊዮን keep their multiplier at 1 (unlike the bare መቶ / ሺ)", () => {
        expect(phonemize("7", "am")).toBe("səbat"); // ሰባት — a units case
        expect(phonemize("42", "am")).toBe("aɾba hulət"); // አርባ ሁለት — a compound 21-99 case
        expect(phonemize("101", "am")).toBe("məto and"); // መቶ አንድ — a hundreds case
        expect(phonemize("12345", "am")).toBe("asɾa hulət ʃi sost məto aɾba amɨst"); // a thousands case
        expect(phonemize("1000000", "am")).toBe("and milijon"); // አንድ ሚሊዮን — was EMPTY
        expect(phonemize("2000000", "am")).toBe("hulət milijon"); // ሁለት ሚሊዮን
        expect(phonemize("1000000000", "am")).toBe("and bilijon"); // አንድ ቢሊዮን — was EMPTY
    });
});

// ── #562 text normalization ───────────────────────────────────────────────────────────────────────────
// Counts are over the 1,922 unique FLEURS am_et transcripts (column 3). See src/languages/amharic/normalize.ts
// for the full tabulation, the ordering couplings, and the negative results.
describe("Amharic #562 normalization", () => {
    // The Ethiopic sentence terminator written as TWO U+1361 WORDSPACE — the typewriter/keyboard substitute
    // for ። . 74 instances, 60 utterances use it as their ONLY terminator, and it reached no TOKEN branch at
    // all, so every one of those sentence boundaries produced NO PAUSE.
    test("፡፡ is the sentence terminator ።, not nothing", () => {
        expect(phonemize("ሰረዘ፡፡", "am")).toBe("səɾəzə ."); // was "səɾəzə" — no pause
        expect(phonemize("ሰላም። ዓለም።", "am")).toBe("səlam . aləm ."); // ። itself was already correct
    });

    // The lone ፡ introduces a list in all 14 residual corpus instances; between digits it is a TIME separator.
    test("lone ፡ is a clause colon; between digits it is a clock", () => {
        expect(phonemize("ሁለት ነገሮች፡ አልጋ", "am")).toBe("hulət nəɡəɾot͡ʃ , alɡa");
        expect(phonemize("11፡00 ሰዓት", "am")).toBe("asɾa and səat"); // was "asɾa and , zeɾo səat"
    });

    // Amharic writes initialisms and unit abbreviations with ASCII dots between ETHIOPIC letters. Every
    // interior dot was mapped to a full STOP, shattering the sentence into up to six phrases (~60 instances).
    // Removing the dot leaves the fidel run, which IS the spelled letter reading.
    test("dotted abbreviations no longer break the sentence", () => {
        expect(phonemize("ኤ.ኦ.ኤል", "am")).toBe("eoel"); // was "e . o . el" — two full stops
        expect(phonemize("እ.ኤ.አ. በ 1970", "am")).toBe("ɨea bə ʃi zətʼəɲ məto səba");
        expect(phonemize("ቲ.ሬክስ ዓይነት", "am")).toBe("tiɾeks ajnət");
        // A TRAILING dot on a SINGLE-dot abbreviation is deliberately LEFT — indistinguishable from a
        // sentence period, and only 7 instances. This asserts the conservative choice, not an oversight.
        expect(phonemize("ወዘተ.", "am")).toBe("wəzətə .");
    });

    // Digit de-grouping runs FIRST, before any comma is read as clause punctuation (43 instances).
    test("grouped thousands are one number, not a pause plus a zero", () => {
        expect(phonemize("5,000", "am")).toBe("amɨst ʃi"); // was "amɨst , zeɾo"
        expect(phonemize("5,000,000", "am")).toBe("amɨst milijon"); // two grouping commas
        expect(phonemize("1,400", "am")).toBe("ʃi aɾat məto"); // was "and , aɾat məto"
    });

    // 26 instances; the dot was a full STOP. The fractional tail is read ONE DIGIT AT A TIME. ነጥብ
    test("decimals take ነጥብ and digit-by-digit fractions", () => {
        expect(phonemize("6.34", "am")).toBe("sɨdɨst nətʼb sost aɾat"); // was "sɨdɨst . səlasa aɾat"
    });

    // 21 instances. Only the SEPARATOR is resolved — no ሰዓት/ደቂቃ is inserted, because the corpus text already
    // supplies the frame and adding the word would double it (the Arabic duplicate-الساعة failure). The
    // Ethiopian 6-hour clock offset is deliberately NOT applied; the text never settles the frame.
    test("clock: the colon is not a comma", () => {
        expect(phonemize("10:08", "am")).toBe("asɾ sɨmɨnt"); // was "asɾ , sɨmɨnt"
        expect(phonemize("10:00", "am")).toBe("asɾ"); // :00 is the bare hour, not "…zero"
        // The sports-split tail: the clock consumes `.SS` itself, because after the clock rewrite there is
        // no digit left of the dot for the decimal rule and the bare dot became a sentence STOP.
        expect(phonemize("4:41.30", "am")).toBe("aɾat aɾba and nətʼb sost zeɾo");
    });

    // 37 instances. The ኛ was a separate token and the cardinal kept its uninflected final syllable. Every
    // form for 1–10 and 20 is attested in this corpus's own running text.
    test("ordinals inflect the cardinal's LAST word", () => {
        expect(phonemize("19ኛው", "am")).toBe("asɾa zətʼənəɲaw"); // was "asɾa zətʼəɲ ɲaw"
        expect(phonemize("15 ኛው", "am")).toBe("asɾa amstəɲaw"); // spaced form
        expect(phonemize("190ኛ", "am")).toBe("məto zətʼənaɲa"); // only the final word inflects
        expect(phonemize("1000ኛው", "am")).toBe("ʃiɲaw");
    });

    // "from X to Y", restricted to the ከ frame. 14 of the 19 hyphenated pairs are SPORTS SCORES or bracketed
    // year spans and must NOT take a connective — this asserts both halves of that restriction.
    test("ranges take እስከ only in the ከ frame", () => {
        expect(phonemize("ከ120-160 ሜትር", "am")).toBe("kə məto haja ɨskə məto sɨlsa metɨɾ");
        expect(phonemize("7-2 ነው", "am")).toBe("səbat hulət nəw"); // a score — no እስከ
    });

    // ኪ.ሜ/ኪሜ ×35 read as the letter-run "kime". The expansion is corpus-sourced: the same corpus writes
    // ኪሎ ሜትር and ኪሎሜትሮች in full. ካሬ PRECEDES the unit, also the corpus's own convention.
    test("ኪ.ሜ expands; ኪ.ሜ² is a squared area", () => {
        expect(phonemize("240 ኪ.ሜ", "am")).toBe("hulət məto aɾba kilo metɨɾ");
        expect(phonemize("19,500 ኪ.ሜ²", "am")).toBe("asɾa zətʼəɲ ʃi amɨst məto kaɾe kilo metɨɾ");
    });

    // Currency: the shared tier already carried $/¥/£. The #562 run added `magnitudes` and two LOCAL
    // workarounds for core limitations — see normalize.ts §8b.
    test("currency: magnitudes hop, letter-code prefixes reach the tier, the noun is not doubled", () => {
        expect(phonemize("US$14.7 ቢሊዮን", "am")).toContain("bilijon dolaɾ"); // was: sign dropped entirely
        expect(phonemize("$100 ዶላሮች", "am")).toBe("məto dolaɾot͡ʃ"); // was "məto dolaɾ dolaɾot͡ʃ"
        expect(phonemize("50%", "am")).toBe("hamsa bəməto"); // already correct; pinned
    });

    // NEGATIVE RESULT, pinned so a future reader does not re-derive it: the TOKEN letter class is
    // [ሀ-ፚ] = U+1200–U+135A and the Ethiopic punctuation is U+1362–U+1368, ABOVE the range. The hazard that
    // made Burmese and Khmer drop every sentence boundary (a raw block range swallowing the script's own
    // punctuation) does NOT apply to Amharic. This test fails if anyone widens the class to the full block.
    test("Ethiopic punctuation is not swallowed by the letter class", () => {
        expect(phonemize("ሀገር፣ ከተማ፤ ሰው። ውሃ፥ በረዶ፦ ጨው", "am"))
            .toBe("haɡəɾ , kətəma , səw . wɨha , bəɾədo , t͡ʃʼəw");
    });

    // #586 — the two powers sit on OPPOSITE SIDES in this language, which is why the tier's `position`
    // takes a per-power record. The corpus writes `783,562 ስኩዌር ኪ.ሜ.` (word before) and `120-160 ሜትር ኪዩብ`
    // (word after); a single value would have had to be wrong about one of them.
    test("the squared/cubed measure word (#586)", () => {
        expect(phonemize("783,562 km²", "am")).toContain("sɨkuweɾ kilo metɨɾ");
        expect(phonemize("120 m³", "am")).toContain("metɨɾ kijub");
    });
});
