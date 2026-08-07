import { describe, expect, it } from "vitest";
import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/tamil/tamil.ts";
import { numberToWords, ordinalStem } from "../src/languages/tamil/numbers.ts";
import { normalizeTamil } from "../src/languages/tamil/normalize.ts";

describe("Tamil abugida g2p", () => {
    it("core words, vowels, retroflex, dental", () => {
        const cases: [string, string][] = [
            ["தமிழ்", "t̪ˈɐmɪɻ"], // ழ → ɻ (census), த → t̪ dental
            ["வணக்கம்", "ʋˈɐɳɐkːɐm"], // க்க geminate → kː, ண → ɳ
            ["இரண்டு", "ˈɪɾɐɳɖʊ"], // ண்ட → ɳɖ (post-nasal voicing)
            ["நன்றி", "n̪ˈɐnrɪ"], // ந n̪ / ன n distinction, ன்ற → nr
            ["அது", "ˈad̪ʊ"], // independent அ → a; த voiced intervocalically
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    it("plosive allophony (voicing)", () => {
        expect(phonemizeWord("மகன்")).toBe("mˈɐɡɐn"); // க → ɡ intervocalic
        expect(phonemizeWord("தம்பி")).toBe("t̪ˈɐmbɪ"); // ப → b post-nasal
        expect(phonemizeWord("பசி")).toBe("pˈɐt͡ɕɪ"); // ச stays t͡ɕ intervocalic (the exception)
        expect(phonemizeWord("பஞ்சு")).toBe("pˈɐɲd͡ʒʊ"); // ச → d͡ʒ post-nasal
        expect(phonemizeWord("கற்று")).toBe("kˈɐʈrʊ"); // ற்ற → ʈr
        expect(phonemizeWord("அவர்")).toBe("ˈaʋɐr"); // coda ர → r (not the tap ɾ)
    });

    it("stress: primary on syllable 1, secondary on odd syllables (4+ syllable words)", () => {
        expect(phonemizeWord("அரசியல்")).toBe("ˈaɾɐt͡ɕˌɪjɐl"); // 4 syll → ˌ on syllable 3
        expect(phonemizeWord("இரண்டு")).toBe("ˈɪɾɐɳɖʊ"); // 3 syll → no secondary
    });

    it("numbers", () => {
        expect(phonemize("5", "ta")).toBe("ˈaᶦn̪d̪ʊ");
        expect(phonemize("10", "ta")).toBe("pˈɐt̪ːʊ");
    });
});

/**
 * text normalization. Asserted on the TEXT layer where the rule is a rewrite (readable, and the IPA
 * for a whole utterance is unreviewable), and through phonemize() where the point is that the pipeline
 * consumes it — no stray pause, no bare consonant, no leaked digit.
 */
describe("Tamil numbers — sandhi-fused cardinals", () => {
    it("teens are suppletive, not ten + unit", () => {
        expect(numberToWords(11)).toBe("பதினொன்று");
        expect(numberToWords(12)).toBe("பன்னிரண்டு");
        expect(numberToWords(19)).toBe("பத்தொன்பது");
    });

    it("21–99 take the ten's oblique form", () => {
        expect(numberToWords(21)).toBe("இருபத்தி ஒன்று");
        expect(numberToWords(20)).toBe("இருபது"); // …but an exact ten stays free
        expect(numberToWords(99)).toBe("தொண்ணூற்றி ஒன்பது");
    });

    it("hundreds are fused stems, with their own oblique", () => {
        expect(numberToWords(200)).toBe("இருநூறு");
        expect(numberToWords(300)).toBe("முந்நூறு");
        expect(numberToWords(900)).toBe("தொள்ளாயிரம்");
        expect(numberToWords(101)).toBe("நூற்றி ஒன்று");
        expect(numberToWords(948)).toBe("தொள்ளாயிரத்து நாற்பத்தி எட்டு");
    });

    it("thousands: 1000 is ஆயிரம், never ஒன்று ஆயிரம்", () => {
        expect(numberToWords(1000)).toBe("ஆயிரம்");
        expect(numberToWords(5000)).toBe("ஐயாயிரம்");
        expect(numberToWords(10000)).toBe("பத்தாயிரம்");
        expect(numberToWords(1995)).toBe("ஆயிரத்து தொள்ளாயிரத்து தொண்ணூற்றி ஐந்து");
        expect(numberToWords(2243)).toBe("இரண்டாயிரத்து இருநூற்றி நாற்பத்தி மூன்று");
    });

    it("lakh and crore take the attributive ஒரு", () => {
        expect(numberToWords(100000)).toBe("ஒரு லட்சம்");
        expect(numberToWords(5000000)).toBe("ஐம்பது லட்சம்");
        expect(numberToWords(783562)).toBe("ஏழு லட்சத்து எண்பத்தி மூவாயிரத்து ஐந்நூற்றி அறுபத்தி இரண்டு");
        expect(numberToWords(10000000)).toBe("ஒரு கோடி");
    });

    it("the ordinal stem is regular over every word the compositor can end on", () => {
        for (const [w, want] of [
            ["ஒன்று", "ஒன்ற"], ["நான்கு", "நான்க"], ["பத்து", "பத்த"], ["தொண்ணூறு", "தொண்ணூற"],
            ["ஆயிரம்", "ஆயிரம"], ["தொள்ளாயிரம்", "தொள்ளாயிரம"], ["கோடி", "கோடிய"],
        ] as const) expect(ordinalStem(w)).toBe(want);
    });
});

describe("Tamil normalization", () => {
    it("de-groups BOTH grouping systems before the comma is read as a pause", () => {
        // Western 3-digit and Indian 2-then-3. 5,000,000 used to read "ஐந்து <pause> பூஜ்ஜியம் …".
        expect(normalizeTamil("2,243")).toBe("2243");
        expect(normalizeTamil("5,000,000")).toBe("5000000");
        expect(normalizeTamil("7,83,562")).toBe("783562");
        // …but a genuine list is always spaced in this corpus and must survive.
        expect(normalizeTamil("11, 12 வது")).toBe("11, பன்னிரண்டாவது");
        expect(phonemize("2,243", "ta")).not.toContain(",");
    });

    it("fuses the ordinal suffix onto the final cardinal word", () => {
        expect(normalizeTamil("2019-ஆம் ஆண்டு")).toBe("இரண்டாயிரத்து பத்தொன்பதாம் ஆண்டு");
        expect(normalizeTamil("5ஆம் நிலை")).toBe("ஐந்தாம் நிலை");
        expect(normalizeTamil("16 ம் நூற்றாண்டு")).toBe("பதினாறாம் நூற்றாண்டு");
        expect(normalizeTamil("60 வது கோல்")).toBe("அறுபதாவது கோல்");
        expect(normalizeTamil("1000ஆவது")).toBe("ஆயிரமாவது");
    });

    it("clock: the colon is not a pause, and :00 minutes are dropped", () => {
        expect(normalizeTamil("10:08 மணிக்கு")).toBe("10 08 மணிக்கு");
        expect(normalizeTamil("11:00 மணிக்கு")).toBe("11 மணிக்கு");
        expect(normalizeTamil("06:30 முதல் 07:30")).toBe("06 30 முதல் 07 30");
        expect(normalizeTamil("(15.00 UTC)")).toBe("(15 UTC)"); // the dotted clock, zone-marked
        expect(phonemize("10:08 மணிக்கு", "ta")).not.toContain(",");
    });

    it("decimals read digit-by-digit after புள்ளி, and units keep their number", () => {
        expect(normalizeTamil("2.2 மில்லியன்")).toBe("2 புள்ளி 2 மில்லியன்");
        expect(normalizeTamil("3.50 மீ")).toBe("3 புள்ளி 5 0 மீ");
        expect(normalizeTamil("35 mm")).toBe("35 மில்லிமீட்டர்");
        expect(normalizeTamil("3,850 km²")).toBe("3850 சதுர கிலோமீட்டர்"); // exponent: "before", spaced
    });

    it("rate units are a DATIVE PREFIX, and are not doubled when the text already has one", () => {
        expect(normalizeTamil("480 km/h")).toBe("மணிக்கு 480 கிலோமீட்டர்");
        expect(normalizeTamil("133 m/s")).toBe("வினாடிக்கு 133 மீட்டர்");
        expect(normalizeTamil("300 mph")).toBe("மணிக்கு 300 மைல்");
        expect(normalizeTamil("மணிக்கு 480 km/h")).toBe("மணிக்கு 480 கிலோமீட்டர்");
    });

    it("currency and percent", () => {
        expect(normalizeTamil("$10")).toBe("10 டாலர்");
        expect(normalizeTamil("US$ 30")).toBe("30 டாலர்");
        expect(normalizeTamil("$2.3 பில்லியன்")).toBe("2 புள்ளி 3 பில்லியன் டாலர்");
        expect(normalizeTamil("93%")).toBe("93 சதவீதம்");
    });

    it("era markers expand, and keep the space after them", () => {
        expect(normalizeTamil("கிமு 10,000")).toBe("கிறிஸ்துவுக்கு முன் 10000");
        expect(normalizeTamil("கி.மு. 356")).toBe("கிறிஸ்துவுக்கு முன் 356");
        expect(normalizeTamil("(கி.பி 1000)")).toBe("(கிறிஸ்துவுக்கு பின் 1000)");
    });

    it("Tamil unit abbreviations, dotted or not — without matching inside a word", () => {
        expect(normalizeTamil("12 கிமீ")).toBe("12 கிலோமீட்டர்");
        expect(normalizeTamil("1600 கி.மீ")).toBe("1600 கிலோமீட்டர்");
        expect(normalizeTamil("12.8 கி மி")).toBe("12 புள்ளி 8 கிலோமீட்டர்");
        expect(normalizeTamil("5 மிமீ")).toBe("5 மில்லிமீட்டர்");
        // trap #2: these all CONTAIN the abbreviation's letters and must not be touched.
        expect(normalizeTamil("எஸ்கிமோ பழங்குடியினர்")).toBe("எஸ்கிமோ பழங்குடியினர்");
        expect(normalizeTamil("சுருக்கி மிகவும்")).toBe("சுருக்கி மிகவும்");
        expect(normalizeTamil("நுண்ணோக்கி மூலமாக")).toBe("நுண்ணோக்கி மூலமாக");
    });

    it("dotted initialisms lose their interior dots but never a sentence-final pause", () => {
        expect(normalizeTamil("எம்.ஆர்.ஐ துறையில்")).toBe("எம் ஆர் ஐ துறையில்");
        expect(normalizeTamil("ஜி. டி. பி இன்")).toBe("ஜி டி பி இன்");
        expect(normalizeTamil("ஐ.நா. முகாமில்")).toBe("ஐ நா முகாமில்");
        expect(normalizeTamil("1 யு.எஸ்.")).toBe("1 யு எஸ்."); // sentence end — the dot stays
        // trap #2 again: a real sentence boundary looks identical in Tamil, which has no case.
        expect(normalizeTamil("கட்பேக், 21 ஆகியோர் ஆவர். கட்பேக்தான் வண்டி"))
            .toBe("கட்பேக், 21 ஆகியோர் ஆவர். கட்பேக்தான் வண்டி");
        expect(phonemize("எம்.ஆர்.ஐ துறையில்", "ta")).not.toContain(".");
    });

    it("fractions, degrees, the bare locative clitic, and zero-width characters", () => {
        expect(normalizeTamil("29 3/4")).toBe("29 முக்கால்");
        expect(normalizeTamil("24 1/2")).toBe("24 அரை");
        expect(normalizeTamil("(1/5 அங்குல)")).toBe("(ஐந்தில் ஒரு பங்கு அங்குல)");
        expect(normalizeTamil("35 ° W")).toBe("35 டிகிரி W");
        // ல் alone is a single consonant and reached the IPA as a bare [l].
        expect(normalizeTamil("1444-ல்")).toBe("1444 இல்");
        expect(normalizeTamil("1920ல்")).toBe("1920 இல்");
        expect(normalizeTamil("ஸ்டைல் ​​ஸ்கை")).toBe("ஸ்டைல் ஸ்கை"); // ⚠ TWO ZWSP U+200B after the space
    });

    it("Tamil DIGITS ௦–௯ do not occur in the corpus, but are folded anyway", () => {
        // The negative result stands: the ta_in digit inventory is entirely ASCII. The fold exists because
        // WITHOUT it the engine returned an EMPTY STRING for a Tamil numeral — `\d+` is ASCII-only, so it
        // matched no token and assembleClauses dropped it. Silent total loss, so worth folding regardless.
        expect(normalizeTamil("௧௨")).toBe("12");
        expect(phonemize("௧௨", "ta")).toBe(phonemize("12", "ta"));
    });

    it("the PLUS is read பிளஸ், sourced from the corpus's own audio", () => {
        // Wikidata returns the bare character `+` as ta's label for "plus sign", and prose writes the glyph,
        // so no text tier could answer this. IndicConformer 600m over ta_in/train:
        //   UTC+1  → "…யூடிசி பிளஸ் ஒன்…"  (2 of 3 speakers; the third skipped the parenthetical entirely)
        //   +30 °C → "…வெப்பம் பிளஸ் முப்பது டிகிரி சி…"  (1 speaker — the only row ta_in has)
        // ⚠ NOT a fleet default: both hi speakers OMIT the plus before a temperature (see hindi.test.ts).
        expect(normalizeTamil("UTC+1")).toContain("பிளஸ்");
        expect(normalizeTamil("+30 டிகிரி")).toContain("பிளஸ்");
        // A designation keeps its silent hyphen — the plus arms must not have widened the sign rules.
        expect(normalizeTamil("சந்திரயான் -1")).not.toContain("பிளஸ்");
    });
});
