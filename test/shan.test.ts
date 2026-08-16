import { describe, expect, test } from "vitest";
import { normalizeShan } from "../src/languages/shan/normalize.ts";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/shan/shan.ts";

// Canonical-IPA goldens for Shan / Tai Long (shn) — လိၵ်ႈတႆး, Southwestern Tai (Tai-Kadai), the SHAN ABUGIDA (a
// Myanmar-script variant), TONAL. A per-syllable scan: onset → medials → rime (vowel signs ×
// coda) → EXPLICIT tone (unmarked→˨˦, ႇ→˩, ႈ→˧˧˨, visarga း→˥, ႉ→˦˨). Signatures: aspirated ⟨သ⟩→[sʰ], glottal-onset
// ⟨ဢ⟩→[ʔ]; ⟨ူ⟩→[o] closed / [uː] open; medial ⟨ွ⟩ ROUNDS the inherent rime to [ɔ]; ⟨ိူ⟩→[ɤ], ⟨ို⟩→[ɯ]; the ⟨ႂ⟩ coda
// →[ɰ]; palatalisation ⟨ၵျ⟩→[d͡ʑ]. Referee: wikipron shn_mymr_broad (2607 human).
describe("Shan (Tai Long) canonical IPA", () => {
    test("onsets, tones, and the endonym", () => {
        expect(phonemizeWord("တႆး")).toBe("taj˥"); // 'Tai/Shan' — ⟨ႆ⟩ final-y→[j], visarga း→˥ (high)
        expect(phonemizeWord("ၼမ်ႉ")).toBe("nam˦˨"); // 'water' — ⟨ၼ⟩→n, ⟨မ⟩ coda→m, ⟨ႉ⟩→˦˨ (tone 5)
        expect(phonemizeWord("ၵိၼ်")).toBe("kin˨˦"); // 'eat' — ⟨ၵ⟩→k, unmarked→˨˦ (rising)
        expect(phonemizeWord("ၽႃႇ")).toBe("pʰaː˩"); // ⟨ၽ⟩→pʰ, ⟨ႃ⟩→aː, ⟨ႇ⟩→˩ (low)
    });

    test("⟨ၢ⟩ and ⟨ႃ⟩ are BOTH long [aː]; short [a] is the inherent (sign-less) vowel", () => {
        expect(phonemizeWord("ၵၢၼ်")).toBe("kaːn˨˦"); // 'work' — closed-syllable ⟨ၢ⟩ → long [aː]
        expect(phonemizeWord("တၢင်း")).toBe("taːŋ˥"); // 'way' — ⟨ၢ⟩ → [aː]
        expect(phonemizeWord("တတ်း")).toBe("tat̚˥"); // inherent (no sign) → SHORT [a], checked coda ⟨တ⟩→[t̚]
    });

    test("the ⟨ူ⟩ o/uː split, medial-⟨ွ⟩ rounding, aspirated ⟨သ⟩", () => {
        expect(phonemizeWord("ၵူၼ်း")).toBe("kon˥"); // 'person' — ⟨ူ⟩ before a coda → [o]
        expect(phonemizeWord("ၵွင်")).toBe("kɔŋ˨˦"); // medial ⟨ွ⟩ + inherent → ROUNDED [ɔ] (no -w- glide)
        expect(phonemizeWord("သွင်")).toBe("sʰɔŋ˨˦"); // 'two' — aspirated ⟨သ⟩→[sʰ] + ⟨ွ⟩ rounding
    });

    test("diphthong rimes ⟨ိူ ို⟩, the ⟨ႂ⟩ coda, palatalisation, and ⟨ေႃ⟩", () => {
        expect(phonemizeWord("မိူင်း")).toBe("mɤŋ˥"); // 'country' (möng) — ⟨ိူ⟩→[ɤ] before a coda
        expect(phonemizeWord("ႁိူၼ်း")).toBe("hɤn˥"); // 'house' — ⟨ိူ⟩→[ɤ], ⟨ႁ⟩→h
        expect(phonemizeWord("ၶိုၵ်ႉ")).toBe("kʰɯk̚˦˨"); // ⟨ို⟩→[ɯ] short before a checked coda ⟨ၵ⟩→[k̚]
        expect(phonemizeWord("ၸႂ်")).toBe("t͡ɕaɰ˨˦"); // 'heart/mind' — ⟨ႂ⟩ coda → [ɰ] offglide
        expect(phonemizeWord("ၵျေႃး")).toBe("d͡ʑɔː˥"); // palatalised ⟨ၵျ⟩→[d͡ʑ] + ⟨ေႃ⟩→[ɔː]
    });
});

