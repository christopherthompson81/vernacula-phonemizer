/**
 * THE SECONDARY-STRESS CLASH RULE, RE-MEASURED AGAINST THE REFERENCE.
 *
 * The rule drops a 2° whose syllable is adjacent to the 1°. Its exception used to require a TRUE
 * diphthong (AY/OY/AW) in a CLOSED syllable, and that shape was arrived at by counting rows changed
 * and by not breaking tests — never by asking the reference what it does. Asking it, over 31,760
 * words whose per-nucleus alignment was validated first:
 *
 *   final syllable, CLOSED    gold marks it  1,849 / 1,973   94%   → exempt, whatever the vowel
 *   final syllable, OPEN      gold marks it    167 /   330   51%   → exempt by VOWEL
 *   NOT the final syllable    gold marks it    918 / 1,973   47%   → keep dropping, no signal
 *
 * docs/investigations/en/en_clash_rule_investigation.md.
 */
import { describe, expect, test } from "vitest";
import { makeArpabetToIpa } from "../src/languages/english/englishArpabet.ts";
import { MANIFEST } from "../src/languages/english/manifest.ts";

const toIpa = makeArpabetToIpa(MANIFEST.arpabet);
const ipa = (word: string, arpabet: string) => toIpa(arpabet.split(" "), word);

describe("a 2° on the final syllable survives the clash rule", () => {
    // ⚠ CLOSED FINAL IS EXEMPT WHATEVER THE VOWEL — 94%, and flat across every vowel (AY 95%, AE 89%,
    // AA 94%, EH 95%, OW 91%, IY 99%, UH 97%) and every syllable count. There is no sub-split to find.
    test("a closed final syllable keeps its mark, on any vowel", () => {
        expect(ipa("aardvark", "AA1 R D V AA2 R K")).toBe("ˈɑːɹdvˌɑːɹk");   // gold ˈɑɹdvˌɑɹk
        expect(ipa("abject", "AE1 B JH EH2 K T")).toBe("ˈæbd͡ʒˌɛkt");        // gold ˈæbʤˌɛkt
        expect(ipa("airplane", "EH1 R P L EY2 N")).toBe("ˈɛɹplˌeᶦn");       // gold ˈɛɹplˌAn
        expect(ipa("format", "F AO1 R M AE2 T")).toBe("fˈɔːɹmˌæt");         // gold fˈɔɹmˌæt
        expect(ipa("profile", "P R OW1 F AY2 L")).toBe("pɹˈoᶷfˌaᶦɫ");       // the case the exception began as
    });

    // ⚠ OPEN FINAL SPLITS BY VOWEL, AND THAT SPLIT IS THE WHOLE POINT. Gold marks OY 10/10, AW 8/8,
    // EY 65/71, AY 11/12, AO 10/11, UW 22/33 — against OW 22/104, IY 9/55, AA 5/15. It is the same
    // distinction the original narrowing was reaching for and could not express.
    test("an open final syllable keeps it only on the strong vowels", () => {
        expect(ipa("airway", "EH1 R W EY2")).toBe("ˈɛɹwˌeᶦ");        // gold ˈɛɹwˌA
        expect(ipa("aircrew", "EH1 R K R UW2")).toBe("ˈɛɹkɹˌuː");    // gold ˈɛɹkɹˌu
    });

    // ⚠ AND THE CASE THE RULE WAS BUILT FOR MUST KEEP WORKING. CMUdict writes OW2 on an ordinary final
    // -o, and marking it over-articulates. These three were the documented reason the exception was
    // narrowed in the first place, and they are still dropped — none of them is in gold, so they are
    // held by judgement rather than by measurement, which is exactly why they are pinned.
    test("an ordinary final -o is still not marked", () => {
        expect(ipa("zorro", "Z AO1 R OW2")).toBe("zˈɔːɹoᶷ");
        expect(ipa("aalto", "AA1 L T OW2")).toBe("ˈɑːɫtoᶷ");
        expect(ipa("adolfo", "AH0 D AA1 L F OW2")).toBe("ədˈɑːɫfoᶷ");
    });

    // ⚠ A NON-FINAL 2° IS STILL DROPPED, and that is measured too: gold marks those 47% of the time,
    // which is a coin flip, so dropping is very slightly the better half. Exempting them as well scored
    // 86.88% against this rule's 87.82%.
    test("a 2° that is not on the final syllable is still dropped", () => {
        expect(ipa("abdomen", "AE1 B D OW2 M AH0 N")).toBe("ˈæbdoᶷmən");
    });
});
