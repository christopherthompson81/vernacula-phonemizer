/**
 * arz (Egyptian Arabic) short-vowel LEXICON — regression guard for the shipped Egyptian vowel data. The MSA
 * neural diacritizer restores MSA short vowels, which are wrong for Egyptian (مصر MSA miṣr → Egyptian maṣr,
 * أنا anā → ana); the lexicon (egyptian-lexicon.tsv, mined from kaikki/Wiktionary Egyptian-Arabic, CC BY-SA)
 * supplies the correct Egyptian vocalization. ⚠ The referee eval must score the RULE path (lexicon:false) to
 * stay NON-CIRCULAR: kaikki shares Wiktionary with the wikipron-arz referee, so scoring the lexicon path would
 * grade the mined data against its own source. This lexicon is a SHIPPED refinement, validated against
 * wikipron-arz at build time.
 *
 * `createArabic("egyptian", true).text(word)` resolves a lexicon hit synchronously (no ONNX diacritizer needed),
 * so these assertions are deterministic.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { createArabic, ipaOnly, repairForeignClusters } from "../src/languages/arabic/arabic.ts";

const arz = createArabic("egyptian", true);
const msa = createArabic(undefined, false);
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

// ⚠ A WIKTIONARY ENTRY CAN CARRY TWO TRANSCRIPTIONS — phonemic and phonetic — and a miner that takes the
// whole field glues them (كتب → "katab/[kˈatab"), so the raw "/[" reaches the IPA output as if it were a
// phoneme. Two layers guard it:
// the DATA is repaired, and the loader DROPS any row carrying a structural delimiter, so a re-mine cannot
// reintroduce it — such a word falls through to the rule g2p instead (unrefined, but never punctuation).
describe("Egyptian lexicon — no annotation artifacts", () => {
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

    // The guard REPAIRS rather than drops, and that distinction matters here: this lexicon exists to supply
    // EGYPTIAN short vowels. A dropped row falls back to the abjad rule path or the MSA diacritizer, which
    // restores MSA vowels that are WRONG for Egyptian — so dropping would degrade to "incorrect vowels",
    // not merely "unrefined". Recovering an alternant keeps the vocalization.
    it("repairs a malformed value at load instead of dropping the vocalization", () => {
        expect(ipaOnly("katab/[kˈatab")).toBe("kˈatab"); // prefer the single stressed alternant
        expect(ipaOnly("ʃˈarː/[ʃar")).toBe("ʃˈarː"); // ...whichever side it is on
        expect(ipaOnly("sakːˈiːna//saˈkːiːna")).toBe("sakːˈiːna"); // both stressed → first
        expect(ipaOnly("p/~/b")).toBe("p"); // neither stressed → first
        expect(ipaOnly("kˈatab")).toBe("kˈatab"); // a clean value is untouched
        expect(ipaOnly("x(y)")).toBeUndefined(); // genuinely unusable → dropped
    });

    it("emits a single clean transcription for the reported words", () => {
        expect(arz.text("كتب")).toBe("kˈatab"); // was "katab/[kˈatab"
        for (const w of ["كتب", "دلوقتي", "شلتة", "كمترة", "عيل", "نسر"]) {
            expect(arz.text(w), w).not.toMatch(DELIMITER);
        }
    });
});

// Foreign-cluster repair (سنترال → sntrˈaːl). The diacritizer vocalizes native words and frequent
// loans but returns rare transliterations bare; the g2p then emits consonant runs no Arabic syllable
// permits — (C)V(C)(C) allows at most CC, so a 3+ run is always a vocalization failure. Tier 1 re-reads
// و/ي inside an illegal run as the vowels they carry in loan spellings; tier 2 breaks residual runs with
// the epenthetic vowel, after the run's FIRST consonant (selected against 57 attested loanword
// transcriptions: booking → bukinɡ, not bukniɡ). Pure function — no ONNX needed to test it.
describe("Arabic foreign-cluster repair", () => {
    it("tier 1: mater lectionis — و/ي in an illegal run become u/i", () => {
        expect(repairForeignClusters("bwknɡ")).toBe("bukinɡ"); // بوكنج Booking (tier 2 finishes knɡ)
        expect(repairForeignClusters("kˈaːrwljn")).toBe("kˈaːrulin"); // Carolyn
    });

    it("tier 2: epenthesis after the first consonant of a residual run", () => {
        expect(repairForeignClusters("sntrˈaːl")).toBe("sinitrˈaːl"); // سنترال Central
    });

    it("no-ops on legally syllabified words — native output is untouched by construction", () => {
        for (const w of ["mˈaktab", "madrˈasa", "kumbijˈuːtar", "muʕtaʔˈalaː", "ʔˈatˤlaʔ"]) {
            expect(repairForeignClusters(w)).toBe(w);
        }
    });

    it("word-final CC (legal CVCC) is not broken", () => {
        expect(repairForeignClusters("ʃˈabt")).toBe("ʃˈabt");
        expect(repairForeignClusters("kˈalb")).toBe("kˈalb");
    });
});

// Egyptian numerals. arz used to read digits with the MSA compositor, producing forms the dialect
// does not have: 80 → θamaːnuːn, with a /θ/ Egyptian lacks (Egyptian folds it to t/s), and the MSA
// connector wa. The variety now carries its own attested tables (kaikki arz IPA, wikipron, and
// en.wiktionary {{arz-numeral}} transliterations; the fused hundreds 300–900 are pedagogical-literature
// forms, flagged as such in egyptian.jsonc). Composition (units-before-tens, fused hundreds) rides the
// shared algorithm. Sync path — numberToIpa needs no diacritizer.
describe("Egyptian numerals", () => {
    it("dialect forms, not MSA", () => {
        expect(arz.text("80")).toBe("tamaniːn"); // was θamaːnuːn, with a /θ/ Egyptian does not have
        expect(arz.text("25")).toBe("xamsa wi ʕiʃriːn"); // wi, not wa
        expect(arz.text("90")).toBe("tisʔiːn"); // attested ʕ→ʔ
        expect(arz.text("200")).toBe("miteːn");
        expect(arz.text("1998")).toBe("ʔalf wi tusʕumijːa wi tamanja wi tisʔiːn");
    });

    it("no MSA-only phonemes anywhere in 0..2000", () => {
        for (let n = 0; n <= 2000; n++) {
            expect(arz.text(String(n)), `n=${n}`).not.toMatch(/[θð]|wa /u);
        }
    });

    it("MSA is untouched", () => {
        expect(msa.text("80")).toBe("θamaːnuːn");
        expect(msa.text("25")).toBe("xamsa wa ʕiʃruːn");
    });
});
