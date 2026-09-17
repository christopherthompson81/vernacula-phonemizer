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
 * ⚠ `tools/english/en_g2p_ngram.ts` HAS THE OPPOSITE BUG and it is NOT fixed here: its own copy of
 * collapseGeminates has no vowel exemption, and its comment claims the collapse is "Lossless vs CMUdict". It
 * is not — it changes 186 rows, and the 95 vowel ones are this same `-erer` class. The trainer and the shipped
 * engine therefore disagree about post-processing, which means the model's held-out numbers were measured
 * against a chain that does not ship. Closing that means retraining, so it is recorded rather than patched.
 */
import { describe, expect, test } from "vitest";
import { phonemizeEnNeural } from "../src/languages/english/englishNeural.ts";
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

    // ⚠ THE STRONGER STRESS SURVIVES. The digraph is ONE syllable and the model may mark either of its letters;
    // dropping the second copy blindly loses `Yenisei`'s primary and leaves the tonic on the wrong syllable.
    test("the digraph keeps the stronger of the two marks", async () => {
        expect(await phonemizeEnNeural("Yenisei")).toBe("jˌɛnɪsˈeᶦ");
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
