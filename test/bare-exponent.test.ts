/**
 * ARBITRARY EXPONENT READING — squared, cubed, and "to the power of N" on a BARE base.
 *
 * ⚠ EXPONENT MACHINERY BUILT AROUND UNITS DROPS A BARE POWER SILENTLY. Measured on one probe across eight
 * languages, `20²` read as the plain number in every one — en *twˈɛnti*, de *t͡svˈant͡sɪç*, fr *vˈɛ̃*,
 * es *bˈeᶦnte*, it *vˈenti*, hi *bˈiːs*, pt *vˈĩtɨ*, ru *dvˈat͡sətʲ* — because a power with nothing to
 * modify never reached a rule.
 *
 * ⚠ THE PREDICATE IS A DIFFERENT WORD FROM THE UNIT MODIFIER, which is why this needed new data rather than a
 * reuse: English reads *square kilometres* but *twenty SQUARED*; Italian *chilometri quadrati* but
 * *venti AL quadrato*, with a connective the modifier form does not carry.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

/** The declared languages, and the reading each must produce. */
const CASES: [string, string, string][] = [
    // lang, input, a substring the reading must contain
    ["en", "20²", "skwˈɛɹd"],
    ["en", "8³", "kjˈuːbd"],
    ["en", "2¹⁰", "pʰˈaᶷɚ"],
    ["de", "20²", "kvadʁˈaːt"],
    ["de", "2¹⁰", "hoːx"],
    ["fr", "20²", "kaʁˈe"],
    ["fr", "2¹⁰", "pɥisɑ̃s"],
    ["es", "20²", "kwaðɾˈaðo"],
    ["es", "2¹⁰", "eleβˈaðo"],
    ["it", "20²", "kwadrˈato"],
    ["it", "2¹⁰", "elevˈato"],
    ["pt", "20²", "kwɐdɾˈadu"],
    ["ru", "20²", "kvɐdrˈatʲe"],
    ["ru", "2¹⁰", "sʲtʲˈepʲɪnʲɪ"],
    ["ja", "20²", "nid͡ʑo̞ː"],
    ["cmn", "20²", "pʰiŋ˧˥ fɑŋ˥˥"],
    ["hi", "20²", "ʋˈəɾɡ"],
    ["hi", "2¹⁰", "ɡʱˈaːt̪"],
];

