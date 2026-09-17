/**
 * CMUDICT CONTRADICTS ITSELF ON THE FINAL `-y`, and we were reproducing both halves.
 *
 * `city` is `S IH1 T IY0` and `ability` is `AH0 B IH1 L AH0 T IY2` — the same unstressed FLEECE vowel
 * in the same environment, with different stress digits. Across the dictionary, `-y`-spelled words end
 * `IY0` 7,219 times and `IY2` 198 times, so the second is upstream noise; misaki's gold agrees, leaving
 * 121 of the 123 it covers unstressed. docs/investigations/en/en_final_vowel_stress_investigation.md.
 *
 * ⚠ THE DIGIT IS DEMOTED, NOT THE MARK SUPPRESSED, because the digit does three jobs: it selects the
 * stress mark, it selects the vowel (`iː` stressed vs `i` unstressed) and it gates the flap. Suppressing
 * only the mark would leave `ability` as `əbˈɪlᵻtʰiː` — an unmarked LONG vowel after an unflapped /t/,
 * which is a third reading that is neither the dictionary's nor gold's.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";
import { makeArpabetToIpa } from "../src/languages/english/englishArpabet.ts";
import { MANIFEST } from "../src/languages/english/manifest.ts";

const toIpa = makeArpabetToIpa(MANIFEST.arpabet);
const ipa = (word: string, arpabet: string) => toIpa(arpabet.split(" "), word);

describe("the final -y is unstressed, whichever digit CMUdict happened to write", () => {
    // ⚠ DRIVEN THROUGH THE CONVERTER, NOT `phonemize`, ON PURPOSE. Every word below is a flat-lexicon
    // hit, so a test that only called `phonemize` would pass with the rule reverted — it would be
    // reading `accent-lexicon.tsv`, a PRE-RENDERED cache, and asserting nothing about the rule. That
    // exact mistake was made and caught while building #1317.
    test("IY2 on a -y spelling is demoted, and takes the mark and the length with it", () => {
        expect(ipa("ability", "AH0 B IH1 L AH0 T IY2")).toBe("əbˈɪlᵻt̬i");
        expect(ipa("anarchy", "AE1 N ER0 K IY2")).toBe("ˈænɚki");
        expect(ipa("apology", "AH0 P AA1 L AH0 JH IY2")).toBe("əpʰˈɑːləd͡ʒi");
    });

    test("and the flap it was blocking now fires", () => {
        // A secondary-stressed syllable takes a real onset, so the 2° was suppressing the flap: gold
        // writes `əbˈɪləɾi` and `Idˈɛntəɾi`, both flapped. This is the second Run 14 defect the same
        // change closes — flap-count disagreements with gold fell 1,290 → 1,245.
        expect(ipa("ability", "AH0 B IH1 L AH0 T IY2")).toContain("t̬i");
        expect(ipa("identity", "AY0 D EH1 N T IH0 T IY2")).toContain("t̬i");
    });

    test("a word CMUdict already wrote IY0 is untouched — the two now agree", () => {
        expect(ipa("city", "S IH1 T IY0")).toBe("sˈɪt̬i");
        expect(ipa("happy", "HH AE1 P IY0")).toBe("hˈæpi");
    });

    // ⚠ BOTH NARROWINGS ARE LOAD-BEARING. A blanket "drop the final 2°" would be wrong: gold KEEPS it
    // on 94–100% of final EY/AY/OY/AW, and on 50.5% of final stress-2 rows overall.
    test("other final vowels keep their secondary stress", () => {
        expect(ipa("alleyway", "AE1 L IY0 W EY2")).toBe("ˈæliwˌeᶦ");
        expect(ipa("alibi", "AE1 L AH0 B AY2")).toBe("ˈæləbˌaᶦ");
        expect(ipa("buffalo", "B AH1 F AH0 L OW2")).toBe("bˈʌfəlˌoᶷ");
    });

    // ⚠ NOT EVERY FINAL 2° SURVIVES, AND THE REASON IS OLDER THAN THIS RULE. `airway` (EH1 R W EY2)
    // and `aircrew` (EH1 R K R UW2) have the 2° on the syllable NEXT TO the primary, so the
    // secondary-stress CLASH rule above drops the mark — and its diphthong exception covers only the
    // true diphthongs AY/OY/AW, not EY/UW. Gold marks both (`ˈɛɹwˌA`, `ˈɛɹkɹˌu`), so this is a real
    // divergence; it is simply a DIFFERENT one, and pinning it here keeps the two from being confused
    // if either rule is touched later.
    test("a final 2° adjacent to the primary is dropped by the older clash rule", () => {
        expect(ipa("airway", "EH1 R W EY2")).toBe("ˈɛɹweᶦ");
        expect(ipa("aircrew", "EH1 R K R UW2")).toBe("ˈɛɹkɹuː");
    });

    test("final IY2 NOT spelled -y keeps it — those are compounds with a free morpheme", () => {
        // `-ee` words are only 67% unstressed in gold, because the last syllable is a real word:
        // bumblebee, carefree, jubilee, filigree, oversee, divorcee.
        expect(ipa("bumblebee", "B AH1 M B AH0 L B IY2")).toContain("bˌiː");
        expect(ipa("jubilee", "JH UW1 B AH0 L IY2")).toContain("lˌiː");
    });

    // ⚠ THE OBVIOUS EXCEPTION GATE IS A TRAP, and this records the decision not to build it. The only
    // two `-y` words gold stresses are `latchkey` and `turnkey`, both real compounds — but 17 of the
    // 198 rows end `-key` and 15 are SURNAMES (`starkey`, `markey`, `whipkey`), while CMUdict writes
    // IY0 on 100 of the 121 `-key` words including the identical `berkey`, `blakey`, `buckey`. Gating
    // on `-key` would hold the stress on 15 surnames whose twins are unstressed — re-creating this
    // very inconsistency on the side with LESS evidence. 2 declared misses against 121.
    test("latchkey and turnkey are the declared misses", () => {
        expect(ipa("latchkey", "L AE1 CH K IY2")).toBe("lˈæt͡ʃki");     // gold: lˈæʧkˌi
        expect(ipa("starkey", "S T AA1 R K IY2")).toBe("stˈɑːɹki");     // and the surname it shares a shape with
    });

    // The rule lives in the converter rather than in `g2p-dict.tsv` because the dict is REGENERATED
    // from upstream CMUdict by `en_g2p_ngram.ts --emit`, and because the n-gram and the BiLSTM predict
    // the same digit from the same training data. A per-row edit would leave the OOV path saying IY2
    // for an unlisted word in the identical environment — the split `g2p-curated.tsv`'s gate exists
    // to catch. Measured: 56 gold words not in the dict changed with it (`phrenology`, `autarchy`).
    test("the flat lexicon was rebuilt, so recorded and unrecorded words agree", () => {
        expect(phonemize("their ability to", "en")).toContain("əbˈɪlᵻt̬i");
        expect(phonemize("the company said", "en")).toContain("kʰˈʌmpə̆ni");
    });
});
