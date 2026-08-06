import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/nepali/nepali.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Nepali / नेपाली (ne) — Indo-Aryan, Devanagari. Reuses the Hindi engine with the
// Nepali divergences: the inherent vowel realised as [ʌ] (not ə), the DENTAL affricates च/छ/ज/झ→[t͡s t͡sʰ d͡z d͡zʱ]
// (not palatal), the sibilant merger श/ष→[s], NO phonemic vowel length (ई→i, ऊ→u), diphthongs ऐ→[ʌi]/औ→[ʌu],
// व→[w]. Validated at 68.9% vs wikipron nep narrow + 67.8% vs kaikki.
describe("Nepali canonical IPA", () => {
    test("inherent vowel [ʌ] (not Hindi ə)", () => {
        expect(phonemizeWord("गर्नु")).toBe("ɡˈʌɾnu"); // 'to do' — inherent → ʌ
        expect(phonemizeWord("अचार")).toBe("ˈʌt͡saɾ"); // initial अ → ʌ
    });

    test("dental affricates च/छ → [t͡s]/[t͡sʰ] (not palatal)", () => {
        expect(phonemizeWord("मान्छे")).toBe("mˈant͡sʰe"); // छ → t͡sʰ (Hindi t͡ʃʰ)
        expect(phonemizeWord("अचार")).toBe("ˈʌt͡saɾ"); // च → t͡s
    });

    test("sibilant merger श/ष → [s]; no phonemic vowel length", () => {
        expect(phonemizeWord("भाषा")).toBe("bʱˈasa"); // ष → s, आ → a (no length)
        expect(phonemizeWord("नेपाल")).toBe("nˈepal"); // ई/ा short
        expect(phonemizeWord("हिमाल")).toBe("ɦˈimal"); // 'mountain'
    });

    test("embedded English keeps its schwa — only Devanagari ə becomes ʌ", () => {
        // The ə→ʌ realisation must NOT touch the (contrastive) English /ə/ in an embedded Latin run.
        const out = getPhonemizer("ne").text("म computer").trim();
        expect(out).toContain("kəmpj"); // 'computer' keeps ə, not kʌmpj
        expect(out.startsWith("mˈʌ")).toBe(true); // the Nepali म → mʌ
    });

    test("numbers (Nepali words)", () => {
        expect(getPhonemizer("ne").text("6").trim()).toBe("t͡sʰˈʌ"); // छ (dental affricate)
        expect(getPhonemizer("ne").text("2").trim()).toBe("d̪ˈui"); // दुई
        expect(getPhonemizer("ne").text("100").trim()).toBe("ˈek sˈʌj"); // एक सय — NOT bareMagnitude
    });
});

// ── #562 text normalization ───────────────────────────────────────────────────────────────────────
// Nepali reuses Hindi's ENGINE but supplies its own normalizer and symbol words through the engine's
// `overrides` parameter. These assert through `text()`, which is the layer that owns the rules.
const t = (s: string): string => getPhonemizer("ne").text(s).trim();

