import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/santali/santali.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Santali (sat) — ᱥᱟᱱᱛᱟᱲᱤ, Munda (Austroasiatic), the OL CHIKI alphabet (U+1C50–1C7F), the
// A grapheme scan + sign rules: ⟨ᱷ⟩ aspirates the preceding stop
// (ᱵᱷ→bʱ), ⟨ᱹ⟩ modifies the vowel (ᱟᱹ→ə), ⟨ᱸ⟩ nasalizes it (ᱟᱸ→ã), and the HALLMARK — a word-final voiced stop is
// CHECKED/glottalized (ᱫᱟᱜ→dakʼ, ᱢᱮᱫ→metʼ). Referee: kaikki Santali (490 human).
describe("Santali (ᱥᱟᱱᱛᱟᱲᱤ) canonical IPA", () => {
    test("word-final CHECKED stops (the Santali hallmark)", () => {
        expect(phonemizeWord("ᱫᱟᱜ")).toBe("dakʼ"); // 'water' — final ⟨ᱜ⟩ ɡ→checked [kʼ]
        expect(phonemizeWord("ᱢᱮᱫ")).toBe("metʼ"); // 'eye' — final ⟨ᱫ⟩ d→[tʼ]
        expect(phonemizeWord("ᱪᱮᱫ")).toBe("cetʼ"); // 'what' — ⟨ᱪ⟩→c, final ⟨ᱫ⟩→[tʼ]
        expect(phonemizeWord("ᱦᱚᱲ")).toBe("hɔɽ"); // 'person/Santal' — ⟨ᱲ⟩→ɽ (no checking on a sonorant)
    });

    test("nasalization ⟨ᱸ⟩, vowel-mod ⟨ᱹ⟩→ə, aspiration ⟨ᱷ⟩", () => {
        expect(phonemizeWord("ᱪᱟᱸᱫᱚ")).toBe("cãdɔ"); // 'moon' — ⟨ᱟᱸ⟩→[ã], ⟨ᱚ⟩→ɔ
        expect(phonemizeWord("ᱯᱟᱹᱨᱥᱤ")).toBe("pərsi"); // 'language' — ⟨ᱟᱹ⟩→[ə]
        expect(phonemizeWord("ᱵᱷᱟᱨᱚᱛ")).toBe("bʱarɔt"); // 'India' — ⟨ᱵᱷ⟩→[bʱ] aspirated
    });

    test("palatal ⟨ᱡ⟩→ɟ, the script's own name, and a multi-word phrase", () => {
        expect(phonemizeWord("ᱚᱡᱚ")).toBe("ɔɟɔ"); // ⟨ᱡ⟩ AAJ → palatal stop [ɟ]
        expect(phonemizeWord("ᱥᱟᱱᱛᱟᱲᱤ")).toBe("santaɽi"); // 'Santali'
        expect(phonemizeWord("ᱚᱞ ᱪᱮᱢᱮᱫ")).toBe("ɔl cemetʼ"); // 'Ol Chemet' (the script) — checking applies per word
    });

    test("⟨ᱽ AHAD⟩ blocks final checking; ⟨ᱶ OV⟩→w̃; nasalized/ɛ nucleus still checks", () => {
        expect(phonemizeWord("ᱨᱳᱜ")).toBe("rokʼ"); // final ⟨ᱜ⟩ ɡ→checked [kʼ]
        expect(phonemizeWord("ᱨᱳᱜᱽ")).toBe("roɡ"); // + ⟨ᱽ AHAD⟩ → PLAIN, unchecked (the minimal pair)
        expect(phonemizeWord("ᱥᱟᱶ")).toBe("saw̃"); // ⟨ᱶ OV⟩ = the NASAL glide [w̃] (vs ⟨ᱣ⟩ [w])
        expect(phonemizeWord("ᱥᱮᱺᱜᱮᱹᱞ")).toBe("sɛ̃ɡɛl"); // ⟨ᱮᱺ⟩ → lowered+nasalized [ɛ̃]
    });

    // ═══ CARDINAL NUMBERS — the NATIVE MUNDA decimal series (ᱜᱮᱞ 'ten' as the base) for 1–99, with the
    // Indo-Aryan loan magnitudes above it, in Indian 2-2-3 grouping. Sources in src/languages/santali/numbers.ts.
    test("cardinals: native ᱜᱮᱞ decimal, SPACED, purely additive", () => {
        const sat = getPhonemizer("sat");
        expect(sat.text("0").trim()).toBe("sun"); // ᱥᱩᱱ — an IA loan; no native Munda zero exists
        expect(sat.text("5").trim()).toBe("mɔɳe"); // ᱢᱚᱬᱮ
        expect(sat.text("11").trim()).toBe("ɡel mitʼ"); // ᱜᱮᱞ ᱢᱤᱫ — SPACED in Ol Chiki practice
        expect(sat.text("25").trim()).toBe("bar ɡel mɔɳe"); // ᱵᱟᱨ ᱜᱮᱞ ᱢᱚᱬᱮ — attested; 'two-ten-five'
        expect(sat.text("47").trim()).toBe("pun ɡel ejaj"); // ᱯᱩᱱ ᱜᱮᱞ ᱮᱭᱟᱭ — Ghosh's own worked example
        // The multiplier ONE is written in Santali (unlike Maltese/Lule Sami, which drop it).
        expect(sat.text("100").trim()).toBe("mitʼ saj"); // ᱢᱤᱫ ᱥᱟᱭ, never bare ᱥᱟᱭ
    });

    test("cardinals: IA loan magnitudes + Indian 2-2-3 grouping (no million/billion exists)", () => {
        const sat = getPhonemizer("sat");
        expect(sat.text("1200").trim()).toBe("mitʼ haɟar bar saj"); // ᱢᱤᱫ ᱦᱟᱡᱟᱨ ᱵᱟᱨ ᱥᱟᱭ — attested in prose
        expect(sat.text("5000").trim()).toBe("mɔɳe haɟar"); // ᱢᱚᱬᱮ ᱦᱟᱡᱟᱨ — attested
        expect(sat.text("100000").trim()).toBe("mitʼ lakʰ"); // ᱢᱤᱫ ᱞᱟᱠᱷ — 10⁵ is a LAKH, not "hundred thousand"
        expect(sat.text("1000000").trim()).toBe("ɡel lakʰ"); // ᱜᱮᱞ ᱞᱟᱠᱷ = ten lakh — Santali has no "million"
        expect(sat.text("10000000").trim()).toBe("mitʼ kɔrɔɽ"); // ᱢᱤᱫ ᱠᱚᱨᱚᱲ — 10⁷ is a CRORE
    });

    test("cardinals: OL CHIKI digits ᱐-᱙ compose exactly like Western ones", () => {
        // U+1C50–1C59. ᱒᱕ is the same number as 25, so it must read identically.
        expect(getPhonemizer("sat").text("᱒᱕").trim()).toBe("bar ɡel mɔɳe");
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// TEXT NORMALIZATION — src/languages/santali/normalize.ts. The evidence for every rule is in that file's
// header; these pin the BRANCHES rather than the corpus's instances (trap 13), so each block covers a
// branch AND the adversarial neighbour that must not be claimed.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
describe("Santali (sat) text normalization", () => {
    const say = (s: string): string => getPhonemizer("sat").text(s).trim();

    // ⚠ THE LARGEST DEFECT IN THE LANGUAGE, and it is not a number rule: sat.wikipedia types ⟨ᱹ GAAHLAA⟩
    // as an ASCII PERIOD (246 occurrences in the mined artifact's 242 retained segments). Each one split
    // its word, inserted a clause pause, AND left the vowel unmodified.
    test("the ASCII period is ⟨ᱹ GAAHLAA⟩ — the dotted spelling reads as the signed one", () => {
        // The invariant, stated as an EQUALITY rather than a literal: the two spellings the corpus writes
        // for one word must read identically. 55 of its 142 dotted forms have their signed twin in the
        // same 242 segments, so this is the corpus's own minimal pair.
        for (const [dotted, signed] of [
            ["ᱞᱟ.ᱜᱤᱫ", "ᱞᱟᱹᱜᱤᱫ"],   // 'for'  — the commonest, ×9
            ["ᱟ.ᱰᱤ", "ᱟᱹᱰᱤ"],       // 'very'
            ["ᱠᱟ.ᱢᱤ", "ᱠᱟᱹᱢᱤ"],     // 'work'
            ["ᱢᱤᱫᱴᱟ.ᱝ", "ᱢᱤᱫᱴᱟᱹᱝ"], // 'one'
            ["ᱨᱩᱣᱟ.", "ᱨᱩᱣᱟᱹ"],     // 'fever' — the WORD-FINAL branch, a different arm of the rule
            ["ᱴᱷᱟ.ᱣᱠᱟ.ᱱ", "ᱴᱷᱟᱹᱣᱠᱟᱹᱱ"], // two dots in one word
        ] as const) expect(say(dotted)).toBe(say(signed));
        expect(say("ᱞᱟ.ᱜᱤᱫ")).toBe("ləɡitʼ"); // and it is the RIGHT reading, not merely a matching one
        expect(say("ᱨᱩᱣᱟ.")).toBe("ruwə");
    });

    // ⚠ THE ADVERSARIAL NEIGHBOUR of the rule above, and the reason it keys on ⟨ᱟ⟩ rather than on the
    // vowel class: the same corpus writes Latin acronyms SPELLED OUT in Ol Chiki with the same dot. A
    // wider vowel class rewrote PSLV's first dot to a GAAHLAA and glued the acronym shut (*pies el bʱi*).
    test("a dot after a CONSONANT is an initialism separator, not a GAAHLAA", () => {
        expect(say("ᱯᱤ.ᱮᱥ.ᱮᱞ.ᱵᱷᱤ")).toBe("pi es el bʱi"); // PSLV — letter names, not one word
        expect(say("ᱟᱨ.ᱮᱱ.ᱟᱭ")).toBe("ar en aj");           // RNI
        expect(say("ᱭᱩ.ᱴᱤ.ᱥᱤ")).toBe("ju ʈi si");            // UTC
        // ⚠ THE ERA MARKER IS DELIBERATELY NOT EXPANDED. `ᱠ.ᱞ.` is a corpus hapax whose expansion the
        // wiki never spells out (`ᱠᱷᱨᱤᱥᱴ ᱞᱟᱦᱟ` and `ᱠᱷᱨᱤᱥᱴᱚ ᱞᱟᱦᱟ` are both 0/0), so it reads as its
        // letters rather than as a guessed phrase. Pinning this pins the REFUSAL, which is the point.
        expect(say("᱑᱙᱓ ᱠ.ᱞ.")).toBe("mitʼ saj are ɡel pe k l");
    });

    // ⚠ AND THE SAME SUBSTITUTION FOR ⟨ᱼ PHAARKAA⟩, narrowed to the finite-verb enclitic (70 of the 99
    // hyphens). The phonemes were already right; what was wrong was the word boundary.
    test("the ASCII hyphen is ⟨ᱼ PHAARKAA⟩ before the verb enclitic — and NOT in a compound", () => {
        expect(say("ᱢᱮᱱᱟᱜ-ᱟ")).toBe(say("ᱢᱮᱱᱟᱜᱼᱟ"));
        expect(say("ᱢᱮᱱᱟᱜ-ᱟ")).toBe("menakʼa"); // was *menakʼ a*, two words
        expect(say("ᱦᱩᱭᱩᱜ-ᱟ")).toBe("hujukʼa");
        // The ~29 genuine compound hyphens keep their word boundary, which is what they mean.
        expect(say("ᱚᱞ-ᱛᱚᱞ")).toBe("ɔl tɔl");
        expect(say("ᱤᱱᱰᱚ-ᱮᱭᱨᱚ")).toBe("inɖɔ ejrɔ");
    });

    // ⚠ BOTH DECIMAL CONVENTIONS, and the point is that they now agree. The corpus writes `᱒᱒.᱓᱓` ×84 and
    // — remarkably — `᱓᱐ᱹ᱑` ×16, with the GAAHLAA sign standing in for the point. The ᱹ form used to read
    // as NOTHING (a lone sign is an empty token), so `᱓᱐ᱹ᱑` silently merged into *thirty one*.
    // ⚠ NO DECIMAL WORD IS EMITTED, and that refusal is deliberate and priced: `ᱴᱩᱰᱟᱹᱜ` is attested as the
    // NAME of the mark (the script article calls ⟨ᱹ⟩ `ᱜᱟᱹᱦᱞᱟᱹ ᱴᱩᱰᱟᱹᱜ`) but nothing attests it as how a
    // reader says a decimal, and STRIPPING the separator would invent a quantity — `᱒᱒.᱓᱓` would become
    // *twenty-two thirty-three*. The pause it already had is kept; the invariant is the AGREEMENT.
    test("the GAAHLAA decimal separator folds onto the ASCII one", () => {
        expect(say("᱓᱐ᱹ᱑")).toBe(say("᱓᱐.᱑"));
        expect(say("᱒᱓ᱹ᱔᱔")).toBe(say("᱒᱓.᱔᱔"));
        expect(say("᱓᱐ᱹ᱑")).not.toBe(say("᱓᱐᱑")); // and it is NOT read as a single number
    });

    // ⚠ DE-GROUPING, WITH BOTH CONVENTIONS. Untreated, `᱑᱐,᱐᱐᱐` read as *ɡel , sun* — "ten, zero", the
    // quantity destroyed rather than merely paused. The corpus writes western 3-3-3 AND Indian 2-2-3.
    test("de-grouping handles western 3-3-3 and Indian 2-2-3 alike", () => {
        expect(say("᱑᱐,᱐᱐᱐")).toBe("ɡel haɟar");
        expect(say("᱑,᱒᱓,᱔᱕᱖")).toBe(say("123456"));   // Indian grouping — the 2-digit arm
        expect(say("᱒᱙᱙,᱗᱙᱒,᱔᱕᱘")).toBe(say("299792458")); // the speed of light, one number at last
        // A comma with ONE digit after it is not a group — Santali writes no comma-decimal, and the two
        // corpus instances of a trailing 2-digit group are both fragments of an Indian-grouped number.
        expect(say("᱑᱒,᱕")).toContain(",");
    });

    // ⚠ THE RANGE JOINER IS ATTESTED AND IS AN INFIX — checked for PART OF SPEECH, not just existence
    // (the Fula `hakkunde` lesson). Every corpus instance puts `ᱠᱷᱚᱱ` BETWEEN the two numerals.
    test("ranges take the attested infix ᱠᱷᱚᱱ — hyphen, en dash and ⟨ᱼ PHAARKAA⟩ alike", () => {
        expect(say("᱒-᱓ ᱜᱤᱫᱽᱨᱟᱹ")).toBe("bar kʰɔn pe ɡidrə");
        expect(say("᱑᱙᱔᱕-᱑᱙᱔᱖")).toContain("kʰɔn");
        expect(say("᱑᱘᱔᱘ ᱼ ᱔᱙")).toContain("kʰɔn"); // PHAARKAA used as a dash, ×4 digit-flanked
        expect(say("᱑᱙᱓᱐ – ᱑᱙᱔᱘")).toContain("kʰɔn");
    });

    // ⚠ THE GUARD IS THE POINT (trap 55). The SAME corpus writes subtraction and a true negative in its
    // arithmetic article, and a bare digit-hyphen-digit rule would read both as spans. It must not.
    test("the range rule refuses arithmetic, a negative result, and a clock field", () => {
        expect(say("᱑ - ᱐ = ᱑")).not.toContain("kʰɔn");   // subtraction, not a span
        expect(say("᱐ - ᱑ = -᱑")).not.toContain("kʰɔn");   // and a genuine negative RESULT
        expect(say("᱑᱐:᱓᱐ - ᱑᱑")).not.toContain("kʰɔn");   // a clock field is not an operand
    });

    // ⚠ THE SOURCED SIGN VOCABULARY. Each word's attestation and the sense that was READ are in
    // normalize.ts's header; these pin that the rules fire and in the language's own POSTPOSED order.
    test("percent, currency, units and the exponent are read, postposed", () => {
        expect(say("᱕᱐%")).toBe("mɔɳe ɡel sajkɔɽa");          // ᱥᱟᱭᱠᱚᱲᱟ, "per hundred"
        expect(say("$᱕᱐᱐")).toBe("mɔɳe saj ɖɔlar");
        expect(say("₹᱕᱐᱐")).toBe("mɔɳe saj ʈaka");
        expect(say("US$᱑᱐᱐")).toBe("mitʼ saj ɖɔlar");          // the compound key; a bare `$` cannot match
        expect(say("᱕ km")).toBe("mɔɳe kilɔmiʈɔr");            // was *mɔɳe ˈʊkm*, raw Latin
        expect(say("᱕ km²")).toBe("mɔɳe bɔrɡɔ kilɔmiʈɔr");     // ᱵᱚᱨᱜᱚ PRECEDES, and was English *skwˈɛɹd*
        expect(say("᱑᱐᱕ ᱠ.ᱢ.")).toBe("mitʼ saj mɔɳe kilɔmiʈɔr"); // the NATIVE dotted abbreviation
    });

    // ⚠ THE DEGREE, AND WHAT IT REFUSES. `°C` was reading the ⟨C⟩ through the English fallback as the
    // letter name *sˈiː* — trap 56's class, a plausible word rather than a visible leak.
    test("°C and the bare ° are read; °F and a Latin-direction coordinate are refused whole", () => {
        expect(say("᱓᱐ °C")).toBe("pe ɡel ɖiɡri selsijɔs");
        expect(say("᱔᱐°C")).toBe("pun ɡel ɖiɡri selsijɔs");
        // The corpus's DOMINANT shape: a bare ° with the noun already spelled out in Santali.
        expect(say("᱒᱙° ᱠᱷᱚᱱ ᱓᱖° ᱥᱮᱞᱥᱤᱭᱚᱥ")).toBe("bar ɡel are ɖiɡri kʰɔn pe ɡel turuj ɖiɡri selsijɔs");
        // ⚠ REFUSED WHOLE, never half (trap 53): no Fahrenheit word and no sourced direction words, and
        // reading only the ° would leave the direction letter to the English fallback as *ˈɛn*.
        expect(say("᱑᱐᱔°F")).not.toContain("ɖiɡri");
        expect(say("22.33°N")).not.toContain("ɖiɡri");
    });

    // ⚠ ZERO-WIDTH CHARACTERS END THE WORD, because they are outside `TOKEN`'s class entirely.
    test("ZWNJ/ZWJ inside a word are stripped rather than splitting it", () => {
        expect(say("ᱦᱚ‌ᱲ")).toBe("hɔɽ"); // was *hɔ ɽ*
        expect(say("ᱦᱚ‍ᱲ")).toBe("hɔɽ");
    });

    // ⚠ ⟨ᱻ RELAA⟩ IS UNREADABLE TODAY — it is inside `TOKEN`'s word class but no branch of phonemizeWord
    // claims it, so it contributes the empty string. Repaired to PHAARKAA only after a CONSONANT, where
    // its own vowel-LENGTH function is impossible; after a vowel it is left alone, and that residual gap
    // is real and stated rather than papered over.
    test("⟨ᱻ RELAA⟩ after a consonant is repaired to ⟨ᱼ PHAARKAA⟩, after a vowel it is not", () => {
        expect(say("ᱦᱩᱭᱩᱜᱻᱟ")).toBe(say("ᱦᱩᱭᱩᱜᱼᱟ"));
        expect(say("ᱱᱟᱜᱟᱨᱻᱮ")).toBe(say("ᱱᱟᱜᱟᱨᱼᱮ"));
        expect(say("ᱢᱤᱻᱢᱤᱫ")).toBe("mimitʼ"); // after a vowel: unchanged, and still unread. Known gap.
    });

    // ⚠ ORDINARY TEXT MUST SURVIVE, and a sentence end must not be lost. The dot rule rewrites a
    // character that is also this layer's clause punctuation, so this is the check that matters most.
    test("ordinary prose keeps its ᱾ MUCAAD pauses and gains no new ones", () => {
        const src = "ᱦᱚᱲ ᱠᱚ ᱫᱚ ᱟ.ᱰᱤ ᱦᱩᱭᱩᱜ-ᱟ ᱾ ᱟᱨ ᱞᱟ.ᱜᱤᱫ ᱠᱟ.ᱢᱤ ᱢᱮᱱᱟᱜᱼᱟ ᱿";
        const out = say(src);
        expect(out).toBe("hɔɽ kɔ dɔ əɖi hujukʼa . ar ləɡitʼ kəmi menakʼa .");
        expect(out.split(".").length - 1).toBe(2); // exactly the two native terminators, no extras
    });
});
