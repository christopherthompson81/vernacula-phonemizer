/**
 * The Gurmukhi exceptions lexicon — the invariants that keep it from scoring the answer key.
 *
 * `gurmukhi-lexicon.tsv` carries wikipron pan_guru readings for the words the eval path gets wrong (mostly
 * the medial-schwa class proven lexical three ways — investigation Runs 1-4). The referee eval scores
 * `phonemizeWordEval`, which must never read it; shipped `phonemizeWord` consults it first. House pattern:
 * af/en-GB/tl/ilo/km.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { guruLexicon, phonemizeWord, phonemizeWordEval } from "../src/languages/punjabi/punjabi.ts";

const PA = join(import.meta.dirname, "../src/languages/punjabi");
const referee = new Set<string>();
for (const line of readFileSync(join(import.meta.dirname, "../tools/referee-eval/referees/pa.wikipron-pan-broad.tsv"), "utf8").split("\n"))
    if (!line.startsWith("#") && line.includes("\t")) referee.add(line.split("\t")[0]!);

describe("punjabi Gurmukhi exceptions lexicon", () => {
    test("it is real and its licence is recorded", () => {
        expect(guruLexicon().size).toBeGreaterThan(200);
        const header = readFileSync(join(PA, "gurmukhi-lexicon.tsv"), "utf8").slice(0, 900);
        expect(header).toContain("CC-BY-SA");
        expect(header).toContain("MUST NEVER READ THIS FILE");
    });

    test("⚠ every entry is a referee word — it is an EXCEPTIONS lexicon, not a dictionary", () => {
        const stray = [...guruLexicon().keys()].filter((w) => !referee.has(w));
        expect(stray, `entries not in the referee: ${stray.slice(0, 5).join(", ")}`).toEqual([]);
    });

    test("⚠ the EVAL path reads none of it — the referee eval depends on this", () => {
        // If phonemizeWordEval consulted the lexicon, every entry would round-trip identically and the
        // eval would be scoring the file it was mined from. The lexicon exists precisely because the eval
        // reading DIFFERS on these words.
        const differing = [...guruLexicon()].filter(([w, ipa]) => phonemizeWordEval(w) !== ipa);
        expect(differing.length).toBe(guruLexicon().size);
    });

    test("shipped precedence: lexicon → eval path", () => {
        const [w, ipa] = [...guruLexicon()][0]!;
        expect(phonemizeWord(w)).toBe(ipa);
    });

    test("the audio-adjudicated words read correctly shipped (FLEURS, investigation Runs 1-2)", () => {
        // The medial-schwa positions the audio recovered at 100% precision, now served by the lexicon:
        expect(phonemizeWord("ਹਸਪਤਾਲ")).toBe("ɦəspət̪äːl"); // hospital — was *ɦəsəpt̪aːl
        expect(phonemizeWord("ਦਿਲਚਸਪ")).toBe("d̪ɪlt͡ʃəsəp"); // interesting — was *d̪ɪlət͡ʃsəp
        expect(phonemizeWord("ਅਸਮਾਨ")).toBe("əsə̆maːn"); // sky — the loan keeps its epenthetic vowel
    });
});

// BINDI HOMORGANIC RESTORATION — the one rule-shaped class of the 161 non-schwa residual (population-derived
// 26:5; investigation Run 7). Opt-in per manifest: Gurmukhi's ਂ restores the nasal consonant before a stop;
// Devanagari's chandrabindu stays pure nasalization (the flag is what keeps Hindi inert).
describe("punjabi bindi → homorganic nasal before a stop", () => {
    test("the class words read the consonant, in the RULES (no lexicon)", () => {
        expect(phonemizeWordEval("ਆਂਡਾ")).toBe("ˈãɳɖaː"); // egg — was *ˈãɖaː (retroflex → ɳ)
        expect(phonemizeWordEval("ਗੋਂਗਲੂ")).toBe("ɡˈõŋɡəluː"); // turnip — velar → ŋ
        expect(phonemizeWordEval("ਆਂਦਰ")).toBe("ˈãn̪d̪əɾ"); // intestine — dental → n̪
    });
    test("⚠ h-coalescence stays LEXICON-served — the population splits 17 kept : 10 fused, not a rule", () => {
        expect(phonemizeWord("ਜ਼ਹਿਰ")).toBe("zɛː˦ɾə̆"); // referee reading via the lexicon
        expect(phonemizeWordEval("ਜ਼ਹਿਰ")).toBe("zˈəɦɪɾ"); // the rules keep the transparent form
    });
});
