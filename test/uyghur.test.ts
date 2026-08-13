import { describe, expect, test } from "vitest";

import { numeralWords, phonemizeWord } from "../src/languages/uyghur/uyghur.ts";
import { makeUyghurNormalizer } from "../src/languages/uyghur/normalize.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Uyghur / ئۇيغۇرچە (ug) — Turkic (Karluk), the Uyghur Arabic alphabet (a FULL phonemic
// alphabet — all 8 vowels written, so no short-vowel restoration). Hand-adjudicated against wikipron uig_arab_broad
// (human, 2673) refereeing the greedy letter→IPA g2p + final-stop devoicing. Signatures:
// ا→ɑ (back a), ە→ɛ, the hamza ئ→ʔ (glottal onset), ⟨چ ج⟩→t͡ʃ d͡ʒ, ⟨غ⟩→ʁ, ⟨خ⟩→χ, ⟨ق⟩→q, ⟨ف⟩→p (nativised).
describe("Uyghur canonical IPA — greedy letter g2p", () => {
    test("vowels ا→ɑ / ە→ɛ, the hamza ئ→ʔ glottal onset, ⟨غ⟩→ʁ", () => {
        expect(phonemizeWord("ئۇيغۇر")).toBe("ʔujʁur"); // "Uyghur" — ئ→ʔ onset, ۇ→u, ي→j, غ→ʁ
        expect(phonemizeWord("ئالىم")).toBe("ʔɑlim"); // "scholar" — ا→ɑ (back)
        expect(phonemizeWord("مەكتەپ")).toBe("mɛktɛp"); // "school" — ە→ɛ
        expect(phonemizeWord("خەلق")).toBe("χɛlq"); // "people" — خ→χ, ق→q
    });

    test("affricates ⟨چ ج⟩→t͡ʃ d͡ʒ, ڭ→ŋ", () => {
        expect(phonemizeWord("ئۇيغۇرچە")).toBe("ʔujʁurt͡ʃɛ"); // "Uyghur (language)" — چ→t͡ʃ
        expect(phonemizeWord("جۇڭگو")).toBe("d͡ʒuŋɡo"); // "China" — ج→d͡ʒ, ڭ→ŋ
        expect(phonemizeWord("ياخشى")).toBe("jɑχʃi"); // "good" — ش→ʃ
    });

    test("word-final STOP devoicing (b/d/g → p/t/k), but fricatives stay voiced", () => {
        expect(phonemizeWord("كىتاب")).toBe("kitɑp"); // "book" — final ب → p
        expect(phonemizeWord("ئاز")).toBe("ʔɑz"); // "few" — final ز stays z (no fricative devoicing)
        expect(phonemizeWord("ئاغ")).toBe("ʔɑʁ"); // final غ stays ʁ
        expect(phonemizeWord("تىل")).toBe("til"); // "tongue/language"
    });
});