// Cardinal numbers — Shan is Southwestern Tai, so the system is structurally Thai's: 20 is သၢဝ်း (replacing the
// whole "twenty"), a final 1 in a compound is ဢဵတ်း (not ၼိုင်ႈ), tens 30–90 are unit+သိပ်း, and 10⁴/10⁵ are their
// own words (မိုၼ်ႇ / သႅၼ်). Numerals from Wiktionary "Category:Shan numerals" + Omniglot "Numbers in Shan".
// NOTE 10⁶: neither source attests a word for a million, so it composes on သႅၼ် — သိပ်းသႅၼ် (see shan.ts).
describe("Shan (shn) cardinal numbers", () => {
    for (const [n, ipa] of [
        [0, "sʰun˨˦"], // သုၼ်
        [7, "t͡ɕet̚˥"], // ၸဵတ်း
        [11, "sʰip̚˥ ʔet̚˥"], // သိပ်းဢဵတ်း — final 1 is ဢဵတ်း
        [20, "sʰaːw˥"], // သၢဝ်း — the irregular twenty (no သိပ်း)
        [21, "sʰaːw˥ ʔet̚˥"], // သၢဝ်းဢဵတ်း
        [42, "sʰiː˩ sʰip̚˥ sʰɔŋ˨˦"], // သီႇသိပ်းသွင် — unit-first decade
        [100, "nɯŋ˧˧˨ paːk̚˩"], // ၼိုင်ႈပၢၵ်ႇ
        [1000, "nɯŋ˧˧˨ heŋ˨˦"], // ၼိုင်ႈႁဵင်
        [12345, "nɯŋ˧˧˨ mɯn˩ sʰɔŋ˨˦ heŋ˨˦ sʰaːm˨˦ paːk̚˩ sʰiː˩ sʰip̚˥ haː˧˧˨"], // မိုၼ်ႇ myriad magnitude
        [1000000, "sʰip̚˥ sʰɛn˨˦"], // သိပ်းသႅၼ် — 10 × 10⁵ (no attested 10⁶ word)
    ] as const) {
        test(`${n} → ${ipa}`, () => {
            expect(phonemize(String(n), "shn")).toBe(ipa);
        });
    }
});

