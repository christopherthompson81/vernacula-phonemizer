import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { numberToText, phonemizeWord } from "../src/languages/pashto/pashto.ts";
import { makePashtoNormalizer } from "../src/languages/pashto/normalize.ts";

// Canonical-IPA goldens for Pashto / پښتو (ps) — first Eastern Iranian language, a Perso-Arabic ABJAD (extended).
// scope-limited: the consonant + WRITTEN-vowel skeleton is correct (retroflex ʈ ɖ ɳ ɻ, retroflex sibilants ʂ ʐ,
// affricates t͡s d͡z, dental t̪ d̪, long/mid vowels ا/آ→ɑ ې→e و→o ی→i), but SHORT vowels a/ə/i/u are usually
// unwritten → a default [ə] (the zwarakay) stands in (short-vowel restoration is deferred, as for Urdu/Persian).
// Validated against wikipron pus + kaikki pus (human).
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

// ── TEXT NORMALIZATION (src/languages/pashto/normalize.ts) ──────────────────────────────────────────────
// Counts cited are over a fresh ps.wikipedia dump — 242,649 lines after markup and category-residue
// filtering. Full derivation in docs/investigations/ps_normalization_investigation.md.
const normalizePashto = makePashtoNormalizer({ numeralWords: numberToText });

