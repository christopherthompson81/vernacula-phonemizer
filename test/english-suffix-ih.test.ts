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