// The three findings of the silent-deletion scan, and the one it got right for the wrong reason.
// Evidence and sourcing: docs/investigations/silent_sea_investigation.md Run 4.
describe("Shan (shn) — the characters that used to read as nothing", () => {
    /**
     * ⚠ THE VOICED SERIES OF THE SHAN LETTER BLOCK WAS ABSENT FROM `onsets`. U+1075–U+1081 is the Shan run;
     * the table held 1075 1076 1078 107A 107C 107D 107E 1080 1081 and skipped exactly ၷ ၹ ၻ ၿ. Standard
     * Shan has no voiced plosives, so these are loan-only — which is why they were missed and not a reason
     * to omit them: the corpus writes ⟨ၻ⟩ ×34, ⟨ၿ⟩ ×22, ⟨ၷ⟩ ×13, all in English loans and Pali.
     * Values: Wikipedia "Help:IPA/Shan and Tai Lue" — ၻ [d], ၿ [b], ၷ [ɡ] "in foreign words", ၹ [z].
     */
    test("⟨ၻ ၿ⟩ are /d/ and /b/ — loan letters, not missing ones", () => {
        expect(phonemizeWord("ၻွၵ်ႇ")).toBe("dɔk̚˩"); // ၻွၵ်ႇတႂ်ႇ 'doctor' — was *kaː˨˦*, the ၻ and its ⟨ွ⟩ gone
        expect(phonemizeWord("ၻီႇ")).toBe("diː˩"); // ၻီႇၵရီႇ 'degree' ×6 in the corpus
        expect(phonemizeWord("ၿီႇလီႇယၢၼ်ႇ")).toBe("biː˩liː˩jaːn˩"); // 'billion' — was *liː˩jaːn˩*
    });

    /**
     * ⟨ꧦ⟩ U+A9E6 SHAN REDUPLICATION, the ໆ/ๆ-style "say that again" mark the module header has claimed since
     * bring-up. TWO holes had to close before it could work: it is not an onset (so the scan stepped over
     * it), AND U+A9E6 is in Myanmar Extended-B, which the TOKEN class did not admit — so the word was cut
     * in two before `phonemizeWord` ever saw the mark.
     */
    test("⟨ꧦ⟩ repeats the preceding syllable, and the token class now keeps it in the word", () => {
        expect(phonemizeWord("လၢႆꧦ")).toBe("laːj˨˦laːj˨˦"); // လၢႆလၢႆ 'various'
        expect(phonemize("ႁတ်းꧦႁၢၼ်ꧦ", "shn")).toBe("hat̚˥hat̚˥haːn˨˦haːn˨˦"); // ႁတ်းႁၢၼ် 'bold' → 'boldly'
        expect(phonemize("ငၢႆႈꧦ", "shn")).toBe("ŋaːj˧˧˨ŋaːj˧˧˨"); // ငၢႆႈငၢႆႈ 'easily'
    });

    /**
     * ⚠ ⟨က န အ ည ခ⟩ ARE NOT SHAN LETTERS. The scan reported them ×76/×70/×59/×41/×30 as silent and it was
     * right about the silence and wrong about the cause: 15 of the corpus's 407 lines are BURMESE, and the
     * detector's native-script filter cannot see that, Burmese and Shan being the same script. The silence
     * was also the lesser half — the surrounding Burmese vowel signs latched onto the next consonant and
     * `ပတ်ဝန်းကျင်` read *pat̚˨˦waː˨˦ŋaː˨˦*. A run carrying a Burmese-only consonant now goes to the script
     * router, i.e. to `my`.
     */
    test("a Burmese run inside Shan text is read by the Burmese engine, not mis-scanned as Shan", () => {
        for (const w of ["ပတ်ဝန်းကျင်", "သည်", "တောင်ကြီး", "အမြင့်"])
            expect(phonemize(w, "shn"), w).toBe(phonemize(w, "my"));
        // ⚠ AND A SHAN WORD MUST NEVER TAKE THAT BRANCH. The Burmese-only set is the COMPLEMENT of the Shan
        // inventory — ⟨င တ ထ ပ မ ယ ရ လ ဝ သ⟩ are shared and excluded — so this is a property, not a sample.
        for (const w of ["တႆး", "မိူင်းတႆး", "ၵိၼ်", "ႁတ်းႁၢၼ်"])
            expect(phonemize(w, "shn"), w).toBe(phonemizeWord(w));
    });
});

