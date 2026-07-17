import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/pashto/pashto.ts";

// Canonical-IPA goldens for Pashto / پښتو (ps) — first Eastern Iranian language, a Perso-Arabic ABJAD (extended).
// 🟠 scope-limited: the consonant + WRITTEN-vowel skeleton is correct (retroflex ʈ ɖ ɳ ɻ, retroflex sibilants ʂ ʐ,
// affricates t͡s d͡z, dental t̪ d̪, long/mid vowels ا/آ→ɑ ې→e و→o ی→i), but SHORT vowels a/ə/i/u are usually
// unwritten → a default [ə] (the zwarakay) stands in (short-vowel restoration is deferred, as for Urdu/Persian).
// Validated against wikipron pus + kaikki pus (human). See docs/ps_native_bringup_investigation.md.
describe("pashto canonical IPA", () => {
    test("consonant + written-vowel skeleton (retroflex, affricate, long vowels)", () => {
        const cases: [string, string][] = [
            ["پښتو", "paʂt̪ˈo"], // Pashto — ښ→ʂ retroflex, ت→t̪ dental, و→o; پ→[a] restored (Kandahari paʂto)
            ["سلام", "səlˈɑm"], // salaam — ا→ɑ
            ["ښه", "ʂˈə"], // good — final ه → ə
            ["کور", "kˈor"], // house — و→o
            ["کتاب", "kit̪ˈɑb"], // book — dental t̪, ا→ɑ; ك→[i] restored (the Arabic loan kitāb, not the schwa default)
            ["اوبه", "ˈobə"], // water — initial او→o, final ه→ə
            ["نوم", "nˈom"], // name
            ["ماشوم", "mɑʃˈom"], // child
            ["ورځ", "ˈorəd͡z"], // day — ځ → d͡z affricate
            ["اسپانيا", "aspɑnjˈɑ"], // Spain — ـيا: ی is the glide [j], the final ا the [ɑ] nucleus
            ["دنيا", "d̪ənjˈɑ"], // world — ـيا → jɑ
            ["انګور", "aŋɡˈor"], // grapes — homorganic ن → [ŋ] before the velar ګ
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("numbers (decimal; skeleton)", () => {
        expect(phonemize("10", "ps")).toBe("lˈəs"); // لس
        expect(phonemize("100", "ps")).toBe("sˈəl"); // سل
    });
});
