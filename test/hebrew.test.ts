import { describe, expect, test } from "vitest";

import { phonemizeWord, createHebrew } from "../src/languages/hebrew/hebrew.ts";

// Canonical-IPA goldens for Hebrew (he) — Afro-Asiatic (Semitic), the Hebrew abjad, MODERN ISRAELI pronunciation.
// PHASE 1: a niqqud→IPA segmental g2p over VOCALIZED (pointed) input (unvocalized restoration — a neural nakdan —
// is Phase 2, deferred, the Arabic-diacritizer analogue). Hand-adjudicated against en.wiktionary vocalized→a=IL
// IPA (2561 words): 87.1% folded, the folds stripping stress (unwritten), the variable glottal ⟨א⟩/⟨ע⟩=ʔ, the
// velar-nasal allophone, and resh notation. Signatures: bgdkpt dagesh (בּ→b/ב→v, כּ→k/כ→χ, פּ→p/פ→f); ⟨ש⟩ shin/sin;
// ⟨ו⟩ shuruk וּ→u / holam male וֹ→o; patach genuvah (final guttural's patach surfaces before it, מָשִׁיחַ→maʃiaχ).
// See docs/investigations/he_native_bringup_investigation.md.
describe("Hebrew canonical IPA — Phase-1 niqqud→IPA (Modern Israeli)", () => {
    test("bgdkpt dagesh split + ⟨ש⟩ shin/sin + ⟨ו⟩ specials", () => {
        expect(phonemizeWord("בַּיִת")).toBe("bajit"); // dagesh בּ→b; ⟨יִ⟩…⟨ת⟩; yod glide
        expect(phonemizeWord("אָב")).toBe("ʔav"); // soft ⟨ב⟩→v
        expect(phonemizeWord("שָׁלוֹם")).toBe("ʃalom"); // shin-dot ⟨שׁ⟩→ʃ, holam male ⟨וֹ⟩→o
        expect(phonemizeWord("תּוֹרָה")).toBe("toʁa"); // ⟨ת⟩→t (always), holam male, silent final ⟨ה⟩
    });

    test("vowels + patach genuvah + quiescent letters", () => {
        expect(phonemizeWord("אֶבֶן")).toBe("ʔeven"); // segol→e, soft ב→v
        expect(phonemizeWord("סֵפֶר")).toBe("sefeʁ"); // tsere→e, ⟨ר⟩→ʁ
        expect(phonemizeWord("מָשִׁיחַ")).toBe("maʃiaχ"); // patach genuvah: final ⟨חַ⟩ → [aχ]
        expect(phonemizeWord("אֲבַטִּיחַ")).toBe("ʔavatiaχ"); // dagesh טּ, hiriq-yod mater, patach genuvah
    });

    test("text: words + clause punctuation (unvocalized restoration + stress + numbers deferred)", () => {
        expect(createHebrew().text("שָׁלוֹם, מָה שְׁלוֹמְךָ?")).toBe("ʃalom  ,  ma ʃlomχa  ? ");
    });
});
