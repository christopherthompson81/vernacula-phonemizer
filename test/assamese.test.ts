import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/assamese/assamese.ts";
import { normalizeAssamese } from "../src/languages/assamese/normalize.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Assamese / অসমীয়া (as) — Eastern Indo-Aryan, Bengali-Assamese script. Reuses the
// Bengali engine (abugida scan + inherent-vowel deletion) with Assamese phoneme values + two disabled Bengali
// rules (heightHarmony, medialSchwaDeletion). The DEFINING divergences from Bengali: sibilants শ/ষ/স→[x] (velar
// fricative), deaffrication চ/ছ→[s] জ/ঝ→[z], the alveolar merger (no retroflex/dental split), ৰ→[ɹ], ৱ→[w].
// Validated ~72.2% vs wikipron asm + 69.2% vs kaikki.
describe("Assamese canonical IPA", () => {
    test("sibilants শ/ষ/স → [x] (the Assamese signature)", () => {
        expect(phonemizeWord("অসম")).toBe("ɔxɔm"); // স → x
        expect(phonemizeWord("সাত")).toBe("xat"); // স → x
        expect(phonemizeWord("দেশ")).toBe("dex"); // শ → x
        expect(phonemizeWord("শিশু")).toBe("xixu"); // শ → x (both)
    });

    test("deaffrication চ/ছ → [s], জ/ঝ → [z]", () => {
        expect(phonemizeWord("চাউল")).toBe("saul"); // চ → s
        expect(phonemizeWord("জীৱন")).toBe("ziwɔn"); // জ → z, ৱ → w
    });

    test("alveolar merger (no retroflex/dental split) + extra letters ৰ/ৱ", () => {
        expect(phonemizeWord("ভাত")).toBe("bʱat"); // ত → alveolar t (not dental t̪)
        expect(phonemizeWord("ৰাতি")).toBe("ɹati"); // ৰ → ɹ, ত → t
        expect(phonemizeWord("আৰু")).toBe("aɹu"); // ৰ → ɹ
        expect(phonemizeWord("মানুহ")).toBe("manuɦ"); // হ → ɦ
    });

    test("no ɔ→o height harmony, medial ɔ retained (unlike Bengali)", () => {
        expect(phonemizeWord("গৰু")).toBe("ɡɔɹu"); // ɔ NOT raised before u (Bengali would give ɡoɾu)
        expect(phonemizeWord("চকৰি")).toBe("sɔkɔɹi"); // medial inherent ɔ retained (Bengali deletes)
    });

    test("numbers route through the same engine", () => {
        const d = getPhonemizer("as");
        expect(d.text("7").trim()).toBe("xat"); // সাত
        expect(d.text("100").trim()).toBe("ek ex"); // এক এশ (one hundred)
    });
});

// TEXT NORMALIZATION (src/languages/assamese/normalize.ts) — the Assamese PRE-PASS that runs before the
// shared Bengali normalize (which Assamese reuses wholesale). It owns the Assamese-specific classes: the
// শ classical ordinals (11–20), the নং number marker, comma-grouped ordinals, dotted Latin/Bengali runs,
// version dots, currency codes, the ampersand, and the regnal II. Assertions are FULL-PIPELINE unless the
// rule is text→text only.
describe("Assamese text normalization", () => {
    const ph = (s: string): string => getPhonemizer("as").text(s).trim();

    test("text→text: the শ classical ordinals (11–20) and 1শ = একশ", () => {
        expect(normalizeAssamese("11শ শতিকা")).toBe("একাদশ শতিকা");
        expect(normalizeAssamese("18শ শতিকাত")).toBe("অষ্টাদশ শতিকাত");
        expect(normalizeAssamese("1শ শতাংশ")).toBe("একশ শতাংশ"); // 1শ = one hundred, not an ordinal
    });

    test("the নং number marker reads নম্বৰ; the comma-grouped ordinal stays attached", () => {
        expect(ph("190 নং স্থান")).toBe("ek ex nɔbːɔi nɔmbɔɹ xtʰan");
        expect(ph("60নং আছিল")).toBe("xatʰi nɔmbɔɹ asil");
        expect(ph("1,000তম")).toBe("ek ɦazaɹɔtɔm");
    });

    test("dotted runs lose their dots (Latin U.S. and Bengali ইউ.এছ.অ.চি); the W. suffix dot goes", () => {
        expect(ph("ইউ.এছ.অ.চি ৰ")).toBe("iu es ɔ si ɹɔ");
        expect(ph("George W. Bush")).toBe("d͡ʒˈɔːɹd͡ʒ dˈʌbəɫjuː bˈʊʃ");
    });

    test("version dots read বিন্দু, not the decimal দশমিক", () => {
        expect(ph("802.11এন মানদণ্ড")).toBe("atʰ ex dui bindu eɡʱaɹ en manɔdɔndo");
    });

    test("currency codes expand (AUD$/US$); the ampersand reads আৰু", () => {
        // The currency noun is POSTPOSED and the magnitude sits between it and the number — the corpus's
        // own prose is "$১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ", and the tier already reads a bare $30 that way.
        expect(ph("AUD$৪৫ মিলিয়ন")).toBe("pãs sɔlːix milijɔn ɔxtɹelijan dɔlaɹ");
        expect(ph("US$30")).toBe("tɹix ameɹikan dɔlaɹ");
        // …and where the sentence spells the currency itself, the sign must not add a SECOND one
        expect(ph("$১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ")).toBe("sɔidʱːo dɔxɔmik xat bilijɔn ameɹikan dɔlaɹ");
        expect(ph("B&B য়ে")).toBe("bˈiː aɹu bˈiː je");
    });

    test("regnal II reads দ্বিতীয় and KEEPS the noun it qualifies", () => {
        expect(ph("II বিশ্ব যুদ্ধ")).toBe("ditij bixːo zudʱːo");
        // the corpus's one instance carries a case suffix, which re-attaches to the noun
        expect(ph("II বিশ্ব যুদ্ধৰ সময়ত")).toBe("ditij bixːo zudʱːɔɹ xɔmɔjɔt");
    });

    test("the version-dot and initial-dot rules stay inside their evidence", () => {
        expect(ph("6.5km")).toBe("sɔj dɔxɔmik pãs kilomitaɹ"); // a decimal with a unit is not a version
        expect(ph("802.11এন মানদণ্ড")).toBe("atʰ ex dui bindu eɡʱaɹ en manɔdɔndo");
        expect(ph("George W. Bush")).toBe("d͡ʒˈɔːɹd͡ʒ dˈʌbəɫjuː bˈʊʃ"); // an initial loses its dot
        expect(ph("NASA. Bush")).toBe("nˈæsə . bˈʊʃ"); // a SENTENCE period after an acronym does not
    });

    test("শত is the word \"hundred\", not the শ ordinal suffix", () => {
        expect(normalizeAssamese("৯০শত")).toBe("৯০শত");
        expect(ph("৯০শত")).toBe("nɔbːɔi xɔt");
    });

    // `বৰ্গ কিলোমিটাৰ` ×7 in as_in. The word arrives from the SHARED Bengali symbol tier, read with
    // Assamese phoneme values (র → ɹ), which is the same arrangement কিলোমিটাৰ itself already uses.
    test("the squared/cubed measure word", () => {
        expect(getPhonemizer("as").text("19,500 km²").trim()).toContain("bɔɹɡo kilomitaɹ");
    });
});
