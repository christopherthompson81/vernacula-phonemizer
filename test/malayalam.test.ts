import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/malayalam/malayalam.ts";
import { getPhonemizer } from "../src/registry.ts";

/** The whole pipeline: normalization, tokenization and G2P, trimmed. */
const ml = (t: string): string => getPhonemizer("ml").text(t).trim();

// Canonical-IPA goldens for Malayalam (ml) — Dravidian Brahmic abugida, mirrors Telugu/Kannada (generic engine +
// a Malayalam data file, NO inherent-vowel deletion). The two Malayalam-specific features: SAMVRITOKARAM (a
// word-final chandrakkala → half-close [ɨ], നാല്→naːlɨ) and CHILLU pure-consonants (ൻ ർ ൺ ൽ ൾ ൿ → bare codas),
// plus the Dravidian INTERVOCALIC VOICING (single plosives voice between vowels: അടി→aɖi; geminates and
// word-final stops stay voiceless). Referees: wikipron mal + kaikki mal.
describe("Malayalam canonical IPA", () => {
    test("retroflex/dental series, ള→ɭ, gemination→length", () => {
        expect(phonemizeWord("മലയാളം")).toBe("mˈalajaːɭam"); // ള→ɭ, final ം→m
        expect(phonemizeWord("അമ്മ")).toBe("ˈamːa"); // geminate മ്മ → mː
        expect(phonemizeWord("വെള്ളം")).toBe("ʋˈeɭːam"); // ള്ള → ɭː
        expect(phonemizeWord("കുട്ടി")).toBe("kˈuʈːi"); // retroflex geminate ʈː
    });

    test("intervocalic voicing (Dravidian sonorization) — geminates stay voiceless", () => {
        expect(phonemizeWord("അടി")).toBe("ˈaɖi"); // single ട ʈ→ɖ between vowels
        expect(phonemizeWord("കറുക")).toBe("kˈaruɡa"); // single ക k→ɡ intervocalic
        expect(phonemizeWord("പണ്ട്")).toBe("pˈaɳɖɨ"); // retroflex ണ്ട ɳʈ→ɳɖ (scoped post-nasal, even before samvrit)
    });

    test("samvritokaram — word-final chandrakkala → [ɨ]", () => {
        expect(phonemizeWord("നാല്")).toBe("nˈaːlɨ"); // 'four' — the half-close [ɨ]
        expect(phonemizeWord("വീട്")).toBe("ʋˈiːʈɨ"); // 'house' — stop stays voiceless before samvrit
    });

    test("chillu pure-consonant (no inherent vowel, no samvrit [ɨ])", () => {
        expect(phonemizeWord("അച്ഛൻ")).toBe("ˈat͡ʃʰːan"); // ends in chillu ൻ → bare n (not ...nɨ)
    });

    test("anusvara → [m] before a sibilant, homorganic before a stop", () => {
        expect(phonemizeWord("അംശം")).toBe("ˈamʃam"); // ംശ → m before ʃ
        expect(phonemizeWord("അംഗം")).toBe("ˈãŋɡam"); // ംഗ → homorganic ŋ before ɡ
    });

    test("numbers compose (units/teens/tens/magnitudes)", () => {
        // A bare hundred is നൂറ് alone; the shared composer was prefixing "one" unconditionally.
        expect(ml("100")).toBe("nˈuːrɨ"); // നൂറ്
        expect(ml("5")).toBe("ˈaɲt͡ʃɨ"); // അഞ്ച്
        // `bareMagnitude` now reaches lakh and crore too — these read "one lakh"/"one crore" before.
        expect(ml("100000")).toBe("lˈakʂam"); // ലക്ഷം
        expect(ml("10000000")).toBe("kˈoːɖi"); // കോടി
    });
});

/**
 * NUMBER COMPOSITION. Malayalam moved off `indicNumberWords` onto the SHARED Dravidian composer
 * (core/numbers.ts), which Telugu and Kannada also read. ⚠ Each assertion below names the reading a
 * PRIVATE per-language composer produced, which is what the shared one has to reproduce.
 */
describe("Malayalam numbers — the Dravidian composer", () => {
    test("21-99 is ONE fused word, not the ten and the unit apart", () => {
        expect(ml("21")).toBe("ˈiɾubat̪ːijonːɨ"); // was ˈiɾubat̪ɨ ˈonːɨ (ഇരുപത് ഒന്ന്)
        expect(ml("45")).toBe("nˈaːlpat̪ːijaɲt͡ʃɨ"); // the glide യ at a vowel juncture
        expect(ml("22")).toBe("ˈiɾubat̪ːiɾaɳɖɨ"); // a consonant-initial unit attaches directly
    });

    test("round hundreds are suppletive, not count + നൂറ്", () => {
        expect(ml("200")).toBe("ˈiɾunːuːrɨ"); // ഇരുന്നൂറ് — was ɾˈaɳɖɨ nˈuːrɨ
        expect(ml("500")).toBe("ˈaɲːuːrɨ"); // അഞ്ഞൂറ്
        expect(ml("900")).toBe("t̪ˈoɭːaːjiɾam"); // തൊള്ളായിരം — not a hundred word at all
    });

    test("the magnitude takes its combining form before a remainder", () => {
        expect(ml("150")).toBe("nˈuːrːi ˈampat̪ɨ"); // നൂറ്റി — was nˈuːrɨ ˈampat̪ɨ
        expect(ml("1976")).toBe("ˈaːjiɾat̪ːi t̪ˈoɭːaːjiɾat̪ːi ˈeɻubat̪ːijaːrɨ");
        //                      ^ was ˈaːjiɾam ˈompat̪ɨ nˈuːrɨ ˈeɻubat̪ɨ ˈaːrɨ — five words for three
    });

    test("round thousands fuse the count into the noun", () => {
        expect(ml("2011")).toBe("ɾˈaɳɖaːjiɾat̪ːi pˈad̪inonːɨ"); // was ɾˈaɳɖɨ ˈaːjiɾam pˈad̪inonːɨ
        expect(ml("3000")).toBe("mˈuːʋaːjiɾam"); // മൂവായിരം
    });
});

