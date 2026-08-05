import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { normalizeKazakh } from "../src/languages/kazakh/normalize.ts";
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

// TEXT NORMALIZATION (src/languages/kazakh/normalize.ts) — the pre-tokenizer pass behind #562. The
// DEFINING rule (trap 14 (agreement cannot be applied to digits)) is the case suffix after a digit: the suffix must AGREE with the word via vowel
// harmony (200-ге → екі жүзге, 11:00-ден → он бірден), so the number is wordified first. Also the
// N-ші/N-шы ordinals, space-thousands, comma-decimals, and the б.д.д. era marker.
describe("Kazakh text normalization", () => {
    const ph = (s: string): string => phonemize(s, "kk").trim();

    it("text→text: the N-ші ordinal and the N-case-suffix read as words with harmony", () => {
        expect(normalizeKazakh("190-шы орын")).toBe("жүз тоқсаныншы орын");
        expect(ph("60-шы гол")).toBe("ˈɑɫpəsənʃə ɡˈoɫ"); // алпысыншы
        expect(ph("1-ші")).toBe("bɪrɪnʃˈɪ"); // бірінші
        expect(ph("200-ге")).toBe("jekˈɪ ʒʏzɡˈe"); // екі жүзге (dative on жүз)
        expect(ph("80-нен")).toBe("seksennˈen"); // сексеннен (nasal ablative)
        expect(ph("60-тан")).toBe("ˈɑɫpəstɑn"); // алпыстан (voiceless ablative)
        expect(ph("1000-нан")).toBe("bˈɪr məŋnˈɑn"); // бір мыңнан (nasal)
    });

    // A COMPOUND NUMERAL IS TWO WORDS in Kazakh — он бес, жиырма тоғыз. The layer's own orthographic
    // composer glued them, so every case-suffixed compound and every compound clock read as a word the
    // language does not have (*онбеске, *жиырматоғызда, *онбірден).
    it("a compound numeral keeps its space, and the suffix lands on the last word", () => {
        expect(normalizeKazakh("15-ке")).toBe("он беске");
        expect(normalizeKazakh("29-да")).toBe("жиырма тоғызда");
        expect(normalizeKazakh("11:00-ден")).toBe("он бірден");
        expect(normalizeKazakh("11000-нан")).toBe("он бір мыңнан");
    });

    // `N-НОУН` is the ordinal writing with the noun spelled out — 13 corpus instances the case-suffix
    // rule could not see, because the tail is a WORD rather than an ending.
    it("N-noun reads the ordinal and keeps the noun", () => {
        expect(normalizeKazakh("8-ғасырдан")).toBe("сегізінші ғасырдан");
        expect(normalizeKazakh("20-ғасырдың")).toBe("жиырмасыншы ғасырдың");
        expect(normalizeKazakh("2016-жылы")).toBe("екі мың он алтыншы жылы"); // a four-digit ordinal
        expect(normalizeKazakh("247-бабына")).toBe("екі жүз қырық жетінші бабына");
        expect(normalizeKazakh("15-і")).toBe("он бесі"); // the date possessive, not an ordinal
        expect(normalizeKazakh("1000-шы")).toBe("1000-шы"); // a round thousand still declines (мыңыншы)
    });

    it("clocks read the h-less colon form, incl. the case suffix", () => {
        expect(ph("08:46")).toBe("seɡˈɪz qˈərəq ˈɑɫtə");
        expect(ph("13:15")).toBe("ˈon ˈʏʃ ˈon bˈes");
        expect(ph("11:00-ден")).toBe("ˈon bɪrdˈen"); // он бірден
        expect(ph("9:30-да")).toBe("tˈoʁəz ˈotəzdɑ"); // тоғыз отызда
    });

    it("space-thousands de-group; comma-decimals read бүтін; rates use сағат", () => {
        expect(ph("17 000")).toBe("ˈonʒˈetɪ mˈəŋ");
        expect(ph("5 000 000")).toBe("bˈes məjlɫəjˈon");
        expect(ph("2,3 миллиард")).toBe("jˈekɪ bʏtˈɪn ˈʏʃ mˈəjɫɫəjɑrd");
        expect(ph("83 км/сағ")).toBe("seksˈen ˈʏʃ kəjlomˈetr sɑʁˈɑt");
        expect(ph("160 км/сағ-қа")).toBe("ʒˈʏz ˈɑɫpəs kəjlomˈetr sɑʁɑtqˈɑ"); // сағатқа
        // trap pins: the dot-version (802.11n), the Figure dot (1.1), the dot-clock (15.00 UTC)
        expect(ph("802.11n")).toBe("seɡˈɪz ʒˈʏz jekˈɪ nʏktˈe ˈon bˈɪr ˈɛn");
        expect(ph("1.1 суретті")).toBe("bˈɪr nʏktˈe bˈɪr swrettˈɪ");
        expect(ph("15.00 UTC")).toBe("ˈon bˈes jˈuː tʰˈiː sˈiː");
        // the 4-digit ordinal is corpus-absent and must not emit a fused guess
        expect(normalizeKazakh("1000-ші")).toBe("1000-ші");
    });

    it("era markers, degrees, roman ordinals and percent read their Kazakh words", () => {
        expect(ph("б.д.д. 356 жылы")).toBe("bɪzdˈɪŋ dæwɪrɡˈe dejˈɪn ˈʏʃʒˈʏz jˈelwˈɑɫtə ʒˈəɫə");
        expect(ph("+ 30 °C-тан")).toBe("pɫjˈus ˈotəz ɡrˈɑdws t͡sˈelʔsəjjden"); // цельсийден
        expect(ph("35°W")).toBe("ˈotəz bˈes ɡrˈɑdws bˈɑtəs"); // градус батыс
        expect(ph("XVI ғасырда")).toBe("ˈon ˈɑɫtənʃə ʁˈɑsərdɑ"); // он алтыншы ғасырда
        expect(ph("80%")).toBe("seksˈen pˈɑjəz");
        expect(ph("UTC + 1")).toBe("jˈuː tʰˈiː sˈiː pɫjˈus bˈɪr");
    });

    // #586 — `шаршы километр` ×8 and `текше метр` ×2, word-first. The measure word does not inflect: the
    // corpus's `2,2 миллион шаршы километріне` carries the dative on the HEAD noun, so one form suffices.
    it("the squared/cubed measure word (#586)", () => {
        expect(phonemize("2,2 km²", "kk")).toContain("ʃˈɑrʃə kəjlomˈetr");
        expect(phonemize("120 m³", "kk")).toContain("tekʃˈe mˈetr");
    });

    // #586 — THE NUMERO SIGN was dropped: «№ 11 ғарышкер» read as *он бір ғарышкер*. `нөмір` ×1 here, and the
    // same corpus writes the same content the other way round — `1 және 2 нөмірлі реакторлар`, the postposed
    // adjectival form, which suits a different construction than a preposed sign.
    // ⚠ One instance of each: acted on because the alternative is a silently dropped sign.
    it("the numero sign reads нөмір (#586)", () => {
        expect(phonemize("«№ 11 ғарышкер»", "kk")).toContain("nɵmˈɪr ˈonbˈɪr");
    });
});
