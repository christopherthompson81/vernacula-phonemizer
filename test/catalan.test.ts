import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/catalan/catalan.ts";

// Canonical-IPA goldens for General Eastern/Central Catalan (Barcelona standard), espeak-independent. Rule-based
// g2p → 2R stress → UNSTRESSED VOWEL REDUCTION (a/e→ə, o→u) → regressive voicing assimilation → spirantization
// → nasal place assimilation → final devoicing + final-r deletion + coda-cluster simplification. Stressed
// open/close mid height (ɛ/e, ɔ/o) is LEXICAL and defaults to open (the documented ceiling — dona/dóna).
// See docs/investigations/ca_bringup_investigation.md.
describe("catalan canonical IPA", () => {
    test("vowel reduction (the Central signature) + dark l", () => {
        expect(phonemizeWord("casa")).toBe("kˈazə"); // final a → ə, intervocalic s → z
        expect(phonemizeWord("mira")).toBe("mˈiɾə"); // tap ɾ
        expect(phonemizeWord("carro")).toBe("kˈaru"); // rr → trill; final o → u
        expect(phonemizeWord("xocolata")).toBe("ʃukuɫˈatə"); // o→u ×2, dark ɫ, x → ʃ
        expect(phonemizeWord("dona")).toBe("dˈɔnə"); // stressed open ɔ (correct here)
    });

    test("Run 2 — lexical stressed mid-vowel height (open ɛ/ɔ default, close e/o from the espeak-derived lexicon)", () => {
        expect(phonemizeWord("pedra")).toBe("pˈeðɾə"); // close e (lexicon)
        expect(phonemizeWord("menja")).toBe("mˈeɲʒə"); // close e
        expect(phonemizeWord("por")).toBe("pˈoɾ"); // close o
        expect(phonemizeWord("Barcelona")).toBe("bəɾsəɫˈonə"); // close o
        expect(phonemizeWord("terra")).toBe("tˈɛrə"); // stays OPEN ɛ (not flagged)
        expect(phonemizeWord("cosa")).toBe("kˈɔzə"); // stays OPEN ɔ
    });

    test("palatals, affricates, digraphs (ny/ll/tx/tj/tg/ix)", () => {
        expect(phonemizeWord("any")).toBe("ˈaɲ"); // ny → ɲ
        expect(phonemizeWord("panxa")).toBe("pˈaɲʃə"); // n → ɲ before ʃ
        expect(phonemizeWord("caixa")).toBe("kˈaʃə"); // ix → ʃ (the i is a silent marker, not a glide)
        expect(phonemizeWord("peix")).toBe("pˈeʃ");
        expect(phonemizeWord("platja")).toBe("pɫˈad͡ʒə"); // tj → d͡ʒ
        expect(phonemizeWord("metge")).toBe("mˈed͡ʒə"); // tg(e) → d͡ʒ
        expect(phonemizeWord("cotxe")).toBe("kˈot͡ʃə"); // tx → t͡ʃ
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
        expect(phonemizeWord("llei")).toBe("ʎˈej"); // ll → ʎ, ei → ɛj
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
        expect(phonemizeWord("cent")).toBe("sˈen");
        expect(phonemizeWord("molt")).toBe("mˈoɫ"); // final -lt → l
    });

    test("review fixes: velar-nasal cluster, -ig affricate, spirant-after-lateral, diphthong-final stress", () => {
        expect(phonemizeWord("banc")).toBe("bˈaŋ"); // n→ŋ then final k drops
        expect(phonemizeWord("sang")).toBe("sˈaŋ"); // -ng → ŋ
        expect(phonemizeWord("maig")).toBe("mˈat͡ʃ"); // vowel-preceded -ig → t͡ʃ (i silent)
        expect(phonemizeWord("mig")).toBe("mˈit͡ʃ"); // consonant-preceded -ig → i + t͡ʃ (i is a nucleus)
        expect(phonemizeWord("alga")).toBe("ˈaɫɣə"); // ɡ DOES spirantize after a lateral (only d stays occlusive)
        expect(phonemizeWord("remei")).toBe("rəmˈɛj"); // falling-diphthong-final → OXYTONE (final stress)
        expect(phonemizeWord("correu")).toBe("kurˈɛw");
        expect(phonemizeWord("pausa")).toBe("pˈawzə"); // s → z after a glide too
    });

    test("Run 3 — ⟨x⟩ realization, -Cs cluster, bl/gl gemination", () => {
        expect(phonemizeWord("taxi")).toBe("tˈaksi"); // ⟨x⟩ after a vowel → ks
        expect(phonemizeWord("box")).toBe("bˈɔks"); // coda ⟨x⟩ → ks
        expect(phonemizeWord("panxa")).toBe("pˈaɲʃə"); // ⟨x⟩ after a consonant → ʃ
        expect(phonemizeWord("examen")).toBe("əɡzˈamən"); // ex- prefix → ɡz
        expect(phonemizeWord("forts")).toBe("fˈɔɾs"); // -rts → rs (but fort → fˈɔɾt keeps its t)
        expect(phonemizeWord("fort")).toBe("fˈɔɾt");
        expect(phonemizeWord("poble")).toBe("pˈɔbːɫə"); // bl → bː + l (geminate; popular word, lexicon)
        expect(phonemizeWord("regla")).toBe("rˈeɡːɫə"); // gl → ɡː + l
        expect(phonemizeWord("problema")).toBe("pɾuβɫˈemə"); // learned word: bl SPIRANTIZES (not in the geminate lexicon)
        expect(phonemizeWord("obligar")).toBe("uβɫiɣˈa");
    });

    test("review fixes: diphthong+coda oxytone stress, gua/guo glide", () => {
        expect(phonemizeWord("correus")).toBe("kurˈɛws"); // falling diphthong + plural -s → still OXYTONE (not penult)
        expect(phonemizeWord("dijous")).toBe("diʒˈɔws");
        expect(phonemizeWord("remeis")).toBe("rəmˈɛjs");
        expect(phonemizeWord("aigua")).toBe("ˈajɣwə"); // gua → ɡw (u is a glide, not a hiatus nucleus)
        expect(phonemizeWord("guardar")).toBe("ɡwəɾðˈa");
    });

    test("numbers", () => {
        expect(phonemize("2", "ca")).toBe("dˈos");
        expect(phonemize("21", "ca")).toBe("bˈin i un"); // vint-i-un
        expect(phonemize("31", "ca")).toBe("tɾˈɛntə un"); // trenta-un
        expect(phonemize("100", "ca")).toBe("sˈen"); // cent
        expect(phonemize("200", "ca")).toBe("dˈos sˈens"); // dos-cents → two words (hyphen split)
        expect(phonemize("2024", "ca")).toBe("dˈos mˈiɫ bˈin i kwˈatɾə");
    });

    test("text: reduction + function-word destressing + punctuation", () => {
        expect(phonemize("El gat menja peix.", "ca")).toBe("əɫ ɡˈat mˈeɲʒə pˈeʃ ."); // el reduces: proclitic [ə] (was ɛɫ before the Run-27 fix)
    });
});

