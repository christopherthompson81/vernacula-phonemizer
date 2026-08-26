import { describe, expect, test } from "vitest";
import { phonemizeWordRules } from "../src/languages/saraiki/saraiki.ts";
import { normalizeSaraiki } from "../src/languages/saraiki/normalize.ts";
import { phonemize } from "../src/index.ts";
import { makeNativePunjabi, loadPunjabiManifest } from "../src/languages/punjabi/punjabi.ts";
import { loadSharedPhonology } from "../src/core/phonology.ts";


// Diagnostic gold for the Saraiki (skr) engine — one word per signature feature. These are OUR canonical output
// (rule-only, default-[ə] for the unwritten abjad short vowels + weight stress); they line up with the wikipron
// skr_arab referee on the recoverable consonant + long-vowel backbone. The point of this suite is to lock the
// engine's distinctive Saraiki behaviors: the FOUR implosives, retained voiced aspirates + aspirated sonorants
// (no Punjabi tonogenesis), and the retroflex nasal ݨ→ɳ.
describe("Saraiki (skr) g2p — diagnostic gold", () => {
    for (const [word, ipa] of [
        ["اٻاسی", "əɓˈaːsiː"], // ٻ → ɓ  bilabial implosive
        ["اڄ", "ˈəʄ"], // ڄ → ʄ  palatal implosive ("today")
        ["ڳوݙا", "ɠˈoːɗaː"], // ڳ → ɠ velar + ݙ → ɗ retroflex implosive (both, one word)
        ["بھڄݨ", "bʱˈəʄəɳ"], // بھ → bʱ voiced aspirate KEPT (no tonogenesis) + ڄ ʄ + ݨ ɳ
        ["آلھݨا", "ˈaːlʱɳaː"], // لھ → lʱ  aspirated SONORANT kept (Punjabi strips it) + ݨ ɳ
        ["آوݨ", "ˈaːʋɳ"], // ݨ → ɳ retroflex nasal (verbal infinitive), و → ʋ
        ["تہاݙا", "t̪əɦˈaːɗaː"], // dental t̪, ہ → ɦ, ݙ → ɗ ("yours")
    ] as const) {
        test(`${word} → ${ipa}`, () => {
            expect(phonemizeWordRules(word)).toBe(ipa);
        });
    }
});

