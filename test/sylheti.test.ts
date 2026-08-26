import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/sylheti/sylheti.ts";
import { normalizeSylheti } from "../src/languages/sylheti/normalize.ts";

// Canonical-IPA goldens for Sylheti / ꠍꠤꠟꠐꠤ ꠘꠣꠉꠞꠤ (syl) — Eastern Indo-Aryan, the SYLOTI NAGRI abugida.
// Hand-adjudicated against wikipron syl_sylo_broad (human, Syloti Nagri). The generic-abugida g2p (inherent ɔ,
// Bengali-style inherent deletion) + Sylheti spirantisation are scored against it, with the unwritten HIGH tone
// and notation folded. Sylheti's signature is SPIRANTISATION: ꠇ/ꠈ→x, ꠌ/ꠍ→s, ꠎ→z, ꠙ→ɸ, ꠚ→f,
// ꠡ→ʃ, ꠢ→ɦ. Tone (H/L, developed from lost breathy voice) is unwritten → deferred.
describe("Sylheti canonical IPA — Syloti Nagri abugida + spirantisation", () => {
    test("SPIRANTISATION: ꠇ→x, ꠌ/ꠍ→s, ꠎ→z (the split from Bengali)", () => {
        expect(phonemizeWord("ꠀꠇꠟ")).toBe("axɔl"); // ꠇ (ko) → x
        expect(phonemizeWord("ꠀꠇꠔꠣ")).toBe("axt̪a"); // ꠇ→x, ꠔ→t̪ (dental), medial inherent deleted
        expect(phonemizeWord("ꠀꠍꠦ")).toBe("ase"); // ꠍ (cho) → s
        expect(phonemizeWord("ꠀꠁꠎ")).toBe("aiz"); // ꠎ (jo) → z
    });

    test("inherent vowel ɔ + final/medial deletion; ꠋ anusvara → ŋ", () => {
        expect(phonemizeWord("ꠀꠉꠘ")).toBe("aɡɔn"); // ꠉ→ɡ; inherent ɔ; final inherent on ꠘ dropped
        expect(phonemizeWord("ꠉꠞꠝ")).toBe("ɡɔɾɔm"); // "hot" — inherent ɔ twice
        expect(phonemizeWord("ꠀꠋꠉꠥꠞ")).toBe("aŋɡuɾ"); // "grape" — ꠋ (anusvara) → ŋ, ꠥ (sign-u) → u
        expect(phonemizeWord("ꠝꠣꠛꠥꠖ")).toBe("mabud̪"); // ꠖ (do) → d̪ (dental)
    });
});