describe("Nepali normalization", () => {
    test("21-99 are FUSED single words, from nepali.jsonc `compound`", () => {
        // The core fallback composed tens+unit in the Hindi-belt order, so 21 read "one twenty".
        expect(t("21")).toBe("ˈekːais"); // एक्काइस, not ˈek bˈis
        expect(t("35")).toBe("pʌˈĩn̪t̪is"); // पैंतीस, not pˈãt͡s t̪ˈis
        expect(t("99")).toBe("unˈansʌj"); // उनान्सय
        expect(t("1995")).toBe("ˈek ɦˈʌd͡zaɾ nˈʌu sˈʌj pˈʌnt͡sanʌbːe"); // 175 corpus years depend on this
        expect(t("2000")).toBe("d̪ˈui ɦˈʌd͡zaɾ");
    });

    test("ZWJ inside a word no longer splits it (104 corpus instances)", () => {
        // U+200D is category Cf, so the tokenizer's Devanagari class excluded it: गर्‍यो was two words.
        expect(t("गर्\u200dयो")).toBe("ɡˈʌɾjo"); // was ɡˈʌɾ jˈo
    });

    test("ASCII colon written for visarga, but not a genuine list colon", () => {
        expect(t("प्राय: यो")).toBe("pɾˈajʌh jˈo"); // was pɾˈaj , — a spurious phrase break
        expect(t("राय: अर्को")).toBe("ɾˈaj , ˈʌɾko"); // a real list colon KEEPS its pause
    });

    test("ordinals join the cardinal as a MATRA, not the independent vowel", () => {
        expect(t("15 औं")).toBe("pˈʌnd̪ʱɾʌũ"); // पन्ध्रौं — was pˈʌnd̪ʱɾʌ ˈʌũ, a stray syllable
        expect(t("9 औँ")).toBe("nˈʌwʌũ"); // नवौं — suppletive stem
        expect(t("1,000 औँ")).toBe("ˈek ɦˈʌd͡zaɾʌũ"); // a comma-grouped numeral still matches
    });

    test("clock is Nepali's बजेर/मिनेट, not Hindi's बजकर/मिनट, and never duplicates बजे", () => {
        expect(t("बिहान 9:30 बजे")).toBe("bˈiɦan nˈʌu bˈʌd͡zeɾ t̪ˈis mˈineʈ");
        expect(t("11:00 बजेपछि")).toBe("ˈeɡʱaɾ bʌd͡zˈept͡sʰi"); // no बजे inserted before a बज- word
        expect(t("10:00-11:00 राती")).toBe("d̪ˈʌs bˈʌd͡ze d̪ˈekʰi ˈeɡʱaɾ bˈʌd͡ze ɾˈat̪i");
    });

    test("a SPORTS time mm:ss.hh is not a clock", () => {
        // Hindi's rule claimed it and produced a bogus clock plus a spurious phrase break.
        expect(t("4:41.30 मिनेट")).toBe("t͡sˈaɾ ˈekt͡salis d̪ʌsˈʌmlʌw t̪ˈin sˈunjʌ mˈineʈ");
    });

    test("currency: डलर/पाउन्ड, a letter-code prefix, and no duplicated noun", () => {
        expect(t("$500")).toBe("pˈãt͡s sˈʌj ɖˈʌlʌɾ"); // was डॉलर (ɖˈɔːlʌɾ)
        expect(t("US$30")).toBe("jˈuː ˈɛs t̪ˈis ɖˈʌlʌɾ"); // the shared tier DROPPED this sign entirely
        expect(t("$1000 डलर")).toBe("ˈek ɦˈʌd͡zaɾ ɖˈʌlʌɾ"); // the text already wrote the noun
        expect(t("£27 मिलियन")).toBe("sˈʌt̪ːais mˈilijʌn paˈunɖʌ"); // magnitude hops the sign
    });

    test("ranges take देखि only when ASCENDING — a sports score is not a range", () => {
        expect(t("35-40 माइल")).toBe("pʌˈĩn̪t̪is d̪ˈekʰi t͡sˈalis mˈail");
        expect(t("5-3 ले")).toBe("pˈãt͡s t̪ˈin lˈe"); // a hockey scoreline keeps its silent hyphen
        expect(t("1995-1996 देखि").endsWith("d̪ˈekʰi")).toBe(true);
        expect(t("1995-1996 देखि")).not.toContain("d̪ˈekʰi d̪ˈekʰi"); // the postposition is already there
    });

    test("units, rates and abbreviations", () => {
        expect(t("165 किमी/ घण्टा")).toBe("ˈek sˈʌj pʌĩsˈʌʈʰʈʰi kˈilomiʈʌɾ pɾˈʌt̪i ɡʱˈʌɳʈa");
        expect(t("6 सेमी")).toBe("t͡sʰˈʌ sˈenʈimiʈʌɾ"); // Nepali सेन्टिमिटर, not Hindi's सेंटीमीटर
        expect(t("1600 कि.मी. को")).toBe("ˈek ɦˈʌd͡zaɾ t͡sʰˈʌ sˈʌj kˈilomiʈʌɾ kˈo"); // was two pauses
        expect(t("डा. मोल")).toBe("ɖˈakʈʌɾ mˈol"); // the dot was a phrase break
    });

    test("percent is प्रतिशत — Hindi's inherited word is CORRECT for Nepali", () => {
        expect(t("88%")).toBe("ˈʌʈʰasi pɾˈʌt̪isʌt̪");
    });

    test("degrees keep their scale letter, even welded to a Devanagari postposition", () => {
        // #586. The plus is now read (प्लस), sourced from the corpus's own audio: 2 of 3 ne_np speakers of the
        // offset sentence say `p l a s`/`p l o s`. ⚠ Both TEMPERATURE speakers omit it (`t i s d i ɡ r i`), so
        // this arm is the standing choice to voice an explicitly typed character, not a copied reading habit.
        expect(t("+30°Cभन्दा")).toBe("plˈʌs t̪ˈis ɖˈiɡɾi sˈelsijʌs bʱˈʌnd̪a"); // C was read as the letter name
        expect(t("35°W")).toBe("pʌˈĩn̪t̪is ɖˈiɡɾi pˈʌst͡sim");
    });

    test("the approximation tilde is spoken; the plus sign deliberately is not", () => {
        expect(t("~500")).toBe("lˈʌɡbʱʌɡ pˈãt͡s sˈʌj");
        expect(t("युटिसी+1")).not.toContain("d̪ʱˈʌn"); // a UTC offset is not "plus one"
    });

    // `वर्ग किलोमिटर` ×4 ("सुन्दरवनले 3,850 वर्ग किलोमिटर क्षेत्रफल ओगटेको छ"). No cube word: घन is ×0, and
    // this is the same घन/धन cluster that produced five confidently wrong plus words in Phase 1.
    test("the squared/cubed measure word", () => {
        expect(t("3,850 km²")).toContain("wˈʌɾɡʌ kˈilomiʈʌɾ");
    });

    // `120–160 घनमिटर इन्धन`, and this is why a token probe for घन read ×0: the corpus writes it FUSED
    // to the unit noun. `before` still spells it as two words, which the same corpus does for
    // `वर्ग किलोमिटर`. `m` had to be declared too — मिटर ×12 is the corpus's spelling (मीटर is ×0 here).
    test("the bare metre and the cubed measure word", () => {
        expect(t("5 m")).toContain("mˈiʈʌɾ");
        expect(t("120 m³")).toContain("ɡʱˈʌn mˈiʈʌɾ");
        expect(t("802.11m")).toContain("ˈɛm");
    });
});
