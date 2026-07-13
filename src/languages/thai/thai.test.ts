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
});
