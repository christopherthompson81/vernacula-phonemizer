import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/bishnupriya/bishnupriya.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Bishnupriya Manipuri / বিষ্ণুপ্রিয়া মণিপুরী (bpy) — Eastern Indo-Aryan, Bengali /
// Eastern-Nagari script (~120k, Assam/Tripura + Sylhet). Reuses the Bengali engine (abugida scan + inherent-vowel
// deletion) with BENGALI phoneme values — the referee is Bengali-like, NOT Assamese-like: the ʃ sibilants, the
// retroflex/dental split, and the affricates are all kept. The one divergence is heightHarmony:false (no ɔ→o
// raising). Validated 84.2% folded / 95.1% symbol vs the English-Wiktionary bpy category (human, 38 pairs).
// See docs/investigations/bpy_native_bringup_investigation.md.
describe("Bishnupriya Manipuri canonical IPA", () => {
    test("Bengali-like sibilants শ/ষ/স → [ʃ] (NOT the Assamese [x])", () => {
        expect(phonemizeWord("সাত")).toBe("ʃat̪"); // স → ʃ, ত → dental t̪ (seven)
        expect(phonemizeWord("সমুদ্র")).toBe("ʃɔmud̪ɾo"); // স → ʃ; the initial ɔ is NOT raised (no height harmony)
        expect(phonemizeWord("বিশ")).toBe("biʃ"); // শ → ʃ (twenty)
    });

    test("affricates চ/জ + the retroflex/dental split kept (Bengali, not the Assamese merger)", () => {
        expect(phonemizeWord("চার")).toBe("t͡ʃaɾ"); // চ → t͡ʃ affricate (four), র → tap ɾ
        expect(phonemizeWord("হাজার")).toBe("ɦad͡ʒaɾ"); // জ → d͡ʒ, হ → ɦ (thousand)
        expect(phonemizeWord("আট")).toBe("aʈ"); // ট → RETROFLEX ʈ (eight)
        expect(phonemizeWord("তিন")).toBe("t̪in"); // ত → DENTAL t̪ (three)
    });

    test("inherent-vowel deletion (final + medial) with no height harmony", () => {
        expect(phonemizeWord("দশ")).toBe("d̪ɔʃ"); // final inherent deleted (ten); দ → dental d̪
        expect(phonemizeWord("খরগোশ")).toBe("kʰɔɾɡoʃ"); // medial ɔ (র) deleted; initial ɔ stays UNRAISED (rabbit)
        expect(phonemizeWord("পাহাড়")).toBe("paɦaɽ"); // হ → ɦ, ড় → retroflex flap ɽ (mountain)
    });

    test("registry wiring + diphthong", () => {
        expect(phonemizeWord("নৌকা")).toBe("nouka"); // ঔ/ৌ → ou diphthong (boat)
        expect(getPhonemizer("bpy").text("আট").trim()).toBe("aʈ");
    });
});
