import { describe, expect, test } from "vitest";

// The RULE g2p (default-schwa short vowels) is phonemizeWordRules; the shipped phonemizeWord adds the kaikki
// short-vowel restoration lexicon. The rule tests below exercise the g2p, so they use phonemizeWordRules.
import { readFileSync, existsSync } from "node:fs";

import { phonemize } from "../src/index.ts";
import {
    phonemizeWord as phonemizeWordShipped,
    phonemizeWordRules as phonemizeWord,
} from "../src/languages/sindhi/sindhi.ts";
import { normalizeSindhi } from "../src/languages/sindhi/normalize.ts";

// Canonical-IPA goldens for Sindhi (sd) — Perso-Arabic ABJAD, Indo-Aryan. The signature is the four-way IMPLOSIVE
// series ٻ→ɓ, ڏ→ɗ, ڄ→ʄ, ڳ→ɠ (a census gap) + the retroflex series ٽ ٺ ڊ ڍ ڻ ڙ + aspiration (ڀ bʰ, ٿ t̪ʰ,
// جھ d͡ʒʰ, لھ lʰ). SHORT vowels are unwritten → a default [ə] (the abjad wall). See docs/investigations/sd_native_bringup_investigation.md.
describe("Sindhi canonical IPA", () => {
    test("the four implosives ٻɓ ڏɗ ڄʄ ڳɠ (the census gap)", () => {
        expect(phonemizeWord("ٻارو")).toBe("ɓˈaːɾoː"); // ٻ → ɓ
        expect(phonemizeWord("ڏاڏو")).toBe("ɗˈaːɗoː"); // ڏ → ɗ
        expect(phonemizeWord("ڄاڻ")).toBe("ʄˈaːɳə"); // ڄ → ʄ, ڻ → ɳ (retroflex)
        expect(phonemizeWord("ڳالھ")).toBe("ɠˈaːlʰə"); // ڳ → ɠ, لھ → lʰ (aspirated sonorant)
    });

    test("consonants, aspiration, retroflex, long vowels", () => {
        expect(phonemizeWord("ڪتاب")).toBe("kət̪ˈaːbə"); // ڪ→k, ت→t̪ (dental), ا→aː
        expect(phonemizeWord("سنڌ")).toBe("sˈənd̪ʰə"); // ڌ → d̪ʰ (aspirated dental)
        expect(phonemizeWord("پنج")).toBe("pˈəɲd͡ʒə"); // ن → ɲ before ج (palatal nasal assimilation)
    });

    test("word-final ه silent (vowel-carrier), ع silent", () => {
        expect(phonemizeWord("ٻه")).toBe("ɓˈə"); // final ه silent → ɓ + default ə
    });

    // A homorganic nasal + stop is one tautosyllabic cluster — the abjad scan's blanket
    // "consonant before consonant → default ə" must not split it. Cross-checked against the
    // lexicon, where the attested forms are انب əmb and سنڌي sɪndʱiː (no ə inside the cluster).
    test("no default-ə inside a homorganic nasal + stop cluster", () => {
        expect(phonemizeWord("پنج")).toBe("pˈəɲd͡ʒə"); // palatal: ɲd͡ʒ, not ɲəd͡ʒ
        expect(phonemizeWord("سنڌ")).toBe("sˈənd̪ʰə"); // dental: nd̪ʰ, not nəd̪ʰ
        expect(phonemizeWord("انب")).toBe("ˈəmbə"); // labial: mb, not məb
    });

    // ...but only the DEFAULT-inserted ə may be swallowed. A vowel the writer actually spelled with a harakat
    // must survive, and it also blocks the assimilation (n and b are then in different syllables). The rules
    // are written against a private-use sentinel for exactly this reason; matching a bare ə ate written vowels
    // (نَب → mb, losing the fatha).
    test("a WRITTEN harakat vowel is never swallowed by nasal assimilation", () => {
        expect(phonemizeWord("نَب")).toBe("nˈəbə"); // fatha survives; n stays n (no cluster to assimilate in)
        expect(phonemizeWord("سنَڌ")).toBe("sˈənəd̪ʰə"); // cf. سنڌ → sˈənd̪ʰə, where the ə is only a default
    });

    test("the default-schwa sentinel never leaks into output", () => {
        for (const w of ["نَب", "سنڌ", "پنج", "انب", "ڪتاب", "ٻارو"]) {
            expect(phonemizeWord(w), w).not.toMatch(/[\uE000-\uF8FF]/u);
        }
    });
});

