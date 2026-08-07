import { describe, expect, test } from "vitest";

import { phonemizeWord, createLatgalian } from "../src/languages/latgalian/latgalian.ts";

// Canonical-IPA goldens for Latgalian (ltg) — latgaļu volūda, an Eastern Baltic sibling of Latvian. The signature is
// the ⟨i⟩/⟨y⟩ soft/hard split: front ⟨i ī e ē⟩ palatalize the preceding consonant, but ⟨y⟩→[ɨ] (a hard central vowel
// Latvian lacks) does NOT. Plus macron length, háček sibilants, written palatals, and Baltic voicing assimilation.
// Referee: wikipron ltg narrow + kaikki.
describe("Latgalian (latgaļu volūda) canonical IPA", () => {
    test("the ⟨i⟩/⟨y⟩ SOFT/HARD split (the signature)", () => {
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

    // Cardinal numbers (numbers.ts). East-Baltic concord as in Latvian — SINGULAR after a count ending in …1
    // (except …11), plural otherwise — but with the Latgalian twist that "tyukstūša" is FEMININE (Latvian's
    // tūkstotis is masculine), so the thousands multiplier takes the FEMININE unit series (sešys, vīna).
    test("cardinal numbers: -padsmit teens + the FEMININE tyukstūša multiplier", () => {
        const ltg = createLatgalian();
        expect(ltg.text("7").trim()).toBe("sʲæpʲtʲænʲi"); // septeni
        expect(ltg.text("15").trim()).toBe("pʲiːt͡spatʲsʲmʲit"); // pīcpadsmit (the -padsmit teen)
        expect(ltg.text("21").trim()).toBe("dʲiwʲdʲæsʲmʲit vʲiːnt͡s"); // divdesmit vīns (coda ⟨v⟩→w; final ⟨-ns⟩→[nt͡s])
        expect(ltg.text("101").trim()).toBe("sɨmts vʲiːnt͡s"); // symts vīns
        expect(ltg.text("555").trim()).toBe("pʲiːt͡sʲi sɨmʲtʲi pʲiːd͡zʲdʲæsʲmʲit pʲiːt͡sʲi"); // pīci symti pīcdesmit pīci
        expect(ltg.text("1000").trim()).toBe("tɨukstuːʃa"); // tyukstūša — the numeral is dropped
        expect(ltg.text("2000").trim()).toBe("dʲivʲi tɨukstuːʃɨs"); // divi tyukstūšys → plural
        expect(ltg.text("6000").trim()).toBe("sʲæʃɨs tɨukstuːʃɨs"); // sešys tyukstūšys — FEMININE multiplier
        expect(ltg.text("21000").trim()).toBe("dʲiwʲdʲæsʲmʲit vʲiːna tɨukstuːʃa"); // divdesmit vīna tyukstūša (fem sg)
        expect(ltg.text("100000").trim()).toBe("sɨmts tɨukstuːʃɨs"); // symts tyukstūšys (masc symts + fem noun)
        expect(ltg.text("12345").trim()).toBe(
            "dʲiwpatʲsʲmʲit tɨukstuːʃɨs træis sɨmʲtʲi t͡ʃʲætrudʲæsʲmʲit pʲiːt͡sʲi",
        ); // divpadsmit tyukstūšys treis symti četrudesmit pīci
        expect(ltg.text("1000000").trim()).toBe("vʲiːnt͡s mʲilʲjɔnt͡s"); // vīns miļjons (masculine, keeps the numeral)
        expect(ltg.text("1000000000").trim()).toBe("vʲiːnt͡s mʲilʲjarts"); // vīns miļjards
    });
});