// ── TEXT NORMALIZATION ───────────────────────────────────────────────────────────────────────────────
//
// Pinned against `tools/corpus/mined/syl.jsonc` (a syl.wikipedia dump). ⚠ THESE PIN THE RULE'S BRANCHES,
// NOT THE CORPUS'S INSTANCES — every case the corpus does not contain is marked, because a rule is
// correct exactly where you looked and silent everywhere else.
describe("Sylheti normalization — the clause marks", () => {
    // ⚠ THE LARGEST DEFECT THIS LANGUAGE HAD, and it was not a number rule. ⁕ U+2055 is the corpus's
    // sentence terminator (×476 in the artifact's excerpt tier) and was undeclared; ꠨ was declared as a
    // full stop while being a COMMA; and ꠨ ꠩ ꠪ ꠫ (U+A828–A82B) sit INSIDE the Syloti Nagri block, so the
    // old word class `[ꠀ-꠬]` claimed them as words and no declaration for them could ever be reached.
    test("⁕ ॥ ꠫ end a sentence; ꠨ ꠪ are a comma-length pause", () => {
        expect(phonemize("ꠉꠞꠝ ⁕ ꠙꠣꠘꠤ", "syl")).toBe("ɡɔɾɔm . ɸani");
        expect(phonemize("ꠈꠟꠦꠎ ॥ ꠡꠛ", "syl")).toBe("xɔlez . ʃɔb");
        expect(phonemize("ꠀꠍꠤꠟ꠫ ꠙ꠆ꠞꠝꠣꠘ", "syl")).toBe("asil . ɸɾɔman");
        // The corpus glosses ꠨ itself: `ꠅꠞ ꠝꠣꠏꠈꠣꠘꠧ ꠇꠝꠣ (꠨)` — "the COMMA (꠨)".
        expect(phonemize("ꠘꠎꠞꠈꠣꠞꠣ ꠨ ꠜꠣꠃꠀꠁꠟ", "syl")).toBe("nɔzɔɾxaɾa , bauail");
        // ꠪ introduces a gloss in all 24 of its instances (`ꠀꠋꠞꠦꠎꠤ ꠪ …`, "English: …").
        expect(phonemize("ꠀꠋꠞꠦꠎꠤ ꠪ ꠐꠦꠈꠣ", "syl")).toBe("aŋɾezi , ʈexa");
    });

    // ⚠ THE FOURTH TERMINATOR, missed by the first survey and found while porting. `৷` U+09F7 is
    // nominally BENGALI CURRENCY NUMERATOR FOUR and is universally typed as a DANDA because that is what
    // the glyph looks like: 9 instances in the mined artifact, ALL sentence-final after a Syloti word —
    // more than either ॥ (8) or ꠫ (6), both of which were declared. It fell through every class: outside
    // `BN_LETTER` (which stops at U+09E5) so the Bengali fold never saw it, and unlisted in TOKEN.
    test("৷ U+09F7 is a full stop, not silence", () => {
        expect(phonemize("ꠔꠣꠘ ꠙꠄꠖꠣ ꠅꠄ৷ ꠔꠣꠘ ꠛꠠ", "syl")).toBe("t̪an ɸɔed̪a ɔe . t̪an bɔɽ");
        // …and it reads identically to the ⁕ the same corpus writes for the same job.
        expect(phonemize("ꠔꠣꠘ ꠙꠄꠖꠣ ꠅꠄ⁕ ꠔꠣꠘ ꠛꠠ", "syl")).toBe("t̪an ɸɔed̪a ɔe . t̪an bɔɽ");
    });

    // ⚠ THE BRANCH THE CORPUS DOES NOT EXERCISE MUCH: a sentence-final `.`. Tabulating every dot in the
    // corpus gives 51 abbreviation dots against 3 real sentence-final periods, and the abbreviation rule
    // is narrowed to multi-dot tokens precisely so those 3 pauses survive.
    test("a sentence-final period is still a pause", () => {
        expect(phonemize("ꠈꠦꠁꠞ ꠅꠁꠛꠅ. ꠀꠝꠞ", "syl")).toBe("xeiɾ ɔibɔ . amɔɾ");
    });
});

describe("Sylheti normalization — numbers", () => {
    // De-grouping runs FIRST, and the group size is 2 OR 3 because this corpus writes both the Indic
    // 2-2-3 grouping and the Western 3-3. `renderNumber` supplies lakh/crore from the VALUE.
    test("de-grouping handles Indic AND Western separators", () => {
        expect(normalizeSylheti("১,০০,০০০")).toBe("১০০০০০");
        expect(normalizeSylheti("২২,২২৪,২৮২")).toBe("২২২২৪২৮২");
        expect(phonemize("১,০০,০০০ ꠢꠦꠇ꠆ꠐꠞ", "syl")).toBe("ex lax ɦexʈɔɾ");
        // …and a clause comma after a number is NOT a separator (one digit after it, not two or three).
        expect(normalizeSylheti("ꠛꠍꠞ ৫, ꠀꠞ")).toBe("ꠛꠍꠞ ৫, ꠀꠞ");
    });

    // ꠖꠡꠝꠤꠇ, sourced from syl.wikipedia's `৯ ꠖꠡꠝꠤꠇ ৭ ꠡꠞ꠆ꠇꠞꠣ` ("9 point 7 grams of sugar") and its
    // definitional `ꠖꠡꠝꠤꠇ ꠡꠁꠋꠇꠣ ꠚꠖ꠆ꠖꠔꠤ` ("the decimal number system").
    test("the decimal point is a WORD, not a clause pause", () => {
        expect(phonemize("১২.৫", "syl")).toBe("baɾɔ d̪ɔʃmix ɸas");
        // ⚠ THE UNEXERCISED BRANCH: a DOI is `digit.digit` too, and must not be read as a decimal.
        expect(normalizeSylheti("doi=10.1016/j.langsci.2018.06.010"))
            .toBe("doi=10.1016/j.langsci.2018.06.010");
    });

    // ⚠ THE ASCENDING GUARD. Measured over every hyphen/dash between two numbers in the artifact: 16 are
    // genuine ranges and all 16 ascend; 5 are not ranges and none does — two football scores, a URL
    // fragment and two lifespans. ꠔꠘꠦ is attested BETWEEN two numeric operands twice (`৫০% ꠔꠘꠦ ৯০%`,
    // `৩০ ꠔꠘꠦ 600 ꠐꠦꠈꠣ`) and is an ablative postposition on the left operand, which is the shape used.
    test("an ASCENDING pair is a range; a score is not", () => {
        expect(normalizeSylheti("১০-১৪ ꠍꠦ.ꠝꠤ.")).toBe("১০ ꠔꠘꠦ ১৪ ꠍꠦꠝꠤ");
        expect(normalizeSylheti("১৯,৬০০-২০,০০০")).toBe("১৯৬০০ ꠔꠘꠦ ২০০০০"); // after de-grouping
        expect(normalizeSylheti("3-3 ꠉꠂꠟꠦ")).toBe("3-3 ꠉꠂꠟꠦ"); // a drawn football score
        expect(normalizeSylheti("4-2 ꠛꠦꠛꠗꠣꠘꠦ")).toBe("4-2 ꠛꠦꠛꠗꠣꠘꠦ"); // and a won one
        // A hyphen carrying a case clitic is not a range either — the right operand is not a digit.
        expect(normalizeSylheti("১৯৭০-ꠞ ꠖꠡꠇ")).toBe("১৯৭০-ꠞ ꠖꠡꠇ");
    });
});