// Quantity-sensitive weight stress (the shared hi/ur/pa Indo-Aryan rule): rightmost superheavy,
// else rightmost NON-FINAL heavy, else initial. Sindhi previously emitted no stress at all.
describe("Sindhi weight stress", () => {
    test("every word carries exactly one primary stress", () => {
        for (const w of ["ٻارو", "ڪتاب", "سنڌ", "پنج", "ٻه", "زبان"]) {
            const ipa = phonemizeWord(w);
            expect(ipa.match(/ˈ/gu)?.length, `${w} → ${ipa}`).toBe(1);
        }
    });

    test("stress lands on the rightmost non-final heavy syllable", () => {
        expect(phonemizeWord("ڪتاب")).toBe("kət̪ˈaːbə"); // kə(L) t̪aː(H) bə(L) → the long aː
        expect(phonemizeWord("زبان")).toBe("zəbˈaːnə"); // zə(L) baː(H) nə(L) → the long aː
    });

    test("a monosyllable is still marked", () => {
        expect(phonemizeWord("ٻه")).toBe("ɓˈə");
    });
});

// SHORT-VOWEL restoration (shipped): the kaikki lexicon supplies the vowels the abjad leaves unwritten. This gold
// is the 2-SOURCE-VERIFIED subset — words where kaikki (Wiktionary/standard, our root) AND an INDEPENDENT source,
// Nihalani's *The Phonetics of Sindhi* (1974), AGREE on the short vowels (7/9 same-word overlap = 78%; the 2
// disagreements — سالو aː~aɪ, ميز ɛ~e — are documented variety variation). Independently corroborated → this test
// can genuinely fail (unlike a kaikki-vs-kaikki+wikipron check, which is circular). See the sd investigation doc.
describe("Sindhi short-vowel restoration — 2-source-verified (kaikki ∩ Nihalani 1974)", () => {
    for (const [word, ipa] of [
        ["اسي", "əsi"], // eighty
        ["ٻيلو", "ɓeːloː"], // forest (implosive ɓ + Nihalani's short vowels)
        ["ڳرو", "ɠəro"], // heavy (implosive ɠ)
        ["انب", "əmb"], // mango
        ["نالو", "naːloː"], // name
        ["رات", "raːt̪ɪ"], // night
        ["صوف", "suːfə"], // wool
    ] as const) {
        // Stress is stripped before comparing ON PURPOSE. These goldens are the SEGMENTAL forms the two
        // independent sources agree on; neither kaikki nor the Nihalani transcriptions we extracted mark
        // stress. Baking our own weight-stress layer into them would make the gold partly a copy of our
        // own output, which is exactly the circularity this test exists to avoid. Stress is covered
        // separately in "Sindhi weight stress" above.
        test(`${word} → ${ipa}`, () => {
            expect(phonemizeWordShipped(word).replace(/[ˈˌ]/gu, "")).toBe(ipa);
        });
    }
});

// The neural OOV tagger's "cannot break the consonant skeleton" property holds for consonants (they never take
// the empty tag) but NOT automatically for the glide/vowel letters: a few stray training alignments put the
// empty chunk in their mask, and the decoder then deleted them outright (دنيا → d̪ʊnaː, the ي gone).
// export_sd_tagger_onnx.py prunes the empty tag from any letter that took it in <5% of >=20 observations.
// This asserts the shipped MASK directly, so it runs without onnxruntime and cannot silently regress.
describe("Sindhi tagger mask — glide-deletion guard", () => {
    const META = new URL("../src/languages/sindhi/sd-g2p-tagger.meta.json", import.meta.url);
    test("glide/vowel letters cannot emit the empty chunk; genuine silent carriers still can", () => {
        if (!existsSync(META)) return; // model not built in this checkout
        const meta = JSON.parse(readFileSync(META, "utf8")) as {
            src: Record<string, number>;
            tags: Record<string, string>;
            charTags: Record<string, number[]>;
        };
        const emptyId = Number(Object.entries(meta.tags).find(([, v]) => v === "")![0]);
        const permits = (ch: string): boolean =>
            (meta.charTags[String(meta.src[ch])] ?? []).includes(emptyId);

        // would be DELETED if empty were permitted — these carry sound
        for (const ch of ["و", "ي", "ئ", "آ"]) expect(permits(ch), `${ch} must not delete`).toBe(false);
        // legitimately silent: ھ is absorbed into the preceding aspirate digraph, ه/ع are silent carriers
        for (const ch of ["ھ", "ه", "ع"]) expect(permits(ch), `${ch} may be silent`).toBe(true);
    });
});

