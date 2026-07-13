import { describe, expect, it } from "vitest";
import { phonemizeWord } from "./thai.ts";

describe("Thai g2p (ported syllabifier + native IPA render)", () => {
  it("monosyllables: onset, vowel length, coda, computed tone", () => {
    expect(phonemizeWord("ดี")).toBe("dˈiː˧");      // mid tone (live, mid class)
    expect(phonemizeWord("กิน")).toBe("kˈi˧n");
    expect(phonemizeWord("ข้าว")).toBe("kʰˈaː˥˩w");  // falling (high class + mai tho)
    expect(phonemizeWord("หมา")).toBe("mˈaː˩˩˦");    // rising (silent ห raises low ม → high)
    expect(phonemizeWord("ไทย")).toBe("tʰˈa˧j");     // diphthong aj, silent ย
  });

  it("multi-syllable segmentation + minor-syllable glottal suppression", () => {
    expect(phonemizeWord("เวลา")).toBe("wˈeː˧laː˧");            // เ–ว reorder, 2 syllables
    expect(phonemizeWord("ประเทศ")).toBe("prˈa˨˩tʰeː˥˩t");     // ประ minor syllable → no glottal
    expect(phonemizeWord("สวัสดี")).toBe("sˈa˨˩wa˨˩tdˌiː˧");   // 3 syllables → ˌ on the last
  });

  it("dictionary of irregulars (Chao notation), rules can't derive", () => {
    expect(phonemizeWord("ได้")).toBe("dˈaː˥˩j");   // long ai irregular
    expect(phonemizeWord("สร้าง")).toBe("sˈaː˥˩ŋ"); // silent ร (Sanskrit)
    expect(phonemizeWord("ใคร")).toBe("kʰrˈa˧j");   // cluster under leading vowel
    expect(phonemizeWord("เงิน")).toBe("ŋˈɤ˧n");    // short เ–ิ exception
  });

  it("secondary stress on even nuclei (3,5,…); glottal on a final short open syllable", () => {
    expect(phonemizeWord("เกิด")).toBe("kˈɤː˨˩t");  // เ–ิ+coda → ɤː long (rule)
    expect(phonemizeWord("ณ")).toBe("nˈa˦˥ʔ");      // standalone letter → glottal
  });
});
