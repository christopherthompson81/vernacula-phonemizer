import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord, phonemizeWordSegmental } from "../src/languages/oromo/oromo.ts";

// Canonical-IPA goldens for Oromo / Afaan Oromoo (om) — shallow near-phonemic Qubee Latin orthography. Signature
// Cushitic features: EJECTIVES c→t͡ʃʼ, q→kʼ, x→tʼ, ph→pʼ; retroflex IMPLOSIVE dh→ᶑ; DOUBLED vowels = long (aa→aː),
// DOUBLED consonants = geminate (bb→bː); apostrophe → glottal stop [ʔ]. Cross-checked vs epitran orm-Latn (100%
// folded) + kaikki human IPA (96%). See docs/investigations/om_native_bringup_investigation.md.
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
        // asserted on the SEGMENTAL output: these goldens are about ejectives/gemination/length/glottal,
        // not about stress. Stress has its own block below, so a stress change can't silently rewrite them.
        for (const [w, exp] of cases) expect(phonemizeWordSegmental(w)).toBe(exp);
    });

    test("glottal stop + geminate digraph (where epitran is wrong, we are right)", () => {
        expect(phonemizeWordSegmental("buʼaa")).toBe("buʔaː"); // apostrophe → [ʔ] (epitran drops it)
        expect(phonemizeWordSegmental("qopphaaʼuu")).toBe("kʼopʼːaːʔuː"); // pph = geminate ph → [pʼː] (epitran gives pːh)
    });

    test("word-edge apostrophe/quote is punctuation, not a glottal", () => {
        // interior apostrophe = [ʔ]; a word-edge ' ʼ ’ (quotation) must NOT leak a glottal stop.
        expect(phonemize("dhugaa’", "om")).toBe("ᶑuɡˈaː");
        expect(phonemize("’dhugaa’", "om")).toBe("ᶑuɡˈaː");
        expect(phonemizeWordSegmental("buʼaa")).toBe("buʔaː"); // interior kept
    });

    test("text", () => {
        expect(phonemize("afaan oromoo", "om")).toBe("afˈaːn oromˈoː");
    });
});

// Stress is PHONETIC and PREDICTABLE in Oromo — "no lexical contrast by making use of stress, and it could be
// predictable from the environment" (Dejene Geshe, *Kamisee Oromo Phonology*, Addis Ababa University, 2010,
// §5.3.1; the same patterns are reported for the MECHA dialect by Waqo 1981 and Gragg 1976). These are the
// thesis's own worked examples, so the gold is an INDEPENDENT print source, not our own output.
describe("Oromo stress (Dejene 2010 §5.3.1)", () => {
    const syl = (ipa: string): number => {
        const pre = ipa.split("ˈ")[0] ?? "";
        let n = 0;
        for (let k = 0; k < pre.length; k++) {
            if (/[aeiou]/.test(pre[k]!) && !(k > 0 && pre[k] === pre[k - 1])) n++;
        }
        return n;
    };
    for (const [w, expected, rule] of [
        ["shan", 0, "1: monosyllable"],
        ["nama", 0, "2: disyllabic short-final → penult"],
        ["suuta", 0, "2: penult, whatever the preceding length"],
        ["sanbata", 1, "3: polysyllabic, no long vowel → penult"],
        ["bilbila", 1, "3: penult"],
        ["sangaa", 1, "4: long-final → ultimate"],
        ["dargaggoo", 2, "4: long-final → ultimate"],
        ["mootummaa", 2, "4: long-final → ultimate"],
        ["bishaan", 1, "5: consonant-final, long vowel elsewhere takes it"],
        ["kudhan", 1, "5: consonant-final, all short → ultimate"],
        ["kamis", 1, "5: consonant-final → ultimate"],
    ] as const) {
        test(`${w} — rule ${rule}`, () => {
            expect(syl(phonemizeWord(w)), phonemizeWord(w)).toBe(expected);
        });
    }

    // §5.3.1 rule 7 — the focus marker and short object pronouns are UNSTRESSED. They are frequent enough
    // that stressing them would put a spurious prominence on a clitic in nearly every sentence.
    test("rule 7: open monosyllabic function words are unstressed", () => {
        for (const w of ["tu", "nu", "na", "si"]) expect(phonemizeWord(w), w).not.toContain("ˈ");
        expect(phonemizeWord("shan")).toContain("ˈ"); // a CONTENT monosyllable is still stressed
    });

    test("exactly one primary stress per word", () => {
        for (const w of ["nama", "bishaan", "dargaggoo", "sanbata", "shan", "obboleessa"]) {
            expect(phonemizeWord(w).match(/ˈ/gu)?.length, w).toBe(1);
        }
    });
});
