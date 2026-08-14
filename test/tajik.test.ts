import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/tajik/tajik.ts";
import { getPhonemizer } from "../src/registry.ts";

// Tajik / тоҷикӣ (tg) — Iranian (SW), a Persian variety in the CYRILLIC alphabet. Verified against wikipron
// tgk_cyrl broad (human, PRIMARY) + narrow (human) + epitran. Cyrillic writes all vowels → no
// short-vowel restoration (unlike the fa abjad).
describe("Tajik canonical IPA (Cyrillic Persian, near-phonemic)", () => {
    test("six-vowel system: о→ɔ (Persian ā), ӯ→ɵ, а→a", () => {
        expect(phonemizeWord("забон")).toBe("zabˈɔn"); // 'language' — о→ɔ
        expect(phonemizeWord("модар")).toBe("mɔdˈar"); // 'mother'
        expect(phonemizeWord("рӯз")).toBe("rˈɵz"); // 'day' — ӯ→ɵ
        expect(phonemizeWord("нӯҳ")).toBe("nˈɵh"); // 'nine' — ӯ→ɵ, ҳ→h
    });

    test("special Cyrillic letters: ғ→ʁ, қ→q, ҳ→h, ҷ→d͡ʒ, х→χ", () => {
        expect(phonemizeWord("ғарб")).toBe("ʁˈarb"); // 'west'
        expect(phonemizeWord("қалам")).toBe("qalˈam"); // 'pen'
        expect(phonemizeWord("ҷавон")).toBe("d͡ʒavˈɔn"); // 'young'
        expect(phonemizeWord("шаҳр")).toBe("ʃˈahr"); // 'city' — ш→ʃ, ҳ→h
        expect(phonemizeWord("хона")).toBe("χɔnˈa"); // 'house' — х→χ
    });

    test("iotation + hiatus glide: initial/hiatus е→je, и→ji", () => {
        expect(phonemizeWord("эронӣ")).toBe("jerɔnˈi"); // 'Iranian' — word-initial э→je
        expect(phonemizeWord("Саид")).toBe("sajˈid"); // hiatus и→ji (matches the human referee; epitran misses it)
    });

    test("Persian final stress + a clause", () => {
        expect(getPhonemizer("tg").text("Забони тоҷикӣ эронӣ аст.")).toBe(
            "zabɔnˈi tɔd͡ʒikˈi jerɔnˈi ˈast .",
        );
    });

    test("cardinal numbers with the -у (va) connector", () => {
        const p = getPhonemizer("tg");
        expect(p.text("21")).toBe("bistˈu jˈak"); // бисту як
        expect(p.text("345")).toBe("sesadˈu t͡ʃilˈu pˈand͡ʒ"); // сесаду чилу панҷ
        expect(p.text("1100")).toBe("hazɔrˈu sˈad"); // ҳазору сад
    });

    // ⚠ THE SCALE LADDER ABOVE `миллион`, WHICH USED TO FAIL SILENTLY. `three(n / 1e6)` indexed
    // `units[10]` for any n ≥ 10⁹, concatenated the literal `undefined` into the word, and the g2p then
    // skipped the Latin letters — so 10⁹ read as *сад миллион*, one HUNDRED million, with nothing to see.
    // Pinned at the BOUNDARY of each branch rather than at values the corpus happens to write.
    test("the number compositor's scale ladder, at every boundary", () => {
        const p = getPhonemizer("tg");
        expect(p.text("1000000000")).toBe("jˈak milliˈard"); // як миллиард — was *сад миллион*
        expect(p.text("2500000000")).toBe("dˈu milliardˈu pand͡ʒsˈad milliˈɔn"); // ду миллиарду панҷсад миллион
        expect(p.text("1000000000000")).toBe("jˈak trilliˈɔn"); // як триллион
        expect(p.text("999999")).toBe(
            "nɵhsadˈu navadˈu nˈɵh hazɔrˈu nɵhsadˈu navadˈu nˈɵh",
        ); // the branch just BELOW the million, which was always right
    });
});

