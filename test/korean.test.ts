import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/korean/korean.ts";
import { normalizeKorean } from "../src/languages/korean/normalize.ts";

describe("Korean Hangul g2p + sandhi", () => {
    it("core words + coda neutralisation (unreleased ̚)", () => {
        expect(phonemizeWord("한국")).toBe("hˈɐnɡuk̚"); // ㄱ→ɡ after nasal; coda ㄱ→k̚
        expect(phonemizeWord("밥")).toBe("pˈɐp̚"); // coda ㅂ→p̚ unreleased
        expect(phonemizeWord("꽃")).toBe("k͈ˈot̚"); // ㄲ tense onset; ㅊ coda→t̚
        expect(phonemizeWord("값")).toBe("kˈɐp̚"); // ㅄ cluster coda→p̚
        expect(phonemizeWord("서울")).toBe("sɘˈuɭ"); // stress on the heavy 2nd syllable; ㄹ coda→ɭ
    });

    it("cross-syllable sandhi", () => {
        expect(phonemizeWord("가다")).toBe("kˈɐdɐ"); // lenis ㄷ voices intervocalically → d
        expect(phonemizeWord("학교")).toBe("hˈɐk̚k͈jo"); // tensification: k̚ + ㄱ → k͈
        expect(phonemizeWord("국물")).toBe("kˈuŋmuɭ"); // nasalization: ㄱ before ㅁ → ŋ
        expect(phonemizeWord("독립")).toBe("tˈoŋnip̚"); // ㄱ→ŋ, ㄹ→n
        expect(phonemizeWord("신라")).toBe("sˈiɭɭɐ"); // lateralization: ㄴㄹ → ll
        expect(phonemizeWord("좋다")).toBe("t͡ɕˈotʰɐ"); // aspiration: ㅎ + ㄷ → tʰ
        expect(phonemizeWord("놓고")).toBe("nˈokʰo"); // aspiration: ㅎ + ㄱ → kʰ
        expect(phonemizeWord("국이")).toBe("kˈuɡi"); // liaison + voicing: ㄱ → onset ɡ
        expect(phonemizeWord("같이")).toBe("kˈɐt͡ɕʰi"); // liaison + palatalization: ㅌ+이 → t͡ɕʰ
    });

    it("stress = first heavy (closed) syllable, else first", () => {
        expect(phonemizeWord("사람")).toBe("sɐɾˈɐm"); // open + closed → stress 2nd
        expect(phonemizeWord("하나")).toBe("hˈɐnɐ"); // open + open → stress 1st
    });

    it("lexical tensification (경음화) — Sino-Korean §26 / loanword, native stays lenis", () => {
        expect(phonemizeWord("갈등")).toBe("kˈɐɭt͈ɯŋ"); // Sino-Korean ㄹ+ㄷ → tense
        expect(phonemizeWord("물질")).toBe("mˈuɭt͡ɕ͈iɭ"); // ㄹ+ㅈ → tense
        expect(phonemizeWord("알다")).toBe("ˈɐɭdɐ"); // native ㄹ+ㄷ → stays LENIS (no over-tensing)
    });

    it("numbers (Sino-Korean)", () => {
        expect(phonemize("10", "ko")).toBe("sˈip̚");
        expect(phonemize("100", "ko")).toBe("p͈ˈɛk̚"); // 백 is lexically tense (loanword-initial 경음화)
    });
});

