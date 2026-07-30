import { describe, expect, it, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/vietnamese/vietnamese.ts";
import { normalizeVietnamese as N } from "../src/languages/vietnamese/normalize.ts";

describe("Vietnamese g2p (Northern)", () => {
    it("the 6 tones (Chao contours after the nucleus)", () => {
        expect(phonemizeWord("ma")).toBe("mˈaː˧"); // ngang (level)
        expect(phonemizeWord("mà")).toBe("mˈaː˨˩"); // huyền (low falling)
        expect(phonemizeWord("má")).toBe("mˈaː˧˥"); // sắc (high rising)
        expect(phonemizeWord("mả")).toBe("mˈaː˧˩˧"); // hỏi (dipping)
        expect(phonemizeWord("mã")).toBe("mˈaː˧ˀ˥"); // ngã (creaky rising)
        expect(phonemizeWord("mạ")).toBe("mˈaː˨˩ˀ"); // nặng (heavy/glottal)
    });

    it("onsets, rhymes, tone placement", () => {
        const cases: [string, string][] = [
            ["xin", "sˈi˧n"],
            ["chào", "t͡ɕˈaː˨˩w"], // ch → t͡ɕ, ào → aː + tone + w glide
            ["Việt", "vˈiɛ˨˩ˀt̪"], // iê → iɛ, nặng, dental t̪
            ["một", "mˈo˨˩ˀt̪"],
            ["người", "ŋˈɨə˨˩j"], // ng → ŋ, ươi → ɨə + j
            ["nước", "nˈɨə˧˥k"],
            ["đi", "ɗˈi˧"], // đ → implosive ɗ
            ["biết", "bˈiɛ˧˥t̪"],
            ["quả", "kwˈaː˧˩˧"], // qu → kw glide
            ["giết", "zˈiɛ˧˥t̪"], // gi → z, the i rejoins the iê diphthong
            ["anh", "ʔˈe˧ɲ"], // vowel-initial → ʔ; a → e before palatal nh; ngang tone ˧
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    // The `ây` rhyme was MISSING from rhymes.tsv, so every syllable carrying it phonemized to "" and was
    // routed to the ENGLISH fallback: thấy/Tây → [tʰˈeᶦ] ("they"), gây → [ɡˈeᶦ], đây → [dˈeᶦ]. 526
    // instances across 438 of the 1,978 vi_vn corpus utterances (22.1%), and the top wikipron divergence
    // class (12× `dây` → empty). Value is əj, exactly parallel to the file's own ay→aj and âu→əw.
    it("the ây rhyme (â = ə, + j glide)", () => {
        expect(phonemizeWord("đây")).toBe("ɗˈə˧j");
        expect(phonemizeWord("thấy")).toBe("tʰˈə˧˥j");
        expect(phonemizeWord("giây")).toBe("zˈə˧j"); // gi onset, the i rejoins
        expect(phonemizeWord("lầy")).toBe("lˈə˨˩j");
        expect(phonemizeWord("ay")).toBe("ʔˈa˧j"); // unchanged: ă-quality a, not ə
    });

    it("numbers (Northern)", () => {
        expect(phonemize("5", "vi")).toBe("nˈa˧m");
        expect(phonemize("25", "vi")).toBe("hˈaː˧j mˈɨə˧j lˈa˧m"); // 5-after-ten → lăm
        expect(phonemize("21", "vi")).toBe("hˈaː˧j mˈɨə˧j mˈo˧˥t̪"); // 1-after-ten → mốt
    });
});

// Foreign proper nouns are code-switched constantly in Vietnamese text; a token that is not a valid
// Vietnamese syllable used to phonemize to "" and vanish (paris sofia → nothing, Run 28). Now routed
// through the English phonemizer — a missing word is worse than an English-phoneme one.
describe("Vietnamese: foreign tokens are not dropped", () => {
    test("invalid syllables route through foreign", () => {
        const ipa = phonemize("tại paris và sofia", "vi");
        expect(ipa.split(" ").length).toBe(4);
        expect(ipa).toContain("pʰˈɛɹɪs");
    });

    test("native syllables and numbers unaffected", () => {
        expect(phonemize("có 25 người", "vi")).toBe("kˈɔ˧˥ hˈaː˧j mˈɨə˧j lˈa˧m ŋˈɨə˨˩j");
    });
});

// #562 TEXT NORMALIZATION (src/languages/vietnamese/normalize.ts). Assertions are on the normalizer's
// TEXT output where the point is which words are chosen, and on the phonemized output where the point is
// that no spurious clause pause survives. Corpus counts and the before-behaviour are in the file header.
describe("Vietnamese normalization (#562)", () => {
    test("dot-grouped thousands: the separator was read as a SENTENCE break", () => {
        // before: "bốn mươi . không" — forty, full stop, zero
        expect(N("40.000 người")).toBe("40000 người");
        expect(N("5.000.000 độc giả")).toBe("5000000 độc giả");
        expect(phonemize("40.000 người", "vi")).not.toContain(".");
        // the guard that was a live bug: a grouped numeral followed by sentence punctuation
        expect(N("khoảng ¥130.000, với")).toBe("khoảng ¥130000, với");
        expect(N("khoảng ¥7,000.")).toBe("khoảng ¥7000.");
        // NOT grouping — the blocks are not three digits
        expect(N("Chuẩn 802.11n")).toBe("Chuẩn 802 chấm 11n");
    });

    test("decimal comma → phẩy, decimal dot → chấm", () => {
        expect(N("14,7 tỷ USD")).toBe("14 phẩy 7 tỷ u ét sì dê");
        expect(N("6,34 inch")).toBe("6 phẩy 34 inch");
        expect(N("1.234,5 mét")).toBe("1234 phẩy 5 mét"); // de-group first, then the decimal
        expect(N("tần số 2.4 Ghz")).toBe("tần số 2 chấm 4 Ghz");
        expect(phonemize("2,3 tỷ đô", "vi")).toBe("hˈaː˧j fˈə˧˩˧j bˈaː˧ t̪ˈi˧˩˧ ɗˈo˧");
    });

    test("clock: H giờ M, a following giờ is CONSUMED, :00 drops the minutes", () => {
        expect(N("khoảng 9:30 sáng")).toBe("khoảng 9 giờ 30 sáng");
        expect(N("lúc 8:30 giờ tối")).toBe("lúc 8 giờ 30 tối"); // not "8 giờ 30 giờ tối"
        expect(N("khoảng 12:00 giờ GMT")).toBe("khoảng 12 giờ giê em mờ tê");
        expect(N("vào lúc 07:19 giờ sáng")).toBe("vào lúc 7 giờ 19 sáng"); // leading zero not spoken
        expect(N("Vào lúc 11:20, cảnh sát")).toBe("Vào lúc 11 giờ 20, cảnh sát"); // sentence comma ≠ hundredths
        expect(N("khoảng 10:00 – 11:00 đêm")).toBe("khoảng 10 giờ đến 11 giờ đêm");
        // RATIOS are not clocks: a single minute digit excludes them
        expect(N("tỷ số là 3:2")).toBe("tỷ số là 3:2");
        expect(N("bằng hạng 2:2")).toBe("bằng hạng 2:2");
    });

    test("sports times M:SS,hh are claimed before the clock rule", () => {
        expect(N("thời gian 4:41,30, chậm hơn")).toBe("thời gian 4 phút 41 giây 30, chậm hơn");
        expect(N("Hungary 1:09,02 phút.")).toBe("Hungary 1 phút 9 giây 2."); // trailing phút consumed
    });

    test("ranges: đến only when ASCENDING — the corpus's 5 sports scores all descend", () => {
        expect(N("(100-200 dặm)")).toBe("(100 đến 200 dặm)");
        expect(N("năm 1995-1996")).toBe("năm 1995 đến 1996");
        expect(N("dày 2 – 3 km")).toBe("dày 2 đến 3 km");
        expect(N("thắng 5-3 trước")).toBe("thắng 5-3 trước"); // score
        expect(N("tỷ số 6-6.")).toBe("tỷ số 6-6."); // score
        expect(N("21 - 20, chấm dứt")).toBe("21 - 20, chấm dứt"); // score
    });

    test("units: HTML sup, squared, per-hour, degrees", () => {
        expect(N("chiếm 783.562 km<sup>2</sup> (")).toBe("chiếm 783562 km vuông (");
        expect(N("diện tích 3.850 km²,")).toBe("diện tích 3850 km vuông,");
        expect(N("(3136mm2 so với")).toBe("(3136mm vuông so với");
        // the corpus writes km/giờ and dặm/giờ in full — the target forms are its own
        expect(N("khoảng 83 km/h và")).toBe("khoảng 83 km/giờ và");
        expect(N("tối đa 40 mph (64 kph)")).toBe("tối đa 40 dặm/giờ (64 km/giờ)");
        expect(N("thường trên +30°C.")).toBe("thường trên +30 độ xê.");
        expect(N("phía đông 35° Tây.")).toBe("phía đông 35 độ Tây.");
        // `m` = mét reaches the shared symbol tier, which needs the digits still adjacent
        expect(phonemize("cao 4892 m", "vi")).toContain("mˈɛ˧˥t̪");
        expect(phonemize("22 km", "vi")).toBe("hˈaː˧j mˈɨə˧j hˈaː˧j kˈi˧ lˈo˧ mˈɛ˧˥t̪");
    });

    test("fractions and multiplication", () => {
        expect(N("từ 1/4 sang 1/2 dặm")).toBe("từ 1 phần 4 sang 1 phần 2 dặm");
        expect(N("cỡ 36 x 24 mm")).toBe("cỡ 36 nhân 24 mm");
        expect(N("dạng 6x6 cm")).toBe("dạng 6 nhân 6 cm");
        expect(N("và/hoặc")).toBe("và/hoặc"); // word slashes untouched
    });

    test("Vietnamese era abbreviations expand BEFORE the initialism rule", () => {
        expect(N("năm 356 TCN vì")).toBe("năm 356 trước Công nguyên vì");
        expect(N("năm 1100 SCN.")).toBe("năm 1100 sau Công nguyên.");
        expect(N("Tháng CNTT Đài Bắc")).toBe("Tháng công nghệ thông tin Đài Bắc");
    });

    test("all-caps initialisms → Vietnamese letter names, not English phonemes", () => {
        expect(N("của FBI khi")).toBe("của ép bê i khi");
        expect(N("giờ GMT, hôm nay")).toBe("giờ giê em mờ tê, hôm nay");
        // English phonemes Vietnamese does not have are gone from the output
        expect(phonemize("của FBI khi", "vi")).not.toMatch(/[æʌɫɹθðʃ]/u);
        // attached to digits = an alphanumeric code, not an initialism
        expect(N("chuyến bay CG4684 của")).toBe("chuyến bay CG4684 của");
        // an all-caps DOCUMENT carries no signal
        expect(N("HAI MƯƠI NGƯỜI")).toBe("HAI MƯƠI NGƯỜI");
    });

    test("Roman numerals are resolved by the registry BEFORE this pass sees them", () => {
        // vi is not in ROMAN_NATIVE, so XIX is already 19 — the initialism rule must never spell it
        expect(phonemize("thế kỷ XIX", "vi")).toBe("tʰˈe˧˥ kˈi˧˩˧ mˈɨə˨˩j t͡ɕˈi˧˥n");
    });

    test("no clause pause is ever EMITTED by this pass, only consumed", () => {
        for (const s of ["40.000", "14,7", "9:30", "4:41,30", "2.4", "100-200", "1/4", "36 x 24"])
            expect(N(s)).not.toMatch(/[.,;:!?…]/u);
    });
});
