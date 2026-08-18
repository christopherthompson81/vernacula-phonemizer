import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeWestArmenian, ordinalWords } from "../src/languages/westarmenian/normalize.ts";

import { phonemizeWord } from "../src/languages/westarmenian/westarmenian.ts";
import { phonemizeWord as eastern } from "../src/languages/armenian/armenian.ts";

// Canonical-IPA goldens for WESTERN Armenian (hyw) — արեւմտահայերէն, the Istanbul/diaspora standard. The signature is
// the CONSONANT SHIFT: the classical three-way stop/affricate system collapses to a two-way one — classical VOICED
// ⟨բ դ գ ձ ջ⟩ and classical ASPIRATE ⟨փ թ ք ց չ⟩ both → voiceless-aspirated [pʰ tʰ kʰ t͡sʰ t͡ʃʰ], while classical
// VOICELESS ⟨պ տ կ ծ ճ⟩ → VOICED [b d ɡ d͡z d͡ʒ]. Referee: wikipron hye_armn_w broad + narrow.
describe("Western Armenian (արեւմտահայերէն) canonical IPA", () => {
    test("THE CONSONANT SHIFT — classical voiceless ⟨պ տ կ⟩ → VOICED [b d ɡ]", () => {
        expect(phonemizeWord("պատ")).toBe("bɑd"); // 'wall' — ⟨պ⟩→[b], final ⟨տ⟩→[d]
        expect(phonemizeWord("տուն")).toBe("dun"); // 'house' — ⟨տ⟩→[d]
        expect(phonemizeWord("կով")).toBe("ɡov"); // 'cow' — ⟨կ⟩→[ɡ]
        expect(phonemizeWord("ծառ")).toBe("d͡zɑɾ"); // 'tree' — ⟨ծ⟩→[d͡z]
        expect(phonemizeWord("ճամբա")).toBe("d͡ʒɑmpʰɑ"); // 'road' — ⟨ճ⟩→[d͡ʒ], and ⟨բ⟩→[pʰ]
    });

    test("THE CONSONANT SHIFT — classical voiced ⟨բ դ գ⟩ → voiceless-ASPIRATED [pʰ tʰ kʰ]", () => {
        expect(phonemizeWord("բարի")).toBe("pʰɑɾi"); // 'kind' — ⟨բ⟩→[pʰ]
        expect(phonemizeWord("դուռ")).toBe("tʰuɾ"); // 'door' — ⟨դ⟩→[tʰ], and ⟨ռ⟩→[ɾ] (neutralised)
        expect(phonemizeWord("գործ")).toBe("kʰoɾd͡z"); // 'work' — ⟨գ⟩→[kʰ], ⟨ծ⟩→[d͡z]
        expect(phonemizeWord("ձուկ")).toBe("t͡sʰuɡ"); // 'fish' — ⟨ձ⟩→[t͡sʰ], ⟨կ⟩→[ɡ]
        expect(phonemizeWord("ջուր")).toBe("t͡ʃʰuɾ"); // 'water' — ⟨ջ⟩→[t͡ʃʰ]
    });

    test("classical aspirate ⟨փ թ ք⟩ stay [pʰ tʰ kʰ] — MERGING with the shifted voiced column", () => {
        expect(phonemizeWord("փակ")).toBe("pʰɑɡ"); // ⟨փ⟩→[pʰ] (= ⟨բ⟩), ⟨կ⟩→[ɡ]
        expect(phonemizeWord("թութ")).toBe("tʰutʰ"); // ⟨թ⟩→[tʰ] (= ⟨դ⟩)
        expect(phonemizeWord("քար")).toBe("kʰɑɾ"); // ⟨ք⟩→[kʰ] (= ⟨գ⟩)
    });

    test("shared features + the front-rounded ⟨յու⟩→[ʏ] is POST-CONSONANT ONLY", () => {
        expect(phonemizeWord("Երևան")).toBe("jeɾevɑn"); // word-initial ⟨ե⟩→[je]; ligature ⟨և⟩→[ev]
        expect(phonemizeWord("Առյուծ")).toBe("ɑɾʏd͡z"); // C+⟨յու⟩→[ʏ] front-rounded (after ⟨ռ⟩); ⟨ծ⟩→[d͡z]
        expect(phonemizeWord("Հարություն")).toBe("hɑɾutʰʏn"); // C+⟨յու⟩→[ʏ] (the -ություն suffix, after ⟨թ⟩)
        expect(phonemizeWord("յոթ")).toBe("jotʰ"); // 'seven' — word-initial ⟨յո⟩ is the GLIDE [jo], NOT [œ]
        expect(phonemizeWord("յուղ")).toBe("juʁ"); // 'oil' — word-initial ⟨յու⟩ is the GLIDE [ju], NOT [ʏ]
    });

    test("the same word diverges from EASTERN precisely on the stop series", () => {
        expect(phonemizeWord("պատ")).toBe("bɑd"); // Western
        expect(eastern("պատ")).toBe("pɑt"); // Eastern — the voicing is mirror-imaged
        expect(phonemizeWord("բարի")).toBe("pʰɑɾi"); // Western
        expect(eastern("բարի")).toBe("bɑɾi"); // Eastern
    });
});

