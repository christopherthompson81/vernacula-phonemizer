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
