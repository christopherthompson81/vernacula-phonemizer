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
    const enGb = CONFIG["en-GB"]!.referees[0]!;

    /**
     * ⚠ THE en-GB RULE IS THE MIRROR OF en's AND ITS FIRST FOUR DRAFTS EACH DROPPED ONSETS. The corpus is
     * a UK one with US rows in it, so the test is "is this reading rhotic" — and a /ɹ/ is an ONSET, not
     * contamination, in five shapes that a bare `ɹ not before a vowel` misses. Every row below was a real
     * false positive of a real draft, so they are pinned in BOTH directions: a detector verified only on
     * the rows it is meant to catch will happily take onsets with it, which is exactly how three of those
     * four drafts passed their author's own spot-check.
     */
    test("en-GB drops a rhotic row and never an onset", () => {
        const ipa = enGb.excludeRows![0]!.ipa!;
        // ONSETS — must NOT match. Each names the draft that got it wrong.
        for (const [why, reading] of [
            ["a syllabic consonant is a nucleus", "æbɔːɹl̩"],              // aboral
            ["… including after a schwa", "mətɜːtəɹl̩"],                     // materteral
            ["a combining mark before the vowel", "d̠͡ɹ̠ɑmətaɪz"],          // dramatize
            ["a glide in the cluster", "ɹjuːkjuːən"],                       // ryukyuan
            ["… and the labial one", "iːpɹwɑː"],                                // yprois
            ["a parenthesised optional segment", "olɛksɑndɹ⁽ʲ⁾iʌ̯kɐ"],  // oleksandrivka
            ["a geminate ɹ", "əkɹɹeɪzɪəl"],                                 // acrasial
            ["our own weak vowel ᵻ", "pɹᵻviːniənt"],                        // prevenient
            ["a PRECOMPOSED vowel — the corpus is not NFD", "pətiɡɹã"],      // petitgrain
        ] as const) expect([why, ipa.test(reading)]).toEqual([why, false]);
        // RHOTIC — must match.
        for (const [why, reading] of [
            ["an r-coloured vowel is not an RP symbol", "æbɚ"],                 // aber
            ["… nor is it word-internally", "æfɹɪkɑːnɚ"],                   // afrikaner
            ["a coda ɹ before a consonant", "eɪkɑɹs"],                          // acars
            ["… and at a syllable boundary", "ɑɹpə"],                           // arpa
        ] as const) expect([why, ipa.test(reading)]).toEqual([why, true]);
    });

    // ⚠ AND THE ROW-LEVEL CRITERION IS ALL-VARIANTS, which is what keeps a usable row alive: `asdr` is
    // `eɪɛsdiːɑː` BESIDE `eɪɛsdiːɑːɹ`, so the British reading carries it. The scorer credits any
    // variant, so dropping the row for its US reading would throw away good evidence.
    test("a row with one clean reading survives its rhotic one", () => {
        const ipa = enGb.excludeRows![0]!.ipa!;
        expect(ipa.test("eɪɛsdiːɑː")).toBe(false);
        expect(ipa.test("eɪɛsdiːɑːɹ")).toBe(true);
    });


    test("en declares exactly the five validated rules", () => {
        expect(en.excludeRows).toHaveLength(5);
        const [vowel, rhotic, finalR, coda, glyph] = en.excludeRows!;
        expect(coda!.spelling).toBeDefined();
        expect(coda!.ipaLacks).toBeDefined();
        // ⚠ THE LAST ONE IS NOT A VARIETY RULE and is here for a different reason: a one-character headword
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

    // ⚠ AND THE COMPANION HAS ITS OWN BLIND SPOT, which is why non-rhoticity takes THREE rules: it only looks at the
    // last three symbols, so a non-rhotic word whose r is mid-word and whose only ɹ is some other
    // syllable's ONSET passes both. `perchlorate` pəklɔːɹeɪt and `weatherproof` wɛðəpɹuːf are RP rows that
    // survived until the coda rule was written; they were surfacing as dictionary "defects" where the
    // referee, not the dictionary, was wrong.
    test("an onset r elsewhere in the word does not mask a non-rhotic coda either", () => {
        const [, whole, finalR, coda] = en.excludeRows!;
        const caught = (w: string, ipa: string, x: typeof whole): boolean =>
            (x!.spelling?.test(w) ?? true) && (x!.ipaLacks ? !x!.ipaLacks.test(ipa) : true);
        for (const [w, ipa] of [["perchlorate", "pəklɔːɹeɪt"], ["weatherproof", "wɛðəpɹuːf"]] as const) {
            expect(caught(w, ipa, whole)).toBe(false);
            expect(caught(w, ipa, finalR)).toBe(false);
            expect(caught(w, ipa, coda)).toBe(true);
        }
        // a real GenAm coda rhotic is not touched, however many onset ɹ the word also has
        expect(caught("perchlorate", "pɚklɔɹeɪt", coda)).toBe(false);
        expect(caught("Bombardier", "bɑmbɑɹdieɪ", coda)).toBe(false);
    });

    // ⚠ BOTH OF THESE WERE FALSE POSITIVES THE FIRST TIME THE CODA RULE WAS RUN, and both are in the
    // SPELLING half. `r+` backtracks, so a geminate matches its own first half and every `arr`/`err` word
    // looked like a coda r with no coda rhotic; the `rh` digraph did the same, where the ɹ legitimately
    // serves the spelled r.
    test("a geminate rr and an rh digraph are not a coda r", () => {
        const coda = en.excludeRows![3]!;
        const caught = (w: string, ipa: string): boolean =>
            coda.spelling!.test(w) && !coda.ipaLacks!.test(ipa);
        expect(caught("arrange", "əɹeɪnd͡ʒ")).toBe(false);
        expect(caught("narrow", "næɹoʊ")).toBe(false);
        expect(caught("gonorrhea", "ɡɑnəɹiə")).toBe(false);
        // but a compound seam spelled `rh` is still caught by the whole-string rule, which needs no coda
        const whole = en.excludeRows![1]!;
        expect(whole.spelling!.test("letterhead") && !whole.ipaLacks!.test("lɛtəhɛd")).toBe(true);
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
