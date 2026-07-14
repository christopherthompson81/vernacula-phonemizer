import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/catalan/catalan.ts";

// Canonical-IPA goldens for General Eastern/Central Catalan (Barcelona standard), espeak-independent. Rule-based
// g2p → 2R stress → UNSTRESSED VOWEL REDUCTION (a/e→ə, o→u) → regressive voicing assimilation → spirantization
// → nasal place assimilation → final devoicing + final-r deletion + coda-cluster simplification. Stressed
// open/close mid height (ɛ/e, ɔ/o) is LEXICAL and defaults to open (the documented ceiling — dona/dóna).
// See docs/ca_bringup_investigation.md.
describe("catalan canonical IPA", () => {
    test("vowel reduction (the Central signature) + dark l", () => {
        expect(phonemizeWord("casa")).toBe("kˈazə"); // final a → ə, intervocalic s → z
        expect(phonemizeWord("mira")).toBe("mˈiɾə"); // tap ɾ
        expect(phonemizeWord("carro")).toBe("kˈaru"); // rr → trill; final o → u
        expect(phonemizeWord("xocolata")).toBe("ʃukuɫˈatə"); // o→u ×2, dark ɫ, x → ʃ
        expect(phonemizeWord("dona")).toBe("dˈɔnə"); // stressed open ɔ (correct here)
    });

    test("palatals, affricates, digraphs (ny/ll/tx/tj/tg/ix)", () => {
        expect(phonemizeWord("any")).toBe("ˈaɲ"); // ny → ɲ
        expect(phonemizeWord("panxa")).toBe("pˈaɲʃə"); // n → ɲ before ʃ
        expect(phonemizeWord("caixa")).toBe("kˈaʃə"); // ix → ʃ (the i is a silent marker, not a glide)
        expect(phonemizeWord("peix")).toBe("pˈɛʃ");
        expect(phonemizeWord("platja")).toBe("pɫˈad͡ʒə"); // tj → d͡ʒ
        expect(phonemizeWord("metge")).toBe("mˈɛd͡ʒə"); // tg(e) → d͡ʒ
        expect(phonemizeWord("cotxe")).toBe("kˈɔt͡ʃə"); // tx → t͡ʃ
        expect(phonemizeWord("col·legi")).toBe("kuɫːˈɛʒi"); // l·l → ɫː
    });

    test("soft c/g, j, betacism, spirantization", () => {
        expect(phonemizeWord("cel")).toBe("sˈɛɫ"); // c before e → s
        expect(phonemizeWord("gel")).toBe("ʒˈɛɫ"); // g before e → ʒ
        expect(phonemizeWord("jo")).toBe("ʒˈɔ");
        expect(phonemizeWord("abduïda")).toBe("əβðuˈiðə"); // b→β, d→ð spirantized; ï breaks the diphthong (hiatus)
    });

    test("diphthongs: falling offglides, Cia hiatus", () => {
        expect(phonemizeWord("peu")).toBe("pˈɛw"); // eu → ɛw
        expect(phonemizeWord("ciutat")).toBe("siwtˈat"); // iu → iw (falling); i is the nucleus
        expect(phonemizeWord("ciència")).toBe("siˈɛnsiə"); // Cia/Cie → HIATUS (not a rising glide, unlike Spanish)
        expect(phonemizeWord("llei")).toBe("ʎˈɛj"); // ll → ʎ, ei → ɛj
    });

    test("stress (2R + written accent) + final-r deletion", () => {
        expect(phonemizeWord("cantar")).toBe("kəntˈa"); // final -r silent (Central); penult reduces
        expect(phonemizeWord("ciutat")).toBe("siwtˈat"); // ends in a consonant → final stress
        expect(phonemizeWord("quinze")).toBe("kˈinzə"); // ends in vowel → penult stress
    });

    test("assimilation + final devoicing + coda-cluster simplification", () => {
        expect(phonemizeWord("absolta")).toBe("əpsˈɔɫtə"); // b → p before voiceless s (regressive)
        expect(phonemizeWord("esbós")).toBe("əzβˈos"); // s → z before voiced b (regressive)
        expect(phonemizeWord("actitud")).toBe("əktitˈut"); // final d → t
        expect(phonemizeWord("vint")).toBe("bˈin"); // v→b; final -nt → n (cluster simplification)
        expect(phonemizeWord("cent")).toBe("sˈɛn");
        expect(phonemizeWord("molt")).toBe("mˈɔɫ"); // final -lt → l
    });

    test("numbers", () => {
        expect(phonemize("2", "ca")).toBe("dˈɔs");
        expect(phonemize("21", "ca")).toBe("bˈin i un"); // vint-i-un
        expect(phonemize("31", "ca")).toBe("tɾˈɛntə un"); // trenta-un
        expect(phonemize("100", "ca")).toBe("sˈɛn"); // cent
        expect(phonemize("2024", "ca")).toBe("dˈɔs mˈiɫ bˈin i kwˈatɾə");
    });

    test("text: reduction + function-word destressing + punctuation", () => {
        expect(phonemize("El gat menja peix.", "ca")).toBe("ɛɫ ɡˈat mˈɛɲʒə pˈɛʃ .");
    });
});
