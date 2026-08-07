import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import {
    phonemizeWord,
    phonemizeWordRules,
} from "../src/languages/bengali/bengali.ts";

// Canonical-IPA goldens for Bengali (bn) — native abugida G2P (bengali.jsonc + core/abugida) + Bengali-specific
// vowel harmony, inherent-vowel deletion, and phôla gemination. Standard (Kolkata/standard-colloquial) variety:
// inherent vowel /ɔ/ (raises to [o] by harmony), three sibilants শ ষ স → ʃ, dental t̪/d̪ vs retroflex ʈ/ɖ,
// ং → ŋ, র → tap ɾ.
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
        // জীবন: the gold and the rule engine BOTH mis-defaulted it to d͡ʒibɔn — a shared blind spot, so the
        // gold could not catch it. Google and wikipron independently corroborate [o]; the lexicon pins d͡ʒibon.
        expect(phonemizeWord("জীবন")).toBe("d͡ʒibon");
        // the rule engine is the honest, lexicon-free signal:
        expect(phonemizeWordRules("মন")).toBe("mɔn");
        expect(phonemizeWordRules("কলম")).toBe("kɔlɔm");
    });

    test("text: words + Bengali danda pause", () => {
        expect(phonemize("আমি বাংলা বলি।", "bn")).toContain("baŋla");
    });
});