describe("Sylheti normalization — the signs", () => {
    // ꠡꠔꠣꠋꠡ / ꠒꠤꠉ꠆ꠞꠤ / ꠐꠦꠈꠣ, each sourced in `normalize.ts` with what attests it.
    test("percent, degrees and taka are read", () => {
        expect(phonemize("১০০%", "syl")).toBe("ex ʃɔ ʃɔt̪aŋɔʃ");
        // The corpus glosses its own abbreviation: `০° ꠍꠦꠟꠍꠤꠀꠍ` beside `১৮°ꠍꠦ.`.
        expect(normalizeSylheti("১৮°ꠍꠦ.")).toBe("১৮ ꠒꠤꠉ꠆ꠞꠤ ꠍꠦꠟꠍꠤꠀꠍ");
        expect(normalizeSylheti("৬৪.৪° ꠚꠣ.")).toBe("৬৪ ꠖꠡꠝꠤꠇ ৪ ꠒꠤꠉ꠆ꠞꠤ ꠚꠣꠞꠦꠘꠢꠣꠁꠐ");
        // ⚠ UNEXERCISED BRANCH: this corpus never writes the LATIN `°C`, and ℃ folds to it upstream.
        expect(normalizeSylheti("২০°C")).toBe("২০ ꠒꠤꠉ꠆ꠞꠤ ꠍꠦꠟꠍꠤꠀꠍ");
        expect(normalizeSylheti("২০℃")).toBe("২০℃"); // folded by registry.ts, not here — pinned as such
        expect(phonemize("৳৫", "syl")).toBe("ɸas ʈexa");
    });

    // TRAP 12: the corpus's own sentence states the currency once for three amounts, so the sign is
    // dropped exactly where the word is already written and read everywhere else.
    test("a REDUNDANT taka sign is dropped, not doubled", () => {
        expect(normalizeSylheti("৳১ ꠨ ৳২ ꠀꠞ ৳৫ ꠐꠦꠈꠣꠞ ꠘꠧꠐ")).toBe("১ ꠐꠦꠈꠣ ꠨ ২ ꠐꠦꠈꠣ ꠀꠞ ৫ ꠐꠦꠈꠣꠞ ꠘꠧꠐ");
    });

    // ⚠ A SOURCED REFUSAL, PINNED SO IT CANNOT BE QUIETLY "FIXED". No Sylheti minus word is attested
    // anywhere, and the corpus's negatives are real (absolute zero). The sign stays unread and
    // `review.ts --lang syl` stays red on it — see `defects.ts` under `syl`.
    test("the minus is NOT read (unsourced, deliberately)", () => {
        expect(normalizeSylheti("-২৭৩.১৫° ꠍꠦ.")).toBe("-২৭৩ ꠖꠡꠝꠤꠇ ১৫ ꠒꠤꠉ꠆ꠞꠤ ꠍꠦꠟꠍꠤꠀꠍ");
    });
});

