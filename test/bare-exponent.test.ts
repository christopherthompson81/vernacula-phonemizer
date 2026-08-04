/**
 * ARBITRARY EXPONENT READING (#586) — squared, cubed, and "to the power of N" on a BARE base.
 *
 * Before this, EVERY language in the fleet dropped an exponent that had no unit to modify. Measured on the
 * same probe across eight: `20²` read as the bare number in all of them — en *twˈɛnti*, de *t͡svˈant͡sɪç*,
 * fr *vˈɛ̃*, es *bˈeᶦnte*, it *vˈenti*, hi *bˈiːs*, pt *vˈĩtɨ*, ru *dvˈat͡sətʲ*. The whole exponent machinery
 * was unit-only, so a power with nothing to modify vanished silently.
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
        // ⚠ THE CAP ALONE DID NOTHING. `{1,3}` matches the LAST three letters of a long word, so `Smith¹`
        // matched `ith` and still read *smˈɪθ tʰuː ðə pʰˈaᶷɚ ʌv wˈʌn*. The `(?<![A-Za-z])` boundary is what
        // makes a length limit limit anything, and this test exists because the first version shipped without it.
        expect(phonemize("Smith¹ said", "en")).toBe(phonemize("Smith said", "en"));
        // Short bases — real mathematical variables — are unaffected.
        expect(phonemize("mc²", "en")).toContain("skwˈɛɹd");
        expect(phonemize("x⁷", "en")).toContain("pʰˈaᶷɚ");
    });
});
