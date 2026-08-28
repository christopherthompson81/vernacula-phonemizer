/**
 * Native Nepali / नेपाली (ne) text phonemizer — canonical IPA. Indo-Aryan, Devanagari.
 * Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress, numbers) with a Nepali
 * data file whose divergences from Hindi are: the inherent vowel realised as [ʌ] (not ə — the schwa-deletion
 * logic runs on ə, then this module maps the surviving ə→ʌ), the DENTAL affricates च/छ/ज/झ→[t͡s t͡sʰ d͡z d͡zʱ]
 * (not palatal), the sibilant merger श/ष→[s], NO phonemic vowel length (ई→i, ऊ→u), the diphthongs ऐ→[ʌi]/
 * औ→[ʌu], and व→[w]. Validated vs wikipron nep + kaikki.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { makeNepaliNormalizer } from "./normalize.ts";
import { noteRewrite } from "../../core/trace.ts";

/**
 * normalization. Nepali shares Hindi's ENGINE but not Hindi's orthographic conventions, so it
 * supplies its OWN normalizer and its OWN symbol words through `makeNativeHindi`'s `overrides` rather
 * than inheriting Hindi's (`src/languages/marathi/marathi.ts` is the other worked example).
 *
 * What is overridden and what is NOT is recorded in normalize.ts's header. For this tier specifically:
 *   percent  प्रतिशत — IDENTICAL to Hindi's, and that is a measured result: it is the ne_np corpus's own
 *                     word (×9) and a wikipron headword. Hindi's default is right here.
 *   units    IDENTICAL to Hindi's. Nepali has no phonemic vowel length, so the corpus's किलोमिटर and
 *            Hindi's किलोमीटर are the same phoneme string (kˈilomiʈʌɾ); overriding them would change
 *            nothing. Only सेंटीमीटर would differ, and its Devanagari abbreviation is claimed in
 *            normalize.ts before this tier ever sees it.
 *   currency ABSENT here on purpose — the signs are claimed in normalize.ts step 9, which the shared
 *            tier cannot do: its `(?<![\p{L}\p{M}])` guard makes a letter-code prefix (US$, AUD$)
 *            unmatchable, and it has no way to suppress a currency noun the text already wrote out.
 *   unitPer  प्रति with `rateDenominators` — declared so the LATIN rate forms compose; Hindi declares no
 *            `unitPer` at all, so "km/h" dropped its denominator and read the h as a letter name.
 */
const NE_SYMBOLS = makeSymbolNormalizer({
    // ⚠ THE AMPERSAND WAS A MISSING CELL, NOT A SOURCING PROBLEM — the tier's own `ampersand` note says so,
    // and this language is one of the fourteen that still had no word declared, so `&` was DROPPED outright.
    // र is ×2379 TOKEN in this language's own corpus, i.e. among its commonest words; there was nothing to source.
    //
    // A Latin-script printing LIGATURE rather than anything native, so what it takes is a reading and not a
    // translation: for a language written in Latin script that is its own conjunction, and for one that is not,
    // the symbol only ever arrives inside a Latin run. Either way the tier substitutes the conjunction, SPACED —
    // see the tier, where the spacing exists because `B&B` is two initialisms.
    ampersand: "र",
    // `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
    // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
    // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
    // defaults to it — this language does not split dimension from product.
    multiply: { times: "गुणा" },
    percent: ["प्रतिशत"],
    // Hindi's four keys, with `cm` respelled (see above), plus the one-letter `m`.
    // ⚠ A ONE-LETTER UNIT KEY IS A HAZARD — it also matches alphanumeric designations ("5 A", "6 b",
    // compass points) — so `m` is declared only after checking that digit-adjacent bare `m` does not occur
    // in this sense here. It is needed: without a head noun the cube word below would be dead data.
    // ⚠ THE DEVANAGARI ABBREVIATIONS MUST BE DECLARED BESIDE THE LATIN ONES. With only the Latin keys,
    // `19,500 किमि²` matches nothing and the unit AND its exponent are lost together, while the Latin
    // `19,500 km²` reads correctly. Both spellings occur — किमि and किमी.
    units: { km: ["किलोमीटर"], "किमि": ["किलोमीटर"], "किमी": ["किलोमीटर"],
        cm: ["सेन्टिमिटर"], mm: ["मिलीमीटर"], kg: ["किलोग्राम"], m: ["मिटर"] },
    unitPer: "प्रति",
    rateDenominators: { h: "घण्टा", s: "सेकेण्ड" },
    // `वर्ग किलोमिटर` is word-first ("सुन्दरवनले 3,850 वर्ग किलोमिटर क्षेत्रफल ओगटेको छ").
    // ⚠ A TOKEN PROBE REPORTS घन AS ABSENT, AND IS WRONG: the cube word is written FUSED to its unit noun
    // (`120–160 घनमिटर इन्धन`), so it never appears as a token of its own. `before` still spells it as two
    // words, which is what the same text does for `वर्ग किलोमिटर`; only the cube happens to be written closed.
    exponentWords: { squared: ["वर्ग"], cubed: ["घन"], position: "before" },
});

// The Devanagari inherent/independent vowel stays ə through the shared schwa-deletion, then surfaces as the
// Nepali [ʌ]. The word/wordRules/number paths are pure Devanagari, so mapping ə→ʌ on them is safe.
const nepaliVowel = (s: string): string => s.replace(/ə/gu, "ʌ");

// text() interleaves EMBEDDED-Latin runs (English via `foreign`), whose /ə/ is a real, contrastive vowel that
// must NOT become [ʌ]. So the foreign output's ə is shielded behind a private-use sentinel before interleaving,
// then restored after the Devanagari ə→ʌ map.
const SENTINEL = "";

function engine(foreign?: ForeignPhonemizer): ReturnType<typeof makeNativeHindi> {
    const shieldedForeign: ForeignPhonemizer | undefined = foreign
        ? (latin) => foreign(latin).replace(/ə/gu, SENTINEL)
        : undefined;
    const def = loadManifest<HindiDef>(import.meta.url, "nepali.jsonc");
    const base = makeNativeHindi(
        def,
        loadSharedPhonology(),
        shieldedForeign,
        undefined,
        undefined,
        { normalize: makeNepaliNormalizer(def.numbers), symbols: NE_SYMBOLS },
    );
    return {
        word: (w) => nepaliVowel(base.word(w)),
        wordRules: (w) => nepaliVowel(base.wordRules(w)),
        number: (d) => nepaliVowel(base.number(d)),
        // Map Devanagari ə→ʌ, then restore the shielded English ə (computer stays kəmpjuːt̬ɚ, not kʌmpjuːt̬ɚ).
        text: (i) => {
            const pre = base.text(i);
            const out = nepaliVowel(pre).split(SENTINEL).join("ə");
            // ⚠ A whole-string post-pass, so it is reported to the trace (#1150).
            noteRewrite("nepali-inherent-vowel", pre, out);
            return out;
        },
    };
}

/** Build the Nepali phonemizer. `foreign` handles embedded Latin runs. */
export function createNepali(foreign?: ForeignPhonemizer): { text(input: string): string } {
    return engine(foreign);
}

let NE: ReturnType<typeof makeNativeHindi> | undefined;
/** Bare word→IPA (tests / eval). */
export function phonemizeWord(w: string): string {
    return (NE ??= engine()).word(w);
}
