import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/balochi/balochi.ts";

// Canonical-IPA goldens for Balochi / بلوچی (bal) — Southern Balochi, Balochi Arabic alphabet. Authored from Jahani
// & Korn (2009), "Balochi", The Iranian Languages (Tables 11.1/11.2/11.6). NO machine referee exists (no
// wikipron/kaikki/epitran for bal/bcc/bgn/bgp) → these goldens are the falsifiable check on the SOURCED inventory:
// each Arabic-script word's consonant + long-vowel backbone must match the J&K value. The script is DEFECTIVE — the
// short vowels /a i u/ are unwritten and ⟨و⟩/⟨ی⟩ conflate uː/oː and iː/eː — so the goldens assert the actual
// (folded/defaulted) output and note the full J&K form in the comment. Verdict ⛔ (defective vowel encoding).
describe("Balochi (Southern) canonical IPA — Balochi Arabic alphabet", () => {
    test("the SIGNATURE: retroflex ٹ→ʈ, ڈ→ɖ vs dental ت→t̪, د→d̪", () => {
        expect(phonemizeWord("ڈاکٹر")).toBe("ɖaːkʈr"); // "doctor" — ڈ→ɖ, ٹ→ʈ (retroflex); J&K ɖaːkʈar (short a unwritten)
        expect(phonemizeWord("کتاب")).toBe("kt̪aːb"); // "book" — ت→t̪ (DENTAL); J&K kit̪aːb (short i unwritten)
        expect(phonemizeWord("مات")).toBe("maːt̪"); // "mother" — dental t̪
    });

    test("long vowels ا→aː, matres و→uː/ی→iː; affricate چ→t͡ʃ, خ→x", () => {
        expect(phonemizeWord("آپ")).toBe("aːp"); // "water" — آ→aː
        expect(phonemizeWord("چار")).toBe("t͡ʃaːr"); // "four" — چ→t͡ʃ
        expect(phonemizeWord("شیر")).toBe("ʃiːr"); // "milk" — ی→iː
        expect(phonemizeWord("خاموش")).toBe("xaːmuːʃ"); // "quiet" — خ→x; و→uː DEFAULT (J&K xaːmoːʃ: the o/u merger)
    });

    test("short vowels are unwritten (the abjad fold) — consonant + long-vowel backbone only", () => {
        expect(phonemizeWord("گریب")).toBe("ɡriːb"); // "poor" — J&K ɡariːb (short a unwritten)
        expect(phonemizeWord("نام")).toBe("naːm"); // "name"
        expect(phonemizeWord("راه")).toBe("raːh"); // "road" — ه→h
    });
});
