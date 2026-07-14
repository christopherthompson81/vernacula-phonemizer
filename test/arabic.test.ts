import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    phonemizeArabic,
    phonemizeWord,
} from "../src/languages/arabic/arabic.ts";
import { isSkeleton, restoreSkeletons } from "../src/languages/arabic/restore.ts";

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

    test("definite article: sun/moon assimilation + hamzat-wasl", () => {
        expect(phonemizeWord("الْقَمَر")).toBe("ʔalqˈamar"); // moon letter → keep l
        expect(phonemizeWord("الشَّمْس")).toBe("ʔaʃːˈams"); // sun letter → l assimilates (ʃ geminate)
        expect(phonemizeWord("الَّذِي")).toBe("ʔalːˈaðiː"); // lam-initial → geminate ll
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
            "kˈataba ʔatˤːˈaːlibu .",
        );
        expect(phonemize("الْقَمَر وَالشَّمْس", "ar")).toBe(
            "ʔalqˈamar waʃːˈams",
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
    });

    // Phase 2: bare (undiacritized) Arabic via the neural diacritizer pre-pass → g2p. Gated on the model.
    describe.skipIf(!haveDiacritizer)(
        "bare text via neural diacritizer",
        () => {
            test("undiacritized input restores vowels then phonemizes", async () => {
                expect(await phonemizeArabic("كتب الطالب الدرس")).toBe(
                    "kˈatab ʔatˤːˈaːlib ʔadːˈars",
                );
                expect(await phonemizeArabic("اللغة العربية جميلة")).toBe(
                    "ʔalːˈuɣa ʔalʕarabˈijːa d͡ʒamˈiːla",
                );
            });
        },
    );
});