// TEXT NORMALIZATION. ⚠ Two of the three defects this covers are NOT in the normalization layer at all —
// the numbers data was missing its fused 21-99 forms, and clausePunctuation mapped every mark to ITSELF
// padded with spaces, so raw dandas reached the output on 2,949 of 3,006 corpus utterances. Reading the
// normalizer alone would have found neither.
describe("bengali normalization", () => {
    test("21-99 are fused words, not unit+tens", () => {
        // Bengali, unlike a decimal-compositional language, has its own word for every number to 100. The
        // shared composer's documented fallback was emitting "এক বিশ" ("one twenty") for 21. 161 corpus
        // numbers land in this range. Ten of the authored forms are attested in the wikipron referee.
        expect(phonemize("21", "bn")).toBe("ekuʃ"); // একুশ — referee-attested
        expect(phonemize("24", "bn")).toBe("t͡ʃobːiʃ"); // চব্বিশ — referee-attested
        expect(phonemize("39", "bn")).toBe("unt͡ʃolːiʃ"); // উনচল্লিশ
        expect(phonemize("66", "bn")).toBe("t͡ʃʰeʃɔʈʈi"); // ছেষট্টি
        expect(phonemize("99", "bn")).toBe("niɾanɔbːoi"); // নিরানব্বই
        // `hundred` was "একশো", which already contains its own এক, so 100 came out as "এক একশো".
        expect(phonemize("100", "bn")).toBe("æk ʃɔt̪");
        expect(phonemize("1956", "bn")).toBe("æk ɦad͡ʒaɾ nɔj ʃɔt̪ t͡ʃʰapːanːo"); // was "নয় একশো ছয় পঞ্চাশ"
        expect(phonemize("১৮১৯", "bn")).toBe("æk ɦad͡ʒaɾ aʈ ʃɔt̪ uniʃ"); // Bengali digits read identically
    });

    test("punctuation is a canonical pause, not a raw mark", () => {
        // clausePunctuation mapped "।" to " । " — the danda itself, padded — so a non-IPA character and a
        // double space reached the output. 3,327 dandas in the corpus.
        expect(phonemize("এটি বাক্য। দুই।", "bn")).toBe("eʈi bakːo . d̪ui .");
    });

    test("ordinals: two suffix series, both suppletive at the bottom", () => {
        // The CLASSICAL series is suppletive through ten — ৮ম is অষ্টম, not *আটম.
        expect(phonemize("৮ম", "bn")).toBe("ɔʃʈɔm");
        expect(phonemize("২ ম", "bn")).toBe("d̪it̪ij"); // দ্বিতীয়, with the space the corpus writes
        expect(phonemize("৪র্থ", "bn")).toBe("t͡ʃot̪uɾt̪ʰo");
        expect(phonemize("১৭তম", "bn")).toBe("ʃɔt̪eɾot̪ɔm"); // regular above ten: suffix JOINED
        // The DATE series is what the corpus actually contains (শে ×10, ই ×8), with its own suppletives.
        expect(phonemize("২৬ শে নভেম্বর", "bn")).toBe("t͡ʃʰabːiʃʃe nɔbʱembɔɾ");
        expect(phonemize("৮ই জুলাই", "bn")).toBe("aʈoi d͡ʒulai"); // was [aʈ i], the suffix as its own word
        expect(phonemize("১লা জানুয়ারি", "bn")).toBe("pɔɦela d͡ʒanujaɾi"); // পহেলা
    });

    test("symbols: the shared tier reads Bengali digits and signs", () => {
        // Without a symbol tier, % and every currency sign are DROPPED outright; the digit fold is what lets
        // the shared ASCII-keyed tier see a Bengali-digit amount at all.
        expect(phonemize("3%", "bn")).toBe("t̪in ʃɔt̪aŋʃo");
        expect(phonemize("৮%", "bn")).toBe("aʈ ʃɔt̪aŋʃo"); // Bengali digits — the sign was dropped
        expect(phonemize("৳৫০০", "bn")).toBe("pãt͡ʃ ʃɔt̪ ʈaka");
        expect(phonemize("৫ কিমি", "bn")).toBe("pãt͡ʃ kilomiʈaɾ"); // was read as the word [kimi]
        expect(phonemize("5 mm", "bn")).toBe("pãt͡ʃ milimiʈaɾ");
        expect(phonemize("20 °C", "bn")).toBe("biʃ ɖiɡɾi ʃeloʃijaʃ"); // was the English letter name
    });

    test("abbreviations, clock, signs and fractions", () => {
        expect(phonemize("ডঃ শর্মা", "bn")).toBe("ɖɔkʈɔɾ ʃɔɾma"); // the VISARGA was read as a syllable
        expect(phonemize("ড. শর্মা", "bn")).toBe("ɖɔkʈɔɾ ʃɔɾma"); // the dotted form left a phrase break
        expect(phonemize("১১:২০", "bn")).toBe("æɡaɾoʈa biʃ miniʈ"); // the colon reached the output raw
        expect(phonemize("11:00", "bn")).toBe("æɡaɾoʈa"); // :00 was read as শূন্য
        expect(phonemize("-5 ডিগ্রি", "bn")).toBe("ɾinat̪ːɔk pãt͡ʃ ɖiɡɾi"); // both signs occur in this corpus
        expect(phonemize("+3 ডিগ্রি", "bn")).toBe("d͡ʒoɡ t̪in ɖiɡɾi");
        expect(phonemize("১/৫", "bn")).toBe("pãt͡ʃ bʱaɡeɾ æk"); // "of five parts, one"
        expect(phonemize("1/2", "bn")).toBe("ɔɾd̪ʱek"); // অর্ধেক
    });

    // `বর্গকিলোমিটার` ×8. Declared SPACED because this tier is shared with Assamese and the two
    // corpora disagree about the space: bn fuses it here but writes `বর্গ মাইল` spaced in the same sentence,
    // and as writes `বৰ্গ কিলোমিটাৰ` spaced throughout. `before` is attested in both.
    test("the squared/cubed measure word", () => {
        expect(phonemize("19,500 km²", "bn")).toContain("bɔɾɡo kilomiʈaɾ");
    });

    // `120-160 কিউবিক মিটার জ্বালানি তেল` — the loan, word-first. ⚠ Do NOT reach for the native-looking
    // candidates: ঘন scores ×19 but every hit is the reduplicated adverb "frequently", and `ঘনমিটার` is ×0.
    // The corpus uses neither.
    test("the cubed measure word", () => {
        expect(phonemize("120 m³", "bn")).toContain("kiubik miʈaɾ");
    });

    test("the yen sign is VOICED although both speakers omit it", () => {
        // Both bn_in speakers read the amounts and no currency word at all (wav2vec2:
        // "d a m d u a z er p a sh o t e k"). We voice it anyway: for TTS an explicitly typed character is
        // content, and a speaker's omission is evidence about reading habit, not licence to delete.
        const s = phonemize("টিকিটের দাম ¥2,500 থেকে ¥130,000 এর মধ্যে।", "bn");
        expect(s).toContain("ijen");
        expect(s).not.toBe(phonemize("টিকিটের দাম 2,500 থেকে 130,000 এর মধ্যে।", "bn"));
    });
});
