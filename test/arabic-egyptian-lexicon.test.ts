/**
 * arz (Egyptian Arabic) short-vowel LEXICON — regression guard for the shipped Egyptian vowel data. The MSA
 * neural diacritizer restores MSA short vowels, which are wrong for Egyptian (مصر MSA miṣr → Egyptian maṣr,
 * أنا anā → ana); the lexicon (egyptian-lexicon.tsv, mined from kaikki/Wiktionary Egyptian-Arabic, CC BY-SA)
 * supplies the correct Egyptian vocalization. The referee eval scores the RULE path (lexicon:false) so its 37.3%
 * stays non-circular (kaikki shares Wiktionary with the wikipron-arz referee); this lexicon is a SHIPPED
 * refinement, validated ~88–92% against wikipron-arz at build time. See
 * docs/investigations/arz_egyptian_bringup_investigation.md.
 *
 * `createArabic("egyptian", true).text(word)` resolves a lexicon hit synchronously (no ONNX diacritizer needed),
 * so these assertions are deterministic.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { createArabic } from "../src/languages/arabic/arabic.ts";

const arz = createArabic("egyptian", true);
// word → shipped Egyptian IPA (from the lexicon). Egyptian vowels the MSA path gets wrong.
const GOLD: [string, string][] = [
    ["مصر", "mˈasˤr"], // MSA miṣr → Egyptian maṣr
    ["أنا", "ˈana"], // MSA anā → Egyptian ana (short final)
    ["قط", "ʔˈutˤː"], // MSA qaṭṭ → Egyptian ʔuṭṭ (ق→ʔ, u vowel)
    ["ازاى", "ezːˈaːj"], // izzāy "how" — dialectal, no MSA form
    ["كتاب", "kitˈaːb"],
    ["تلفزيون", "tilifizjˈoːn"],
    ["برتقان", "bortoʔˈaːn"], // bortoʔān "oranges" (majhūl و→o per kaikki)
    ["بنطلون", "bantˤalˈoːn"], // banṭalōn "trousers"
    ["كنبة", "kˈanaba"], // kanaba "sofa"
];

describe("arz Egyptian short-vowel lexicon (shipped)", () => {
    for (const [word, ipa] of GOLD) {
        it(`${word} → ${ipa}`, () => {
            expect(arz.text(word)).toBe(ipa);
        });
    }
});

// g2p rules on DIACRITIZED Egyptian input (not lexicon): guards the diphthong-over-geminate ːː→ː collapse
// surfaced by the calima-egy silver (كُوَيِّس produced eːː before the fix).
describe("arz Egyptian g2p rules (diacritized input)", () => {
    for (const [word, ipa] of [
        ["أَيَّة", "ʔˈeːa"], // ayya — ay-diphthong over geminate ي; was ʔeːːa before the ːː→ː collapse
        ["بَيت", "bˈeːt"], // ay → eː
        ["يَوم", "jˈoːm"], // aw → oː
    ] as const) {
        it(`${word} → ${ipa}`, () => {
            expect(arz.text(word)).toBe(ipa);
        });
    }
});

// #550 — the mined lexicon once glued a Wiktionary entry's phonemic and phonetic transcriptions together
// (كتب → "katab/[kˈatab"), and the raw "/[" reached the IPA output as if it were a phoneme. Two layers now:
// the DATA is repaired, and the loader DROPS any row carrying a structural delimiter, so a re-mine cannot
// reintroduce it — such a word falls through to the rule g2p instead (unrefined, but never punctuation).
describe("Egyptian lexicon — no annotation artifacts (#550)", () => {
    const DELIMITER = /[/[\]~()|\\]/u;

    it("ships no entry carrying a structural delimiter", () => {
        const path = new URL("../src/languages/arabic/egyptian-lexicon.tsv", import.meta.url);
        const bad: string[] = [];
        for (const line of readFileSync(path, "utf8").split("\n")) {
            if (!line || line.startsWith("#")) continue;
            const [w, ipa] = line.split("\t");
            if (ipa && DELIMITER.test(ipa)) bad.push(`${w} → ${ipa}`);
        }
        expect(bad, `malformed rows:\n${bad.join("\n")}`).toEqual([]);
    });

    it("emits a single clean transcription for the reported words", () => {
        expect(arz.text("كتب")).toBe("kˈatab"); // was "katab/[kˈatab"
        for (const w of ["كتب", "دلوقتي", "شلتة", "كمترة", "عيل", "نسر"]) {
            expect(arz.text(w), w).not.toMatch(DELIMITER);
        }
    });
});