// Proclitic vowel reduction (found by the FLEURS engine diff, Run 27). De-stressing a function word used to be
// a post-hoc ˈ strip, applied AFTER reduce() had run with the word's only nucleus at the stress index — the
// mark vanished but the vowel kept its stressed quality (el → ɛɫ). Central Catalan proclitics are [ə]; the
// human referee attests em → "ə m", and espeak agrees (əl). Now the whole word reduces (stress = -1).
describe("Catalan proclitic reduction", () => {
    test("clitics reduce in running text", () => {
        expect(phonemize("el gat", "ca")).toBe("əɫ ɡˈat");
        expect(phonemize("del mar", "ca")).toBe("dəɫ mˈaɾ");
        expect(phonemize("es posa", "ca")).toBe("əs pˈɔzə");
        expect(phonemize("que ve", "ca")).toBe("kə bˈe");
        expect(phonemize("ho fa", "ca")).toBe("u fˈa"); // ho — the famously [u] pronoun
    });

    test("keep-vowel function words lose only the mark", () => {
        // the conjunction "o" resists reduction (contrast with u; referee: o → "o"), as do no/com.
        expect(phonemize("blanc o negre", "ca")).toBe("bɫˈaŋ o nˈɛɣɾə");
        expect(phonemize("no ve", "ca")).toBe("no bˈe");
    });

    test("content monosyllables keep their stressed vowel", () => {
        expect(phonemize("mel", "ca")).toBe("mˈɛɫ");
        expect(phonemize("tren", "ca")).toBe("tɾˈɛn");
    });

    test("citation form (phonemizeWord) is unchanged — stress + full vowel", () => {
        expect(phonemizeWord("el")).toBe("ˈɛɫ");
    });
});
