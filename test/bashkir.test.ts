import { describe, expect, test } from "vitest";

import { phonemizeWord, phonemizeWordNative, isRussianLoan } from "../src/languages/bashkir/bashkir.ts";
import { getPhonemizer } from "../src/registry.ts";
import { normalizeBashkir } from "../src/languages/bashkir/normalize.ts";
import { ROMAN_POLICY } from "../src/languages/bashkir/romanOrdinals.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Bashkir (ba) — Башҡорт теле, Kipchak Turkic (sibling of Tatar), CYRILLIC. Signatures:
// the INTERDENTAL fricatives ⟨ҫ⟩→[θ], ⟨ҙ⟩→[ð] (Bashkir's hallmark); the WRITTEN uvulars ⟨ҡ⟩→[q], ⟨ғ⟩→[ʁ] (no harmony
// inference — unlike Tatar); the Bashkir VOWEL SHIFT ⟨о⟩→[ʊ], ⟨ө⟩→[ø], ⟨ы⟩→[ɯ], ⟨е⟩→[ɪ]; dark ⟨л⟩→[ɫ] (back harmony);
// ⟨у ү⟩→[w] after a vowel. Real Bashkir text is loan-heavy → a detected RUSSIAN LOAN (vowel-harmony violation) is
// routed to the Russian g2p. Referee: kaikki Bashkir (REFEREE-LIMITED by Russian loans).
describe("Bashkir (Башҡорт теле) canonical IPA", () => {
    test("the INTERDENTAL hallmark ⟨ҫ⟩→θ, ⟨ҙ⟩→ð + written uvulars ⟨ҡ ғ⟩", () => {
        expect(phonemizeWordNative("аҫыл")).toBe("ɑˈθɯɫ"); // 'noble' — ⟨ҫ⟩→[θ] interdental
        expect(phonemizeWordNative("ҙур")).toBe("ˈðuɾ"); // 'big' — ⟨ҙ⟩→[ð] interdental
        expect(phonemizeWordNative("башҡорт")).toBe("bɑʃˈqʊɾt"); // 'Bashkir' — ⟨ҡ⟩→[q], ⟨ш⟩→ʃ, ⟨о⟩→ʊ
        expect(phonemizeWordNative("ҡыҙыл")).toBe("qɯˈðɯɫ"); // 'red' — ⟨ҡ⟩→[q], ⟨ҙ⟩→[ð], dark ⟨л⟩→[ɫ]
    });

    test("the Bashkir vowel shift + ⟨у⟩ glide", () => {
        expect(phonemizeWordNative("көн")).toBe("ˈkøn"); // 'day' — ⟨ө⟩→[ø]
        expect(phonemizeWordNative("балыҡ")).toBe("bɑˈɫɯq"); // 'fish' — ⟨ы⟩→[ɯ], dark ⟨л⟩
        expect(phonemizeWordNative("һыу")).toBe("ˈhɯw"); // 'water' — ⟨һ⟩→h, ⟨ы⟩→ɯ, ⟨у⟩ after a vowel → [w]
        expect(phonemizeWordNative("йәшел")).toBe("jæˈʃɪl"); // 'green' — ⟨ә⟩→æ, ⟨е⟩→[ɪ]
        expect(phonemizeWordNative("биш")).toBe("ˈbiʃ"); // 'five' — a word ending in ⟨и⟩→[i] still gets stress
        expect(phonemizeWordNative("үҙ")).toBe("ˈyð"); // 'self' — ⟨ү⟩→[y] onset counts as a vowel for stress
    });

    test("NUMBERS — Turkic decimal; Bashkir's own lexemes, NOT Tatar's", () => {
        const ba = getPhonemizer("ba");
        // Data + provenance: src/languages/bashkir/numbers.ts (Wiktionary Module:number list/data/ba + Omniglot).
        expect(ba.text("7").trim()).toBe("jɪˈtɪ"); // ете — Bashkir ⟨ете⟩, not Tatar ⟨җиде⟩
        expect(ba.text("11").trim()).toBe("ˈun ˈbɪɾ"); // ун бер — TWO words in Bashkir (Tatar fuses: унбер)
        expect(ba.text("25").trim()).toBe("jɪɡɪɾˈmɪ ˈbiʃ"); // егерме биш — the 21-99 compound
        expect(ba.text("100").trim()).toBe("ˈjøð"); // йөҙ — the ⟨ҙ⟩ interdental hallmark inside a numeral
        expect(ba.text("555").trim()).toBe("ˈbiʃ ˈjøð ilˈlɪ ˈbiʃ"); // биш йөҙ илле биш
        expect(ba.text("1984").trim()).toBe("ˈmɪŋ tuˈʁɯð ˈjøð hikˈhæn ˈdyɾt"); // мең туғыҙ йөҙ һикһән дүрт — ⟨һикһән⟩ 80, not Tatar ⟨сиксән⟩
        expect(ba.text("12345").trim()).toBe("ˈun iˈkɪ ˈmɪŋ ˈøs ˈjøð ˈqɯɾq ˈbiʃ"); // ун ике мең өс йөҙ ҡырҡ биш
        expect(ba.text("1000000").trim()).toBe("ˈbɪɾ miɫɫiˈʊn"); // бер миллион
    });

    test("Russian-loan detection routes to the Russian g2p (a reality of Bashkir text)", () => {
        expect(isRussianLoan("республика")).toBe(true); // back ⟨у а⟩ + front ⟨е⟩, no Bashkir letter → loan
        expect(isRussianLoan("Европа")).toBe(true); // front ⟨е⟩ + back ⟨о⟩ → loan
        expect(isRussianLoan("тарих")).toBe(false); // back ⟨а⟩ + NEUTRAL ⟨и⟩ (Arabic loan, read native) → NOT flagged
        expect(isRussianLoan("башҡорт")).toBe(false); // has ⟨ҡ⟩ → native
        expect(isRussianLoan("балыҡ")).toBe(false); // all-back harmony → native
        expect(phonemizeWord("республика")).toContain("rʲ"); // routed to Russian → palatalization the native scan can't make
    });

    test("⟨ѳ⟩ and ⟨ӊ⟩ are legacy-codepage ⟨ө⟩ and ⟨ң⟩ — a deleted vowel AND a mis-routed loan", () => {
        // Found by the silent-deletion detector: ⟨ѳ⟩ ×7 against ⟨ө⟩ ×1,323, ⟨ӊ⟩ ×11 against ⟨ң⟩ ×921. Both
        // fall outside the letter tables, so `кѳньяғында → knjɑʁɯnˈdɑ` lost its vowel outright — and with the
        // front vowel gone the harmony test could route a native front word to the RUSSIAN g2p.
        expect(phonemizeWord("кѳньяғында")).toBe(phonemizeWord("көньяғында"));
        expect(phonemizeWord("һѳрѳлгән")).toBe(phonemizeWord("һөрөлгән"));
        expect(phonemizeWord("уныӊ")).toBe(phonemizeWord("уның"));
        expect(phonemizeWord("меӊдән")).toBe("mɪŋˈdæn");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION (src/languages/bashkir/normalize.ts + the shared symbol tier).
//
// ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (playbook trap 13). The ordinal suffix is
// DERIVED from vowel harmony, so each of its three live branches gets a case — including values this
// corpus does not contain — and the fallback path (a case suffix, not an ordinal) gets its own.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe("bashkir text normalization", async () => {
    const ba = await getPhonemizer("ba");

    test("the ordinal suffix is DERIVED by vowel harmony, and every branch is exercised", () => {
        expect(normalizeBashkir("1-се")).toBe("беренсе"); // -енсе after a consonant
        expect(normalizeBashkir("2-се")).toBe("икенсе"); // -нсе after a VOWEL
        expect(normalizeBashkir("3-сө")).toBe("өсөнсө"); // -өнсө — the rounded branch
        expect(normalizeBashkir("6-сы")).toBe("алтынсы"); // -нсы after a vowel, back branch
        expect(normalizeBashkir("23-сө урында")).toBe("егерме өсөнсө урында"); // only the LAST word takes it
        expect(normalizeBashkir("50-се йылдар")).toBe("илленсе йылдар");
        expect(normalizeBashkir("159-сы урын")).toBe("йөҙ илле туғыҙынсы урын");
        // ⚠ LABIAL HARMONY IS NARROWER THAN THE VOWEL INVENTORY SUGGESTS: ⟨у⟩ and ⟨ү⟩ are rounded and do
        // NOT round the suffix. Neither value is in this corpus — they are the branch, not the instance.
        expect(normalizeBashkir("10-сы")).toBe("унынсы"); // ун + -ынсы, never *унонсо*
        expect(normalizeBashkir("4-се")).toBe("дүртенсе"); // дүрт + -енсе, never *дүртөнсө*
        expect(normalizeBashkir("100-сө")).toBe("йөҙөнсө");
        expect(normalizeBashkir("1000-се")).toBe("меңенсе");
    });

    test("…and the SAME notation writes a case suffix, which is glued instead", () => {
        // ⚠ THE WRITER HAS ALREADY CHOSEN THE ALLOMORPH from the SPOKEN numeral, so the rule only has to
        // attach it: йөҙ takes -ҙән, нуль takes -дән. The `endsWith` guard on the ordinal is what makes the
        // fallback safe — a suffix no ordinal produces falls through rather than inventing morphology.
        expect(normalizeBashkir("100-ҙән")).toBe("йөҙҙән");
        expect(normalizeBashkir("0-дән")).toBe("нульдән");
        expect(normalizeBashkir("613-ө")).toBe("алты йөҙ ун өсө"); // the possessive, vowel-initial
        // ⚠ A GLUED SUFFIX MUST BRING ITS OWN VOWEL unless the numeral ends in one. The corpus's
        // `1 923 233-н` would give *…утыҙ өсн*, a syllable no Bashkir word can carry — the writer's `-н`
        // is the accusative of a possessive whose linking vowel they did not type. Declined rather than
        // emitted: the figure still reads, and an impossible syllable is worse than an unspoken morpheme.
        expect(normalizeBashkir("1923233-н")).toBe("1923233-н");
        // ⚠ `-е` AND `-й` ARE RUSSIAN. All seven of the corpus's instances are inside Russian passages —
        // `Издание 1-е`, `4-е изд.`, `2-е изд.` ×3, `2-й Украинский фронт`, `в 1990-е башкир…`. Gluing
        // gave *туҡһане*, a word in neither language.
        expect(normalizeBashkir("2-е изд.")).toBe("2-е изд.");
        expect(normalizeBashkir("1990-е")).toBe("1990-е");
    });

    test("the suffix goes on the DEGREE SIGN as often as on the numeral", () => {
        // `+0,3 °C-тан (тауҙарҙа) +2,8 °C-ҡа тиклем` — a span whose case marking sits on the sign.
        expect(normalizeBashkir("+0,3 °C-тан")).toBe("плюс 0,3 градустан");
        expect(normalizeBashkir("+2,8 °C-ҡа тиклем")).toBe("плюс 2,8 градусҡа тиклем");
        expect(normalizeBashkir("5°-ҡа тиклем")).toBe("5 градусҡа тиклем");
        // ⚠ THE SCALE NAME IS DROPPED WHEN A SUFFIX FOLLOWS: the sourced compound is *Цельсий градусы*,
        // whose possessive -ы needs a linking -н- before the case ending the writer did NOT type. They
        // wrote `-тан`, the allomorph bare *градус* takes. Honest lossiness, not an oversight.
        expect(normalizeBashkir("+28 °C")).toBe("плюс 28 Цельсий градусы");
        // Both the Latin ⟨C⟩ and the Cyrillic ⟨С⟩ occur and render identically; the Latin one was falling
        // to core/foreign.ts and reading as the ENGLISH letter name.
        expect(normalizeBashkir("10° С-тан")).toBe("10 градустан");
        // …and the corpus also types the sign AFTER the letter.
        expect(normalizeBashkir("+35С°")).toBe("плюс 35 Цельсий градусы");
    });

    test("clock, grouping, and the abbreviations", () => {
        expect(normalizeBashkir("10:30")).toBe("ун утыҙ"); // the colon was a clause pause
        expect(normalizeBashkir("8:30-ҙа")).toBe("һигеҙ утыҙҙа"); // the suffix lands on the spoken MINUTE
        expect(normalizeBashkir("3 000 000")).toBe("3000000"); // read as *өс нуль нуль* before this
        expect(normalizeBashkir("1991 й.")).toBe("1991 йыл"); // was the bare glide [j]
        expect(normalizeBashkir("б. э. т. 145")).toBe("беҙҙең эраға тиклем 145");
        expect(normalizeBashkir("һ. б.")).toBe("һәм башҡалар."); // clause-final: the dot IS the sentence end
        expect(normalizeBashkir("№ 5")).toBe("номер 5");
        // ⚠ `г.` WITH A DOT is Russian *года* — every instance is in a Russian passage — and `г` WITHOUT
        // one is the gram. The dot is the only discriminator, which is why the tier is not given the key.
        expect(normalizeBashkir("3,300 г")).toBe("3,300 грамм");
        expect(normalizeBashkir("1988 г.")).toBe("1988 г.");
    });

    test("percent, currency and units — Turkic agreement is SINGULAR", () => {
        expect(ba.text("70 %").trim()).toBe("jɪtˈmɪʃ prɐt͡sˈɛnt");
        // ⚠ NOT a Slavic three-way count: a Turkic counted noun stays singular after any numeral, so every
        // CountForms entry is a one-element array and `5 километр` is right, not *5 километрҙар*.
        expect(ba.text("12,5 км").trim()).toBe("ˈun iˈkɪ øˈtøɾ ˈbiʃ kʲɪɫɐmʲˈetr");
        expect(ba.text("100 кг").trim()).toContain("kiɫʊɡˈɾɑmm");
        expect(ba.text("10 км²").trim()).toBe("ˈun kwɑdˈɾɑt kʲɪɫɐmʲˈetr"); // adjective BEFORE the noun
    });

    test("the decimal COMMA is a quantity, and the dot is not a decimal at all", () => {
        // 24,214 corpus instances. `5,3 %` read as *биш , өс* — a phrase break inside a number.
        expect(ba.text("5,3 %").trim()).toBe("ˈbiʃ øˈtøɾ ˈøs prɐt͡sˈɛnt");
        // ⚠ NO DOT-DECIMAL FOLD, and that is a measured divergence from the Belarusian layer next door.
        // be's 82 dot-decimals were mostly genuine; ba's 98 are almost all PERCENT-ENCODED wiki anchors
        // (`.D0.9A` supplies the `0.9` that tops the frequency table), plus a lens aperture and a page
        // range. Zero are numbers, so the dot is left exactly where it was.
        expect(normalizeBashkir("f/0.7")).toBe("f/0.7");
        expect(normalizeBashkir("6.5-66")).toBe("6.5-66");
    });

    test("signs, and the two the corpus refuses", () => {
        expect(normalizeBashkir("−41 градус")).toBe("минус 41 градус"); // U+2212, not a hyphen
        expect(normalizeBashkir("5 = 5")).toBe("5 тигеҙ 5");
        expect(normalizeBashkir("6 × 6")).toBe("6 тапҡыр 6");
        // ⚠ `=` IS DIGIT-GATED: 16 of the corpus's 17 are LaTeX, a formula the dump left raw, or a typo
        // (`1996=2006`) inside Russian text.
        expect(normalizeBashkir("a^{-1}=e")).toBe("a^{-1}=e");
        // ⚠ NO DIVISION RULE AT ALL: the corpus's single `÷` is `рН = 6,4÷6,7`, a RANGE in the Russian
        // convention ("pH from 6.4 to 6.7"), not a division. One instance of the opposite sense is not
        // evidence for the sign.
        expect(normalizeBashkir("6,4÷6,7")).toBe("6,4÷6,7");
    });

    test("ranges are separated but NOT given a connective, and must survive a full stop (trap 58)", () => {
        // ⚠ A MEASURED REFUSAL, not a gap. Bashkir marks a span with case endings on BOTH operands
        // (*өс йөҙҙән алты йөҙгә тиклем*), which needs an ablative and a dative this layer would have to
        // derive unaided — the one thing the rest of the file is built to avoid. A pause separates the
        // endpoints, invents no morpheme, and leaves the span audible as two figures.
        expect(normalizeBashkir("300—600 мм")).toBe("300, 600 мм");
        expect(normalizeBashkir("1-3 көн")).toBe("1, 3 көн");
        // `Вегетация миҙгеле — 120—135 көн.` is how this corpus ends a sentence.
        expect(normalizeBashkir("120—135 көн.")).toBe("120, 135 көн.");
    });

    test("a century is an ORDINAL, and the ordinal derivation is shared with normalize.ts", () => {
        expect(ROMAN_POLICY.ordinal(19)).toBe("ун туғыҙынсы");
        expect(ROMAN_POLICY.ordinal(20)).toBe("егерменсе");
        expect(ROMAN_POLICY.ordinal(101)).toBeUndefined(); // above 100 a roman is a year; the cardinal is right
        // ⚠ THROUGH `phonemize`, NOT THE RAW ENGINE: core/roman.ts runs in registry.ts wrapping the engine.
        expect(phonemize("XIX быуат", "ba").trim()).toBe("ˈun tuʁɯðɯnˈsɯ bɯˈwɑt");
        expect(phonemize("XX быуатта", "ba").trim()).toBe("jɪɡɪɾmɪnˈsɪ bɯwɑtˈtɑ"); // the noun keeps the case
        // ⚠ AND THE SAME SEAM FEEDS THE SUFFIX RULE: `III-сөнөң` reaches normalize.ts as `3-сөнөң`, whose
        // written suffix runs PAST the ordinal's own tail (*өсөнсө* + a genitive). Spliced on the overlap;
        // a plain `endsWith` test fell through to the glue path and produced *өссөнөң*.
        expect(phonemize("Әхмәт III-сөнөң", "ba").trim()).toBe("æχˈmæt øsønsøˈnøŋ");
    });

    test("initialisms are spelled", () => {
        expect(ba.text("СССР").trim()).toBe("ˈɪs ˈɪs ˈɪs ˈɪɾ"); // was the cluster [sssɾ]
        expect(ba.text("АҠШ").trim()).toBe("ˈɑ ˈqɯ ˈʃɑ"); // the USA, with the Bashkir-only letter names
    });
});
