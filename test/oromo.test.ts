import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/oromo/oromo.ts";

// Canonical-IPA goldens for Oromo / Afaan Oromoo (om) — shallow near-phonemic Qubee Latin orthography. Signature
// Cushitic features: EJECTIVES c→t͡ʃʼ, q→kʼ, x→tʼ, ph→pʼ; retroflex IMPLOSIVE dh→ᶑ; DOUBLED vowels = long (aa→aː),
// DOUBLED consonants = geminate (bb→bː); apostrophe → glottal stop [ʔ]. Cross-checked vs epitran orm-Latn (100%
// folded) + kaikki human IPA (96%). See docs/om_native_bringup_investigation.md.
describe("Oromo canonical IPA", () => {
    test("ejectives, implosive, length, gemination, glottal", () => {
        const cases: [string, string][] = [
            ["dhugaa", "ᶑuɡaː"], // dh → ᶑ (retroflex implosive), aa → aː
            ["qeree", "kʼereː"], // q → kʼ (ejective)
            ["xurii", "tʼuriː"], // x → tʼ (ejective)
            ["coqorsa", "t͡ʃʼokʼorsa"], // c → t͡ʃʼ (ejective affricate), q → kʼ
            ["nyaata", "ɲaːta"], // ny → ɲ
            ["shan", "ʃan"], // sh → ʃ (five)
            ["obboleessa", "obːoleːsːa"], // gemination bb→bː, ss→sː; ee→eː
            ["saddeet", "sadːeːt"], // dd → dː, ee → eː (eight)
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("glottal stop + geminate digraph (where epitran is wrong, we are right)", () => {
        expect(phonemizeWord("buʼaa")).toBe("buʔaː"); // apostrophe → [ʔ] (epitran drops it)
        expect(phonemizeWord("qopphaaʼuu")).toBe("kʼopʼːaːʔuː"); // pph = geminate ph → [pʼː] (epitran gives pːh)
    });

    test("word-edge apostrophe/quote is punctuation, not a glottal", () => {
        // interior apostrophe = [ʔ]; a word-edge ' ʼ ’ (quotation) must NOT leak a glottal stop.
        expect(phonemize("dhugaa’", "om")).toBe("ᶑuɡaː");
        expect(phonemize("’dhugaa’", "om")).toBe("ᶑuɡaː");
        expect(phonemizeWord("buʼaa")).toBe("buʔaː"); // interior kept
    });

    test("text", () => {
        expect(phonemize("afaan oromoo", "om")).toBe("afaːn oromoː");
    });
});