// ── TEXT NORMALIZATION (src/languages/westarmenian/normalize.ts) ────────────────────────────────────
//
// This is a SIBLING TEST. `src/languages/armenian/normalize.ts` already solves the same script and the
// same defining defect; the cases below are the ones where reading hyw's own corpus gave a different
// answer from porting hy's layer across (playbook trap 55). Evidence: `tools/corpus/mined/hyw.jsonc`
// (hyw.wikipedia dump, 140,044 paragraph segments).
describe("Western Armenian text normalization", () => {
    const hyw = { text: (s: string) => phonemize(s, "hyw") };

    test("THE SEVEN THINGS THAT DID NOT TRANSFER FROM EASTERN", () => {
        // The classical ⟨թ⟩ in the measure words — մեթր ×60, քիլոմեթր ×49 on hyw.wikipedia.
        expect(hyw.text("36 կմ")).toBe(hyw.text("36 քիլոմեթր"));
        expect(hyw.text("330 մ")).toBe(hyw.text("330 մեթր"));
        // տոլար ×48, not Eastern's դոլար; եւրօ ×62, not եվրո.
        expect(hyw.text("$25")).toBe(hyw.text("25 տոլար"));
        expect(hyw.text("€25")).toBe(hyw.text("25 եւրօ"));
        // ⚠ THE SCALE COMPOUND IS «սելսիուս աստիճան» — scale FIRST and no genitive, where Eastern writes
        // «Ցելսիուսի աստիճան». The wiki puts it in the slot three times ("0 սելսիուս աստիճանին").
        expect(hyw.text("20 °C")).toBe(hyw.text("20 սելսիուս աստիճան"));
        // ⚠ THE CASE SUFFIX IS LOWERCASE-ONLY AND MUST STAY SO. Making the scale letter case-
        //   insensitive with an `i` flag folds this language's suffix class too, so an UPPERCASE
        //   run after the hyphen starts being captured as a suffix. The scale letter goes in the
        //   character class instead; these pin both halves.
        expect(hyw.text("20 °c")).toBe(hyw.text("20 °C"));       // lowercase scale letter
        expect(hyw.text("20 °-ը")).toBe(hyw.text("20 աստիճանը")); // lowercase suffix IS absorbed
        expect(hyw.text("20 °-Ը")).not.toBe(hyw.text("20 աստիճանԸ")); // uppercase is NOT a suffix
        // ⚠ AND THE OBLIQUE "TWO" IS երկուք-, not Eastern's երկուս- (երկուք ×17 against երկուս ×1).
        expect(ordinalWords(2)).toBe("երկրորդ");
        expect(normalizeWestArmenian("22-ին")).toBe("քսան երկուքին");
    });

    test("the ERA, which the wiki glosses by itself in one parenthesis", () => {
        // "714 Քրիստոսէ առաջ (Մեր թուարկութենէն Առաջ)" — both abbreviations, one sentence.
        expect(normalizeWestArmenian("Ք.Ա. 8-րդ")).toBe("Քրիստոսէ առաջ ութերորդ");
        expect(normalizeWestArmenian("մ.թ.ա. 85")).toBe("մեր թուարկութենէն առաջ 85");
        expect(normalizeWestArmenian("մ.թ. 694")).toBe("մեր թուարկութեամբ 694");
        // …and the corpus's own self-gloss of the astronomical unit.
        expect(normalizeWestArmenian("5.23 ա.մ.")).toBe("5 ամբողջ 23 աստղագիտական միաւոր");
    });

    test("the BOUND SUFFIX on a figure — this language's defining form, 174 instances retained", () => {
        expect(normalizeWestArmenian("2019-ին")).toBe("երկու հազար տասնինին");
        expect(normalizeWestArmenian("2029-ի")).toBe("երկու հազար քսան ինի");
        expect(normalizeWestArmenian("3-րորդ")).toBe("երրորդ"); // the fuller suffix spelling
        expect(normalizeWestArmenian("8-րդ դարէն")).toBe("ութերորդ դարէն");
        expect(normalizeWestArmenian("1960-ականներուն")).toBe("հազար իննհարիւր վաթսունականներուն");
        // ⚠ A RANGE MUST NOT BE CLAIMED BY THE SUFFIX RULE — it needs a LETTER after the hyphen.
        expect(normalizeWestArmenian("1915-1923")).toBe("1915, 1923");
    });

    test("BOTH marks are the decimal here, and the space is the grouping", () => {
        // "5.23 … 4.59 … 5,87" — three decimals, two conventions, one clause.
        expect(normalizeWestArmenian("5,87")).toBe("5 ամբողջ 87");
        expect(normalizeWestArmenian("5.87")).toBe("5 ամբողջ 87");
        expect(normalizeWestArmenian("1 377 808")).toBe("1377808"); // space-grouped
        expect(normalizeWestArmenian("445,000")).toBe("445000"); // …and a comma with exactly 3 digits
        // ⚠ A LEADING ZERO IN THE FRACTION IS A SILENT 10× ERROR OTHERWISE (trap 56).
        expect(normalizeWestArmenian("0.037")).toBe("0 ամբողջ զրօ 37");
    });

    test("⚠ THE COUNTER-EXAMPLE TO TRAP 62 — here `=` really is an equals sign", () => {
        // Five rounds running, `=` was a heading, a gloss, a parallel title, a typo, a Pali definition.
        // hyw has 44 and most are arithmetic from its number-theory articles.
        expect(normalizeWestArmenian("100=47")).toBe("100 հաւասար 47");
        // …but the rule stays DIGIT-GATED, because the sign's other use here is a variable assignment.
        expect(normalizeWestArmenian("ρ =1260")).toBe("ρ =1260");
    });

    test("the signs that take a PAUSE rather than a word", () => {
        expect(normalizeWestArmenian("3800±200")).toBe("3800, 200"); // a tolerance, ×3
        expect(normalizeWestArmenian("0.96÷1.41")).toBe("0 ամբողջ 96, 1 ամբողջ 41"); // ÷ is a RANGE here
        // ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58).
        expect(normalizeWestArmenian("735-714:")).toBe("735, 714:");
    });
});
