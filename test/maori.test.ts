import { describe, expect, test } from "vitest";

import { createMaori, phonemizeWord } from "../src/languages/maori/maori.ts";

// Māori (mi) — te reo Māori, Eastern Polynesian, New Zealand (~185k). One of the simplest orthographies anywhere:
// a near-1:1 phonemic map + the macron = length + two digraphs (⟨wh⟩→ɸ, ⟨ng⟩→ŋ). Strict CV syllables, no glide
// formation. Referee: wikipron mri_latn_broad (human) — the only misses are a non-Māori letter glyph. ⚠ Its two
// referees are the same Wiktionary tradition, so they are not independent of each other.
describe("Māori canonical IPA — direct phonemic g2p + macron length + the ⟨wh ng⟩ digraphs", () => {
    const mi = createMaori();

    test("the digraphs: ⟨wh⟩→[ɸ], ⟨ng⟩→[ŋ]", () => {
        expect(phonemizeWord("whenua")).toBe("ɸenua"); // ⟨wh⟩ → ɸ ("land")
        expect(phonemizeWord("whānau")).toBe("ɸaːnau"); // ⟨wh⟩→ɸ, macron ā→aː ("family")
        expect(phonemizeWord("ngā")).toBe("ŋaː"); // ⟨ng⟩ → ŋ, ā→aː (the plural article)
        expect(phonemizeWord("tangata")).toBe("taŋata"); // medial ⟨ng⟩ → ŋ ("person")
    });

    test("the macron = LENGTH; ⟨r⟩→[ɾ] tap; vowel sequences stay separate (no glides)", () => {
        expect(phonemizeWord("Māori")).toBe("maːoɾi"); // macron ā→aː, ⟨r⟩→ɾ
        expect(phonemizeWord("kāinga")).toBe("kaːiŋa"); // ā→aː, ⟨ng⟩→ŋ ("village")
        expect(phonemizeWord("Aotearoa")).toBe("aoteaɾoa"); // every vowel is its own mora (no diphthong merging)
        expect(phonemizeWord("Rotorua")).toBe("ɾotoɾua"); // ⟨r⟩ → ɾ (a place)
    });

    test("the simple consonants + short vowels", () => {
        expect(phonemizeWord("motu")).toBe("motu"); // ("island")
        expect(phonemizeWord("kia")).toBe("kia"); // ("be / let it")
        expect(phonemizeWord("haka")).toBe("haka"); // ("posture dance")
    });

    test("clause assembly", () => {
        expect(mi.text("Kia ora, e te whānau.").trim()).toBe("kia oɾa , e te ɸaːnau .");
    });
});

