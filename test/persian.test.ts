import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/persian/persian.ts";

// Canonical-IPA goldens for Persian / Farsi (fa) — Perso-Arabic abjad, Iranian phonology. The g2p produces the
// consonant + LONG-vowel skeleton (long vowels ا/آ→aː, و→uː, ی→iː; word-initial ʔ; خوا→[xʷaː]; final ه→[e]) with
// a default [a] for the omitted SHORT vowels — full short-vowel restoration is the deferred subsystem (🟠).
// These goldens are long-vowel-dominant words where the skeleton IS the answer. See docs/investigations/fa_native_bringup_investigation.md.
describe("persian canonical IPA", () => {
    test("consonant + long-vowel skeleton (ʔ-initial, aː/uː/iː, خوا, final ه)", () => {
        const cases: [string, string][] = [
            ["آب", "ʔˈaːb"], // ab: آ→ʔaː
            ["خواب", "xʷˈaːb"], // khab: خوا→labialized xʷaː
            ["دوست", "dˈuːst"], // dust: و→uː, final cluster st
            ["خانه", "xaːnˈe"], // khane: final ه→[e]
            ["فارسی", "faːɾsˈiː"], // farsi: ی→iː, r→ɾ
            ["ایران", "ʔiːɾˈaːn"], // iran: word-initial ا+ی→ʔiː
            ["خوب", "xˈuːb"], // khub: و→uː
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("final cluster (no spurious vowel) + text", () => {
        expect(phonemizeWord("مرد")).toBe("mˈaɾd"); // mard: final cluster rd, no inserted vowel
        expect(phonemize("سلام", "fa")).toContain("salˈaːm");
    });

    // COVERAGE layer (core/harakatLexicon.ts): a mined skeleton is vocalized before g2p so the short vowels
    // surface (madrase, not the default schwa filler); caller-supplied harakat is respected.
    test("coverage lexicon restores mined short vowels", () => {
        expect(phonemizeWord("مدرسه")).toBe("madɾasˈe"); // madrase: sukun on د from the lexicon (مدْرسه)
        expect(phonemizeWord("مدْرسه")).toBe("madɾasˈe"); // caller-supplied sukun is respected (not clobbered)
    });

    // Arabic-script orthographic variants (Arabic yeh ي U+064A, kaf ك U+0643) are common in real Persian text but
    // are NOT canonically NFC-equal to the Farsi forms (ی U+06CC, ک U+06A9); they are folded at the fa entry so the
    // lexicon + tagger (keyed on Farsi orthography) don't treat them as unknown. Surfaced by the GE2PE referee (#27).
    test("Arabic yeh/kaf fold to Farsi (identical output)", () => {
        expect(phonemize("کسي", "fa")).toBe(phonemize("کسی", "fa")); // Arabic ي vs Farsi ی
        expect(phonemize("ملك", "fa")).toBe(phonemize("ملک", "fa")); // Arabic ك vs Farsi ک
    });
});