// ── TEXT NORMALIZATION (src/languages/saraiki/normalize.ts) ─────────────────────────────────────────
// The argument for every case is in the normalizer's own header. ⚠ These call normalizeSaraiki DIRECTLY,
// so the inputs are written with ASCII digits: in the pipeline `foldNativeDigits` has already folded all
// three of this corpus's digit sets before the normalizer runs, and the whole-pipeline cases at the end
// exercise that seam with the corpus's own Arabic-Indic and Extended Arabic-Indic spellings.
describe("Saraiki text normalization", () => {
    test("⚠ BOTH COMMAS GROUP AND BOTH SEPARATE — the three-digit test decides, not the codepoint", () => {
        expect(normalizeSaraiki("1,234,567")).toBe("1234567");
        expect(normalizeSaraiki("476,291")).toBe("476291");
        expect(normalizeSaraiki("714\u060c000")).toBe("714000"); // the ARABIC comma, grouping
        expect(normalizeSaraiki("12\u060c000")).toBe("12000");
        // …and the same mark separating: two digits after, or four, is a list
        expect(normalizeSaraiki("10\u060c 12\u060c 14\u060c 2000\u060c 2006"))
            .toBe("10\u060c 12\u060c 14\u060c 2000\u060c 2006");
        expect(normalizeSaraiki("\u062c\u0646\u0648\u0631\u06cc 4\u060c 1643"))
            .toBe("\u062c\u0646\u0648\u0631\u06cc 4\u060c 1643");
    });

    test("the decimal is the ASCII dot, read digit by digit", () => {
        expect(normalizeSaraiki("52.66")).toBe("52 \u0627\u0639\u0634\u0627\u0631\u06cc\u06c1 6 6");
        expect(normalizeSaraiki("2.43")).toBe("2 \u0627\u0639\u0634\u0627\u0631\u06cc\u06c1 4 3");
    });

    test("degrees: the scale word is سینٹی گریڈ, and the bare sign may run into a following word", () => {
        expect(normalizeSaraiki("53.7 \u00b0C"))
            .toBe("53 \u0627\u0639\u0634\u0627\u0631\u06cc\u06c1 7 \u0688\u06af\u0631\u06cc \u0633\u06cc\u0646\u0679\u06cc \u06af\u0631\u06cc\u0688");
        expect(normalizeSaraiki("60\u00b0")).toBe("60 \u0688\u06af\u0631\u06cc ");
    });

    test("⚠ the minus sign, and the guard that keeps it off an inline negative exponent", () => {
        // the word is sourced from the corpus's own self-gloss — "منفی 28 میٹر (-92 فٹ)"
        expect(normalizeSaraiki("(-92")).toBe("(\u0645\u0646\u0641\u06cc 92");
        expect(normalizeSaraiki("\u22125.4 \u00b0C"))
            .toBe("\u0645\u0646\u0641\u06cc 5 \u0627\u0639\u0634\u0627\u0631\u06cc\u06c1 4 \u0688\u06af\u0631\u06cc \u0633\u06cc\u0646\u0679\u06cc \u06af\u0631\u06cc\u0688");
        // `10−50 cm4 s photon−1` is a CROSS-SECTION, not a subtraction: a digit before the sign blocks it
        expect(normalizeSaraiki("10\u221250 cm4")).toBe("10\u221250 cm4");
    });

    test("⚠ ranges, including the one shape no Latin round produced: the ء year marker before the dash", () => {
        expect(normalizeSaraiki("1682\u20131744")).toBe("1682, 1744");
        expect(normalizeSaraiki("1950\u0621\u20131986\u0621")).toBe("1950\u0621, 1986\u0621");
        expect(normalizeSaraiki("39-45")).toBe("39, 45");
        // an adjacent slash means a citation, not a span
        expect(normalizeSaraiki("213-276/828-889")).toBe("213-276/828-889");
    });

    test("⚠ the colon is NEVER a clock here — four non-clock senses and no rule", () => {
        expect(normalizeSaraiki("2:49:16")).toBe("2:49:16"); // a marathon time
        expect(normalizeSaraiki("1:100")).toBe("1:100"); // a drawing scale
    });

    test("the whole pipeline, through the native-digit fold and the shared symbol tier", () => {
        // Arabic-Indic digits + the Arabic percent sign
        expect(phonemize("\u0668\u0665\u066a", "skr").trim()).toBe("p\u02c8\u0259\u0303\u0272d\u0361\u0292 \u02c8\u0259s\u02d0i\u02d0 f\u02c8i\u02d0s\u0259d\u032a");
        // ⚠ the sign is DECLINED when its own word is already written — "90 % فیصد"
        expect(phonemize("90 % \u0641\u06cc\u0635\u062f", "skr").trim())
            .toBe(phonemize("90 \u0641\u06cc\u0635\u062f", "skr").trim());
        // ⚠ trap 64 again, in a different script: US$ needs its own key or the mark is silently dropped
        expect(phonemize("US$20 \u0645\u0644\u06cc\u0646", "skr").trim())
            .toBe("\u028b\u02c8i\u02d0\u0266 m\u0259l\u02c8i\u02d0n \u0256\u02c8a\u02d0l\u0259\u027e");
    });
});

describe("Saraiki reaches its OWN coverage lexicon on the shipped path (#1049)", () => {
    // ⚠ THIS PINS A SEAM, NOT AN OUTPUT. `data/languages/saraiki/lexicon.tsv` does not exist, so the real
    // map is empty and the fix moves ZERO bytes today — which is exactly what made the defect invisible.
    // `saraiki.ts` documents `phonemizeWord` as "coverage lexicon → rule g2p", but `shippedWord` opened
    // with a bare `return word(w)` for the saraiki flag, so `text()` never consulted the tier and
    // `phonemizeWord` had no caller. The day someone mines that lexicon it would have been dead weight on
    // the only path users reach — `pa`'s own history, one variety over. A stub lexicon is the only way to
    // observe the wiring while the real file is absent.
    const stub = new Map([["\u0643\u0631\u0646", "\u0643\u0650\u0631\u0646"]]); // کرن → کِرن, the skeleton→vocalized shape
    const withLex = makeNativePunjabi(loadPunjabiManifest(), loadSharedPhonology(), undefined, {
        saraiki: true, wordLexicon: () => stub,
    });
    const without = makeNativePunjabi(loadPunjabiManifest(), loadSharedPhonology(), undefined, { saraiki: true });

    test("the shipped text() path consults the variety lexicon", () => {
        // With the tier wired, the bare skeleton reads as the VOCALIZED form; without it, as the skeleton.
        expect(withLex.text("\u0643\u0631\u0646").trim()).toBe(without.text("\u0643\u0650\u0631\u0646").trim());
        expect(withLex.text("\u0643\u0631\u0646").trim()).not.toBe(without.text("\u0643\u0631\u0646").trim());
    });

    test("pa/pnb are untouched — they pass no wordLexicon and keep the Punjabi tiers", () => {
        expect(phonemize("\u0679\u06be\u06cc\u06a9", "pnb")).toBe(phonemize("\u0679\u06be\u06cc\u06a9", "pnb"));
        expect(without.text("\u0643\u0631\u0646").trim()).toBe(phonemizeWordRules("\u0643\u0631\u0646"));
    });
});
