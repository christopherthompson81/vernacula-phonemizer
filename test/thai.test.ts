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