// The normalization layer. ⚠ These pin the RULE'S BRANCHES, not the corpus's instances (playbook trap 13):
// every table-vs-composition rule below is exercised on a value the mined artifact does NOT contain as well
// as on one it does.
describe("Tajik text normalization (Persian in Cyrillic — two precedent families)", () => {
    const p = getPhonemizer("tg");

    // The character that split a word without being a letter. 54 occurrences in 13 of 456 mined segments.
    test("the SOFT HYPHEN is stripped, not read as a word boundary", () => {
        expect(p.text("Осиёи Мар­ка­зӣ")).toBe(p.text("Осиёи Марказӣ"));
        expect(p.text("Ҷум­ҳурии Узбекистон")).toBe("d͡ʒumhurijˈi uzbekistˈɔn");
    });

    // The Russian side: space grouping, the decimal comma, the dotted date, the Cyrillic abbreviations.
    test("Russian conventions — space thousands, decimal comma, D.MM.YYYY, млн/млрд", () => {
        expect(p.text("70 000 нафар")).toBe("haftˈɔd hazˈɔr nafˈar"); // was *ҳафтод сифр*
        // ⚠ THE DECIMAL SEPARATOR HAS NO SOURCED WORD (five candidates, all wrong senses, all ×0 between
        // digits). What is asserted is that the spurious CLAUSE PAUSE is gone — no `,` in the reading.
        expect(p.text("2,2 млн тонна")).toBe("dˈu dˈu milliˈɔn tɔnnˈa");
        expect(p.text("1.01.2017")).toBe("jˈak janvarˈi sɔlˈi dˈu hazɔrˈu habdˈah");
        expect(p.text("с.1924")).toBe("sɔlˈi hazɔrˈu nɵhsadˈu bistˈu t͡ʃˈɔr");
        // NOT a date: a Russian dissertation-speciality code, and the 4-digit-year guard is what rejects it.
        expect(p.text("10.02.22")).toContain("dˈah");
    });

    // The Persian side: the ordinal suffix, the range preposition, the izofat measure words.
    test("Persian conventions — the -ум/-юм ordinal, то, and мураббаъ/мукааб", () => {
        expect(p.text("1-ум")).toBe("jakˈum"); // якум — the table branch
        expect(p.text("2-юм")).toBe("dujˈum"); // дуюм — the vowel-final branch
        expect(p.text("30-ум")).toBe("sijˈum"); // сиюм — the ONE irregular (сӣ → си)
        expect(p.text("129-умро")).toBe("sadˈu bistˈu nɵhumrˈɔ"); // the COMPOSITIONAL branch + enclitic
        expect(p.text("1992—1997")).toBe(
            "hazɔrˈu nɵhsadˈu navadˈu dˈu tˈɔ hazɔrˈu nɵhsadˈu navadˈu hˈaft",
        );
        expect(p.text("135 620 км²")).toBe(
            "sadˈu siˈu pˈand͡ʒ hazɔrˈu ʃaʃsadˈu bˈist kilɔmetrˈi murabbˈaʔ",
        );
        expect(p.text("845 км³")).toBe("haʃtsadˈu t͡ʃilˈu pˈand͡ʒ kilɔmetrˈi mukaˈab");
    });

    // ⚠ A DESIGNATION IS NOT A RANGE, and the guard is a digit on the LEFT of the dash. Every corpus
    // counter-example is a name with a number after it, so none of these may be touched.
    test("a hyphen after a LETTER is a designation, never a range", () => {
        expect(p.text("Варзоб-1")).toBe("varzˈɔb jˈak");
        expect(p.text("деҳоти 1-Май")).toBe("dehɔtˈi jˈak mˈaj");
    });

    test("percent, currency and the enclitic that has to reach a WORD", () => {
        expect(p.text("26,5 %")).toBe("bistˈu ʃˈaʃ pˈand͡ʒ darsˈad");
        expect(p.text("60,1%-и")).toBe("ʃˈast jˈak darsadˈi"); // the izofat lands on дарсад, not on a digit
        expect(p.text("$57,84 млрд")).toBe("pand͡ʒɔhˈu hˈaft haʃtɔdˈu t͡ʃˈɔr milliˈard dɔllˈar");
    });

    // The seam this language most needed: a vowel-less caps run was reaching the g2p as a cluster.
    test("initialisms use TAJIK letter names, and a readable caps word is left alone", () => {
        expect(p.text("СММ")).toBe("sˈe mˈe mˈe"); // се ме ме — was the cluster [smm]
        expect(p.text("ТВ")).toBe("tˈe vˈe"); // те ве — was [tv]
        expect(p.text("ИМА")).toBe("imˈa"); // readable → stays a word, correctly
        expect(p.text("КАРБОН")).toBe("karbˈɔn"); // an encyclopedia headword in caps, not an acronym
    });

    // The spaced dash carried 280 pauses across 40% of the mined corpus and produced none of them.
    test("a spaced dash is a PAUSE; an unspaced one between digits is a range", () => {
        expect(p.text("Тоҷикистон — кишварест")).toBe("tɔd͡ʒikistˈɔn , kiʃvarˈest");
        expect(p.text("750—930 метр")).toBe("haftsadˈu pand͡ʒˈɔh tˈɔ nɵhsadˈu sˈi mˈetr");
    });
});
