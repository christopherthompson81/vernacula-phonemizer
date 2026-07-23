import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    phonemizeWord,
    phonemizeWordRules,
} from "../src/languages/bengali/bengali.ts";

// Canonical-IPA goldens for Bengali (bn) — native abugida G2P (bengali.jsonc + core/abugida) + Bengali-specific
// vowel harmony, inherent-vowel deletion, and phôla gemination. Standard (Kolkata/standard-colloquial) variety:
// inherent vowel /ɔ/ (raises to [o] by harmony), three sibilants শ ষ স → ʃ, dental t̪/d̪ vs retroflex ʈ/ɖ,
// ং → ŋ, র → tap ɾ. See docs/investigations/bn_native_bringup_investigation.md.
describe("bengali canonical IPA", () => {
    test("core akshara → IPA (dental/retroflex, sibilant merger, ং→ŋ)", () => {
        const cases: [string, string][] = [
            ["বাংলাদেশ", "baŋlad̪eʃ"], // Bangladesh: ং→ŋ, দ dental, শ→ʃ
            ["মানুষ", "manuʃ"], // manush: ষ→ʃ
            ["দেশ", "d̪eʃ"], // desh
            ["নাম", "nam"], // nam
            ["ভালো", "bʱalo"], // bhalo: breathy bʱ, ো→o
        ];
        for (const [w, exp] of cases) expect(phonemizeWord(w)).toBe(exp);
    });

    test("vowel harmony ɔ→o (open syllable) + inherent-vowel deletion/retention", () => {
        expect(phonemizeWord("করি")).toBe("koɾi"); // kori: ɔ raises before high [i]
        expect(phonemizeWord("কর")).toBe("kɔɾ"); // kôr: no following vowel → ɔ stays, final inherent deleted
        expect(phonemizeWord("জল")).toBe("d͡ʒɔl"); // jôl: final inherent deleted after single C
        expect(phonemizeWord("অংশ")).toBe("ɔŋʃo"); // ôngsho: cluster coda → final inherent retained as [o]
        // Height harmony is triggered by a [+HIGH] vowel [i u] only (Ferguson & Chowdhury 1960), NOT by a mid
        // vowel — /ɔ/ raises before i/u (কলি→koli) but stays before o/e (ঘরে→ɡʱɔɾe, অকলুষ→ɔkoluʃ).
        expect(phonemizeWord("কলি")).toBe("koli"); // ɔ raises before high [i]
        expect(phonemizeWord("ঘরে")).toBe("ɡʱɔɾe"); // ɔ stays before mid [e]
        expect(phonemizeWord("অকলুষ")).toBe("ɔkoluʃ"); // ɔ stays before mid [o] (no over-raising)
    });

    test("phôla gemination (jô/bô/mô) + geminate-coda vowel retention", () => {
        expect(phonemizeWord("বিদ্যা")).toBe("bid̪ːa"); // biddya: jôphôla ্য → geminate d̪ː
        expect(phonemizeWord("যুদ্ধ")).toBe("d͡ʒud̪ʱːo"); // juddho: geminate d̪ʱː + retained [o]
        expect(phonemizeWord("পদ্ম")).toBe("pɔd̪ːo"); // pôdmo: môphôla → geminate
    });

    test("medial inherent-vowel deletion (Ohala VCɔCV) + ক্ষ / জ্ঞ conjuncts", () => {
        expect(phonemizeWord("আপনার")).toBe("apnaɾ"); // apnar: medial ɔ deleted (apɔnaɾ→apnaɾ)
        expect(phonemizeWord("অক্ষর")).toBe("ɔkʰːɔɾ"); // ôkkhôr: ক্ষ → [kʰː]
        expect(phonemizeWord("বিজ্ঞান")).toBe("biɡːan"); // biggan: জ্ঞ → [ɡː]
    });

    test("word-initial ্যা / অ্যা → [æ] (loanword/tatsama); medial ্যা still geminates", () => {
        expect(phonemizeWord("গ্যাস")).toBe("ɡæʃ"); // 'gas' — word-initial ্যা → æ
        expect(phonemizeWord("ক্যান্ডি")).toBe("kænɖi"); // 'candy' — ্যা → æ, retroflex ɖ
        expect(phonemizeWord("ন্যায়")).toBe("næj"); // 'justice' — word-initial ্যা → æ
        expect(phonemizeWord("অ্যাসিড")).toBe("æʃiɖ"); // 'acid' — অ্যা → æ (স→ʃ merger)
        // MEDIAL ্যা geminates instead of æ (বিদ্যা → bid̪ːa is covered above)
        expect(phonemizeWord("অকাট্য")).toBe("ɔkaʈʈo"); // medial ্য → geminate ʈ, not æ
    });

    test("hiatus harmony: /ɔ/ → [o] before a close vowel [i u]", () => {
        expect(phonemizeWord("বই")).toBe("boi"); // 'book' — ɔ→o before i in hiatus
        expect(phonemizeWord("অই")).toBe("oi"); // ɔ→o before i (independent vowels)
    });

    test("ওয়া glide → [oa] (not [oja]); য় stays [j] elsewhere", () => {
        expect(phonemizeWord("খাওয়া")).toBe("kʰaoa"); // 'to eat' — ওয়া = oa, no glide
        expect(phonemizeWord("দেওয়া")).toBe("d̪eoa"); // 'to give'
        expect(phonemizeWord("যাওয়া")).toBe("d͡ʒaoa"); // 'to go'
        expect(phonemizeWord("মেয়ে")).toBe("meje"); // য় IS [j] here — untouched
    });

    // Whole-word lexicon for the PROVEN-lexical vowel tail (closed-syllable ɔ→o), built from the cross-source
    // consensus of wikipron (Kolkata) + Bengali.AI DUAL-IPA (Dhaka). SHIPPED phonemizeWord applies it; the rule
    // engine (phonemizeWordRules) — and the referee eval — are unaffected.
    test("pronunciation lexicon: shipped override for the lexical tail; rule engine untouched", () => {
        expect(phonemizeWord("মন")).toBe("mon"); // closed-syllable ɔ→o (lexical)
        expect(phonemizeWord("কলম")).toBe("kɔlom");
        expect(phonemizeWord("এক")).toBe("æk");
        expect(phonemizeWord("করে")).toBe("koɾe");
        expect(phonemizeWord("ঘোষণা")).toBe("ɡʱoʃona"); // medial-ɔ retention (consensus insert/delete class)
        expect(phonemizeWord("বলে")).toBe("bole"); // verb ô→o before -e (hand supplement)
        expect(phonemizeWord("কম")).toBe("kɔm"); // minimal-pair partner of মন — genuinely stays ɔ
        // জীবন: Run 16 corrected — the gold+rule had mis-defaulted it to d͡ʒibɔn (a shared blind spot), but
        // Google AND wikipron independently corroborate [o]; the lexicon now pins the correct d͡ʒibon.
        expect(phonemizeWord("জীবন")).toBe("d͡ʒibon");
        // the rule engine is the honest, lexicon-free signal:
        expect(phonemizeWordRules("মন")).toBe("mɔn");
        expect(phonemizeWordRules("কলম")).toBe("kɔlɔm");
    });

    test("text: words + Bengali danda pause", () => {
        expect(phonemize("আমি বাংলা বলি।", "bn")).toContain("baŋla");
    });
});
