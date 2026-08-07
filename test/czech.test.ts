import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/czech/czech.ts";
import { normalizeCzech } from "../src/languages/czech/normalize.ts";

describe("Czech g2p", () => {
    it("vowels, palatalisation, ě", () => {
        const cases: [string, string][] = [
            ["divadlo", "ɟˈɪvadlo"], // di → ɟɪ
            ["děti", "ɟˈɛcɪ"], // dě → ɟɛ, ti → cɪ
            ["běh", "bjˈɛx"], // bě → bjɛ, ch → x
            ["měl", "mɲˈɛl"], // mě → mɲɛ
            ["policie", "pˈolɪt͡sˌɪjɛ"], // hiatus i+e → ɪjɛ
            ["venku", "vˈɛŋku"], // n → ŋ before k
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    it("voicing assimilation (regressive + final devoicing)", () => {
        expect(phonemizeWord("led")).toBe("lˈɛt"); // final devoicing d→t
        expect(phonemizeWord("kde")).toBe("ɡdˈɛ"); // regressive k→ɡ before d
        expect(phonemizeWord("prosba")).toBe("prˈozba"); // s→z before b
        expect(phonemizeWord("vstup")).toBe("fstˈup"); // v→f before st
        expect(phonemizeWord("sníh")).toBe("sɲˈiːx"); // final ɦ→x
        expect(phonemizeWord("rozhodně")).toBe("rˈosɦodɲɛ"); // z→s before ɦ
    });

    it("ř voicing and syllabic consonants", () => {
        expect(phonemizeWord("tři")).toBe("tr̝̊ˈɪ"); // ř devoices after voiceless t
        expect(phonemizeWord("při")).toBe("pr̝̊ˈɪ"); // (ř does not voice the preceding p)
        expect(phonemizeWord("tvář")).toBe("tvˈaːr̝̊"); // final ř devoices
        expect(phonemizeWord("krk")).toBe("kˈr̩k"); // syllabic r̩
        expect(phonemizeWord("vlk")).toBe("vˈl̩k"); // syllabic l̩
    });

    it("stress (first syllable + even non-final secondary) and degemination", () => {
        expect(phonemizeWord("republika")).toBe("rˈɛpublˌɪka");
        expect(phonemizeWord("vyšší")).toBe("vˈɪʃʃiː"); // geminate ʃʃ kept
        expect(phonemizeWord("činnost")).toBe("t͡ʃˈɪnost"); // nn → n
    });

    it("cardinal numbers", () => {
        expect(phonemize("5", "cs")).toBe("pjˈɛt");
        expect(phonemize("10", "cs")).toBe("dˈɛsɛt");
        expect(phonemize("100", "cs")).toBe("stˈo");
        expect(phonemize("1000", "cs")).toBe("cˈɪsiːt͡s"); // first-syllable stress
    });
});

// TEXT NORMALIZATION. Counts measured over the FLEURS cs_cz corpus (column 3).
describe("Czech normalization", () => {
    // ⚠ Czech ordinals inflect for CASE — more than Norwegian/Danish (one form per number) or Icelandic
    // (three, by gender) need. The rules key on the FOLLOWING word, so these pin the recoverable-case
    // heuristics: a later edit to the month list or the v/ve check would otherwise change readings
    // silently.
    it("ordinal case is selected by the following word", () => {
        expect(normalizeCzech("21. století")).toBe("dvacátého prvního století"); // genitive
        expect(normalizeCzech("ve 21. století")).toBe("ve dvacátém prvním století"); // locative after v/ve
        expect(normalizeCzech("3. května")).toBe("třetího května"); // month → genitive
        expect(normalizeCzech("v 90. letech")).toBe("v devadesátých letech"); // plural
    });

    it("a sentence ending in a year keeps its full stop", () => {
        expect(normalizeCzech("Bylo to v roce 1990. Přišel")).toBe("Bylo to v roce 1990. Přišel");
    });

    it("clock, space-grouped thousands, ranges, degrees", () => {
        expect(normalizeCzech("14:30")).toBe("čtrnáct hodin třicet minut");
        expect(normalizeCzech("1 234")).toBe("1234");
        expect(normalizeCzech("1990-1995")).toBe("1990 do 1995");
        expect(phonemize("20 °C", "cs")).toContain("stˈupɲuː"); // three-way count agreement
    });

    // The Czech count form takes the GENITIVE PLURAL for a compound ending in 1 — 21 hodin — where the
    // Russian selector takes the singular. `:00` drops the minutes, which is the idiomatic reading.
    it("count agreement diverges from the Slavic selector at compounds ending in 1", () => {
        expect(normalizeCzech("21:00")).toBe("dvacetjedna hodin"); // genitive plural, not *hodina
        expect(normalizeCzech("5:00")).toBe("pět hodin");
        expect(normalizeCzech("2:00")).toBe("dvě hodiny"); // 2–4 takes the nominative plural
    });

    // Czech marks gender on 1 and 2 only, and both clock nouns are feminine — so the composer's masculine
    // citation form was wrong on every such hour. `1:15 ráno` is the corpus's own instance and it read
    // "jeden hodina patnáct minut".
    it("the clock numeral agrees with its feminine noun", () => {
        expect(normalizeCzech("1:15")).toBe("jedna hodina patnáct minut");
        expect(normalizeCzech("22:00")).toBe("dvacetdvě hodiny");
    });

    it("reads the whole numeral, decimal and unit through the shared tier", () => {
        expect(phonemize("12,5", "cs")).toContain("t͡ʃˈaːrka"); // čárka, the decimal separator
        expect(phonemize("3 850 km²", "cs")).toContain("t͡ʃtvˈɛrɛt͡ʃɲiːx"); // čtverečních
        expect(phonemize("100 km/h", "cs")).toContain("zˈa ɦˈoɟɪnu"); // za hodinu
    });

    // These three were SILENTLY DROPPED and are the DROPPED-SIGN class: `-5 stupňů` read as "pět stupňů", five
    // degrees rather than minus five. `plus` and `×` were already handled; the minus was not.
    it("signs that were dropped are read", () => {
        expect(normalizeCzech("-5")).toBe("mínus 5");
        expect(normalizeCzech("−5")).toBe("mínus 5"); // U+2212 as well as the hyphen
        expect(normalizeCzech("A&B")).toBe("A a B"); // a, the corpus's commonest word
        expect(normalizeCzech("x = y")).toBe("x rovná se y");
    });

    it("a hyphenated compound is not read as a minus", () => {
        expect(normalizeCzech("Praha-východ")).toBe("Praha-východ");
    });

    it("ordinary Czech text is untouched", () => {
        expect(normalizeCzech("Čeština je jazyk.")).toBe("Čeština je jazyk.");
    });
});
