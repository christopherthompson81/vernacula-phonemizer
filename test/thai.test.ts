import { describe, expect, it, test } from "vitest";
import { phonemizeWord } from "../src/languages/thai/thai.ts";
import { phonemize } from "../src/index.ts";

describe("Thai g2p (ported syllabifier + native IPA render)", () => {
    it("monosyllables: onset, vowel length, coda, computed tone", () => {
        expect(phonemizeWord("ดี")).toBe("dˈiː˧"); // mid tone (live, mid class)
        expect(phonemizeWord("กิน")).toBe("kˈi˧n");
        expect(phonemizeWord("ข้าว")).toBe("kʰˈaː˥˩w"); // falling (high class + mai tho)
        expect(phonemizeWord("หมา")).toBe("mˈaː˩˩˦"); // rising (silent ห raises low ม → high)
        expect(phonemizeWord("ไทย")).toBe("tʰˈa˧j"); // diphthong aj, silent ย
    });

    it("multi-syllable segmentation + minor-syllable glottal suppression", () => {
        expect(phonemizeWord("เวลา")).toBe("wˈeː˧laː˧"); // เ–ว reorder, 2 syllables
        expect(phonemizeWord("ประเทศ")).toBe("prˈa˨˩tʰeː˥˩t"); // ประ minor syllable → no glottal
        expect(phonemizeWord("สวัสดี")).toBe("sˈa˨˩wa˨˩tdˌiː˧"); // 3 syllables → ˌ on the last
    });

    it("dictionary of irregulars (Chao notation), rules can't derive", () => {
        expect(phonemizeWord("ได้")).toBe("dˈaː˥˩j"); // long ai irregular
        expect(phonemizeWord("สร้าง")).toBe("sˈaː˥˩ŋ"); // silent ร (Sanskrit)
        expect(phonemizeWord("ใคร")).toBe("kʰrˈa˧j"); // cluster under leading vowel
        expect(phonemizeWord("เงิน")).toBe("ŋˈɤ˧n"); // short เ–ิ exception
    });

    it("secondary stress on even nuclei (3,5,…); glottal on a final short open syllable", () => {
        expect(phonemizeWord("เกิด")).toBe("kˈɤː˨˩t"); // เ–ิ+coda → ɤː long (rule)
        expect(phonemizeWord("ณ")).toBe("nˈa˦˥ʔ"); // standalone letter → glottal
    });

    it("word segmentation: a compound token splits into words (space-separated)", () => {
        expect(phonemizeWord("ก็คือ")).toBe("kˈɔː˨˩ kʰˈɯː˧"); // ก็ + คือ
        expect(phonemizeWord("ไม่ว่า")).toBe("mˈa˥˩j wˈaː˥˩"); // ไม่ + ว่า
    });

    it("word-internal kr/pr/tr cluster (ר), not stranded as a coda ר→น", () => {
        // Rule 3's schwa-deletion must not steal ר's cluster schwa: กรมการ → krom·kaːn, not kon·ma·kaːn.
        expect(phonemizeWord("กรม")).toBe("krˈo˧m"); // krom (standalone, already worked)
        expect(phonemizeWord("ตรงนั้น")).toBe("trˈo˧ŋna˦˥n"); // troŋ·nan (was ton·ŋa·nan)
        expect(phonemizeWord("ผลกระทบ")).toBe("pʰˈo˩˩˦nkra˨˩tʰˌo˦˥p"); // ผล→pʰon (ל coda) but กร→kra cluster
        expect(phonemizeWord("ผลงาน")).toBe("pʰˈo˩˩˦nŋaː˧n"); // ל stays a coda (pʰon), NOT clustered
    });
});