describe("Sylheti normalization — the script repairs", () => {
    // The Bengali-Assamese hazard as this wiki actually presents it: not a second orthography, but marks
    // typed from a Bengali keyboard INSIDE a Syloti Nagri word, which split the token in two.
    test("a stray Bengali mark inside a Syloti word is folded", () => {
        expect(normalizeSylheti("ꠝূꠟ꠆ꠎꠝꠣꠘ")).toBe("ꠝꠥꠟ꠆ꠎꠝꠣꠘ");
        expect(normalizeSylheti("ꠙꠞꠤꠝꠣণꠦ")).toBe("ꠙꠞꠤꠝꠣꠘꠦ");
        expect(normalizeSylheti("ꠃৎꠙꠣꠖꠘ")).toBe("ꠃꠔ꠆ꠙꠣꠖꠘ");
        // ꠎ + ় is the ya-nukta digraph and behaves as a vowel carrier, not as [z].
        expect(normalizeSylheti("ꠡꠧꠒꠤꠎ়ꠣꠝ")).toBe("ꠡꠧꠒꠤꠀꠝ");
        expect(phonemize("ꠝূꠟ꠆ꠎꠝꠣꠘ", "syl")).toBe("mulzɔman"); // was `mɔ lzɔman`, two tokens
    });

    // ⚠ THE HOLE IN THE FOLD TABLE, found while porting. ৃ U+09C3 (vocalic R) is inside `BN_LETTER`'s
    // range, so it makes a run "mixed" and the fold runs — but it had no `BN_TO_SYL` entry, so it survived
    // the fold, fell outside the word class, and SPLIT THE TOKEN. ×7 in the artifact, and all 7 fix the
    // value at [ri]: প্রভৃতি, ব্যবহৃত, পৃথিবী, বৃহত্তম, পথিকৃত.
    test("the vocalic-R sign ৃ folds to ꠞꠤ instead of splitting the word", () => {
        expect(normalizeSylheti("ꠙ꠆ꠞꠜৃꠔꠤ")).toBe("ꠙ꠆ꠞꠜꠞꠤꠔꠤ");
        expect(phonemize("ꠙ꠆ꠞꠜৃꠔꠤ", "syl")).toBe("ɸɾɔbɾit̪i"); // was `ɸɾɔb t̪i`, two tokens
        // …the same reading the word gets when it is spelled in Syloti Nagri throughout.
        expect(phonemize("ꠙ꠆ꠞꠜꠞꠤꠔꠤ", "syl")).toBe("ɸɾɔbɾit̪i");
        expect(normalizeSylheti("ꠛ꠆ꠎꠛꠢৃꠔ")).toBe("ꠛ꠆ꠎꠛꠢꠞꠤꠔ");
    });

    // ⚠ THE GUARD IS THE RULE. A genuine Bengali-script gloss must be left for the script router; folding
    // it would read Bengali with Sylheti phonology, which is worse than the correct reading it replaces.
    test("a genuine Bengali-script run is NOT transliterated", () => {
        expect(normalizeSylheti("ꠛꠦꠋꠉꠟꠤ ꠝꠣꠔꠖꠤ ꠪ বাংলাদেশ")).toBe("ꠛꠦꠋꠉꠟꠤ ꠝꠣꠔꠖꠤ ꠪ বাংলাদেশ");
    });

    // A multi-dot native abbreviation was reaching the output as a run of clause pauses.
    test("a multi-dot abbreviation is one word, not three pauses", () => {
        expect(phonemize("২৫ ꠝꠤ.ꠉ꠆ꠞꠣ.", "syl")).toBe("ɸɔsiʃ miɡɾa"); // was `ɸɔsiʃ mi . ɡɾa .`
        // A SINGLE-dot abbreviation is deliberately left alone: it cannot be told from a sentence end.
        expect(normalizeSylheti("ꠛꠣꠢꠣꠖꠥꠞ ꠒꠣ. ꠝꠃꠟꠧꠜꠤ")).toBe("ꠛꠣꠢꠣꠖꠥꠞ ꠒꠣ. ꠝꠃꠟꠧꠜꠤ");
    });

    // A zero-width joiner mid-word split one Syloti token into two.
    test("zero-width characters are stripped", () => {
        expect(normalizeSylheti("ꠖꠇ꠆‌ꠈꠤꠘ")).toBe("ꠖꠇ꠆ꠈꠤꠘ");
    });
});