// The two Sindhi-specific single-codepoint PARTICLES were silently dropped — no lexicon entry, not in the
// consonant map, so scan() emitted nothing. Between them ~1,900 FLEURS tokens vanished: ۾ "in" (U+06FE,
// kaikki-attested [mẽ]) and ۽ "and" (U+06FD, espeak-corroborated aẽ). Latin runs and digits also dropped —
// no tokenizer group / no foreign phonemizer wired (now the ur/hi English route).
describe("Sindhi: no silent content loss (Run 28)", () => {
    test("the particles ۾ and ۽ are pronounced", () => {
        expect(phonemizeWordShipped("۾").replace(/[ˈˌ]/gu, "")).toBe("mẽ");
        expect(phonemizeWordShipped("۽").replace(/[ˈˌ]/gu, "")).toBe("aẽ");
    });

    // SUPERSEDED IN PART (#587). This asserted that a DIGIT run routes through the foreign phonemizer —
    // which is exactly why every number in Sindhi text was spoken in ENGLISH: `45` read "forty", `100`
    // read "one hundred". Latin still routes to English, correctly; digits now go to Sindhi's own
    // composer.
    test("Latin words route through the foreign phonemizer, digits do NOT", () => {
        const ipa = phonemize("facebook تي 45", "sd");
        expect(ipa).toContain("fˈeᶦsbʊk"); // Latin → English, as before
        expect(ipa).not.toContain("fˈɔːɹt̬i"); // no longer the English "forty"
        expect(ipa).toContain(phonemize("45", "sd")); // read in Sindhi
    });

    // Every form is two-source verified: Wiktionary orthography cross-checked against espeak-ng's own
    // Sindhi numeral phonemes (11 يارهن ↔ [ja:raha], 40 چاليهه ↔ [ca:li:ha], 90 نوي ↔ [navve:]).
    test("Sindhi numbers, Indic lakh/crore grouping", () => {
        expect(phonemize("0", "sd")).toBe(phonemize("ٻڙي", "sd"));
        expect(phonemize("19", "sd")).toBe(phonemize("اوڻيهه", "sd"));
        expect(phonemize("100", "sd")).toBe(phonemize("هڪ سؤ", "sd"));
        expect(phonemize("500000", "sd")).toBe(phonemize("پنج لک", "sd")); // lakh, not "five hundred thousand"
        // Native Arabic-Indic digits read identically — the registry folds them before any engine sees them.
        expect(phonemize("٢٠٢٤", "sd")).toBe(phonemize("2024", "sd"));
    });

    // The fused 21–99, from a Sindhi numerals chart, attestation-checked one at a time against
    // sd.wikipedia and cross-checked against espeak's phonemes. 58 of 72 are attested and authored.
    test("fused 21–99 where the form is attested", () => {
        expect(phonemize("21", "sd")).toBe(phonemize("ايڪيهه", "sd")); // ONE word, not "one twenty"
        expect(phonemize("45", "sd")).toBe(phonemize("پنجيتاليهه", "sd"));
        expect(phonemize("1947", "sd")).toContain(phonemize("ستيتاليهه", "sd"));
    });

    // The third source earned its place: 89 and 98 read as the same word off the chart, and espeak has
    // 89 [Un.Ia:nave:] against 98 [at.#Ia:nave:] — 89 carries the ūṇ- "one less than" prefix.
    test("89 and 98 are distinct", () => {
        expect(phonemize("89", "sd")).not.toBe(phonemize("98", "sd"));
    });

    // ⚠ 14 forms failed attestation in the spelling transcribed and are OMITTED rather than guessed.
    // A missing entry degrades to the two-word UNIT-TENS reading — the right order for Sindhi, since
    // ايڪيهه is literally "one-twenty" — so the cost is an approximate reading, never an invented word.
    test("an unattested value falls back to the two-word unit-tens reading", () => {
        expect(phonemize("39", "sd")).toBe(phonemize("نو ٽيهه", "sd"));
        expect(phonemize("77", "sd")).toBe(phonemize("ست ستر", "sd"));
    });
});

