import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/latgalian/latgalian.ts";

// Canonical-IPA goldens for Latgalian (ltg) — latgaļu volūda, an Eastern Baltic sibling of Latvian. The signature is
// the ⟨i⟩/⟨y⟩ soft/hard split: front ⟨i ī e ē⟩ palatalize the preceding consonant, but ⟨y⟩→[ɨ] (a hard central vowel
// Latvian lacks) does NOT. Plus macron length, háček sibilants, written palatals, and Baltic voicing assimilation.
// Referee: wikipron ltg narrow + kaikki. See docs/investigations/ltg_native_bringup_investigation.md.
describe("Latgalian (latgaļu volūda) canonical IPA", () => {
    test("★ the ⟨i⟩/⟨y⟩ SOFT/HARD split (the signature)", () => {
        expect(phonemizeWord("cylvāks")).toBe("t͡sɨlvaːks"); // 'human' — ⟨y⟩→[ɨ] HARD: ⟨c⟩ is NOT palatalized
        expect(phonemizeWord("byut")).toBe("bɨut"); // 'to be' — ⟨y⟩→[ɨ]
        expect(phonemizeWord("acis")).toBe("at͡sʲis"); // 'eye' — ⟨i⟩ SOFT: ⟨c⟩→[t͡sʲ] palatalized
        expect(phonemizeWord("bet")).toBe("bʲæt"); // 'but' — ⟨e⟩ palatalizes ⟨b⟩→[bʲ]; ⟨e⟩→[æ]
    });

    test("onset-cluster palatalization + written palatals", () => {
        expect(phonemizeWord("bazneica")).toBe("bazʲnʲæit͡sa"); // 'church' — the onset cluster ⟨zn⟩ softens before ⟨ei⟩
        expect(phonemizeWord("mute")).toBe("mutʲæ"); // 'mouth' — ⟨t⟩ palatalizes before ⟨e⟩; ⟨m⟩ before ⟨u⟩ stays hard
        expect(phonemizeWord("ķēneņš")).toBe("kʲæːnʲænʲt͡ʃ"); // ⟨ķ⟩→[kʲ], ⟨ē⟩→[æː], ⟨ņ⟩→[nʲ]; final ⟨-ņš⟩ → [nʲt͡ʃ] (t-epenthesis)
        expect(phonemizeWord("latgaļu")).toBe("ladɡalʲu"); // the endonym — ⟨ļ⟩→[lʲ]; ⟨tg⟩ voices to [dɡ]
    });

    test("review fixes — t-epenthesis, /r/-cluster opacity, final ⟨v⟩→[f]", () => {
        expect(phonemizeWord("sens")).toBe("sʲænt͡s"); // final ⟨-ns⟩ → [nt͡s] (epenthetic t) — the -ons nominative class
        expect(phonemizeWord("akmiņs")).toBe("akʲmʲinʲt͡sʲ"); // final ⟨-ņs⟩ → [nʲt͡sʲ]
        expect(phonemizeWord("treis")).toBe("træis"); // obstruent+⟨r⟩ cluster stays HARD (not tʲrʲ)
        expect(phonemizeWord("svareigs")).toBe("zvarʲæiks"); // a SIMPLE ⟨r⟩ onset still palatalizes before a front vowel
        expect(phonemizeWord("div")).toBe("dʲif"); // word-final ⟨v⟩ devoices to [f] (not the glide [w])
    });

    test("vowels + Baltic voicing assimilation", () => {
        expect(phonemizeWord("volūda")).toBe("vɔluːda"); // ⟨o⟩→[ɔ], macron ⟨ū⟩→[uː]
        expect(phonemizeWord("Latgola")).toBe("ladɡɔla"); // ⟨tg⟩→[dɡ] regressive voicing
        expect(phonemizeWord("atzeit")).toBe("ad͡zʲæit"); // ⟨tz⟩→[d͡z] affricate, palatalized before ⟨ei⟩
    });
});
