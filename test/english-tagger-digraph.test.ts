/**
 * THE OOV TAGGER DOUBLED A VOWEL DIGRAPH'S VOWEL — a malformedness, not a variant.
 *
 * The BiLSTM emits one ARPABET chunk PER CHARACTER with no global constraint, so ⟨oo⟩/⟨ay⟩/⟨ei⟩/⟨ou⟩ can have
 * the vowel tagged on BOTH letters: `atishoo` came out `ˈæt̬ɪʃˌuːˌuː`, `anteroom` `ˈæntɚˌuːˌuːm`, `gaywad`
 * `ɡˌeᶦeᶦwˈɑːd`. Reported as a defect in #1334's ten-row diagnosis of undetermined wikipron divergences.
 *
 * ⚠ THE FIX IS DELIBERATELY *NOT* IN THE SHARED `collapseGeminates`, AND THE DICTIONARY IS WHY. That function
 * collapses a doubled CONSONANT and exempts vowels, and the exemption is correct: 95 dict rows carry a real
 * adjacent identical vowel pair and 89 of them are `ER0 ER0` — the `-erer` agentive, where the stem's /ər/
 * meets the suffix's /ər/. Collapsing there DELETES A SYLLABLE and turns `acquirer` into `acquire`.
 *
 * ⚠ `tools/english/en_g2p_ngram.ts` HAD THE OPPOSITE BUG AND IT IS FIXED NOW (#1341, the retrain this was
 * waiting for): its own copy of collapseGeminates had no vowel exemption while claiming to be "Lossless vs
 * CMUdict". It changed 186 rows, the 95 vowel ones being this same `-erer` class. ⚠ THE EMITTED MODEL WAS
 * NEVER AFFECTED — that collapse runs in the tool's SCORING path, not over the EM-aligned tables it ships —
 * so what it skewed was the tool's own held-out numbers, measured against a chain that does not ship.
 */
import { describe, expect, test } from "vitest";
import { phonemizeEnNeural } from "../src/languages/english/englishNeural.ts";
import { createEnglishTagger } from "../src/languages/english/englishTagger.ts";
import { collapseGeminates } from "../src/languages/english/englishG2p.ts";
import { MANIFEST } from "../src/languages/english/manifest.ts";

const VOWELS = new Set(MANIFEST.arpabet.vowels);

describe("the OOV tagger's vowel-digraph guard", () => {
    test("a digraph's vowel is emitted once", async () => {
        for (const w of ["atishoo", "anteroom", "Botwood", "gaywad", "sinamay", "uuencode"]) {
            const got = await phonemizeEnNeural(w);
            // no vowel symbol repeated back to back, stress marks ignored
            expect(`${w}: ${/(uː|iː|oᶷ|eᶦ|aᶦ|aᶷ|ɑː|ɔː|ʊ|ɪ|ɛ|æ|ə)\1/u.test(got.replace(/[ˈˌ]/gu, ""))}`)
                .toBe(`${w}: false`);
        }
    });

    // ⚠ THE STRONGER STRESS SURVIVES. The digraph is ONE syllable and the model may mark either of its
    // letters; dropping the second copy blindly loses the primary and leaves the tonic on the wrong syllable.
    //
    // ⚠ THIS USED TO BE `Yenisei`, PINNED THROUGH phonemizeEnNeural, AND IT STOPPED EXERCISING THE GUARD at
    // the #1341 retrain: the new weights emit `eᶦ` + `iː` for its ⟨ei⟩ — two DIFFERENT phones — so the guard,
    // which collapses a REPEATED one, never fires and the word is no longer evidence of anything here.
    // ⚠ AND THE GUARD IS NOW NEARLY DEAD, WHICH IS WORTH KNOWING RATHER THAN HIDING. Swept over the 4,862
    // dict words containing adjacent vowel LETTERS, with the guard on and off: it changes TWO of them. The
    // retrained tagger simply learned not to double. `hiaa` is one of the two and is the stronger-mark case
    // exactly — ˌeᶦt͡ʃˌaᶦˌeᶦˈeᶦ collapses to ˌeᶦt͡ʃˌaᶦˈeᶦ, keeping the PRIMARY — so it is pinned here in
    // Yenisei's place. It is a dict word, so it is asked of the TAGGER directly; through the full path the
    // lexicon would answer and the guard would never run.
    test("the digraph keeps the stronger of the two marks", async () => {
        const tagger = await createEnglishTagger();
        expect(tagger, "no tagger: onnxruntime or the model is unavailable").toBeDefined();
        expect(await tagger!.tag("hiaa")).toBe("ˌeᶦt͡ʃˌaᶦˈeᶦ");
        expect(await tagger!.tag("fujii")).toBe("fuːd͡ʒˈiː");   // the other live case: iː + i → iː
    });

    // ⚠ THE PROTECTED CLASS. These are dictionary rows, so they do not pass through the tagger at all — but they
    // are the reason the guard is scoped to ADJACENT VOWEL LETTERS rather than handed to collapseGeminates, and
    // a future "simplification" that moves it there will break exactly these.
    test("a real -erer agentive keeps both rhotic nuclei", () => {
        for (const w of ["acquirer", "adventurer", "gatherer", "emperor"]) {
            expect(`${w}: ${collapseGeminates(["ER0", "ER0"], VOWELS).length}`).toBe(`${w}: 2`);
        }
    });

    // ⚠ AND A DOUBLED CONSONANT STILL COLLAPSES — that is what the function is for (bus+sin → bʌsɪn).
    test("a doubled consonant still collapses", () => {
        expect(collapseGeminates(["B", "AH1", "S", "S", "IH0", "N"], VOWELS)).toEqual(["B", "AH1", "S", "IH0", "N"]);
    });

    // ⚠ A GENUINE SEAM GEMINATE IS NOT A DUPLICATE. `shortchange` is `T` then `CH` and `interrelationship` is
    // `ER0` then `R` — different phones, so neither the guard nor the collapse can see them. Both are dict rows.
    test("a legitimate cross-morpheme cluster is untouched", async () => {
        expect(await phonemizeEnNeural("shortchange")).toContain("tt͡ʃ");
        expect(await phonemizeEnNeural("interrelationship")).toContain("ɚɹ");
    });
}, 120000);
