import { readFileSync } from "node:fs";

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

// ── TEXT NORMALIZATION (#562) ───────────────────────────────────────────────────────────────────────────────
// src/languages/persian/normalize.ts + the DECIMAL IRANIAN number compositor (persian/numbers.ts). Counts and
// the before-behaviour these pin are in the normalize.ts header, measured over the fa_ir corpus (1,856 utts).
describe("persian text normalization (#562)", () => {
    // The compositor. Persian was previously read by the Indic lakh/crore composer, which had the tens and units
    // in Indic order, no ⟨و⟩, and no fused hundreds: 21 "یک بیست", 200 "دو صد", 1,000,000 "ده صد هزار".
    test("cardinals: connective ⟨و⟩ /o/, bare صد/هزار, fused hundreds, million", () => {
        const cases: [string, string][] = [
            ["21", "bˈiːsto ˈiːk"], // bist-O-yek — the enclitic connective, and the Iranian tens-first order
            ["100", "sˈad"], // the BARE hundred (not *یک صد)
            ["105", "sˈado pˈand͡ʒ"],
            ["200", "devˈiːst"], // fused irregular hundreds, not multiplier + صد
            ["300", "siːsˈad"],
            ["700", "haftsˈad"],
            ["900", "nohsˈad"],
            ["1000", "hezˈaːɾ"], // the BARE thousand
            ["1979", "hezˈaːɾo nohsˈado haftˈaːdo nˈoh"],
            ["1000000", "ˈiːk miːljˈuːn"], // million KEEPS the یک, unlike صد/هزار
            ["5000000", "pˈand͡ʒ miːljˈuːn"],
        ];
        for (const [n, exp] of cases) expect(phonemize(n, "fa")).toBe(exp);
    });

    // The ⟨ه⟩ branch of the g2p returned before the shared harakat consumption, so a written short vowel after
    // ⟨ه⟩ was discarded — which silently corrupted the DIACRITIZED number table itself.
    test("a harakat written after ⟨ه⟩ is read, not dropped", () => {
        expect(phonemize("1000", "fa")).toBe("hezˈaːɾ"); // هِزار — was [hzˈaːɾ]
        expect(phonemize("7", "fa")).toBe("hˈaft"); // هَفت — was [hfˈat]
        expect(phonemize("80", "fa")).toBe("haʃtˈaːd"); // هَشتاد — was [hʃatˈaːd]
    });

    // The final-cluster heuristic deletes the g2p's DEFAULT [a] before a word-final coda run. It must not delete
    // a fatha the text actually WROTE: هَشت is [haʃt] (inserted) but سیصَد is [siːsad] (written, was [siːsd]).
    test("the written-vowel guard is scoped: inserted [a] goes, written fatha stays", () => {
        expect(phonemize("8", "fa")).toBe("hˈaʃt"); // inserted → deleted
        expect(phonemize("300", "fa")).toBe("siːsˈad"); // written → kept
        expect(phonemize("500", "fa")).toBe("paːnsˈad");
        // …and the MEDIAL rule is left bit-identical, including for a written fatha (5 lexicon entries depend on
        // it, and the wikipron referee agrees with the deletion): تکَیه → takje, not takaje.
        expect(phonemizeWord("تکیه")).toBe("takjˈe");
        expect(phonemizeWord("گریه")).toBe("ɡeɾjˈe");
    });

    // Grouping separators were read as CLAUSE PUNCTUATION: "1,000" → [ˈiːk , sˈefɾ] ("one, zero").
    test("digit de-grouping — ASCII comma, period, and the Arabic comma ⟨،⟩", () => {
        expect(phonemize("1,000", "fa")).toBe("hezˈaːɾ");
        expect(phonemize("5,000,000", "fa")).toBe("pˈand͡ʒ miːljˈuːn");
        expect(phonemize("104.500", "fa")).toBe("sˈado t͡ʃahˈaːɾ hezˈaːɾo paːnsˈad"); // period grouping
        expect(phonemize("19،500", "fa")).toBe("nuːzdˈah hezˈaːɾo paːnsˈad"); // ⟨،⟩ as the thousands mark
        // …while ⟨،⟩ as real punctuation (×1691 in the corpus) is untouched — it still emits its pause.
        expect(phonemize("سلام، دنیا", "fa")).toContain(" , ");
    });

    // The colon is a clause mark, so "11:00" read as [iːjzadˈah , sˈefɾ] — "eleven, zero" with a pause inside.
    test("clock: hour ⟨و⟩ minutes دقیقه, minutes dropped at :00, and NO inserted ساعت", () => {
        expect(phonemize("8:46", "fa")).toBe("hˈaʃt ˈuː t͡ʃehˈelo ʃˈeʃ daqiːqˈe");
        expect(phonemize("06:30", "fa")).toBe("ʃˈeʃ ˈuː sˈiː daqiːqˈe");
        expect(phonemize("11:00", "fa")).toBe("iːjzadˈah"); // :00 → the bare hour
        // the corpus always writes ساعت itself; the rule must not add a second one (the Arabic-clock bug)
        expect(phonemize("ساعت 12:00", "fa").match(/saːʔˈat/gu)?.length ?? 0).toBeLessThan(2);
        // …and a دقیقه the TEXT already wrote is reused, not duplicated (3 of the 14 corpus clocks write one).
        expect(phonemize("ساعت 07:19 دقیقه صبح", "fa").match(/daqiːqˈe/gu)?.length).toBe(1);
        // …and the DOTTED clock is claimed ONLY when UTC anchors it — otherwise H.MM is a decimal.
        expect(phonemize("15.00 UTC", "fa")).toContain("paːnzdˈah");
        expect(phonemize("15.00", "fa")).toContain("mamˈiːz");
    });

    // The decimal period was a full CLAUSE BREAK inside the number; the fraction reads digit by digit.
    test("decimals read with ممیز, fractional part digit by digit", () => {
        expect(phonemize("1.5", "fa")).toBe("ˈiːk mamˈiːz pˈand͡ʒ");
        expect(phonemize("6.34", "fa")).toBe("ʃˈeʃ mamˈiːz sˈeh t͡ʃahˈaːɾ"); // 3-4, not "thirty-four"
        expect(phonemize("12.8", "fa")).toBe("davaːzdˈah mamˈiːz hˈaʃt");
    });

    // Neither % nor the Arabic ٪ is in the engine's TOKEN, so all four corpus percentages were silently DELETED.
    test("percent — ASCII % and the Arabic ٪ both read درصد", () => {
        expect(phonemize("80%", "fa")).toBe("haʃtˈaːd daɾsˈed");
        expect(phonemize("93٪", "fa")).toBe("nˈavdo sˈeh daɾsˈed");
        expect(phonemize("3%", "fa")).toBe(phonemize("3 درصد", "fa")); // the sign reads as the written word
    });

    // The ordinal suffix was tokenized apart and spoken as its own word [ʔˈam].
    test("ordinals: the suffix fuses onto the cardinal, across a ZWNJ too", () => {
        expect(phonemize("قرن 16ام", "fa")).toBe(phonemize("قرن شانزدهم", "fa"));
        expect(phonemize("1000‌ام", "fa")).toBe(phonemize("هزارم", "fa")); // ZWNJ between digits and suffix
        expect(phonemize("16ام", "fa")).not.toContain("ʔˈam"); // no stray glottal word
    });

    // Persian-Indic ۰-۹ do not occur in this corpus but are ordinary in Persian typing.
    test("Persian-Indic digits ۰-۹ fold to ASCII", () => {
        expect(phonemize("۱۹۷۹", "fa")).toBe(phonemize("1979", "fa"));
        expect(phonemize("۱٫۵", "fa")).toBe(phonemize("1.5", "fa")); // and the Arabic decimal separator ٫
    });

    // MEASURED AND DELIBERATELY LEFT (normalize.ts header): the hyphen between numbers is 6 ranges, 3 sports
    // scores and 3 bidi-reversed orders in this corpus, so no connective is inserted — but both numbers must
    // still reach the output as separate words rather than being fused or dropped.
    test("a hyphen between numbers inserts nothing, and loses nothing", () => {
        expect(phonemize("1644-1912", "fa")).toBe(
            "hezˈaːɾo ʃeʃsˈado t͡ʃehˈelo t͡ʃahˈaːɾ hezˈaːɾo nohsˈado davaːzdˈah",
        );
    });

    // `\b` is ASCII-defined and matches NOTHING against Perso-Arabic script (the trap in six languages so far).
    test("no ASCII word boundary is used in the Persian normalizer", () => {
        const src = readFileSync(
            new URL("../src/languages/persian/normalize.ts", import.meta.url),
            "utf8",
        );
        // …in the CODE. The header documents the trap by name, so the comments are stripped before the check.
        const code = src.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/[^\n]*/gu, "");
        expect(code).not.toMatch(/\\b/u);
    });

    // #586 — the header records that this corpus writes NO unit abbreviation, which is still true; but
    // `5 km` reached the g2p as the cluster [ˈʊkm] and a phonemizer is handed arbitrary text (the argument
    // step 7b already makes for the currency signs fa_ir also lacks). Every word is the corpus's own:
    // کیلومتر ×65, متر ×45, and the richest measure-word attestation in the sweep — کیلومتر مربع ×16,
    // متر مکعب ×3, both POSTPOSED.
    test("unit abbreviations and their powers (#586)", () => {
        expect(phonemize("19,500 km²", "fa")).toContain("kiːlˈuːmtɾ maɾebˈeʔ");
        expect(phonemize("120 m³", "fa")).toContain("mˈetɾ mˈakʔb");
        expect(phonemize("4892 m", "fa")).toContain("mˈetɾ");
        // ⚠ LATIN KEYS ONLY. The ckb pass reads `کم`/`سم` as unit abbreviations; the SAME graphemes here are
        // ordinary words — کم ×63 is the adjective "little/few" and سم ×5 is "poison" — so a shared
        // Perso-Arabic table would read 68 Persian words as measurements.
        expect(phonemize("اصطکاک کم است", "fa")).toContain("kˈam ʔˈast");
        expect(phonemize("سم مار", "fa")).toContain("sˈam");
        // ORDERING: before the decimal rule (6), which rewrites the dot as ممیز and would leave the version
        // guard no dot to reject. `802.11m` is a designation, so the `m` stays a letter name.
        expect(phonemize("802.11m", "fa")).toContain("ˈiːk ˈiːk ˈɛm");
    });

    // #586 — RATES. `120 km/h` read the denominator as the ENGLISH LETTER NAME [ˈeᶦt͡ʃ] and `133 m/s` as
    // [ˈɛs]. The construction is spelled out in this corpus's own rate sentence: "480 کیلومتر بر ساعت
    // (133 متر بر ثانیه؛ 300 مایل بر ساعت)" — `بر` is "per", `ساعت` the hour, `ثانیه` the second.
    test("the rate denominators (#586)", () => {
        expect(phonemize("120 km/h", "fa")).toContain("bˈaɾ saːʔˈet");
        expect(phonemize("133 m/s", "fa")).toContain("bˈaɾ saːnejˈe");
        expect(phonemize("اصطکاک کم است", "fa")).toContain("kˈam ʔˈast"); // the adjective still untouched
    });

    test("#586 the ampersand is the ENGLISH word, and both speakers say it", () => {
        // wav2vec2-xlsr-53-espeak-cv-ft, both fa_ir speakers of the sentence:
        //   A `h ɑ b eː  b iː a n b iː  d a r p ɑ j ɑ n …`   B `x ɑ b e  b i a n d b iː  d a r p ɑ j ɑ n …`
        // MMS alone would have read as a drop — it omits the span for A and floats it to the head for B.
        const s = phonemize("بدیهی است که B&B ها به عمدتا.", "fa");
        expect(s).toContain("ʔˈand");
        expect(s).not.toBe(phonemize("بدیهی است که BB ها به عمدتا.", "fa"));
    });
});