// ── TEXT NORMALIZATION (src/languages/shan/normalize.ts) ────────────────────────────────────────────
//
// The evidence for every case is `tools/corpus/mined/shn.jsonc` (shn.wikipedia dump, 43,435 paragraph
// segments) and the argument is in the normalizer's own header. This layer is SMALL on purpose: the
// artifact is dense with figures and thin with words for them, and four of its classes are refusals.
describe("Shan text normalization", () => {
    const shn = { text: (s: string) => phonemize(s, "shn") };

    test("THE SEPARATOR CONVENTION IS THE ENGLISH ONE, and the dot is free to be a decimal point", () => {
        // Shan ends sentences with ။, not with the ASCII dot — so `4.54` needed no trade-off, where ba
        // declined a dot-decimal rule outright and tt found 17 of its 18 were figure references.
        expect(shn.text("4.54")).toBe("sʰiː˩ haː˧˧˨ sʰiː˩"); // was "four ⟨sentence break⟩ fifty-four"
        // ⚠ AND THE COMMA GROUPS. `2,759 ထတ်း` sits beside `4300 ထတ်း` in the same sentence.
        expect(shn.text("2,759")).toBe("sʰɔŋ˨˦ heŋ˨˦ t͡ɕet̚˥ paːk̚˩ haː˧˧˨ sʰip̚˥ kaw˧˧˨");
        // ⚠ AND THE NATIVE DIGITS ARE FOLDED BY THIS LAYER, not by the engine — `shan.ts` folds at the
        // top of text(), i.e. AFTER this pass, so a de-grouping rule written there would never see them.
        expect(shn.text("၉၂၄,၆၀၈")).toBe(shn.text("924,608"));
        expect(shn.text("၇၀၅၄.၃၇")).toBe(shn.text("7054.37"));
    });

    test("THE COORDINATE, which this corpus writes BOTH ways in one publication", () => {
        // "19 ၻီႇၵရီႇ 45 မိၼိတ်ႉ" in words, `၁၈° ၀'` in signs — the gloss is the source.
        expect(shn.text("၁၈° ၀'")).toBe(shn.text("18 ၻီႇၵရီႇ 0 မိၼိတ်ႉ"));
        expect(shn.text("၉၄° ၄၀'")).toBe(shn.text("94 ၻီႇၵရီႇ 40 မိၼိတ်ႉ"));
        // ⚠ The scale name is NOT emitted — no Shan word for Celsius is attested — but the ⟨C⟩ is
        // consumed rather than left to read as the ENGLISH letter name, which is what it was doing.
        expect(shn.text("70°C")).toBe(shn.text("70 ၻီႇၵရီႇ"));
    });

    test("the CLOCK, and the word the corpus already wrote", () => {
        expect(shn.text("5:23")).toBe(shn.text("5 မူင်း 23 မိၼိတ်ႉ")); // was "five ⟨pause⟩ twenty-three"
        expect(shn.text("10:00")).toBe(shn.text("10 မူင်း")); // a zero minute is dropped
        // ⚠ AND IT MUST NOT DOUBLE. `09:00 – 10:00 မူင်း` puts one မူင်း after the whole span.
        expect(shn.text("10:00 မူင်း")).toBe(shn.text("10 မူင်း"));
    });

    test("the ERA MARKER is claimed for A.D and REFUSED for B.C, which is what the evidence says", () => {
        // `ပီၶရိတ်ႉ` is in this corpus's own prose; the negative compound is not, and three instances do
        // not license inventing one.
        expect(shn.text("A.D 739")).toBe(shn.text("ပီၶရိတ်ႉ 739"));
        expect(normalizeShan("(1434 A.D.)")).toBe("(1434 ပီၶရိတ်ႉ)");
        expect(normalizeShan("B.C 1122")).toBe("B.C 1122");
    });

    test("ranges, dates and the ± all take a PAUSE, and no connective is invented", () => {
        expect(normalizeShan("400-500")).toBe("400, 500");
        expect(normalizeShan("10/1/1990")).toBe("10, 1, 1990"); // a D/M/Y date, never a fraction here
        expect(normalizeShan("4.5672 ± 0.0006")).toBe("4.5672, 0.0006");
        // ⚠ THE HYPHEN IS A LABEL SEPARATOR IN CENSUS FIGURES — `ၸၢႆး-1,226၊ ယိင်း-1,316` — so the range
        // rule requires a DIGIT before it and leaves those alone.
        expect(normalizeShan("ၸၢႆး-1,226")).toBe("ၸၢႆး-1226");
        expect(normalizeShan("ၸၼ်ႉ-5")).toBe("ၸၼ်ႉ-5");
    });

    test("the country-prefixed currency sign, and the tier the corpus glossed", () => {
        // "50 လၢၼ်ႉၻေႃႇလႃႇ($50 million)" — the corpus names its own sign.
        expect(shn.text("US$70")).toBe(shn.text("70 တေႃႇလႃႇ"));
        expect(shn.text("$579")).toBe(shn.text("579 တေႃႇလႃႇ"));
        expect(shn.text("5950 km")).toBe(shn.text("5950 ၵီႇလူဝ်ႇမီႇတႃႇ"));
    });

    test("what is REFUSED — and the refusal is the finding", () => {
        // PERCENT: the obvious compound ႁူဝ်ပၢၵ်ႇ is the word for CENTURY, which this corpus glosses in
        // English to prove it ("ပီႁူဝ်ပၢၵ်ႇ 15 (15th Century AD)").
        expect(normalizeShan("10%")).toBe("10%");
        // `=` is a PALI GLOSS SEPARATOR ×23, zero equations; `>` is a SOUND-CHANGE ARROW ×10.
        expect(normalizeShan("ပၼ်ထၵ=ၵေႃႉၵိူတ်ႇၸွမ်းတၢင်း")).toBe("ပၼ်ထၵ=ၵေႃႉၵိူတ်ႇၸွမ်းတၢင်း");
        expect(normalizeShan("Rhwam > Yhwam")).toBe("Rhwam > Yhwam");
    });
});
