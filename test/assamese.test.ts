import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/assamese/assamese.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Assamese / অসমীয়া (as) — Eastern Indo-Aryan, Bengali-Assamese script. Reuses the
// Bengali engine (abugida scan + inherent-vowel deletion) with Assamese phoneme values + two disabled Bengali
// rules (heightHarmony, medialSchwaDeletion). The DEFINING divergences from Bengali: sibilants শ/ষ/স→[x] (velar
// fricative), deaffrication চ/ছ→[s] জ/ঝ→[z], the alveolar merger (no retroflex/dental split), ৰ→[ɹ], ৱ→[w].
// Validated ~72.2% vs wikipron asm + 69.2% vs kaikki. See docs/investigations/as_native_bringup_investigation.md.
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