/**
 * TEXT NORMALIZATION. Asserted through `phonemize`, not through normalizeMalayalam directly — the
 * layer's contract is what the engine finally says.
 */
describe("Malayalam text normalization", () => {
    test("ZWNJ was splitting the word in two and adding a spurious samvritokaram", () => {
        expect(ml("ഓസ്‌ട്രേലിയ")).toBe("ˈoːsʈɾeːlija"); // ⚠ ZWNJ U+200C // was ˈoːsɨ ʈɾˈeːlija — two words, two stresses
        expect(ml("സ്‌പീക്കർ")).toBe("spˈiːkːaɾ"); // ⚠ ZWNJ U+200C // was sˈɨ pˈiːkːaɾ — a stray [sɨ]
    });

    test("ZWJ is the LEGACY CHILLU spelling and must be mapped, not deleted", () => {
        // ല് + ZWJ IS ൽ. Deleting the joiner leaves a bare virama, which reads as samvritokaram [ɨ].
        expect(ml("വിസ്താരത്തില്‍")).toBe(ml("വിസ്താരത്തിൽ")); // ⚠ chillu written ല്+ZWJ U+200D vs the atomic ൽ
        expect(ml("വിസ്താരത്തില്‍")).toBe("ʋˈist̪aːɾat̪ːil"); // was ʋˈist̪aːɾat̪ːilɨ
    });

    test("a grouping comma is not clause punctuation", () => {
        expect(ml("1,234")).toBe("ˈaːjiɾat̪ːi ˈiɾunːuːrːi mˈupːat̪ːinaːlɨ");
        //  was ˈonːɨ , ɾˈaɳɖɨ nˈuːrɨ … — a phrase break inside the number
    });

    test("clitics fuse onto the last cardinal word through the right stem", () => {
        expect(ml("1789-ൽ")).toBe("ˈaːjiɾat̪ːi ˈeɻunuːrːi ˈeɳpat̪ːijompad̪il"); // was … ˈompat̪ɨ l
        expect(ml("18-ആം")).toBe("pˈad̪ineʈːaːm"); // ordinal — was pˈad̪ineʈːɨ ˈaːm
        expect(ml("7-മത്തെ")).toBe("ˈeːɻaːmat̪ːe"); // was ˈeːɻɨ mˈat̪ːe
        expect(ml("1970-കളിൽ")).toBe("ˈaːjiɾat̪ːi t̪ˈoɭːaːjiɾat̪ːi ˈeɻubad̪uɡaɭil"); // plural stem -ു
        expect(ml("2000-ത്തിലെ")).toBe("ɾˈaɳɖaːjiɾat̪ːile"); // ത്തി is the ം-final oblique itself
    });

    test("percent, currency and units become the words this corpus writes", () => {
        expect(ml("50%")).toBe("ˈampat̪ɨ ʃˈad̪amaːnam"); // the sign was dropped outright
        expect(ml("$5")).toBe("ˈaɲt͡ʃɨ ɖˈoːɭaɾ");
        expect(ml("100m")).toBe("nˈuːrɨ mˈiːrːaɾ"); // was nˈuːrɨ ˈɛm — the letter, via the foreign path
        expect(ml("93% ശതമാനം")).toBe("t̪ˈoɳːuːrːimuːnːɨ ʃˈad̪amaːnam"); // not …ശതമാനം ശതമാനം
    });

    test("a decimal point and a clock colon are not sentence breaks", () => {
        expect(ml("6.5")).toBe("ˈaːrɨ d̪ˈaʃaːmʃam ˈaɲt͡ʃɨ"); // was ˈaːrɨ . ˈaɲt͡ʃɨ
        expect(ml("06:30")).toBe("ˈaːrɨ mˈupːat̪ɨ"); // was ˈaːrɨ , mˈupːat̪ɨ — a pause inside the time
    });

    // `ക്യൂബിക് മീറ്റർ` ×1 joins the already-declared `ചതുരശ്ര കിലോമീറ്റർ` ×2; both word-first.
    test("the squared/cubed measure word", () => {
        expect(ml("120 m³")).toContain("kjˈuːbikɨ mˈiːrːaɾ");
    });
});