describe("pashto text normalization", () => {
    test("era markers — the language's biggest class, and every one was a bare consonant", () => {
        expect(normalizePashto("۲۰۱۸ز کال")).toBe("۲۰۱۸ زېږديز کال"); // ×38,810, the single largest class
        expect(normalizePashto("۲۰۱۸م کال")).toBe("۲۰۱۸ میلادي کال");
        expect(normalizePashto("۱۳۹۹ل کال")).toBe("۱۳۹۹ لمريز کال");
        expect(normalizePashto("۶۳هـ ق کال")).toBe("۶۳ هجري قمري کال"); // the QUALIFIED Hijri forms first
        expect(normalizePashto("۱۱۶۱ هـ س")).toBe("۱۱۶۱ هجري شمسي");
        expect(normalizePashto("۱۹۶۵ ز.ک. څخه")).toBe("۱۹۶۵ زېږديز کال څخه");
        // ⚠ REGRESSION GUARD: `م.ز` is BC and the bare-`م` arm read it as its own OPPOSITE (میلادي, AD),
        // stranding the ز as a consonant. Written four ways, including ZWNJ-joined — and U+200C is `Cf`,
        // so a `(?![\p{L}\p{M}])` guard treated it as a word end and let the wrong arm fire.
        expect(normalizePashto("۴۲۳ تر ۳۴۷ م‌ز")).toBe("۴۲۳ تر ۳۴۷ مخزېږديز");
        expect(normalizePashto("۱۳۳۶ م.ز.")).toBe("۱۳۳۶ مخزېږديز.");
        expect(normalizePashto("۳۴۲ م ز")).toBe("۳۴۲ مخزېږديز");
        // digit-anchored, because a bare `ق.م` pattern counts 2,695 and 2,499 of those are `قم` in words
        expect(normalizePashto("۱۸۹۴ ق.م. کال")).toBe("۱۸۹۴ له ميلاد څخه مخکې کال");
    });

    test("ordinals — a suffix cannot agree with a digit run (trap 14)", () => {
        // was `نولس مه نېټه`: three tokens where Pashto has two, the suffix stranded as its own word
        expect(normalizePashto("۱۹مه نېټه")).toBe("نولسمه نېټه");
        expect(normalizePashto("۱۹مې پېړۍ")).toBe("نولسمې پېړۍ");
        // ⚠ THE BRANCHES, not the corpus's instances (trap 13) — three irregular cells and two stem rules:
        expect(normalizePashto("۱مه")).toBe("لومړۍ"); // SUPPLETIVE — لومړی ×8,275 against یوم ×22
        expect(normalizePashto("۱م")).toBe("لومړی");
        expect(normalizePashto("۲مه")).toBe("دویمه"); // irregular — دویم ×2,473 against دوم ×54
        expect(normalizePashto("۳مې")).toBe("درېیمې"); // irregular — درېیم ×794 against درېم ×134
        expect(normalizePashto("۵مه")).toBe("پنځمه"); // ه-final cardinal DROPS it: پنځه → پنځم ×607
        expect(normalizePashto("۸مه")).toBe("اتمه"); // اته → اتم ×381
        expect(normalizePashto("۷۰مه")).toBe("اویاهمه"); // ا-final cardinal ADDS ه: اویا → اویاهم ×44
        expect(normalizePashto("۲۰م")).toBe("شلم"); // regular
        // the COMPOSITIONAL branch, which no table of attested ordinals would have covered
        expect(normalizePashto("۱۹۸۰مې لسیزې")).toBe("زر و نهه سل و اتیاهمې لسیزې");
    });

    test("the ordinal/era split on the one ambiguous letter", () => {
        // bare `م` is the era at 100+ and the ordinal below it — 5,005 of its 6,151 instances are 4-digit
        expect(normalizePashto("۲۰م پېړۍ")).toBe("شلم پېړۍ"); // the 20th century
        expect(normalizePashto("۹۹۸ م کلونو")).toBe("۹۹۸ میلادي کلونو"); // a 3-digit AD year
    });

    test("separators: the mark decides, not the group size", () => {
        expect(normalizePashto("۳۲۱،۰۰۰")).toBe("۳۲۱۰۰۰"); // was "321 , ZERO" — ، is clause punctuation
        expect(normalizePashto("۱،۲۳۴،۵۶۷")).toBe("۱۲۳۴۵۶۷");
        expect(normalizePashto("78،477،037")).toBe("78477037");
        // ⚠ THE DOT IS A DECIMAL HERE even on a 3-digit tail — `15.744 ميلیونه` is 15.744 million. Only the
        // unambiguous MULTI-group dot form (×35) de-groups.
        expect(normalizePashto("15.744")).toBe("15 اعشاريه 7 4 4");
        expect(normalizePashto("1.234.567")).toBe("1234567");
        expect(normalizePashto("۷۸.۸")).toBe("۷۸ اعشاريه ۸");
        expect(normalizePashto("۸،۳۵")).toBe("۸ اعشاريه ۳ ۵"); // the ، decimal, which also lost a PAUSE
        // ⚠ REGRESSION GUARD: an IPv4 is a designation. A lookahead of "not a digit" admits it, because the
        // next character after `192.168` is a dot — the guard has to reject dot-then-digit.
        expect(normalizePashto("192.168.2.10")).toBe("192.168.2.10");
        expect(normalizePashto("۷۸.۸.")).toBe("۷۸ اعشاريه ۸."); // …but a sentence period must still be read
    });

    test("percent, ranges and the clock", () => {
        expect(normalizePashto("۲۵٪")).toBe("۲۵ سلنه"); // postposed: N سلنه ×2,657 against سلنه N ×29
        expect(normalizePashto("٪۲۵")).toBe("۲۵ سلنه"); // the PREPOSED sign, ×1,066 — and it still postposes
        expect(normalizePashto("۹۹% سلنه")).toBe("۹۹ سلنه"); // ⚠ the word may already be there (trap 12)
        expect(normalizePashto("۹۰-۹۵٪")).toBe("۹۰ تر ۹۵ سلنه"); // ranges before percent
        expect(normalizePashto("۱۹۶۵-۱۹۷۵")).toBe("۱۹۶۵ تر ۱۹۷۵");
        expect(normalizePashto("۱۷۲۱-۹۴")).toBe("۱۷۲۱-۹۴"); // descending — a birth–death pair
        expect(normalizePashto("٢١-سلطان")).toBe("٢١-سلطان"); // a numbered LIST item, not a span
        expect(normalizePashto("۱۰:۳۰")).toBe("۱۰ بجې او ۳۰ دقیقې"); // the corpus's own idiom
        expect(normalizePashto("۷:۰۰")).toBe("۷ بجې"); // …and no "and zero minutes"
    });

    test("units, degrees, currency, minus and fractions", () => {
        expect(normalizePashto("۵ km")).toBe("۵ کیلومتره"); // was the raw cluster [ˈʊkm]
        expect(normalizePashto("۲۴ °C")).toBe("۲۴ سانتيګراد");
        // ⚠ the trailing space is deliberate and asserted: the corpus writes `د$۲۴۰بيلون` with no spaces at
        // all, so a bare word welded onto the next one (`ډالربيلون`) — one token where there were two.
        expect(normalizePashto("$۱۰۰")).toBe("۱۰۰ ډالر ");
        expect(normalizePashto("د$۲۴۰بيلون")).toBe("د۲۴۰ ډالر بيلون");
        // …and a magnitude word belongs INSIDE the quantity, not after the currency (the id `US$` defect)
        expect(normalizePashto("$۱۴ میلیارد")).toBe("۱۴ میلیارد ډالر ");
        // …and the name may be on the RIGHT, where a left-only guard said the currency twice
        expect(normalizePashto("100 $ میلیارده امریکایي ډالرو")).toBe("100 میلیارده  امریکایي ډالرو");
        expect(normalizePashto("-۱۸ °C")).toBe("منفي ۱۸ سانتيګراد");
        // ⚠ REGRESSION GUARD: the sign must be GLUED. A SPACED dash between two date phrases is a dash, and
        // the range rule cannot claim it because its operands are full dates — this read a death year as
        // "minus 1979". Measured: `-[digit]` ×2,538 against `- [digit]` ×4,296.
        expect(normalizePashto("نېټه - ۱۹۷۹ د ډسمبر")).toBe("نېټه - ۱۹۷۹ د ډسمبر");
        expect(normalizePashto("۲/۳")).toBe("۲ درېیمه برخه"); // composes from the ordinal built above
        expect(normalizePashto("۱/۳برخه")).toBe("۱ درېیمه برخه"); // ⚠ re-SPACED, or it is one token (trap 26)
        expect(normalizePashto("سنن البيهقي: 9/234")).toBe("سنن البيهقي: 9/234"); // a volume/page citation
        expect(normalizePashto("۱۴۳۴/۸/۲ هـ ق")).toBe("۱۴۳۴/۸/۲ هجري قمري"); // a date
    });

    test("end to end — what the layer emits really is spoken by the g2p", () => {
        expect(phonemize("۲۰۱۸ز کال", "ps")).toContain("zeʐd̪ˈiz");
        expect(phonemize("۱۹مه نېټه", "ps")).toBe("nˈoləsmə nˈeʈə"); // one word, not نولس + مه
        expect(phonemize("۲۵٪", "ps")).toContain("səlnˈə");
        expect(phonemize("۷۸.۸", "ps")).toContain("aʔʃˈɑrjə"); // اعشاريه — the ع is [ʔ], per this g2p
    });
});