// ── TEXT NORMALIZATION (src/languages/uyghur/normalize.ts) ────────────────────────────────────────────
// Evidence: `tools/corpus/mined/ug.jsonc` (ug.wikipedia dump, 66,091 paragraphs / 429 mined segments),
// `attest.ts` against ug.wikipedia, and the wikipron referee above. Log:
// `docs/investigations/ug_normalization_investigation.md`. These pin the RULE'S BRANCHES rather than the
// corpus's instances (playbook trap 13) — the corpus attests four of the ordinal's cases and the rule has
// more, so the ones it is silent about are enumerated here.
describe("Uyghur text normalization", () => {
    const norm = makeUyghurNormalizer({ numeralWords });

    test("the hyphenated ordinal — all three stem branches plus the multi-word case", () => {
        // consonant-final stem + ىنچى — the plain branch (بىر · ئۈچ · بەش · توققۇز in the corpus)
        expect(norm("1-كۈنى")).toContain("بىرىنچى");
        expect(norm("5-ئەسىردە")).toContain("بەشىنچى");
        // ى-final stem + نچى — the corpus writes ئىككىنچى
        expect(norm("2 - دەرىجىلىك")).toContain("ئىككىنچى");
        // ە-final stem: drop the ە, then + ىنچى (يەتتە → يەتتىنچى, يىگىرمە → يىگىرمىنچى, both attested)
        expect(norm("7-ئاي")).toContain("يەتتىنچى");
        expect(norm("20-كوچا")).toContain("يىگىرمىنچى");
        // ⚠ THE BRANCH THE CORPUS IS SILENT ABOUT — 6 is the other ە-final unit and never occurs
        // hyphenated in the mined segments; composing rather than tabulating is what reaches it.
        expect(norm("6-ماددا")).toContain("ئالتىنچى");
        // multi-word: the suffix lands on the LAST word only — the corpus's own `ئون بەشىنچى ئەسىرىدىن`
        expect(norm("15-ئەسىردىن")).toBe("ئون بەشىنچى ئەسىردىن");
        expect(norm("306-ماددا")).toBe("ئۈچ يۈز ئالتىنچى ماددا");
        // and the round magnitudes, likewise unattested hyphenated: يۈز → يۈزىنچى, مىڭ → مىڭىنچى
        expect(norm("100-جىلدىدا")).toContain("يۈزىنچى");
        expect(norm("1000-يىلى")).toContain("مىڭىنچى");
        // the noun is RE-EMITTED with its own case and possessive intact (trap 10)
        expect(norm("1949-يىلى")).toBe("مىڭ توققۇز يۈز قىرىق توققۇزىنچى يىلى");
        // the TATWEEL is a dash here too — `1997 ـ يىلى` ×7 — and cannot be elongation after a digit
        expect(norm("1997 ـ يىلى")).toBe("مىڭ توققۇز يۈز توقسان يەتتىنچى يىلى");
    });

    test("the ordinal's two-letter guard, and the era rule that re-creates the case it rejects", () => {
        // ⚠ the one-letter follower is ALWAYS an era abbreviation across a range dash — all 6 of them
        expect(norm("م.ب. 55 - م.ك. 410")).toBe("مىلادىدىن بۇرۇن 55 - مىلادىدىن كېيىن 410");
        // …and after the era rule has expanded it, the guard has to reject the WORD it just wrote
        expect(norm("1100 – م. ب. 771")).toBe("1100 – مىلادىدىن بۇرۇن 771");
        // the multi-part markers before the bare one, or BC reads as its own opposite
        expect(norm("ھ. 35 - يىلى")).toBe("ھىجرىيە ئوتتۇز بەشىنچى يىلى");
        expect(norm("م. 656- يىلى")).toContain("مىلادى ");
        // ⚠ the bare arms need their DOT: `م`/`ھ` are ordinary letters and a word may end in either
        expect(norm("ھەم 2007 يىلى")).toBe("ھەم 2007 يىلى");
    });

    test("de-grouping — both marks, and the decimal point is never one of them", () => {
        expect(norm("9،700،000")).toBe("9700000");
        expect(norm("916,952")).toBe("916952");
        // a number followed by its own CLAUSE comma keeps it
        expect(norm("توققۇز، ئون")).toBe("توققۇز، ئون");
        // `.` is a decimal here and never a thousands mark (D.DDD ×18, every one an exchange rate)
        expect(norm("72.647دىنار")).toBe("72 647دىنار");
        // an IP address is a designation and survives whole
        expect(norm("203.173.138.159")).toBe("203.173.138.159");
    });

    test("percent — both sign orders, both signs, and the suffix re-derived onto the word", () => {
        expect(norm("35%").trim()).toBe("35 پىرسەنت");
        expect(norm("%60").trim()).toBe("60 پىرسەنت");
        // the Arabic sign, ×4 — and the decimal point is a SPACE by then, because step 13 runs last
        expect(norm("٪12.9نى").trim()).toBe("12 9 پىرسەنتنى");
        // ⚠ the WRITTEN suffix is chosen from the digits and is wrong for a ت-final stem, so it is
        // re-derived: ablative دىن → تىن, dative غا → كە, possessive+accusative تىنى → ىنى
        expect(norm("%60تىن").trim()).toBe("60 پىرسەنتتىن");
        expect(norm("99% دىن").trim()).toBe("99 پىرسەنتتىن");
        expect(norm("%1كە").trim()).toBe("1 پىرسەنتكە");
        expect(norm("2%تىنى").trim()).toBe("2 پىرسەنتىنى"); // = the corpus's own `44 پېرسەنتىنى`
        // ⚠ AN ORDINARY WORD AFTER THE SIGN IS NOT A SUFFIX — ×20 of these, and the first version of the
        // rule left the sign unread on every one of them
        expect(norm("11%پورتۇگال").trim()).toBe("11 پىرسەنت پورتۇگال");
        expect(norm("15% ئورمانلىق").trim()).toBe("15 پىرسەنت ئورمانلىق");
        // the word is said ONCE when the corpus already wrote it (trap 12)
        expect(norm("50% پىرسەنت").trim()).toBe("50 پىرسەنت");
    });

    test("units — the exponent, the magnitude gap, and the spelled-out unit noun", () => {
        expect(norm("450,295 km²").trim()).toBe("450295 كۋادرات كىلومېتىر");
        expect(norm("1،145.6 كم²").trim()).toBe("1145 6 كۋادرات كىلومېتىر");
        expect(norm("5 kg").trim()).toBe("5 كىلوگرام");
        // ⚠ a MAGNITUDE WORD between the number and the unit — `10 مىڭ كم²`, 2 of the corpus's 20 exponents
        expect(norm("10 مىڭ كم²").trim()).toBe("10 مىڭ كۋادرات كىلومېتىر");
        // ⚠ and the unit noun spelled out with a bare `²` hanging off it — no symbol key can reach that
        expect(norm("36.6 مىلىيون كىلومېتر²").trim()).toBe("36 6 مىلىيون كۋادرات كىلومېتر");
    });

    test("degrees — the scale form before the bare sign, or the letter reads as English", () => {
        expect(norm("20 °C").trim()).toBe("20 گرادۇس");
        expect(norm("29.58°").trim()).toBe("29 58 گرادۇس");
        // ⚠ END TO END, because `℃` is folded to `°C` by registry.ts BEFORE this file runs — the ordering
        // that makes the scale arm reachable at all lives outside this module.
        expect(phonemize("11.3℃", "ug")).toBe("ʔon bir ʔyt͡ʃ ɡrɑdus");
    });

    test("the minus — read only with the right context that separates it from a range", () => {
        expect(phonemize("ئەڭ تۆۋەن تېمپېراتۇرىسى - 28.7℃", "ug")).toContain("minus");
        // the 19 range dashes and the 9 clause-opening dashes must NOT become a minus
        expect(norm("1066 - 1154")).toBe("1066 - 1154");
        expect(norm("بولۇپ . -2005يىلى")).not.toContain("مىنۇس");
        expect(norm("سۈرئىتى 5%-6%")).not.toContain("مىنۇس");
    });

    test("currency — three signs, three attested names", () => {
        expect(norm("47.00￥").trim()).toBe("47 00 يۈەن");
        expect(norm("5₺").trim()).toBe("5 لىرا");
        expect(norm("$5").trim()).toBe("5 دوللار");
        expect(norm("US$ 49,600").trim()).toBe("49600 ئامېرىكا دوللىرى");
    });

    test("the script folds — presentation forms and the heh, byte-identical to the modern spelling", () => {
        // ⚠ 8 of 429 mined segments are presentation forms and read as the EMPTY STRING without this fold
        expect(phonemize("ﭼﻮﻟﭙﯩﻨﻰ ﺷﺎﻛﻮﺋﯩﻞ", "ug")).toBe("t͡ʃolpini ʃɑkoʔil");
        // ⚠ NFKC gets the HEH wrong for Uyghur: the plain isolated/final forms are the VOWEL ە, the
        // heh-goal forms the consonant ھ. `ﻫﻪﺳﻪﻥ` (ھەسەن, the name Hesen) carries both in one word.
        expect(phonemize("ﺧﻪﻟﻖ ﻫﻪﺳﻪﻥ ﻫﯜﺳﻪﻧﻨﻰ ﺋﺎﺯﺍﺩﻩ ﻣﺎﮬﯩﺮﻯ", "ug"))
            .toBe(phonemize("خەلق ھەسەن ھۈسەننى ئازادە ماھىرى", "ug"));
        // the Arabic heh typed directly is the CONSONANT — `شەهرىنىڭ` read *ʃɛɛriniŋ* before this fold
        expect(phonemize("شەهرىنىڭ", "ug")).toBe("ʃɛhriniŋ");
        // and the HTML entity is a boundary, not letters
        expect(norm("227&nbsp;km²").trim()).toBe("227 كۋادرات كىلومېتىر");
    });
});

