/**
 * CMUDICT WRITES `AH0` WHERE THE VOWEL IS `/ɪ/`, in `-ist`, `-sis` and `-age`.
 *
 * `activist` is `AE1 K T AH0 V AH0 S T`, and the second unstressed slot is not a schwa — it is the
 * `-ist` vowel. Rendering it through the AH path gave *ˈæktəvəst, and the dictionary contradicted
 * itself about it: `abolitionist` came out `…ʃənəst` and `abortionist` `…ʃənɪst`, the same suffix
 * spelled two ways one row apart.
 *
 * docs/investigations/en/en_suffix_weak_vowel_investigation.md.
 */
import { describe, expect, test } from "vitest";
import { makeArpabetToIpa } from "../src/languages/english/englishArpabet.ts";
import { MANIFEST } from "../src/languages/english/manifest.ts";

const toIpa = makeArpabetToIpa(MANIFEST.arpabet);
const ipa = (word: string, arpabet: string) => toIpa(arpabet.split(" "), word);

describe("the -ist / -sis / -age vowel is ɪ, not schwa", () => {
    // ⚠ `-is`, NOT `-sis`, AND THE FIRST VERSION OF THIS RULE GOT THAT WRONG. Testing `/sis$/` split the
    // ending from itself: `analysis` was right and `arthritis` read *ɑːɹθɹˈaᶦt̬əs one row away. The half
    // `/sis$/` missed is the STRONGER half — 35 of 36 referee rows `ɪ` (97.2%) with zero `ə`, against 9 of
    // 12 for `-sis` itself — and misaki's gold cannot arbitrate it: over the 88 dict words this rule
    // targets, gold writes `ɪ` on 48 and `ə` on 40, the same ending both ways with no discriminator
    // (`analysis` ɪ, `arthritis` ə; `axis` ɪ, `aegis` ə). The consistent source wins.
    test("-is is one family, whatever precedes the s", () => {
        expect(ipa("arthritis", "AA0 R TH R AY1 T AH0 S")).toBe("ɑːɹθɹˈaᶦt̬ɪs");
        expect(ipa("analysis", "AH0 N AE1 L AH0 S AH0 S")).toBe("ənˈæləsɪs");
        expect(ipa("axis", "AE1 K S AH0 S")).toBe("ˈæksɪs");
        expect(ipa("tennis", "T EH1 N AH0 S")).toBe("tʰˈɛnɪs");
    });

    // ⚠ THE PHONE GUARD DOES THE DISCRIMINATING, NOT THE SPELLING. Widening to `/is$/` sweeps in every
    // common word ending in those letters, and the stressed-vowel and final-S tests refuse them all.
    test("a stressed or voiced -is is refused", () => {
        expect(ipa("this", "DH IH1 S")).toBe("ðˈɪs");     // stressed IH1
        expect(ipa("his", "HH IH1 Z")).toBe("hˈɪz");      // Z, not S
    });

    test("the three families", () => {
        expect(ipa("activist", "AE1 K T AH0 V AH0 S T")).toBe("ˈæktəvɪst");      // gold ˈæktəvɪst
        expect(ipa("analysis", "AH0 N AE1 L AH0 S AH0 S")).toBe("ənˈæləsɪs");     // gold ənˈæləsɪs
        expect(ipa("cabbage", "K AE1 B AH0 JH")).toBe("kʰˈæbɪd͡ʒ");                // gold kˈæbɪʤ
    });

    test("the suffix no longer has two spellings", () => {
        // These two rows differed in the dictionary and so differed in the reading, one row apart.
        expect(ipa("abolitionist", "AE2 B AH0 L IH1 SH AH0 N AH0 S T")).toContain("ɪst");
        expect(ipa("abortionist", "AH0 B AO1 R SH AH0 N IH0 S T")).toContain("ɪst");
    });

    // ⚠ THE SUFFIX'S OWN VOWEL, WHICH IS THE LAST ONE. Scanning every AH0 that precedes an S fired on
    // the PREFIX instead and was measurably wrong — 58 regressions, all of this shape.
    test("a prefix AH0 before an S is not the suffix vowel", () => {
        expect(ipa("assist", "AH0 S IH1 S T")).toBe("əsˈɪst");            // not *ɪsˈɪst
        expect(ipa("aphesis", "AE1 F AH0 S AH0 S")).toBe("ˈæfəsɪs");      // gold ˈæfəsɪs — only the LAST
    });

    // ⚠ A SINGULAR AND ITS OWN PLURAL MUST AGREE, and the first version of this rule broke that. It took
    // "the last vowel", which is the suffix's own vowel in `package` (P AE1 K AH0 JH) but NOT in
    // `packages` (P AE1 K AH0 JH AH0 Z), where the inflection has moved past it — so the singular read
    // `pʰˈækɪd͡ʒ` and the plural stayed `pʰˈækəd͡ʒᵻz`. That is the two-spellings-per-morpheme defect
    // `en_rebuild_lexicon.mts` exists to warn about, introduced by the fix for another one.
    //
    // ⚠ AND THE REFERENCE CANNOT SEE IT: gold has no entry for `packages`, `messages` or `cottages`, so
    // the score was identical either way (+357 / −3 both times). This case is the only thing that holds it.
    test("a singular and its plural agree", () => {
        expect(ipa("package", "P AE1 K AH0 JH")).toBe("pʰˈækɪd͡ʒ");
        expect(ipa("packages", "P AE1 K AH0 JH AH0 Z")).toBe("pʰˈækɪd͡ʒᵻz");
        expect(ipa("activist", "AE1 K T AH0 V AH0 S T")).toBe("ˈæktəvɪst");
        expect(ipa("activists", "AE1 K T AH0 V AH0 S T S")).toBe("ˈæktəvɪsts");
    });

    // ⚠ `-ism` IS NOT IN THE SET. Its vowel is `IH2 Z AH0 M`: the S is voiced to Z, and the schwa before
    // the M is a real schwa. Including it in the spelling test only produced false fires.
    test("-ism keeps its schwa", () => {
        expect(ipa("protestantism", "P R AA1 T AH0 S T AH0 N T IH2 Z AH0 M")).toContain("zəm");
        expect(ipa("protestantism", "P R AA1 T AH0 S T AH0 N T IH2 Z AH0 M")).toContain("ɑːt̬əst");
    });

    // ⚠ `-est` IS THE OTHER HALF OF THIS FAMILY AND LIVES IN `isBarredI`, NOT HERE, because gold reaches
    // for a different symbol: it writes `ᵻ` on 101 of the 111 `-est` words it carries (91%) where it
    // writes a full `ɪ` for `-ist`/`-is`. The en-GB referee, which has no `ᵻ`, writes `ɪ` on 26 of 41
    // (63%). The two halves are told apart by asking gold WHICH symbol, not by which ending looks similar.
    test("-est takes the weak vowel, not the full ɪ", () => {
        expect(ipa("weakest", "W IY1 K AH0 S T")).toBe("wˈiːkᵻst");
        expect(ipa("biggest", "B IH1 G AH0 S T")).toBe("bˈɪɡᵻst");
    });

    // ⚠ AND SIX LEXICAL `-est` WORDS ARE NOT SUPERLATIVES. gold writes a plain schwa on exactly these ten
    // of its 111 (`forest`, `harvest`, `honest`, `modest`, `tempest`, `interest` and their derivatives)
    // and on no others. A stem test does NOT separate them — stripping `est` and looking the remainder up
    // finds a dictionary word for eight of the ten — so the list is explicit.
    test("the lexical -est words keep their schwa", () => {
        expect(ipa("forest", "F AO1 R AH0 S T")).toContain("əst");
        expect(ipa("honest", "AA1 N AH0 S T")).toContain("əst");
        expect(ipa("rainforest", "R EY1 N F AO2 R AH0 S T")).toContain("əst");
        expect(ipa("dishonest", "D IH0 S AA1 N AH0 S T")).toContain("əst");
    });

    // ⚠ `-ness` AND `-less` ARE DELIBERATELY ABSENT, and this is the case that records why. misaki's gold
    // writes `ɪ` in both — 375 `-ness` words and 34 `-less` words diverge from us on exactly that, making
    // it the LARGEST family in the class and the obvious thing to add. The referee says the opposite:
    // `ə` on 81.0% of 100 `-ness` rows and 74.4% of 43 `-less` rows, and the en-GB referee leans TOWARD
    // `ɪ` by construction, which makes that reading stronger. Following the reference here would have
    // regressed 409 words.
    test("-ness and -less keep their schwa, against the reference", () => {
        expect(ipa("bounciness", "B AW1 N S IY0 N AH0 S")).toContain("nəs");
        expect(ipa("careless", "K EH1 R L AH0 S")).toContain("ləs");
    });
});
