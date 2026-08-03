/**
 * Native Nepali / नेपाली (ne) text phonemizer — canonical IPA, espeak-independent. Indo-Aryan, Devanagari.
 * Reuses the Hindi Devanagari engine (makeNativeHindi — schwa deletion, weight stress, numbers) with a Nepali
 * data file whose divergences from Hindi are: the inherent vowel realised as [ʌ] (not ə — the schwa-deletion
 * logic runs on ə, then this module maps the surviving ə→ʌ), the DENTAL affricates च/छ/ज/झ→[t͡s t͡sʰ d͡z d͡zʱ]
 * (not palatal), the sibilant merger श/ष→[s], NO phonemic vowel length (ई→i, ऊ→u), the diphthongs ऐ→[ʌi]/
 * औ→[ʌu], and व→[w]. Validated vs wikipron nep + kaikki. See docs/investigations/ne_native_bringup_investigation.md.
 */
import { makeNativeHindi, type HindiDef, type ForeignPhonemizer } from "../hindi/hindi.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadSharedPhonology } from "../../core/phonology.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { makeNepaliNormalizer } from "./normalize.ts";

/**
 * #562 normalization. Nepali shares Hindi's ENGINE but not Hindi's orthographic conventions, so it
 * supplies its OWN normalizer and its OWN symbol words through `makeNativeHindi`'s `overrides` rather
 * than inheriting Hindi's (issue #583; `src/languages/marathi/marathi.ts` is the other worked example).
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
    percent: ["प्रतिशत"],
    // Hindi's four keys exactly, with only `cm` respelled (see above). A one-letter `m` is deliberately
    // NOT declared — the playbook's `rateDenominators` note records a one-letter unit key matching an
    // alphanumeric designation, and this corpus's digit-adjacent single Latin letters are all something
    // else (compass points, "5 A", "6 b").
    // `m` — मिटर ×12, which is the corpus's spelling (मीटर, the long-vowel form, is ×0 here); digit-adjacent
    // bare `m` is ×0, so the one-letter-key hazard is checked rather than assumed. Without it the cube word
    // below has no head noun and is dead data.
    units: { km: ["किलोमीटर"], cm: ["सेन्टिमिटर"], mm: ["मिलीमीटर"], kg: ["किलोग्राम"], m: ["मिटर"] },
    unitPer: "प्रति",
    rateDenominators: { h: "घण्टा", s: "सेकेण्ड" },
    // `वर्ग किलोमिटर` ×4 ("सुन्दरवनले 3,850 वर्ग किलोमिटर क्षेत्रफल ओगटेको छ"), word-first. घन ×0 — and this
    // is the same घन/धन cluster that produced five confidently wrong plus words in Phase 1, so the cube
    // reading stays on the fallback until a corpus says otherwise.
    // `120–160 घनमिटर इन्धन` — and this is why a token probe said ×0 for घन: the corpus writes it FUSED to
    // the unit noun. `before` still spells it correctly as two words, which the same corpus does for
    // `वर्ग किलोमिटर`; only the cube instance happens to be written closed.
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
        text: (i) => nepaliVowel(base.text(i)).split(SENTINEL).join("ə"),
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