// Numbers (found by the #562 impact audit): the tokenizer matched (\d+) but NO branch consumed it — every
// digit run in Thai text was silently dropped, and 23.4% of FLEURS th_th utterances contain digits. The
// compositor emits Thai-script words (each kaikki-attested with IPA) through the ordinary g2p.
describe("Thai numbers", () => {
    test("digits are read, not dropped", () => {
        expect(phonemize("5", "th")).toBe("hˈaː˥˩");
        expect(phonemize("25", "th")).toBe("jˈiː˥˩si˨˩p hˈaː˥˩"); // ยี่สิบ, not สองสิบ
        expect(phonemize("21", "th")).toContain("ʔˈe˨˩t"); // final 1 = เอ็ด
        expect(phonemize("1998", "th")).toBe("nˈɯ˨˩ŋ pʰˈa˧n kˈaː˥˩w rˈɔː˦˥j kˈaː˥˩w sˈi˨˩p pˈɛː˨˩t");
        expect(phonemize("10000", "th")).toContain("mˈɯː˨˩n"); // หมื่น 10⁴ is its own word
    });
});

// #562 TEXT NORMALIZATION (src/languages/thai/normalize.ts). The count in each `test` name is instances in
// the FLEURS th_th corpus (1,906 unique utterances, column 3); the comment on a line is what the engine
// produced BEFORE the layer existed.
describe("Thai text normalization (#562)", () => {
    test("ๆ maiyamok repeats the preceding WORD (351 instances / 318 utterances)", () => {
        // was "tˈaː˨˩ŋ" — the reduplication was silently dropped
        expect(phonemize("ต่าง ๆ", "th")).toBe("tˈaː˨˩ŋ tˈaː˨˩ŋ");
        // unspaced was WORSE: "tˈaː˨˩ŋaː˧" — ๆ is in the Thai block and became a spurious syllable
        expect(phonemize("ต่างๆ", "th")).toBe("tˈaː˨˩ŋ tˈaː˨˩ŋ");
        // the antecedent is a WORD, not everything back to the last space: repeat ต่าง, not สิ่งต่าง
        expect(phonemize("สิ่งต่าง ๆ ที่", "th")).toBe("sˈi˨˩ŋ tˈaː˨˩ŋ tˈaː˨˩ŋ tʰˈiː˥˩");
    });

    test("ฯ paiyannoi (13): ฯลฯ = และอื่น ๆ, and a bare ฯ is silent", () => {
        expect(phonemize("ฯลฯ", "th")).toBe("lˈɛ˦˥ʔ ʔˈɯː˨˩n ʔˈɯː˨˩n"); // was "lˈaː˧"
        // ฯ used to corrupt its host word's syllabification: สหรัฐฯ → "sˈo˨˩ra˨˩tʰˌaː˩˩˦"
        expect(phonemize("สหรัฐฯ", "th")).toBe(phonemize("สหรัฐ", "th"));
    });

    test("grouped thousands (53): the comma is grouping, not a clause pause", () => {
        // was "nˈɯ˨˩ŋ , sˈɔː˩˩˦ŋ rˈɔː˦˥j …" — a PAUSE, and the number read in two halves
        expect(phonemize("1,234", "th")).toBe(phonemize("1234", "th"));
        expect(phonemize("1,234", "th")).not.toContain(",");
        expect(phonemize("12,000", "th")).toBe(phonemize("12000", "th"));
    });

    test("decimals (41): the point is จุด and the fraction is spelled digit by digit", () => {
        expect(phonemize("3.5", "th")).toBe("sˈaː˩˩˦m t͡ɕˈu˨˩t hˈaː˥˩"); // was "sˈaː˩˩˦m . hˈaː˥˩"
        // 802.11 is จุดหนึ่งหนึ่ง, never จุดสิบเอ็ด
        expect(phonemize("802.11", "th")).toBe(
            `${phonemize("802", "th")} t͡ɕˈu˨˩t nˈɯ˨˩ŋ nˈɯ˨˩ŋ`,
        );
    });

    test("clock (17): HH.MM น. → นาฬิกา / นาที, and only WITH the น.", () => {
        // was "kˈaː˥˩w . sˈaː˩˩˦m sˈi˨˩p nˈa˦˥ʔ ." — a pause mid-clock, then นาฬิกา read as "naʔ" + pause
        expect(phonemize("09.30 น.", "th")).toBe(
            "kˈaː˥˩w nˈaː˧li˦˥kˌaː˧ sˈaː˩˩˦m sˈi˨˩p nˈaː˧tʰiː˧",
        );
        expect(phonemize("11.00 น.", "th")).toBe("sˈi˨˩p ʔˈe˨˩t nˈaː˧li˦˥kˌaː˧"); // :00 → no นาที
        expect(phonemize("23:35 น.", "th")).toContain("nˈaː˧li˦˥kˌaː˧"); // the one colon-written time
        expect(phonemize("ราว 5 น.", "th")).toBe("rˈaː˧w hˈaː˥˩ nˈaː˧li˦˥kˌaː˧"); // bare hour
        // WITHOUT น. it is not a time — 802.11n and 6.34 นิ้ว and 3.50 เมตร are decimals
        expect(phonemize("6.34", "th")).toContain("t͡ɕˈu˨˩t");
        expect(phonemize("6.34", "th")).not.toContain("nˈaː˧li˦˥kˌaː˧");
    });

    test("Thai unit abbreviations (45), only when a number is adjacent", () => {
        expect(phonemize("220 กม.", "th")).toContain("kˈi˨˩loː˧mˌeː˦˥t"); // was "kˈo˧m ." — nonsense + pause
        expect(phonemize("90 กก.", "th")).toContain("kˈi˨˩loː˧krˌa˧m");
        expect(phonemize("100 ม.", "th")).toContain("mˈeː˦˥t");
        expect(phonemize("165 กม./ชม.", "th")).toContain("tˈɔː˨˩"); // the unit slash IS read, as ต่อ
        expect(phonemize("19500 ตร.กม.", "th")).toContain("tˈaː˧raː˧ŋ"); // two-dot form wins over กม.
        expect(phonemize("220 กม.", "th")).not.toContain("."); // the abbreviation dot is not a pause
    });

    test("era markers and titles: ค.ศ. (21), พ.ศ. (14), ดร. (6)", () => {
        // was "kʰˈa˦˥ʔ . sˈa˨˩ʔ ." — two nonsense syllables and two spurious pauses
        expect(phonemize("ค.ศ. 1776", "th")).toContain("kʰrˈi˦˥tsa˨˩kkˌa˨˩raː˨˩t");
        expect(phonemize("พ.ศ. 2520", "th")).toContain("pʰˈu˦˥ttʰa˦˥sˌa˨˩kka˨˩rˌaː˨˩t");
        expect(phonemize("ดร. ลี", "th")).toContain("dˈɔ˦˥ktɤː˥˩");
        expect(phonemize("ค.ศ. 1776", "th")).not.toContain(".");
    });

    test("all-caps Latin (93) is spelled with THAI letter names, not English phonemes", () => {
        expect(phonemize("GPS", "th")).toBe("t͡ɕˈiː˧ pʰˈiː˧ ʔˈeː˨˩t"); // was "d͡ʒˈiː pʰˈiː ˈɛs"
        expect(phonemize("NASA", "th")).not.toMatch(/[æʌɫɹ]/u); // was "nˈæsə" — æ is not in the inventory
        expect(phonemize("XDR-TB", "th")).not.toMatch(/[æʌɫɹ]/u); // the hyphen splits it into two initialisms
        // mixed-case Latin is deliberately LEFT to the English fallback (no sourced Thai loanword lexicon)
        expect(phonemize("Google", "th")).toBe("ɡˈuːɡəɫ");
    });

    test("degree sign (2)", () => {
        expect(phonemize("30°C", "th")).toContain("ʔˈo˧ŋsaː˩˩˦sˌeː˧nsia˥˩t"); // C was reading as English "siː"
        expect(phonemize("35°", "th")).toContain("ʔˈo˧ŋsaː˩˩˦");
    });

    test("a Thai space is a token boundary, never a pause — no rule may emit a clause mark", () => {
        expect(phonemize("ไทย ไทย", "th")).toBe("tʰˈa˧j tʰˈa˧j");
        const forms = ["สิ่งต่าง ๆ ที่", "1,234", "3.5", "220 กม.", "ค.ศ. 1776", "GPS", "30°C"];
        for (const s of forms)
            expect(phonemize(s, "th")).not.toMatch(/(?:^|\s)[.,;:](?:\s|$)/u);
    });

    test("Thai digits ๐-๙ fold to ASCII (zero in the corpus; the number path is ASCII-only)", () => {
        expect(phonemize("๒๕", "th")).toBe(phonemize("25", "th"));
    });
});