describe("Uyghur — a bound suffix glued straight onto a Latin unit key", () => {
    const say = (s: string): string => phonemize(s, "ug").trim();

    test("`kgغىچە` reads the unit and keeps the author's own morphology", () => {
        // `kg` IS declared, and `1.5 kg` always read. The unit arm's right guard was a flat `\p{L}`, so a
        // Uyghur case suffix touching the key made it decline the whole match and `kɡ` reached the IPA.
        expect(say("1.5kgغىچە")).toContain("kiloɡrɑmʁit͡ʃɛ");
        expect(say("1.5 kg")).toContain("kiloɡrɑm");
    });

    test("⟨ئ⟩ is a word boundary, so a glued next WORD is not fused into the unit", () => {
        // Uyghur's word-initial vowel carrier: every vowel-initial word opens with it and no suffix does.
        // `180kmئېگىزلىكتە` used to read `ˈʊkm ʔeɡizliktɛ` — the unit through the English fallback.
        expect(say("180kmئېگىزلىكتە")).toBe("jyz sɛksɛn kilometir ʔeɡizliktɛ");
    });

    test("the existing unit and exponent readings are unchanged", () => {
        expect(say("450,295 km²")).toBe("tøt jyz ʔɛllik miŋ ʔikki jyz toqsɑn bɛʃ kwɑdrɑt kilometir");
        expect(say("10 مىڭ كم²")).toBe("ʔon miŋ kwɑdrɑt kilometir");
    });
});
