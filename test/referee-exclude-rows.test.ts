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

    test("en declares exactly the four validated rules", () => {
        expect(en.excludeRows).toHaveLength(4);
        const [vowel, rhotic, finalR, glyph] = en.excludeRows!;
        // ⚠ THE FOURTH IS NOT A VARIETY RULE and is here for a different reason: a one-character headword
        // has no fixed meaning in this file (`m` ɛm, `q` kjuː are the letter's NAME; `x` ks is its SOUND),
        // so it cannot arbitrate. It is score-neutral by construction — 3 of its 6 rows were passing.
        expect(glyph!.spelling!.source).toBe("^.$");
        expect(glyph!.ipa).toBeUndefined();
        expect(vowel!.ipa!.source).toBe("əʊ|ɒ|ɪə|ʊə|ɛə");
        expect(rhotic!.spelling).toBeDefined();
        expect(rhotic!.ipaLacks).toBeDefined();
        expect(finalR!.spelling).toBeDefined();
        expect(finalR!.ipaLacks).toBeDefined();
    });

    // ⚠ THE WORD-FINAL RULE EXISTS BECAUSE THE WHOLE-STRING ONE HAS A BLIND SPOT: its `ipaLacks` asks
    // "is there a rhotic ANYWHERE", when it means "is there one where the spelling puts it". `crowner` is
    // transcribed `kɹaʊnə` — non-rhotic, an RP row in a GenAm file — and survived because the ONSET of
    // `crowner` supplies a `ɹ`. Found by sampling ten undetermined divergences and diagnosing each.
    test("an onset r does not mask a non-rhotic coda", () => {
        const [, whole, finalR] = en.excludeRows!;
        const caught = (w: string, ipa: string, x: typeof whole): boolean =>
            (x!.spelling?.test(w) ?? true) && (x!.ipaLacks ? !x!.ipaLacks.test(ipa) : true);
        expect(caught("crowner", "kɹaʊnə", whole)).toBe(false); // the blind spot
        expect(caught("crowner", "kɹaʊnə", finalR)).toBe(true); // closed by the companion
        expect(caught("featured", "fiːt͡ʃəd", finalR)).toBe(true);
    });

    // ⚠ `-s`/`-es` AFTER THE r IS DELIBERATELY EXCLUDED FROM THE WORD-FINAL RULE. There the r is usually
    // the ONSET of the next syllable and IS pronounced, so `Pescadores` pɛskədɔːɹiːz — correct GenAm —
    // would be dropped. Measured: allowing it adds one row and one false positive.
    test("a plural -es does not make the r a coda", () => {
        const finalR = en.excludeRows![2]!;
        const caught = (w: string, ipa: string): boolean =>
            (finalR.spelling?.test(w) ?? true) && (finalR.ipaLacks ? !finalR.ipaLacks.test(ipa) : true);
        expect(caught("Pescadores", "pɛskədɔːɹiːz")).toBe(false);
        expect(caught("cacciatore", "kɑt͡ʃətɔɹi")).toBe(false); // the r IS pronounced here
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
