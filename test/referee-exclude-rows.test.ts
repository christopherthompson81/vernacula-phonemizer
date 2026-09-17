/**
 * `excludeRows` DROPS EVIDENCE, so its semantics are pinned here rather than left to the one config that
 * uses it. It exists because `en.wikipron-eng-latn-us-broad.tsv` is labelled GenAm and 10.7% of it is RP —
 * `Amazonia` as `æməzəʊniə`, `Dunkirk` as `dʌŋkɜːk` — rows validated as UK transcriptions in the wrong file
 * (92% of the RP-vowel rows and 98% of the non-rhotic ones appear in the en-GB referee with a
 * byte-identical reading). docs/investigations/referee/en_referee_audit_investigation.md.
 */
import { describe, expect, test } from "vitest";
import { CONFIG } from "../tools/referee-eval/config.ts";

describe("referee row exclusion", () => {
    const en = CONFIG["en"]!.referees[0]!;

    test("en declares exactly the two validated rules", () => {
        expect(en.excludeRows).toHaveLength(2);
        const [vowel, rhotic] = en.excludeRows!;
        expect(vowel!.ipa!.source).toBe("əʊ|ɒ|ɪə|ʊə|ɛə");
        expect(rhotic!.spelling).toBeDefined();
        expect(rhotic!.ipaLacks).toBeDefined();
    });

    // ⚠ NOT `g`. These are membership tests reused across thousands of rows, and a `g` regex carries
    // `lastIndex` between `.test()` calls — every other row would silently pass the filter.
    test("the patterns are not global", () => {
        for (const x of en.excludeRows!)
            for (const re of [x.ipa, x.spelling, x.ipaLacks])
                if (re) expect(re.global).toBe(false);
    });

    test("the RP-vowel rule fires on RP and not on GenAm", () => {
        const { ipa } = en.excludeRows![0]!;
        expect(ipa!.test("æməzəʊniə")).toBe(true); // Amazonia, RP GOAT
        expect(ipa!.test("bɒdɹəm")).toBe(true); // Bodrum, RP LOT
        expect(ipa!.test("æməzoʊniə")).toBe(false); // the GenAm reading
        expect(ipa!.test("bɑdɹəm")).toBe(false);
    });

    // ⚠ `ɑː` IS DELIBERATELY NOT A MARKER, and it was in the first draft of the list. The backbone strips
    // `ː`, so `ɑː` folds to `ɑ` — the GenAm vowel — and 108 rows would have been dropped for a length mark
    // that never reaches the comparison at all.
    test("a length mark is not an RP marker", () => {
        expect(en.excludeRows![0]!.ipa!.test("ɑːmədɑːbɑːd")).toBe(false);
    });

    // ⚠ NON-RHOTICITY NEEDS BOTH FIELDS: a word SPELLED with a post-vocalic r whose transcription has no
    // rhotic at all. Neither half says it alone, which is why the rule is a conjunction rather than a regex.
    test("the non-rhotic rule needs the spelling and the IPA together", () => {
        const { spelling, ipaLacks } = en.excludeRows![1]!;
        const nonRhotic = (w: string, ipa: string): boolean =>
            spelling!.test(w) && !ipaLacks!.test(ipa);
        expect(nonRhotic("Dunkirk", "dʌŋkɜːk")).toBe(true);
        expect(nonRhotic("Dunkirk", "dʌŋkɝk")).toBe(false); // the rhotic reading is fine
        expect(nonRhotic("Concordia", "kənkɔdiə")).toBe(true);
        expect(nonRhotic("Concordia", "kənkɔɹdiə")).toBe(false);
        // no post-vocalic r in the spelling → the rule must not fire however vowel-final the reading is
        expect(nonRhotic("Alabama", "æləbæmə")).toBe(false);
        // a PRE-vocalic r is not post-vocalic
        expect(nonRhotic("arugula", "əɹuɡələ")).toBe(false);
    });
});