// #562 — the normalization layer. Counts are measured over the FLEURS sd_in corpus (column 3), and every
// emitted word is attested IN that corpus.
describe("sindhi normalization", () => {
    // ⚠ Sindhi uses the ENGLISH numeric conventions, like Central Kurdish and unlike the four European
    // languages in this sweep. The split is total: comma+3 digits is grouping (35, never a decimal),
    // period+1–2 is a decimal (56, never a grouping).
    test("comma groups and period decimates", () => {
        expect(normalizeSindhi("400,000")).toBe("400000");
        expect(normalizeSindhi("2.4")).toBe("2 پوائنٽ 4"); // پوائنٽ, a borrowing of "point" (39)
    });

    // The period form is a CLOCK only where a timezone marks it: of 18 `HH.MM` shapes, exactly two are
    // times and both carry GMT/UTC; the rest are measurements. Claiming the shape outright would turn six
    // measurements into times.
    test("a period clock needs a timezone; a measurement keeps its decimal", () => {
        expect(normalizeSindhi("12.00 GMT")).toBe("12 ڪلاڪ 00 منٽ GMT");
        expect(normalizeSindhi("3.50 ميٽر")).toBe("3 پوائنٽ 5 0 ميٽر");
    });

    test("clock, percent, degrees, squared units", () => {
        expect(normalizeSindhi("11:00")).toBe("11 ڪلاڪ 00 منٽ");
        expect(normalizeSindhi("25%")).toBe("25 سيڪڙو");
        expect(normalizeSindhi("%25")).toBe("25 سيڪڙو"); // the Arabic-script sign-first placement
        expect(normalizeSindhi("20°C")).toBe("20 ڊگري سينٽي گريڊ");
        expect(normalizeSindhi("km²")).toBe("مربع ڪلوميٽر");
    });

    // Sindhi marks a range with a CIRCUMFIX — کان … تائين, "from … until" — not one connective word as
    // the European languages do.
    test("a range is a circumfix", () => {
        expect(normalizeSindhi("1990-1995")).toBe("1990 کان 1995 تائين");
    });

    test("currency, signed numbers and ampersand", () => {
        expect(normalizeSindhi("$500")).toBe("500 ڊالر");
        expect(normalizeSindhi("UTC+1")).toBe("UTC جمع 1");
        expect(normalizeSindhi("A&B")).toBe("A ۽ B");
    });

    test("ordinary Sindhi text is untouched", () => {
        expect(normalizeSindhi("سنڌي هڪ ٻولي آهي.")).toBe("سنڌي هڪ ٻولي آهي.");
    });

    // #586 — `ڪيوبڪ ميٽر` is the corpus's own ("لونو ۾ 120–160 ڪيوبڪ ميٽر تيل هو"), the loan preceding the
    // noun exactly as مربع does in the squared rule above.
    // ⚠ Bare `m` is deliberately NOT in the unit table: adding it made `802.11m` read as a metre, because
    // this file rewrites the version dot to a word before the shared tier's guard can see it (trap 39).
    test("the cubed unit, and why bare m stays out (#586)", () => {
        expect(phonemize("5 m³", "sd")).toContain("kˈiːʋbəkə mˈiːʈəɾə");
        expect(phonemize("5 km³", "sd")).toContain("kˈiːʋbəkə kəloːmˈiːʈəɾə");
        expect(phonemize("802.11m", "sd")).toContain("ˈɛm"); // still a letter
    });
});
