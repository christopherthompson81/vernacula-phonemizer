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

    test("⚠ AN UNDECLARED LANGUAGE KEEPS THE DIGITS — the mark was NOT staying visible, it was being eaten", () => {
        // ⚠ THIS TEST USED TO CERTIFY THE BUG. It asserted only that the BASE survived (`slice(0, 4)` of
        // `phonemize("20")`), so it passed while the exponent was deleted, and its comment claimed the mark
        // "stays where the RAWMARK leak gate can see it". It does not: the mark survives the symbol tier and
        // is then dropped by the language's own tokenizer, which knows no `²`. 169 of 193 registry codes
        // read `10⁶` as *ten* — sw *kˈumi*, ha *ɡˈo˥ma˩*, id *səpˈuluh* — and `(1.60*10⁻¹⁹)`, the elementary
        // charge, as *one point six zero ten* in three shipped goldens.
        // An undeclared language cannot say "squared", but it CAN say the digit, so it now does.
        expect(phonemize("10⁶", "sw")).toBe(phonemize("10 6", "sw"));
        expect(phonemize("20²", "sw")).toBe(phonemize("20 2", "sw"));
        expect(phonemize("10⁶", "id")).toBe(phonemize("10 6", "id"));
        expect(phonemize("10⁶", "ha")).toBe(phonemize("10 6", "ha"));
        // …and the base is still there, which is all the old assertion ever checked.
        const before = phonemize("20", "sw");
        expect(phonemize("20²", "sw")).toContain(before.replace(/[ˈˌ]/gu, "").trim().slice(0, 4));
    });

    test("⚠ THE FALLBACK IS DIGIT-BASE ONLY, and that is the axis the Sinitic dirs declined on", () => {
        // A LETTER base is a unit, a tone number, an isotope or a footnote far more often than a power —
        // which is precisely why seven Sinitic corpora and `so` refused to declare `bareExponent` at all.
        // The fallback declines every one of those and keeps only the digit-base powers `so`'s own note
        // counted as the prize (×26). `mc²` loses nothing it had: it was already silent here.
        expect(phonemize("E = mc²", "sw")).toBe(phonemize("E = mc", "sw"));
        expect(phonemize("/ʃɘ̃⁴⁵/", "hsn")).toBe(phonemize("/ʃɘ̃/", "hsn")); // a Xiang romanization TONE
        // …while the one real exponent in the same corpus now reads its magnitude.
        expect(phonemize("5.9742×10²⁴", "hsn")).not.toBe(phonemize("5.9742×10", "hsn"));
    });

    test("⚠ A UNIT BESIDE THE MARK OWNS IT — the Kirundi regression, and its mirror image", () => {
        // `km²` is the unit path's, and it must not be starved by the fallback: Kirundi reads
        // `93 personnes/km²` as *kiɾometeɾo kwadaɾato* through its own step 8, and an earlier version of this
        // fallback turned it into *kiɾometeɾo kabiɾi* — kilometre TWO.
        expect(phonemize("93 personnes/km²", "rn")).toContain("kiɾometeɾo kwadaɾato");
        // ⚠ AND THE UNIT MAY STAND ON EITHER SIDE. Abkhaz writes the mark BEFORE the noun — `3540² км`,
        // `5,23² км`, `0,5 ² км` — where the digit base makes it look bare and it is not: those are SQUARE
        // kilometres, and reading the mark out gives a second numeral beside a real one. Clearing it also
        // RESTORES the unit, whose adjacency to the number the mark was breaking: a raw `kʼm` in three
        // Abkhaz golden rows became *kʼilometʼra*.
        expect(phonemize("3540² км", "ab")).toBe(phonemize("3540 км", "ab"));
        expect(phonemize("0,5 ² км", "ab")).toBe(phonemize("0,5 км", "ab"));
        expect(phonemize("3540² km", "sw")).toBe(phonemize("3540 km", "sw"));
        // ⚠ ONLY A SQUARE OR A CUBE. No text writes a kilometre to the sixth, so a larger power beside a unit
        // is the NUMBER's magnitude and keeps its digits — `10⁶ km` is a million kilometres.
        // (the word ORDER differs from `10 6 km`, whose unit rule binds the unit to the `6`; what matters is
        // that both the magnitude and the unit are spoken.)
        expect(phonemize("10⁶ km", "sw")).toBe("kˈumi sˈita kilomˈita");
    });

    test("⚠ A LONE ⁰ OR ¹ IS A DEGREE SIGN OR A PRIME, not a power", () => {
        // Measured over the mined artifacts: every lone one is a MARK. Sinhala writes latitude `6⁰03 '` and
        // temperature `133 ⁰C` (its own layer already lists U+2070 in its degree class); Mongolian writes a
        // whole coordinate as `110⁰04¹05¹`, spending ⁰ ¹ ¹ for ° ′ ″; Kinyarwanda numbers a list `4⁰ Ihame`.
        // Nothing writes x⁰ or x¹ — both are identities no author states — so the reading declined here has
        // no case to serve and one attested class of text to damage. It was *three hundred sixty to the
        // power of zero* before.
        expect(phonemize("360⁰", "en")).toBe(phonemize("360", "en"));
        expect(phonemize("4⁰ Ihame", "rw")).toBe(phonemize("4 Ihame", "rw"));
        // ⚠ MULTI-DIGIT RUNS STARTING WITH EITHER ARE UNTOUCHED — `10¹⁰`, `10¹⁰⁰` and `10⁵⁰` are real powers.
        expect(phonemize("10¹⁰", "en")).toContain("pʰˈaᶷɚ ʌv tʰˈɛn");
        expect(phonemize("10¹⁰⁰", "en")).toContain("pʰˈaᶷɚ ʌv wˈʌn hˈʌndɹəd");
        expect(phonemize("2⁰⁵", "en")).toContain("pʰˈaᶷɚ");
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

    test("⚠ AN ENGINE OFF THE SHARED TIER CALLS THE SAME PASS — ps and he", () => {
        // 52 engines do not use `makeSymbolNormalizer` at all; each carries its own unit table because the
        // tier cannot express its word order. They reach the fallback by calling `spacedBareExponent`
        // themselves, AFTER their own unit rule — one implementation rather than 52.
        //
        // ⚠ ps IS THE ONE WITH THE EVIDENCE: 5 rows of its artifact write scientific notation and every one
        // read as bare *lˈəs* ("ten"). Of the 37 codes still off the fallback after #1044, only ps and he had
        // a case at all; 30 have no digit-base superscript in their corpus and are deliberately left alone.
        expect(phonemize("10⁶", "ps")).toBe(phonemize("10 6", "ps"));
        expect(phonemize("2×10³⁰", "ps")).toContain(phonemize("30", "ps").trim()); // the magnitude survives
        // …and ps's own refusals are untouched: `km²` still reads as the unit with the power dropped, which
        // is a missing WORD it has no source for, not a deleted digit.
        expect(phonemize("۵ km²", "ps")).toContain("mət̪ˈər mərbˈəʔ");
        expect(phonemize("10⁻¹⁹", "ps")).toBe(phonemize("10", "ps")); // negative still declined

        // he reads `²` with its own ×3-attested בריבוע and must keep first claim on it.
        expect(phonemize("8² = 64", "he")).toContain("beʁibua");
        expect(phonemize("10²", "he")).toContain("beʁibua");
        expect(phonemize("15 km³", "he")).toContain("kilometeʁ meʔukav");
        // ⚠ ONLY THE POWERS בריבוע CANNOT NAME fall through — and this repairs ZERO rows of he's artifact,
        // whose 6 superscript rows are all squares. Robustness, stated as such.
        expect(phonemize("10⁶", "he")).toBe(phonemize("10 6", "he"));
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
