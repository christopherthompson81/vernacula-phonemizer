import { describe, expect, test } from "vitest";
import { phonemizeWord } from "../src/languages/english-in/english-in.ts";

// Hand-adjudicated DIAGNOSTIC GOLD for General Indian English (en-IN), from the documented phonology (Wells 1982
// vol. 3; Sailaja 2009, *Indian English*). No en-IN pronunciation corpus exists (wikipron/kaikki have no Indian
// English), so this feature-by-feature gold — not a mined referee — is the quality anchor, exactly as for en-GB.
// The delta is a context-free post-process on the GenAm `en` output, so phonemizeWord == phonemizeWordRules.
describe("Indian English (en-IN) — GIE diagnostic gold", () => {
    test("RETROFLEXION /t d/ → [ʈ ɖ] (the signature)", () => {
        expect(phonemizeWord("tin")).toBe("ʈˈɪn");
        expect(phonemizeWord("din")).toBe("ɖˈɪn");
        expect(phonemizeWord("dog")).toBe("ɖˈɔːɡ");
        expect(phonemizeWord("water")).toBe("ʋˈɔːʈəɾ"); // intervocalic flap → retroflex, not a tap
    });

    test("TH-STOPPING: /θ/→[t̪ʰ] dental, /ð/→[d̪] — distinct from retroflex by PLACE", () => {
        expect(phonemizeWord("think")).toBe("t̪ʰˈɪŋk");
        expect(phonemizeWord("this")).toBe("d̪ˈɪs");
        expect(phonemizeWord("three")).toBe("t̪ʰɾˈiː");
        expect(phonemizeWord("tin")).not.toBe(phonemizeWord("thin")); // ʈɪn ≠ t̪ʰɪn (retroflex vs dental)
    });

    test("/v/–/w/ MERGER → [ʋ] (wet = vet)", () => {
        expect(phonemizeWord("wet")).toBe("ʋˈɛʈ");
        expect(phonemizeWord("vet")).toBe("ʋˈɛʈ");
        expect(phonemizeWord("very")).toBe("ʋˈɛɾi");
    });

    test("MONOPHTHONGISATION: FACE [eː], GOAT [oː]", () => {
        expect(phonemizeWord("face")).toBe("fˈeːs");
        expect(phonemizeWord("goat")).toBe("ɡˈoːʈ");
        expect(phonemizeWord("train")).toBe("ʈɾˈeːn"); // retroflex + tap + monophthong = the iconic GIE "train"
        expect(phonemizeWord("they")).toBe("d̪ˈeː"); // TH-stop + FACE monophthong
    });

    test("DE-ASPIRATION of /p k/; CLEAR /l/", () => {
        expect(phonemizeWord("cat")).toBe("kˈæʈ"); // k not kʰ; retroflex final t
        expect(phonemizeWord("full")).toBe("fˈʊl"); // clear l, not dark ɫ
        expect(phonemizeWord("little")).toBe("lˈɪʈəl");
    });

    test("RHOTIC with a TAP [ɾ]: coda /ɹ/ kept, r-coloured vowels → V+ɾ", () => {
        expect(phonemizeWord("car")).toBe("kˈɑːɾ");
        expect(phonemizeWord("letter")).toBe("lˈɛʈəɾ"); // lettER ɚ → əɾ
        expect(phonemizeWord("word")).toBe("ʋˈəɾɖ"); // NURSE ɝ → əɾ, w→ʋ, d→ɖ
        expect(phonemizeWord("start")).toBe("sʈˈɑːɾʈ");
    });

    test("AFFRICATES t͡ʃ/d͡ʒ are NOT retroflexed (tie-guarded)", () => {
        expect(phonemizeWord("church")).toBe("t͡ʃˈəɾt͡ʃ");
        expect(phonemizeWord("judge")).toBe("d͡ʒˈʌd͡ʒ");
    });

    test("PRICE/MOUTH stay diphthongs; a multi-feature word", () => {
        expect(phonemizeWord("price")).toBe("pɾˈaɪs");
        expect(phonemizeWord("time")).toBe("ʈˈaɪm");
        expect(phonemizeWord("student")).toBe("sʈˈuːɖənʈ");
        expect(phonemizeWord("university")).toBe("jˌuːnəʋˈəɾsɪʈi");
    });
});