// Māori cardinal numbers (numbers.ts): the MODERN STANDARD tekau series (tekau mā tahi 11, rua tekau 20 — not the
// older ngahuru decade forms), with the additive particle mā introducing a bare unit digit and kotahi as the
// multiplier "one" before a magnitude (kotahi rau, kotahi mano). Sources cited in maori.jsonc + numbers.ts.
describe("Māori cardinal numbers", () => {
    const mi2 = createMaori();
    const say = (n: number): string => mi2.text(String(n)).trim();

    test("units and the tekau decades", () => {
        expect(say(0)).toBe("koɾe"); // kore
        expect(say(5)).toBe("ɾima"); // rima
        expect(say(20)).toBe("ɾua tekau"); // rua tekau
        expect(say(40)).toBe("ɸaː tekau"); // whā tekau (⟨wh⟩→ɸ, macron = length)
    });

    test("11-99: the additive particle mā (modern tekau mā tahi, not ngahuru)", () => {
        expect(say(11)).toBe("tekau maː tahi"); // tekau mā tahi
        expect(say(25)).toBe("ɾua tekau maː ɾima"); // rua tekau mā rima
        expect(say(99)).toBe("iwa tekau maː iwa"); // iwa tekau mā iwa
    });

    test("rau / mano / miriona — kotahi for a multiplier of 1; mā only before a bare unit", () => {
        expect(say(100)).toBe("kotahi ɾau"); // kotahi rau
        expect(say(101)).toBe("kotahi ɾau maː tahi"); // kotahi rau mā tahi (no tens → mā)
        expect(say(111)).toBe("kotahi ɾau tekau maː tahi"); // kotahi rau tekau mā tahi
        expect(say(555)).toBe("ɾima ɾau ɾima tekau maː ɾima"); // rima rau rima tekau mā rima
        expect(say(1000)).toBe("kotahi mano"); // kotahi mano
        expect(say(12345)).toBe("tekau maː ɾua mano toɾu ɾau ɸaː tekau maː ɾima"); // 12 345
        expect(say(1000000)).toBe("kotahi miɾiona"); // kotahi miriona
        expect(say(1000000000)).toBe("kotahi piɾiona"); // kotahi piriona
    });

    // ⚠ WITHOUT A NORMALIZATION LAYER, `text()` runs the tokenizer straight over raw input — and its classes
    // are letters, digits and clause marks, so `%`, `$` and every unit abbreviation are DELETED outright.
    // Every word emitted below is attested in mi_nz (1,994 unique utterances).
    test("the symbol tier: percent, currency, units and the powers", () => {
        const mi = createMaori();
        expect(mi.text("88%").trim()).toBe("waɾu tekau maː waɾu oːɾau");      // the % was dropped outright
        expect(mi.text("$5").trim()).toBe("ɾima taːɾa");
        expect(mi.text("50 km").trim()).toContain("kiɾomita");
        expect(mi.text("3850 km2").trim()).toContain("kiɾomita puːɾua");      // the corpus's own ASCII form
        expect(mi.text("120 m³").trim()).toContain("mita puːtoɾu");
        expect(mi.text("240 km/h").trim()).toContain("kiɾomita ia haːoɾa");
        expect(mi.text("133 m/s").trim()).toContain("mita ia heːkona");
        expect(mi.text("B&B").trim()).toContain("me");                        // ×2, the fleet's usual pair
    });

    // ⚠ THE THREE SI KEYS THIS LAYER USED TO LEAVE UNDECLARED, and two of them did not even leak visibly:
    // `10 mm` reached the IPA as the raw letters, but `10 l` came out `tekau ˈɛɫ` — the ENGLISH LETTER NAME,
    // routed there by `isNativeWord` failing on a letter Māori does not have — and `10 ha` as a bare `ha`.
    // Sources are Te Aka (`mirimita` noun, (loan) millimetre; `heketea` (loan) hectare; `rita` (loan) litre)
    // and Paekupu's Te Ine list, which pairs each with the symbol declared here.
    test("mm, ha and l — the SI keys, and the register that was NOT taken", () => {
        const mi = createMaori();
        // mi.wikipedia's own climate table: "E 688 mirimita te toharite o te ua o te tau".
        expect(mi.text("688 mm").trim()).toContain("miɾimita");
        // "200 heketea (2.0 km2; 490 eka)" — the wiki glosses the word against the symbol.
        expect(mi.text("200 ha").trim()).toContain("heketea");
        // ⚠ BOTH CASES: BIPM makes ⟨l⟩ and ⟨L⟩ equally official, and a one-letter key only resolves EXACTLY.
        expect(mi.text("10 l").trim()).toContain("ɾita");
        expect(mi.text("10 L").trim()).toContain("ɾita");
        // ⚠ AND THE COINED SERIES IS DELIBERATELY ABSENT. Paekupu gives mitamano (mm) / mitarau (cm) /
        // manomita (km); all three probe 0 token / 0 substring on mi.wikipedia, while the transliterations
        // kiromita ×38, mirimita ×2 and henimita ×1 are what running Māori writes. This layer already reads
        // ⟨km⟩ as kiromita, so the coined series would have to beat 38 counter-instances to be consistent.
        expect(mi.text("5 km").trim()).toContain("kiɾomita");
        expect(mi.text("5 km").trim()).not.toContain("manomita");
    });

    // ⚠ THE TRAPS, each one a word whose count BEATS the word that is right.
    test("the shape words and tāngata are not units", () => {
        const mi = createMaori();
        // tapawhā ×12 is a square as in a PLAZA — St Peter's Square — and tapatoru ×5 a triangle. Neither is
        // a power, and both outnumber pūtoru ×3.
        expect(mi.text("St. Pita Tapawhā").trim()).toContain("tapaɸaː");
        // `m/h` IS MILES per hour here ("35-40 m/h (56-64 km/h)"), so it is its own unit key: with only a
        // bare `m` plus an `h` denominator the tier read mph as METRES per hour.
        expect(mi.text("35 m/h").trim()).toContain("maeɾo ia haːoɾa");
        // A digit-adjacent `t` in this corpus is `1,400 tāngata` — 1,400 PEOPLE, not tonnes — and an
        // ASCII-classed guard would not reject it, because `ā` is not [a-zA-Z]. No `t` key is declared.
        expect(mi.text("1400 tāngata").trim()).toContain("taːŋata");
        // A magnitude must be declared or the currency word lands INSIDE the number.
        expect(mi.text("$2.3 piriona").trim()).toContain("piɾiona taːɾa");
    });
});