describe("bare exponent", () => {
    test("squared, cubed and the generic power all read", () => {
        for (const [lang, input, want] of CASES)
            expect(phonemize(input, lang), `${lang} ${input}`).toContain(want);
    });

    test("⚠ THE UNIT PATH IS UNTOUCHED — it must have first claim on a unit exponent", () => {
        // Ordered after the unit rule for exactly this reason: matching first would turn every `km²` into
        // "kilometre squared" instead of "square kilometres".
        expect(phonemize("19500 km²", "en")).toContain("skwˈɛɹ kəlˈɑːmʌt̬ɚz");
        expect(phonemize("19500 km²", "de")).toContain("kvadʁˈaːtkilomeːtɐ");
        expect(phonemize("19500 km²", "it")).toContain("kilomˈetri kwadrˈati");
        expect(phonemize("19500 km²", "hi")).toContain("ʋˈəɾɡ kɪloːmˈiːʈəɾ");
        expect(phonemize("19500 km²", "cmn")).toContain("pʰiŋ˧˥ fɑŋ˥˥ koŋ˥˥ li˨˩˦");
        // Count agreement on the unit side still works — "one cubic meter", not "meters".
        expect(phonemize("1 m³", "en")).toContain("kjˈuːbɪk mˈiːt̬ɚ");
    });

    test("the base may be LETTERS, not only digits", () => {
        // The case that exposed the gap: `E = mc²` read as *ˈiː ˈiːkwəɫz mˈɪk* — equals voiced, square gone.
        expect(phonemize("E = mc²", "en")).toContain("skwˈɛɹd");
        expect(phonemize("x⁷", "en")).toContain("pʰˈaᶷɚ ʌv sˈɛvən");
    });

    test("a superscript travels with an embedded FOREIGN run", () => {
        // `²` is `No`, not `\\p{L}`, so the foreign-run pattern used to end at `mc` and leave the exponent in
        // the gap to be dropped. English can read the whole formula once it is handed all of it, so the fix is
        // to stop cutting the expression in half — not to invent a Burmese reading for an English formula.
        expect(phonemize("relativity and E = mc² ကို", "my")).toContain("skwˈɛɹd");
        expect(phonemize("คำว่า E = mc² คือ", "th")).toContain("skwˈɛɹd");
        // Routing of ordinary foreign runs is unaffected.
        expect(phonemize("Слово hello значит", "ru")).toContain("həlˈoᶷ");
        expect(phonemize("Ο Πούτιν και ο Владимир", "el")).toContain("vɫɐdʲ");
    });

    test("an UNDECLARED language is unchanged — the gap stays visible, not silently guessed", () => {
        // `bareExponent` is optional and most of the fleet has not declared it. Those languages keep the old
        // behaviour rather than borrowing another language's word order, and the superscript stays where the
        // RAWMARK leak gate can see it — the same choice the unit branch makes for a missing measure word.
        const before = phonemize("20", "sw");
        expect(phonemize("20²", "sw")).toContain(before.replace(/[ˈˌ]/gu, "").trim().slice(0, 4));
    });

    test("`¹` and `⁰` read plainly through the generic form", () => {
        // Not special-cased: "to the power of one" is correct and vanishingly rare, where inventing a word for
        // it would not be.
        expect(phonemize("10⁰", "en")).toContain("pʰˈaᶷɚ ʌv zˈɪɹoᶷ");
        expect(phonemize("10¹", "en")).toContain("pʰˈaᶷɚ ʌv wˈʌn");
    });

    test("⚠ A FOOTNOTE MARKER IS NOT AN EXPONENT — the length cap and its boundary guard", () => {
        // A superscript on an ordinary word is a citation far more often than a power, and reading one as
        // arithmetic is the confidently-wrong outcome this repo ranks below silence. So a LETTER base is capped
        // at three characters — variables are short, prose words are not.
        expect(phonemize("Smith¹ said", "en")).not.toContain("pʰˈaᶷɚ");
        expect(phonemize("the theory² holds", "en")).not.toContain("skwˈɛɹd");
        expect(phonemize("evidence³ shows", "en")).not.toContain("kjˈuːbd");
        // ⚠ THE CAP ALONE DOES NOTHING. `{1,3}` matches the LAST three letters of a long word, so `Smith¹`
        // matches `ith` and still reads *smˈɪθ tʰuː ðə pʰˈaᶷɚ ʌv wˈʌn*. The `(?<![A-Za-z])` boundary is what
        // makes a length limit limit anything.
        expect(phonemize("Smith¹ said", "en")).toBe(phonemize("Smith said", "en"));
        // Short bases — real mathematical variables — are unaffected.
        expect(phonemize("mc²", "en")).toContain("skwˈɛɹd");
        expect(phonemize("x⁷", "en")).toContain("pʰˈaᶷɚ");
    });

    test("NEGATIVE exponents", () => {
        // ⚠ U+207B SUPERSCRIPT MINUS must be in the superscript run. Without it `10⁻³¹` reads as bare
        // *tʰˈɛn* — sign and power both gone.
        expect(phonemize("10⁻³¹", "en")).toContain("pʰˈaᶷɚ ʌv nˈɛɡət̬ɪv");
        expect(phonemize("2⁻⁵", "en")).toContain("nˈɛɡət̬ɪv fˈaᶦv");
        // Every declared language reads it, each with its OWN sign word taken from its existing minus rule.
        for (const [lang, want] of [["de", "mˈiːnʊs"], ["fr", "mwɛ̃"], ["es", "mˈenos"], ["it", "mˈeno"],
            ["pt", "mˈenuʃ"], ["ru", "mʲˈinʊs"], ["hi", "ɾˈɪɳ"]] as [string, string][])
            expect(phonemize("10⁻³¹", lang), lang).toContain(want);
        // A negative exponent always takes the GENERIC power form: `10⁻²` is "to the power of minus two",
        // never "minus squared" — no language has a word for that.
        expect(phonemize("10⁻²", "en")).toContain("pʰˈaᶷɚ ʌv nˈɛɡət̬ɪv tʰˈuː");
    });

    test("SCIENTIFIC NOTATION keeps its unit — the superscript broke their adjacency", () => {
        // ⚠ THE UNIT LEAKED. A superscript sits BETWEEN the number and the unit, so the unit rule's adjacency
        // failed and `9.11 × 10⁻³¹ kg` reached the phoneme stream with a RAW `kɡ` — worse than the dropped
        // exponent beside it. Resolving the exponent BEFORE the unit rule leaves its digits next to the unit.
        const sup = phonemize("9.11 × 10⁻³¹ kg", "en");
        expect(sup).toContain("pʰˈaᶷɚ ʌv nˈɛɡət̬ɪv");
        expect(sup).toContain("kʰˈɪləɡɹˌæmz");
        expect(sup).not.toMatch(/kɡ/u);
        // The ASCII form is the one that actually occurs — both real instances write the exponent as plain
        // digits with the superscript lost (`9.1093837 × 10 -31 kg`, `2.5×10 -11 m`, my's artifact).
        expect(phonemize("9.11 × 10 -31 kg", "en")).toContain("pʰˈaᶷɚ ʌv nˈɛɡət̬ɪv");
        expect(phonemize("2.5×10 -11 m", "en")).toContain("mˈiːt̬ɚz");
        // ⚠ AND IT MUST RUN BEFORE THE SIGN RULE. Placed after, step 0e had already rewritten `-31` to
        // "negative 31", the ASCII pattern could no longer match, and the reading kept saying "ten negative
        // thirty-one" — sign present, power missing.
        expect(phonemize("9.11 × 10 -31 kg", "en")).toContain("tʰuː ðə pʰˈaᶷɚ");
        // ⚠ SUBTRACTION IS NOT SCIENTIFIC NOTATION. The `×` and the ATTACHED minus are the discriminators.
        expect(phonemize("10 - 31 people", "en")).not.toContain("pʰˈaᶷɚ");
        expect(phonemize("from 10 - 31", "en")).not.toContain("pʰˈaᶷɚ");
    });

    test("⚠ THREE ENCODINGS, ONE READING — including the markup form that flattening destroys", () => {
        // A caller hands a phonemizer whichever encoding is at hand. All three must land on the same reading.
        const want = phonemize("19,500 km²", "en");
        expect(phonemize("19,500 km<sup>2</sup>", "en")).toBe(want);   // HTML markup
        expect(phonemize("19,500 km&sup2;", "en")).toBe(want);         // HTML named entity
        expect(phonemize("19,500 km^2", "en")).toBe(want);             // caret, as a programmer types it
        expect(phonemize("19,500 km&#178;", "en")).toBe(want);         // numeric entity (already worked)

        const neg = phonemize("9.11 × 10⁻³¹ kg", "en");
        expect(phonemize("9.11 × 10<sup>-31</sup> kg", "en")).toBe(neg);
        expect(phonemize("9.11 × 10^-31 kg", "en")).toBe(neg);

        // ⚠ THE MARKUP CASE IS A LOSS THE PIPELINE CAUSES, not one the source arrived with. Stripping `<sup>`
        // leaves the digits INLINE, so `2.802×10<sup>10</sup>` becomes `2.802×1010` — the exponent merges into
        // the mantissa. The arithmetic proves which reading was meant: hi's
        // `2,603 वर्ग किलोमीटर (2.802×1010 वर्ग फुट)` only reconciles as 2.802×10¹⁰ sq ft.
        expect(phonemize("2.802×10<sup>10</sup>", "en")).toContain("pʰˈaᶷɚ ʌv tʰˈɛn");
        // ⚠ AND THE OBVIOUS EXPLANATION IS WRONG — this assertion is what catches it. "The unit case survives
        // flattening because the tier accepts an ASCII exponent" holds for 7 of the 9 tier languages that carry
        // `km2` (el es ml bg ne hu cmn), but NOT for en, sw or nb. In those three the `2`
        // fell out of the unit match and read as a SEPARATE NUMBER: "nineteen thousand five hundred kilometres
        // TWO". Audibly wrong, and invisible to both gates — no superscript survives to leak, nothing vanishes.
        // en now accepts the ASCII exponent (bounded by the unit list, so `H2O` cannot match). sw and nb differ
        // for another reason: they declare no `exponentWords`, so the tier hands the exponent back BY DESIGN —
        // a visible missing WORD in their data, which is the documented behaviour and not this bug.
        expect(phonemize("19,500 km2", "en")).toBe(want);
        expect(phonemize("1 m3", "en")).toBe(phonemize("1 m³", "en"));
        // The unit list is the guard: these are not units and must be untouched.
        expect(phonemize("H2O", "en")).toContain("tʰˈuː");
        expect(phonemize("802.11g", "en")).toContain("d͡ʒˈiː");
    });

    test("the caret guard is tight, and `<sub>` is deliberately NOT mapped", () => {
        // A caret must follow a letter or digit and be followed only by (optionally signed/braced) digits.
        expect(phonemize("a ^ b", "en")).not.toContain("pʰˈaᶷɚ");
        expect(phonemize("2^10", "en")).toContain("pʰˈaᶷɚ ʌv tʰˈɛn");
        expect(phonemize("10^{10}", "en")).toContain("pʰˈaᶷɚ ʌv tʰˈɛn");
        // ⚠ SUBSCRIPTS STAY ASCII. Nothing reads a subscript digit, so rendering `<sub>2</sub>` to `₂` would take
        // a form that IS spoken and make it silent — the same error as the bug above, pointed the other way.
        expect(phonemize("CO<sub>2</sub> levels", "en")).toContain("tʰˈuː");
        expect(phonemize("H<sub>2</sub>O", "en")).toBe(phonemize("H2O", "en"));
    });

    test("named entities that map to readable characters no longer stay literal", () => {
        expect(phonemize("&minus;5 degrees", "en")).toContain("nˈɛɡət̬ɪv fˈaᶦv");
        expect(phonemize("&plusmn;3", "en")).toContain("plˈʌs ɔːɹ mˈaᶦnəs");
        expect(phonemize("&frac34; cup", "en")).toContain("kwˈɔːɹt̬ɚz");
        // An entity with no readable target is still left as written rather than invented away.
        expect(phonemize("&notareal; thing", "en")).toBeTruthy();
    });

    test("⚠ ENGLISH LEAKS ITS UNIT ACROSS A MAGNITUDE WORD", () => {
        // `2.2 million km2 of ocean` — the archipelago sentence, in en_us — read as *… mˈɪɫjən ˈʊkm tʰˈuː …*:
        // the abbreviation reached the phoneme stream AS RAW LETTERS and the area was lost entirely. Invisible
        // to every gate, because bare Latin letters are in no leak class and nothing vanished for DROP to catch.
        // Same defect the shared tier fixed with `magnitudes`; English does not use that tier.
        const s = phonemize("2.2 million km2 of ocean", "en");
        expect(s).toContain("skwˈɛɹ kəlˈɑːmʌt̬ɚz");
        expect(s).not.toMatch(/ʊkm/u);
        expect(phonemize("2.2 million km² of ocean", "en")).toBe(s);
        // The plain unit leaked too — it is the magnitude that breaks adjacency, not the exponent.
        expect(phonemize("2.2 million km of ocean", "en")).toContain("kəlˈɑːmʌt̬ɚz");
        // A magnitude forces the PLURAL: the singular test looks at the digits alone, so `1 million km` would
        // otherwise read "kilometre".
        expect(phonemize("1 million km", "en")).toContain("kəlˈɑːmʌt̬ɚz");
        expect(phonemize("1 m³", "en")).toContain("kjˈuːbɪk mˈiːt̬ɚ"); // …and the real singular still works
    });
});
