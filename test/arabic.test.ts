import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    phonemizeArabic,
    phonemizeWord,
} from "../src/languages/arabic/arabic.ts";
import { isSkeleton, restoreSkeletons, lexiconPrimary } from "../src/languages/arabic/restore.ts";

// The neural diacritizer model is gitignored (dev stand-in / built permissively) — skip its tests if absent.
const haveDiacritizer = existsSync(
    join(import.meta.dirname, "../src/languages/arabic/diacritizer.onnx"),
);

// Canonical-IPA goldens for Arabic (ar) — Phase 1: the DIACRITIZED input path (broad MSA, cleanroom rules,
// no lexicon). Emphatics sˤ dˤ tˤ ðˤ, pharyngeals ʕ ħ (the census gaps), gemination Cː, al- sun/moon
// assimilation + hamzat-wasl ʔ, quantity-sensitive stress. Validated vs espeak-portable canonical (2500
// diacritized words): 96% segments. Short-vowel restoration for bare text is a Phase-2 diacritizer pre-pass.
describe("arabic canonical IPA — diacritized path", () => {
    test("consonants, emphatics, pharyngeals, gemination, stress", () => {
        expect(phonemizeWord("كَتَبَ")).toBe("kˈataba"); // antepenult stress (all light)
        expect(phonemizeWord("كِتَاب")).toBe("kitˈaːb"); // final superheavy → final
        expect(phonemizeWord("مُدَرِّس")).toBe("mudˈarːis"); // shadda → Cː, penult (heavy)
        expect(phonemizeWord("صَلَاة")).toBe("sˤˈalaː"); // emphatic sˤ, ة silent (pausal)
        expect(phonemizeWord("نَعَمْ")).toBe("nˈaʕam"); // pharyngeal ʕ
        expect(phonemizeWord("حَجّ")).toBe("ħˈad͡ʒː"); // ħ + geminate d͡ʒ
        expect(phonemizeWord("بَيْت")).toBe("bˈajt"); // diphthong aj
    });

    test("definite article: sun/moon assimilation, waṣl-alif = plain [a] onset (no ʔ)", () => {
        expect(phonemizeWord("الْقَمَر")).toBe("alqˈamar"); // moon letter → keep l; waṣl alif → a (no ʔ)
        expect(phonemizeWord("الشَّمْس")).toBe("aʃːˈams"); // sun letter → l assimilates (ʃ geminate)
        expect(phonemizeWord("الَّذِي")).toBe("alːˈaðiː"); // lam-initial → geminate ll
    });

    test("Egyptian variety raises the definite article a→i (il-)", () => {
        expect(phonemizeWord("الْقَمَر", "egyptian")).toBe("ilʔˈamar"); // il- + ق→ʔ (Cairene)
        expect(phonemizeWord("الشَّمْس", "egyptian")).toBe("iʃːˈams"); // sun assimilation: iʃ-ʃams
        expect(phonemizeWord("الْقَمَر")).toBe("alqˈamar"); // MSA unchanged (no articleVowel)
    });

    test("proclitic + article (alif elides)", () => {
        expect(phonemizeWord("وَالْكُفْر")).toBe("walkˈufr"); // wa + al (moon)
        expect(phonemizeWord("لِلنَّاس")).toBe("linːˈaːs"); // li + al (sun n)
    });

    test("numbers → IPA (MSA counting forms)", () => {
        expect(phonemize("٢٠٢٤", "ar")).toBe("ʔalfaːn wa ʔarbaʕa wa ʕiʃruːn"); // 2000 and 24
        expect(phonemize("100", "ar")).toBe("miʔa");
        expect(phonemize("21", "ar")).toBe("waːħid wa ʕiʃruːn"); // ones precede tens
        expect(phonemize("2000000", "ar")).toBe("miljuːnaːn"); // millions dual (review fix)
        expect(phonemize("3000000", "ar")).toBe("θalaːθa malaːjiːn"); // millions plural
    });

    test("dagger-alif after a geminated article-lam keeps its long vowel (review fix)", () => {
        expect(phonemizeWord("لِلّٰه")).toBe("lilːˈaːh"); // was dropping the aː
    });

    test("text: words + numbers + punctuation → pause", () => {
        expect(phonemize("كَتَبَ الطَّالِبُ.", "ar")).toBe(
            "kˈataba atˤːˈaːlibu .",
        );
        expect(phonemize("الْقَمَر وَالشَّمْس", "ar")).toBe(
            "alqˈamar waʃːˈams",
        );
    });

    // Supplement-only skeleton restoration (restore.ts): sync, no model needed.
    test("skeleton detection + lexicon supplement (supplement-only)", () => {
        // a fully-voweled word is NOT a skeleton; a bare consonant string IS (0 vowels).
        expect(isSkeleton("كَتَبَ")).toBe(false);
        expect(isSkeleton("كتب")).toBe(true); // bare skeleton
        // restoreSkeletons overrides ONLY the skeleton word, from the lexicon; the voweled word is untouched.
        const lex = new Map([["يقول", "يَقُول"]]);
        expect(restoreSkeletons("يقول كَتَبَ", lex)).toBe("يَقُول كَتَبَ");
        // OOV skeleton with no lexicon hit → epenthesis floor keeps it sayable (no longer 0-vowel).
        expect(isSkeleton(restoreSkeletons("قلب", new Map()))).toBe(false);
        // LEXICON-PRIMARY: a direct lexicon hit overrides the neural output even when it is NOT a skeleton.
        expect(lexiconPrimary("كُتِب", new Map([["كتب", "كَتَب"]]))).toBe("كَتَب");
        expect(lexiconPrimary("مَدْرَسَة", new Map())).toBe("مَدْرَسَة"); // OOV non-skeleton kept as-is
    });

    // Phase 2: bare (undiacritized) Arabic via the neural diacritizer pre-pass → g2p. Gated on the model.
    describe.skipIf(!haveDiacritizer)(
        "bare text via neural diacritizer",
        () => {
            test("undiacritized input restores vowels then phonemizes", async () => {
                expect(await phonemizeArabic("كتب الطالب الدرس")).toBe(
                    "kˈatab atˤːˈaːlib adːˈars",
                );
                expect(await phonemizeArabic("اللغة العربية جميلة")).toBe(
                    "alːˈuɣa alʕarabˈijːa d͡ʒamˈiːla",
                );
            });
        },
    );

    // Egyptian Arabic (arz) variety — shares the engine, applies Cairene IPA shifts on the MSA g2p output.
    describe("Egyptian variety (arz)", () => {
        test("consonant shifts + diphthong monophthongization", () => {
            expect(phonemizeWord("قَال", "egyptian")).toBe("ʔˈaːl"); // ق → ʔ
            expect(phonemizeWord("جَمِيل", "egyptian")).toBe("ɡamˈiːl"); // ج → ɡ (Cairene)
            expect(phonemizeWord("ثَلَاثَة", "egyptian")).toBe("talˈaːta"); // ث → t
            expect(phonemizeWord("ظَرف", "egyptian")).toBe("dˤˈarf"); // ظ [ðˤ] → [dˤ]
            expect(phonemizeWord("بَيت", "egyptian")).toBe("bˈeːt"); // ay → eː (true diphthong, glide is coda)
            expect(phonemizeWord("يَوم", "egyptian")).toBe("jˈoːm"); // aw → oː
        });
        test("hiatus is NOT monophthongized (glide onsets the next syllable)", () => {
            // طويل a·w·iː — the w onsets [wiː], not a diphthong coda; must stay tˤawiːl, not become tˤoːiːl.
            expect(phonemizeWord("طَوِيل", "egyptian")).toBe("tˤawˈiːl");
            expect(phonemizeWord("بَيَان", "egyptian")).toBe("bajˈaːn");
        });
        test("MSA output is unaffected (variety is opt-in)", () => {
            expect(phonemizeWord("قَال")).toBe("qˈaːl");
            expect(phonemizeWord("جَمِيل")).toBe("d͡ʒamˈiːl");
        });
    });

    // South Levantine Arabic (ajp — Palestinian/Jordanian) — sibling of North Levantine (apc): ق→ʔ, ج→ʒ, ث/ذ→t/d,
    // but ظ→[zˤ] (SIBILANT, vs apc's [dˤ]); ض stays [dˤ], so the two are distinct.
    describe("South Levantine variety (ajp)", () => {
        test("consonant shifts + ظ→zˤ (the split from North Levantine)", () => {
            expect(phonemizeWord("قَمَر", "southlevantine")).toBe("ʔˈamar"); // ق → ʔ
            expect(phonemizeWord("جَمَل", "southlevantine")).toBe("ʒˈamal"); // ج → ʒ
            expect(phonemizeWord("ثَلَاثَة", "southlevantine")).toBe("talˈaːta"); // ث → t
            expect(phonemizeWord("ظَهْر", "southlevantine")).toBe("zˤˈahr"); // ظ [ðˤ] → [zˤ] (SIBILANT)
            expect(phonemizeWord("بَيْت", "southlevantine")).toBe("bˈeːt"); // ay → eː
        });
    });

    // Hijazi Arabic (acw — western Saudi) — ق→ɡ but ⟨ج⟩ RETAINS the affricate [d͡ʒ] (unlike Egyptian [ɡ] /
    // Levantine [ʒ]), and ⟨خ⟩ stays [x]; interdentals → stops/[zˤ].
    describe("Hijazi variety (acw)", () => {
        test("ق→ɡ, ج RETAINED as d͡ʒ (the distinctive Hijazi profile)", () => {
            expect(phonemizeWord("قَمَر", "hijazi")).toBe("ɡˈamar"); // ق → ɡ (voiced)
            expect(phonemizeWord("جَمَل", "hijazi")).toBe("d͡ʒˈamal"); // ج stays d͡ʒ (affricate retained)
            expect(phonemizeWord("ثَلَاثَة", "hijazi")).toBe("talˈaːta"); // ث → t
            expect(phonemizeWord("ظَهْر", "hijazi")).toBe("zˤˈahr"); // ظ → zˤ
            expect(phonemizeWord("يَوْم", "hijazi")).toBe("jˈoːm"); // aw → oː
        });
    });

    // North Levantine Arabic (apc) — same engine, differs from Egyptian mainly in ج (→ [ʒ], not [ɡ]).
    describe("Levantine variety (apc)", () => {
        test("consonant shifts (ج→ʒ is the signature difference from Egyptian)", () => {
            expect(phonemizeWord("جَمِيل", "levantine")).toBe("ʒamˈiːl"); // ج → ʒ (vs Egyptian ɡ)
            expect(phonemizeWord("قَال", "levantine")).toBe("ʔˈaːl"); // ق → ʔ (urban)
            expect(phonemizeWord("ثَلَاثَة", "levantine")).toBe("talˈaːta"); // ث → t
            expect(phonemizeWord("بَيت", "levantine")).toBe("bˈeːt"); // ay → eː
        });
    });

    // Sudanese Arabic (apd) — AUTHORED (no wikipron referee); this gold IS the correctness anchor, validated against
    // published Sudanese phonology (Dickins). Fingerprint: ق→[ɡ], ج→[ɟ] (palatal), interdentals ث/ذ/ظ KEPT.
    describe("Sudanese variety (apd) — gold-anchored", () => {
        test("ق→ɡ, ج→ɟ (palatal), interdentals kept", () => {
            expect(phonemizeWord("قَال", "sudanese")).toBe("ɡˈaːl"); // ق → ɡ (voiced velar, not ʔ)
            expect(phonemizeWord("جَمَل", "sudanese")).toBe("ɟˈamal"); // ج → ɟ (voiced palatal — the signature)
            expect(phonemizeWord("جَدِيد", "sudanese")).toBe("ɟadˈiːd");
            expect(phonemizeWord("ثَلَاثَة", "sudanese")).toBe("θalˈaːθa"); // ث KEPT as [θ] (vs Egy/Lev [t])
            expect(phonemizeWord("ذَهَب", "sudanese")).toBe("ðˈahab"); // ذ KEPT as [ð]
            expect(phonemizeWord("بَيت", "sudanese")).toBe("bˈeːt"); // ay → eː
        });
    });

    // Iraqi Arabic (acm — Baghdadi gilit). Fingerprint: ق→[ɡ] (gilit), everything else CONSERVATIVE — ج kept [d͡ʒ],
    // خ kept [x], interdentals ث/ذ/ظ KEPT. Referee-measured (wikipron acm broad).
    describe("Iraqi variety (acm)", () => {
        test("ق→ɡ (gilit); ج, خ, interdentals all kept", () => {
            expect(phonemizeWord("قَال", "iraqi")).toBe("ɡˈaːl"); // ق → ɡ (gilit)
            expect(phonemizeWord("جَمَل", "iraqi")).toBe("d͡ʒˈamal"); // ج KEPT [d͡ʒ] (vs Egy [ɡ]/Lev [ʒ])
            expect(phonemizeWord("ثَلَاثَة", "iraqi")).toBe("θalˈaːθa"); // ث KEPT [θ] (vs Egy/Lev [t])
            expect(phonemizeWord("ذَهَب", "iraqi")).toBe("ðˈahab"); // ذ KEPT [ð]
            expect(phonemizeWord("خَبَر", "iraqi")).toBe("xˈabar"); // خ KEPT [x] (vs Gulf/Libyan [χ])
            expect(phonemizeWord("بَيت", "iraqi")).toBe("bˈeːt"); // ay → eː
        });
    });

    // Gulf Arabic (afb — Khaleeji). Fingerprint: ق→[ɡ], خ→[χ] (uvular), ج + interdentals KEPT.
    describe("Gulf variety (afb)", () => {
        test("ق→ɡ, خ→χ; ج and interdentals kept", () => {
            expect(phonemizeWord("قَال", "gulf")).toBe("ɡˈaːl"); // ق → ɡ
            expect(phonemizeWord("خَمسَة", "gulf")).toBe("χˈamsa"); // خ → χ (uvular — vs Iraqi [x])
            expect(phonemizeWord("جَمَل", "gulf")).toBe("d͡ʒˈamal"); // ج KEPT [d͡ʒ]
            expect(phonemizeWord("ثَلَاثَة", "gulf")).toBe("θalˈaːθa"); // ث KEPT [θ]
            expect(phonemizeWord("يَوم", "gulf")).toBe("jˈoːm"); // aw → oː
        });
    });

    // Moroccan Arabic (ary — Darija). Fingerprint: ق KEPT [q] (the Maghrebi signature, NOT eastern g/ʔ), ج→[ʒ],
    // interdentals ث/ذ/ظ → stops [t]/[d]/[dˤ]. (The deep vowel restructuring to schwa is the deferred data tail.)
    describe("Moroccan variety (ary)", () => {
        test("ق KEPT [q]; ج→ʒ; interdentals→stops", () => {
            expect(phonemizeWord("قَلب", "moroccan")).toBe("qˈalb"); // ق KEPT [q] (the Maghrebi signature)
            expect(phonemizeWord("جَمِيل", "moroccan")).toBe("ʒamˈiːl"); // ج → ʒ
            expect(phonemizeWord("ثَلَاثَة", "moroccan")).toBe("talˈaːta"); // ث → t
            expect(phonemizeWord("ذَهَب", "moroccan")).toBe("dˈahab"); // ذ → d
            expect(phonemizeWord("ظَرف", "moroccan")).toBe("dˤˈarf"); // ظ [ðˤ] → [dˤ]
        });
    });

    // Libyan Arabic (ayl — Tripolitanian). Fingerprint: ق→[ɡ], ج→[ʒ] (Maghrebi fricative), خ→[χ] (uvular),
    // interdentals ث/ذ/ظ KEPT (Bedouin-conservative).
    describe("Libyan variety (ayl)", () => {
        test("ق→ɡ, ج→ʒ, خ→χ; interdentals kept", () => {
            expect(phonemizeWord("قَال", "libyan")).toBe("ɡˈaːl"); // ق → ɡ
            expect(phonemizeWord("جَمِيل", "libyan")).toBe("ʒamˈiːl"); // ج → ʒ (Maghrebi fricative — vs Iraqi/Gulf [d͡ʒ])
            expect(phonemizeWord("خَبَر", "libyan")).toBe("χˈabar"); // خ → χ (uvular)
            expect(phonemizeWord("ثَلَاثَة", "libyan")).toBe("θalˈaːθa"); // ث KEPT [θ] (Bedouin-conservative)
            expect(phonemizeWord("بَيت", "libyan")).toBe("bˈeːt"); // ay → eː
        });
    });
});
