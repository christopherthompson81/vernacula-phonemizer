import { describe, expect, test } from "vitest";

import { phonemizeWord, createSetswana } from "../src/languages/setswana/setswana.ts";

// Canonical-IPA goldens for Setswana / Tswana (tn) — Bantu (Sotho-Tswana, S31), Latin orthography, non-click.
// Phonology from the modern sources: Matlhaku (2020, MUN OPL), Zerbian & Kügler (2021, JIPA), Wikipedia, + Cole
// (1955) via Mistry. The greedy longest-match g2p scores 100% folded vs epitran tsn-Latn (tools/referee-eval,
// 1592 words). Vowels are the standard 7-vowel system /i ɪ ɛ a ɔ ʊ u/ (⟨e⟩→ɪ, ⟨o⟩→ʊ, ⟨ê ô⟩→ɛ ɔ). Tone (H/L,
// lexical + unwritten) and the ejective realization (post-nasal/dialectal) are deferred.
// See docs/investigations/tn_native_bringup_investigation.md.
describe("Setswana canonical IPA — greedy g2p", () => {
    test("digraph signatures: dorsal aspirates, lateral affricates, sibilants, palatals", () => {
        expect(phonemizeWord("kgomo")).toBe("k͡χʰʊmʊ"); // "cow" — ⟨kg⟩ → k͡χʰ (uvular)
        expect(phonemizeWord("kgosi")).toBe("k͡χʰʊsi"); // "chief" — ⟨kg⟩
        expect(phonemizeWord("tlhogo")).toBe("t͡ɬʰʊχʊ"); // "head" — ⟨tlh⟩ → t͡ɬʰ (+ ⟨g⟩→χ)
        expect(phonemizeWord("tshaba")).toBe("t͡sʰaba"); // "tribe" — ⟨tsh⟩ → t͡sʰ
        expect(phonemizeWord("batswana")).toBe("bat͡swana"); // ⟨ts⟩ → t͡s
        expect(phonemizeWord("motho")).toBe("mʊtʰʊ"); // "person" — ⟨th⟩ → tʰ, ⟨o⟩→ʊ
        expect(phonemizeWord("dijo")).toBe("did͡ʒʊ"); // "food" — ⟨j⟩ → d͡ʒ
    });

    test("the ⟨g⟩ → [χ] uvular divergence (Setswana has no /g/ phoneme; epitran's plain [g] is wrong)", () => {
        expect(phonemizeWord("legodimo")).toBe("lɪχʊdimʊ"); // "sky/heaven" — ⟨g⟩ → χ
        expect(phonemizeWord("segolo")).toBe("sɪχʊlʊ"); // ⟨g⟩ → χ
        expect(phonemizeWord("nyaga")).toBe("ɲaχa"); // ⟨ny⟩ → ɲ AND ⟨g⟩ → χ
    });

    test("palatal/velar nasals; ⟨ny⟩ → ɲ (vs epitran's naive n+glide)", () => {
        expect(phonemizeWord("ngwana")).toBe("ŋwana"); // "child" — ⟨ng⟩ → ŋ
        expect(phonemizeWord("senya")).toBe("sɪɲa"); // ⟨ny⟩ → ɲ
    });

    test("the standard 7-vowel system /i ɪ ɛ a ɔ ʊ u/ (⟨e⟩→ɪ, ⟨o⟩→ʊ; ê/ô → open-mid ɛ/ɔ)", () => {
        expect(phonemizeWord("dumela")).toBe("dumɪla"); // "hello" — ⟨e⟩ → ɪ (near-close)
        expect(phonemizeWord("tsela")).toBe("t͡sɪla"); // "road" — ⟨e⟩ → ɪ
        expect(phonemizeWord("bola")).toBe("bʊla"); // "dice" — plain ⟨o⟩ → ʊ
        expect(phonemizeWord("bôla")).toBe("bɔla"); // "to rot" — ⟨ô⟩ → ɔ (open-mid), minimal pair vs bola
        expect(phonemizeWord("mmele")).toBe("mmɪlɪ"); // "body" — syllabic ⟨m⟩ onset
        expect(phonemizeWord("ntlha")).toBe("nt͡ɬʰa"); // "point" — nasal + ⟨tlh⟩
    });
});

describe("Setswana cardinal numbers (bo-counting series)", () => {
    const tn = createSetswana();
    const say = (s: string) => tn.text(s).replace(/\s+/g, " ").trim();
    test("units, teens, tens, hundreds, thousands compose descending with ⟨le⟩", () => {
        expect(say("1")).toBe("bʊŋwɪ"); // bongwe
        expect(say("8")).toBe("bʊfɪra bʊbɪdi"); // bofera bobedi (two-word)
        expect(say("10")).toBe("lɪsʊmɪ"); // lesome
        expect(say("15")).toBe("lɪsʊmɪ lɪ bʊt͡ɬʰanʊ"); // lesome le botlhano
        expect(say("20")).toBe("masʊmɪ a mabɪdi"); // masome a mabedi
        expect(say("21")).toBe("masʊmɪ a mabɪdi lɪ bʊŋwɪ"); // + le bongwe
        expect(say("100")).toBe("lɪk͡χʰʊlʊ"); // lekgolo
        expect(say("1000")).toBe("sɪkɪtɪ"); // sekete
        expect(say("2025")).toBe("dikɪtɪ t͡sɪ pɪdi lɪ masʊmɪ a mabɪdi lɪ bʊt͡ɬʰanʊ"); // dikete tse pedi …
    });
});
