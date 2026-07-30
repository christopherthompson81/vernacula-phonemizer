import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/kazakh/kazakh.ts";
import { ROMAN_POLICY } from "../src/languages/kazakh/romanOrdinals.ts";

describe("Kazakh Cyrillic g2p", () => {
    it("core words, vowels, canonical relabels", () => {
        const cases: [string, string][] = [
            ["Қазақстан", "qɑzɑqstˈɑn"], // қ → q, а → ɑ
            ["мен", "mˈen"],
            ["ғылым", "ʁˈəɫəm"], // ғ → ʁ, ы → ə
            ["тоғыз", "tˈoʁəz"],
            ["хат", "χˈɑt"], // х → χ
            ["түрі", "tʏrˈɪ"], // ү → ʏ, і → ɪ
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    it("л vowel harmony (dark ɫ in back words, clear l in front)", () => {
        expect(phonemizeWord("қол")).toBe("qˈoɫ"); // back word → dark ɫ
        expect(phonemizeWord("алма")).toBe("ɑɫmˈɑ");
        expect(phonemizeWord("тіл")).toBe("tˈɪl"); // front vowel ɪ → clear l
        expect(phonemizeWord("Солтүстік")).toBe("soltʏstˈɪk"); // ʏ/ɪ front → all l
    });

    it("glides and word-initial е → je", () => {
        expect(phonemizeWord("ел")).toBe("jˈel"); // word-initial е → je (stress on the vowel)
        expect(phonemizeWord("кино").replace(/ˈ/u, "")).toBe("kəjno"); // и → əj (кино is loan-stressed by espeak; assert the segment)
        expect(phonemizeWord("тау")).toBe("tˈɑw"); // у → glide w
    });

    it("stress: espeak STRESSPOSN_1RU (last syllable before the first reduced ы→ə)", () => {
        expect(phonemizeWord("Санат")).toBe("sɑnˈɑt"); // no reduced vowel → final
        expect(phonemizeWord("бойынша")).toBe("bˈojənʃɑ"); // ы between full vowels pulls stress left
        expect(phonemizeWord("коды")).toBe("kˈodə");
    });

    it("initial-cluster epenthesis and abbreviation letter-spelling", () => {
        expect(phonemizeWord("стратегия")).toBe("sətrɑtˈeɡəjja"); // ≥3 initial consonants → schwa after the first
        expect(phonemizeWord("км")).toBe("kəmˈə"); // consonant-only token → each letter named Cə
        expect(phonemizeWord("РФ")).toBe("rəfˈə");
    });

    it("cardinal numbers", () => {
        expect(phonemize("5", "kk")).toBe("bˈes");
        expect(phonemize("21", "kk")).toBe("ʒəjərmˈɑbˈɪr");
        expect(phonemize("100", "kk")).toBe("ʒˈʏz");
        expect(phonemize("1000", "kk")).toBe("bˈɪr mˈəŋ");
    });
});

// Roman-numeral ORDINAL policy (src/languages/kazakh/romanOrdinals.ts). A century is an ordinal: XIX ғасыр →
// он тоғызыншы ғасыр, attested in Kazakh academic titles ("Он тоғызыншы ғасыр зерттеушілерінің…") and in an
// English–Kazakh dictionary gloss. Tables rather than a suffixing rule, because the tens are irregular
// (жиырмасыншы, қырқыншы) and this language's number manifest holds IPA, not orthography.
describe("Kazakh roman-numeral ordinals", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal?.(n);

    it("ordinal words, incl. the irregular tens; only the last element is suffixed", () => {
        expect(ord(1)).toBe("бірінші");
        expect(ord(9)).toBe("тоғызыншы");
        expect(ord(19)).toBe("он тоғызыншы");
        expect(ord(20)).toBe("жиырмасыншы"); // irregular epenthetic -с-
        expect(ord(21)).toBe("жиырма бірінші");
        expect(ord(40)).toBe("қырқыншы"); // қырық loses its second vowel
        expect(ord(50)).toBe("елуінші");
        expect(ord(63)).toBe("алпыс үшінші"); // past 50 — anniversary / congress range
        expect(ord(100)).toBe("жүзінші");
        expect(ord(101)).toBeUndefined(); // out of range → the caller falls back to the cardinal
    });

    it("context matches the agglutinated century forms (unanchored)", () => {
        for (const w of ["ғасыр", "ғасырда", "ғасырдың", "ғасырлар", "ғасырға", "мыңжылдық", "съезд", "сынып"])
            expect(ROMAN_POLICY.ordinalAfter?.test(w)).toBe(true);
        expect(ROMAN_POLICY.ordinalAfter?.test("ғалым")).toBe(false);
    });

    it("the ordinal reading phonemizes in context", () => {
        expect(phonemize("он тоғызыншы ғасыр", "kk").trim()).toBe("ˈon tˈoʁəzənʃə ʁˈɑsər");
        expect(phonemize("елуінші съезд", "kk").trim()).toBe("jelwɪnʃˈɪ sʔˈezd");
    });

    it("a bare roman numeral still reads as a CARDINAL", () => {
        expect(phonemize("xix", "kk").trim()).toBe("ˈontˈoʁəz"); // он тоғыз, not он тоғызыншы
    });
});