// text normalization. Corpus counts in src/languages/korean/normalize.ts's header; the assertions
// below are the DEFECTS that layer removes, one per rule, phrased as what the engine used to produce.
describe("Korean text normalization", () => {
    it("a number fused to its counter, so the sandhi crosses the boundary", () => {
        // Each of these was two separately phonemized tokens, with no sandhi between them at all.
        expect(normalizeKorean("17일")).toBe("십칠일");
        expect(phonemize("17일", "ko")).toBe("sˈip̚t͡ɕʰiɾiɭ"); // was `sˈip̚t͡ɕʰiɭ ˈiɭ` — no liaison
        expect(phonemize("100년", "ko")).toBe("pˈɛŋnjɘn"); // was `p͈ˈɛk̚ nˈjɘn` — no ㄱ→ŋ nasalization
        expect(phonemize("6개월", "ko")).toBe("ˈjuk̚k͈ɛwɘɭ"); // was `ˈjuk̚ kɛˈwɘɭ` — no tensification
    });

    it("the June / October irregulars, which the Sino compositor cannot derive", () => {
        expect(normalizeKorean("6월")).toBe("유월"); // never 육월
        expect(normalizeKorean("10월")).toBe("시월"); // never 십월
        expect(normalizeKorean("7월")).toBe("칠월"); // the regular case still composes
    });

    it("native-series counters, and the Sino ones they must not claim", () => {
        expect(normalizeKorean("3명의")).toBe("세명의"); // was 삼 명
        expect(normalizeKorean("11시 20분")).toBe("열한시 이십분"); // hour native, minute Sino
        expect(normalizeKorean("20명")).toBe("스무명"); // 20 alone is 스무, not 스물
        expect(normalizeKorean("37번째")).toBe("서른일곱번째");
        expect(normalizeKorean("56가지")).toBe("쉰여섯가지");
        expect(normalizeKorean("100명")).toBe("백명"); // ≥100 has no native form
        expect(normalizeKorean("6개월")).toBe("육개월"); // 개월 is Sino — not 여섯 개월
        expect(normalizeKorean("7개국")).toBe("칠개국"); // 개국 is Sino — not 일곱 개국
        expect(normalizeKorean("제5시드국")).toBe("제오시드국"); // 시 here is not the hour counter
        expect(normalizeKorean("20대의")).toBe("이십대의"); // 대 is Sino in every corpus instance
    });

    it("grouped thousands — the comma was clause punctuation", () => {
        expect(normalizeKorean("1,000명이")).toBe("천명이");
        expect(phonemize("1,000명이", "ko")).toBe("t͡ɕʰˈɘnmjɘŋi"); // was `ˈiɭ , ˈjɘŋ mˈjɘŋi`
        expect(normalizeKorean("24,000개")).toBe("이만사천개");
    });

    it("decimals — the point was clause punctuation, and the fraction is read digit by digit", () => {
        expect(normalizeKorean("7.75")).toBe("칠점칠오"); // never 칠점칠십오
        expect(normalizeKorean("1.5킬로미터")).toBe("일점오킬로미터");
    });

    it("ranges, but only the unambiguous marks", () => {
        expect(normalizeKorean("1894~1895년")).toBe("천팔백구십사에서 천팔백구십오년");
        expect(normalizeKorean("10–60분")).toBe("십에서 육십분");
        expect(normalizeKorean("5-3으로")).toBe("5-삼으로"); // ASCII hyphen left: this one is a score
    });

    it("units, including the ones Korean writes a particle onto", () => {
        expect(normalizeKorean("2~3km의")).toBe("이에서 삼킬로미터의");
        expect(normalizeKorean("83m이고")).toBe("팔십삼미터이고");
        expect(normalizeKorean("802.11g가")).toBe("팔백이점일일g가"); // g is NOT the gram unit here
        expect(normalizeKorean("3136 mm2")).toBe("삼천백삼십육제곱밀리미터");
    });

    it("speed units carry 시속 / 초속 in front, over a whole range, and never twice", () => {
        // The whole hyphenated span is claimed in ONE match, so 시속 lands in front of the range and
        // not between its endpoints — that is why rule 2 runs before rule 5. The hyphen itself stays
        // unread (see the header); only the second endpoint is fused to the unit by rule 8.
        expect(normalizeKorean("35-40 mph")).toBe("시속 35-사십마일");
        expect(normalizeKorean("2~3 mph")).toBe("시속 이에서 삼마일");
        expect(normalizeKorean("83km/h의")).toBe("시속 팔십삼킬로미터의");
        expect(normalizeKorean("133m/s")).toBe("초속 백삼십삼미터");
        expect(normalizeKorean("시속 160km/h")).toBe("시속 백육십킬로미터"); // not 시속 1시속 60…
    });

    it("degrees", () => {
        expect(normalizeKorean("30°C")).toBe("섭씨 삼십도");
        expect(normalizeKorean("35°W")).toBe("삼십오도더블유"); // no 서경 invented for the bearing
    });

    it("initialisms are spelled with HANGUL letter names, not sent to English", () => {
        // Before: FBI → `ˈɛfbˈiːʲˈaᶦ`, CCTV → `sˈiːsiːtʰˈiːvˌiː` — æ/ɹ/v/f are not in Korean's inventory.
        expect(normalizeKorean("FBI는")).toBe("에프비아이는");
        expect(normalizeKorean("CCTV")).toBe("씨씨티브이");
        expect(normalizeKorean("W. 부시")).toBe("더블유. 부시"); // isolated capital
        expect(normalizeKorean("UN")).toBe("유엔"); // lexical word-reading, not 유에누
        expect(phonemize("FBI는", "ko")).toBe("epʰɯbiɐinˈɯn");
    });

    it("mixed-case Latin is deliberately left to the English fallback", () => {
        // Loanword Hangul is lexical and unguessable from spelling; ZMapp is not 즈맵.
        expect(normalizeKorean("ZMapp")).toBe("ZMapp");
        expect(normalizeKorean("TogiNet Radio")).toBe("TogiNet Radio");
    });
});
