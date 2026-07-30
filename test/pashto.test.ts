import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/pashto/pashto.ts";

// Canonical-IPA goldens for Pashto / پښتو (ps) — first Eastern Iranian language, a Perso-Arabic ABJAD (extended).
// 🟠 scope-limited: the consonant + WRITTEN-vowel skeleton is correct (retroflex ʈ ɖ ɳ ɻ, retroflex sibilants ʂ ʐ,
// affricates t͡s d͡z, dental t̪ d̪, long/mid vowels ا/آ→ɑ ې→e و→o ی→i), but SHORT vowels a/ə/i/u are usually
// unwritten → a default [ə] (the zwarakay) stands in (short-vowel restoration is deferred, as for Urdu/Persian).
// Validated against wikipron pus + kaikki pus (human). See docs/investigations/ps_native_bringup_investigation.md.
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

    // NUMBERS — spellings from Omniglot "Pashto numbers and numerals" + learn101.org/pashto_numbers.php (see the
    // source note in pashto.jsonc). Two bugs fixed here: `tens` is keyed by the ROUND value ("20".."90") but the
    // lookup used Math.floor(nn/10) → "2".."9" → undefined, so 20-90 came out EMPTY and 21-99 lost their tens word
    // (SLOT-GAP); and the magnitude chain stopped at زر, so 10⁶+ never reached the میلیون data that already existed.
    test("numbers (decimal; skeleton)", () => {
        expect(phonemize("10", "ps")).toBe("lˈəs"); // لس
        expect(phonemize("100", "ps")).toBe("sˈəl"); // سل
        expect(phonemize("7", "ps")).toBe("ˈowə"); // اووه
    });

    test("numbers: irregular teens, the ⟨ویشت⟩ 21-29 series, and UNITS-FIRST 31-99", () => {
        expect(phonemize("13", "ps")).toBe("d̪ˈijərləs"); // دیارلس — fused, not دری + لس
        expect(phonemize("19", "ps")).toBe("nˈoləs"); // نولس
        expect(phonemize("20", "ps")).toBe("ʃˈəl"); // شل — was EMPTY (the tens-key bug)
        expect(phonemize("21", "ps")).toBe("iwˈojʃət̪"); // یوویشت — the BOUND ویشت form of twenty, not شل
        expect(phonemize("25", "ps")).toBe("pənd͡zˈə ˈojʃət̪"); // پنځه ویشت
        expect(phonemize("31", "ps")).toBe("ˈiʊ d̪ˈerəʃ"); // یو دېرش — units-first, no connector
        expect(phonemize("71", "ps")).toBe("ˈiʊ ojˈɑ"); // یو اویا
        expect(phonemize("99", "ps")).toBe("nhˈə nˈoɪ"); // نهه نوی
    });

    test("numbers: hundreds, thousands, and the میلیون / میلیارد magnitudes", () => {
        expect(phonemize("101", "ps")).toBe("sˈəl ˈo ˈiʊ"); // سل و یو — ⟨و⟩ joins the group to its remainder
        expect(phonemize("555", "ps")).toBe("pənd͡zˈə sˈəl ˈo pənd͡zˈə pənd͡zˈos"); // پنځه سل و پنځه پنځوس
        expect(phonemize("1000", "ps")).toBe("zˈər"); // زر — the leading یو is omitted for a bare magnitude
        expect(phonemize("12345", "ps")).toBe("d̪ˈoləs zˈər ˈo d̪ərˈe sˈəl ˈo pənd͡zˈə t͡səlˈojʂət̪");
        expect(phonemize("1000000", "ps")).toBe("milˈiwən"); // میلیون — was EMPTY
        expect(phonemize("2000000", "ps")).toBe("d̪wˈə milˈiwən"); // دوه میلیون
        expect(phonemize("1000000000", "ps")).toBe("milˈijrəd̪"); // میلیارد
    });
});
