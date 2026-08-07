import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/telugu/telugu.ts";
import { normalizeTelugu } from "../src/languages/telugu/normalize.ts";
import { numberToWords, yearToWords, ordinalToWords } from "../src/languages/telugu/numbers.ts";

// Canonical-IPA goldens for Telugu (te) — a Dravidian Brahmic abugida via the generic engine. Unlike Hindi
// there is NO inherent-vowel deletion (inherent /a/, every akshara pronounced); short/long e,o are distinguished
// (ఎ e / ఏ eː, ఒ o / ఓ oː); retroflex ళ→ɭ, ష→ʂ; geminate → length ː; word-final anusvara ం → [m].
describe("telugu canonical IPA", () => {
    test("abugida core: inherent /a/, retroflex, short/long e·o, gemination, final ం", () => {
        const cases: [string, string][] = [
            ["తెలుగు", "t̪ˈeluɡu"], // 'Telugu': short e, no deletion
            ["చెట్టు", "t͡ʃˈeʈːu"], // 'tree': retroflex geminate ʈː
            ["మనిషి", "mˈaniʂi"], // 'person': ష → retroflex ʂ
            ["నీళ్ళు", "nˈiːɭːu"], // 'water': ళ → retroflex lateral geminate ɭː
            ["పుస్తకం", "pˈust̪akam"], // 'book': final ం → [m]
            ["ఒకటి", "ˈokaʈi"], // 'one': short o
            ["ఊరు", "ˈuːɾu"], // 'town/village': long u
            ["చేయి", "t͡ʃˈeːji"], // 'hand': long eː
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("text: word run + danda", () => {
        expect(phonemize("తెలుగు భాష.", "te")).toContain("t̪ˈeluɡu");
    });
});

// text normalization. The number tests are the important ones: before this, all 627 numerals in the
// te_in corpus were composed by the shared `indicNumberWords`, which orders 21-99 unit-first and does not
// inflect the magnitude nouns — see src/languages/telugu/numbers.ts for the corpus/audio evidence.
describe("telugu numbers (magnitude agreement)", () => {
    test("21-99 is TENS then unit, not unit then tens", () => {
        expect(numberToWords(21)).toBe("ఇరవై ఒకటి"); // was *ఒకటి ఇరవై
        expect(numberToWords(93)).toBe("తొంభై మూడు"); // was *మూడు తొంభై
        expect(numberToWords(30)).toBe("ముప్పై");
    });

    test("a magnitude of ONE is bare — never spelled with ఒకటి", () => {
        expect(numberToWords(100)).toBe("వంద"); // was *ఒకటి వంద
        expect(numberToWords(1000)).toBe("వెయ్యి"); // was *ఒకటి వెయ్యి
        expect(numberToWords(100000)).toBe("లక్ష");
        expect(numberToWords(10000000)).toBe("కోటి");
    });

    test("plural vs oblique-plural magnitude, and the suppletive నూట for 101-199", () => {
        expect(numberToWords(200)).toBe("రెండు వందలు"); // free plural
        expect(numberToWords(250)).toBe("రెండు వందల యాభై"); // oblique before a remainder
        expect(numberToWords(150)).toBe("నూట యాభై"); // suppletive hundred stem — audio-confirmed
        expect(numberToWords(2000)).toBe("రెండు వేలు");
        expect(numberToWords(2011)).toBe("రెండు వేల పదకొండు"); // audio-confirmed
        expect(numberToWords(30000)).toBe("ముప్పై వేలు");
        expect(numberToWords(400000)).toBe("నాలుగు లక్షలు");
    });

    test("1100-1999 read as centuries (audio-arbitrated), 2000s as cardinals", () => {
        expect(yearToWords(1976)).toBe("పంతొమ్మిది వందల డెబ్బై ఆరు");
        expect(yearToWords(1966)).toBe("పంతొమ్మిది వందల అరవై ఆరు");
        expect(yearToWords(1900)).toBe("పంతొమ్మిది వందలు");
        expect(numberToWords(2013)).toBe("రెండు వేల పదమూడు");
    });

    test("ordinals fuse వ onto the last cardinal word", () => {
        expect(ordinalToWords(18)).toBe("పద్దెనిమిదవ"); // -ు dropped
        expect(ordinalToWords(20)).toBe("ఇరవయ్యవ"); // -ై → -య్య; this corpus writes it
        expect(ordinalToWords(10)).toBe("పదవ");
        expect(ordinalToWords(190)).toBe("నూట తొంభయ్యవ");
        expect(ordinalToWords(1970)).toBe("పంతొమ్మిది వందల డెబ్బయ్యవ");
    });
});

describe("telugu text normalization", () => {
    test("౦ (TELUGU DIGIT ZERO) is folded to the anusvara it is a homoglyph for", () => {
        // All 144 in the corpus are typos for ం; before the fold the G2P dropped them and lost the nasal.
        expect(normalizeTelugu("స౦వత్సర౦లో")).toBe("సంవత్సరంలో");
        expect(phonemize("స౦వత్సర౦లో", "te")).toBe(phonemize("సంవత్సరంలో", "te"));
        // A real Telugu digit run is NOT read as the anusvara — the homoglyph guard still holds — and is
        // then folded to ASCII so the number path can see it at all. Before the fold the engine returned
        // an empty string for it.
        expect(normalizeTelugu("౧౦")).toBe("10");
        expect(phonemize("౧౦", "te")).toBe(phonemize("10", "te"));
    });

    test("zero-width joiners are removed, so a split word keeps ONE stress", () => {
        expect(phonemize("వైట్‌హాల్", "te")).toBe("ʋˈaiʈhaːl"); // was ʋˈaiʈ hˈaːl
    });

    test("grouped numerals de-group instead of taking a clause pause", () => {
        expect(normalizeTelugu("17,000")).toBe("17000");
        expect(phonemize("17,000", "te")).toBe("pˈad̪iheːɖu ʋˈeːlu"); // was "pˈad̪iheːɖu , sˈunːaː"
    });

    test("decimals take the borrowed పాయింట్ and read the fraction digit-wise", () => {
        // Both facts arbitrated on the FLEURS audio: 802.11 → "…రెండు పాయింట్ ఒకటి ఒకటి".
        expect(normalizeTelugu("2.4")).toBe("2 పాయింట్ 4");
        expect(normalizeTelugu("802.11")).toBe("802 పాయింట్ 1 1");
        expect(normalizeTelugu("5.0")).toBe("5 పాయింట్ 0");
    });

    test("percent, currency, units and the squared measure", () => {
        expect(normalizeTelugu("93%")).toBe("93 శాతం");
        expect(normalizeTelugu("US$30")).toBe("30 డాలర్లు");
        // the magnitude hops with the sign, and the decimal step (later) then reads the point
        expect(normalizeTelugu("US$ 14.7 బిలియన్")).toBe("14 పాయింట్ 7 బిలియన్ డాలర్లు");
        expect(normalizeTelugu("5mm")).toBe("5 మిల్లీమీటర్లు");
        expect(normalizeTelugu("19,500 km²")).toBe("19500 చదరపు కిలోమీటర్లు");
        expect(normalizeTelugu("3136 mm2")).toBe("3136 చదరపు మిల్లీమీటర్లు"); // the ASCII-2 exponent
    });

    test("rate is a PREFIX dative, and is not duplicated when the text already says it", () => {
        expect(normalizeTelugu("160km/h")).toBe("గంటకు 160 కిలోమీటర్లు");
        expect(normalizeTelugu("గంటకు 83కి.మీ/గం.")).toBe("గంటకు 83 కిలోమీటర్లు");
        expect(normalizeTelugu("(165 కి.మీ./గం)")).toBe("(గంటకు 165 కిలోమీటర్లు)");
    });

    test("dotted abbreviations lose the interior dot but not a sentence-final pause", () => {
        expect(normalizeTelugu("2-3 కి.మీ")).toBe("2-3 కిలోమీటర్లు");
        expect(normalizeTelugu("క్రీ.శ 1000")).toBe("క్రీస్తు శకం 1000");
        expect(normalizeTelugu("క్రీ.పూ 5000")).toBe("క్రీస్తు పూర్వం 5000");
        expect(normalizeTelugu("సుమారు 1100 ఏ.డి. వరకు")).toContain("ఏ డి వరకు");
        expect(normalizeTelugu("(ఉదా. వీసా)")).toBe("(ఉదాహరణకు వీసా)");
        // Sentence-final: the trailing dot survives as a pause.
        expect(normalizeTelugu("1 యు.ఎస్.")).toBe("1 యు ఎస్.");
    });

    test("clock: :00 is dropped, the colon never becomes a pause, and no గంటలు is added", () => {
        expect(normalizeTelugu("11:00 తరువాత")).toBe("11 తరువాత");
        expect(normalizeTelugu("8:30 గంటలకు")).toBe("8 30 గంటలకు");
        expect(phonemize("11:00", "te")).toBe("pˈad̪akõɳɖu"); // was "pˈad̪akõɳɖu , sˈunːaː"
    });

    test("vulgar fractions route through the decimal path rather than being dropped", () => {
        expect(normalizeTelugu("24½ inches")).toBe("24 పాయింట్ 5 అంగుళాలు");
    });

    test("ordinal వ reaches the g2p fused, not as a stray syllable", () => {
        expect(normalizeTelugu("18వ శతాబ్దం")).toBe("పద్దెనిమిదవ శతాబ్దం");
        expect(normalizeTelugu("1970వ")).toBe("పంతొమ్మిది వందల డెబ్బయ్యవ");
        expect(normalizeTelugu("60వది")).toBe("అరవయ్యవది");
    });

    // `120–160 క్యూబిక్ మీటర్ల ఇంధనాన్ని`, the loan, word-first. ఘన ×2 here is "solid/volume"
    // (`నీటి ఘన పరిమాణం`, the volume of water) and not the measure word, so the sentence decides it.
    test("the cubed measure word", () => {
        expect(phonemize("120 m³", "te")).toContain("kjˈuːbik mˈiːʈaɾlu");
    });
});
