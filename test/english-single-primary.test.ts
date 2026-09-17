/**
 * A WORD HAS EXACTLY ONE PRIMARY STRESS — and the dictionary path was not obeying it.
 *
 * 1,029 `g2p-dict.tsv` rows carry more than one stress-1 nucleus, because CMUdict declines to resolve
 * prefixed forms and initialisms (`AA1 R CH B IH1 SH AH0 P`, `EY1 B IY1 EH1 S`). The OOV paths have
 * always run `enforceSinglePrimary` over their predictions; the flat lexicon never did, so 372 words
 * were emitted with two or three primary marks inside one group. That is not a transcription of
 * anything — it is the same shape as #1317, a guard that existed on one path and not its twin.
 *
 * docs/investigations/en/en_multi_primary_investigation.md.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { makeArpabetToIpa, singlePrimary } from "../src/languages/english/englishArpabet.ts";
import { enforceSinglePrimary } from "../src/languages/english/englishG2p.ts";
import { MANIFEST } from "../src/languages/english/manifest.ts";

const toIpa = makeArpabetToIpa(MANIFEST.arpabet);
const ipa = (word: string, arpabet: string) => toIpa(arpabet.split(" "), word);

describe("exactly one primary stress per word", () => {
    // ⚠ DRIVEN THROUGH THE CONVERTER, NOT `phonemize`, for the recorded words: they are flat-lexicon
    // hits, so a phonemize()-only assertion reads the pre-rendered cache and would pass with the rule
    // reverted. Both paths are asserted, as separate cases.
    test("a dict row with two primaries renders with one", () => {
        expect(ipa("amputee", "AE1 M P Y AH0 T IY1")).toBe("ˌæmpjətʰˈiː");
        expect(ipa("afroamerican", "AE1 F R OW0 AH0 M EH1 R AH0 K AH0 N")).toBe("ˌæfɹoᶷəmˈɛɹəkən");
    });

    // ⚠ AND THE CLASH RULE MUST NOT THEN DELETE THE MARK, which is the second half of this fix. The
    // secondary-stress clash rule drops a 2° on the syllable ADJACENT to the primary — and a demoted
    // primary usually lands exactly there, so without an exemption `nineteen` came out `naᶦntˈiːn` with
    // NOTHING on `nine`, and `archbishop` `ɑːɹt͡ʃbˈɪʃəp`. That is arguably worse than the malformed form
    // it replaced: the word loses its first beat entirely, in dates, money and years.
    //
    // The exemption is principled rather than a patch. The clash rule exists to drop a 2° CMUdict WROTE
    // on an ordinary unstressed syllable (`zorro`, `aalto`, `adolfo`); a 2° this engine just created from
    // a 1° is the opposite case — the dictionary called that syllable strong. Worth +55 exact on its own,
    // and it is what makes the numerals match gold.
    test("a demoted mark survives the clash rule", () => {
        expect(ipa("nineteen", "N AY1 N T IY1 N")).toBe("nˌaᶦntˈiːn");           // gold nˌIntˈin
        expect(ipa("alongside", "AH0 L AO1 NG S AY1 D")).toBe("əlˌɔːŋsˈaᶦd");    // gold əlˌɔŋsˈId
        expect(ipa("archbishop", "AA1 R CH B IH1 SH AH0 P")).toBe("ˌɑːɹt͡ʃbˈɪʃəp"); // gold ˌɑɹʧbˈɪʃəp
    });

    // ⚠ AND CMUdict's OWN 2° IN THAT POSITION IS STILL DROPPED — the exemption is narrow. `zorro` is
    // Z AO1 R OW2: the OW2 is the dictionary's, not ours, and marking it over-articulates an ordinary
    // final -o. This is the case the clash rule was built for and it must keep working.
    test("the clash rule still drops a 2° the dictionary wrote", () => {
        expect(ipa("zorro", "Z AO1 R OW2")).toBe("zˈɔːɹoᶷ");
        expect(ipa("aalto", "AA1 L T OW2")).toBe("ˈɑːɫtoᶷ");
    });

    // ⚠ ONE POLICY, BOTH PATHS, AND THIS IS THE CASE THAT SAYS SO. An earlier version of this change kept a
    // demotion in `enforceSinglePrimary` too (the FIRST there, the LAST here), which scored +147 against gold
    // with ZERO regressions — better on paper than what shipped (+341/−106). It was rejected because it made
    // the SAME ARPABET read two different ways depending on which path delivered it, which is the seam the
    // curation gate exists to catch. The justification for allowing it — a predictor's extra `1` is noise
    // while CMUdict's is a statement — does not survive the COMPOUND path, which joins two dictionary stems
    // each carrying its own real primary.
    test("the predictor and the dictionary read the same phones the same way", () => {
        const phones = "AA1 R CH B IH1 SH AH0 P".split(" ");
        const viaDict = toIpa(phones, "archbishop");
        const viaPredictor = toIpa(enforceSinglePrimary(phones, new Set(MANIFEST.arpabet.vowels)), "archbishop");
        expect(viaPredictor).toBe(viaDict);
        expect(viaDict).toBe("ˌɑːɹt͡ʃbˈɪʃəp");
    });

    // ⚠ THE LAST. The teen numerals are why it matters in practice: gold is unanimous (7 of 7) that they are
    // end-stressed, which is what separates nineTEEN from NINEty, and they are far more frequent in real text
    // than the fore-stressed compounds keeping the last costs. That cost is real — 106 words, `Afrobeat`,
    // `Twitterverse`, `Humean` — and it names the next refinement: the discriminator is PREFIXED (stem keeps
    // the primary, 81:24) versus COMPOUND (fore-stressed, 37:31), not which path the phones came from.
    test("CMUdict's unresolved rows go to the LATER element", () => {
        expect(singlePrimary(["TH", "ER1", "T", "IY1", "N"])).toEqual(["TH", "ER2", "T", "IY1", "N"]);
        expect(singlePrimary(["F", "AO1", "R", "T", "IY1", "N"])).toEqual(["F", "AO2", "R", "T", "IY1", "N"]);
    });

    test("a row with one primary is untouched, and one with none is left alone here", () => {
        expect(singlePrimary(["S", "IH1", "T", "IY0"])).toEqual(["S", "IH1", "T", "IY0"]);
        // The "at least one" half is `enforceSinglePrimary`'s and stays there: only a PREDICTOR can
        // return zero primaries, and promoting inside the converter would invent a tonic for the
        // function words that correctly carry none.
        expect(singlePrimary(["AH0", "N", "D"])).toEqual(["AH0", "N", "D"]);
    });

    // ⚠ IT MUST NOT MUTATE ITS INPUT. `enforceSinglePrimary` writes into the array it gets back, so an
    // early `return phones` on the no-primary path would corrupt a caller's phones in place.
    test("the input array is never written through", () => {
        const input = ["AH0", "N", "D"];
        const out = singlePrimary(input);
        out[0] = "AH1";
        expect(input[0]).toBe("AH0");
    });

    test("the flat lexicon was rebuilt, so recorded words agree with the rule", () => {
        for (const w of ["archbishop", "alongside", "amputee", "actuary", "asynchronous"]) {
            const got = phonemize(w, "en");
            expect(got.split(" ").every((g) => (g.match(/ˈ/gu) ?? []).length <= 1)).toBe(true);
        }
    });

    // ⚠ A HYPHENATED COMPOUND IS NOT A COUNTEREXAMPLE. It becomes two spoken GROUPS, and each group is
    // a word with its own primary — `able-bodied` is `ˈAbᵊl bˈɑdid`, two marks separated by a space.
    // The invariant is per GROUP, which is why the check above splits on spaces.
    test("two groups may carry two primaries", () => {
        const got = phonemize("able-bodied", "en");
        expect(got).toContain(" ");
        expect((got.match(/ˈ/gu) ?? []).length).toBe(2);
    });
});
