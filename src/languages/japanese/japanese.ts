/**
 * Japanese (ja) phonemizer — Standard/Tokyo, canonical IPA, espeak-independent.
 *   text → segmentText (bunsetsu spaces) → per run: applyReadings (kanji→kana) → kanaToIpa.
 * PHASE 1: native kana/katakana → IPA (kana.ts) + Sino-Japanese numbers. PHASE 2: kanji → kana via a 60k
 * whole-word reading map + per-kanji on/kun/rendaku fallback (kanji.ts), and orthographic bunsetsu
 * segmentation of spaceless text. Pitch accent (ꜜ) is Phase 3. See docs/ja_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { kanaToIpa, kanaToMorae } from "./kana.ts";
import { applyReadings, segmentText } from "./kanji.ts";
import { numberToKana } from "./numbers.ts";
import { accentNucleus, placeDownstep } from "./pitch.ts";
import { MANIFEST } from "./manifest.ts";

// Japanese clause punctuation → canonical pause marks (from japanese.jsonc).
const CLAUSE_MARK = MANIFEST.clausePunctuation;
// A Japanese-script run (kanji incl. Ext-A/B + iteration marks + hiragana + katakana + long mark), a digit
// run, or clause punctuation. Bunsetsu spaces inserted by segmentText split runs into phrase-sized tokens.
const TOKEN =
    /([㐀-鿿\u{20000}-\u{2a6df}々〻ぁ-ゖァ-ヺー゛゜]+)|(\d+)|([。．.！!？?、，,])/gu;
const KANA_ONLY = /[^ぁ-ゖァ-ヺー]/gu; // strip anything the reading pass left un-converted (unresolved kanji)

class JapanesePhonemizer implements Phonemizer {
    text(input: string): string {
        let out = "";
        let pending: string | null = null;
        const emit = (ipa: string): void => {
            if (!ipa) return;
            if (out === "") out = ipa;
            else if (pending !== null) {
                out += ` ${pending} ${ipa}`;
                pending = null;
            } else out += ` ${ipa}`;
        };
        for (const m of segmentText(input).matchAll(TOKEN)) {
            if (m[1]) {
                const reading = applyReadings(m[1]).replace(KANA_ONLY, ""); // kanji → kana, drop the unresolvable tail
                const morae = kanaToMorae(reading);
                if (morae)
                    emit(placeDownstep(morae, accentNucleus(m[1], reading))); // pitch: surface m[1] disambiguates
            } else if (m[2]) {
                const ipa = kanaToIpa(numberToKana(Number(m[2])));
                if (ipa) emit(ipa);
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk && out !== "") pending = mk;
            }
        }
        if (pending !== null && out !== "") out += ` ${pending}`;
        return out;
    }
}

/** One Japanese word/token → canonical IPA (kanji readings + pitch downstep, so kanji tokens work too). */
export function phonemizeWord(word: string): string {
    const reading = applyReadings(word).replace(KANA_ONLY, "");
    const morae = kanaToMorae(reading);
    return morae === null
        ? ""
        : placeDownstep(morae, accentNucleus(word, reading));
}

/** One Japanese word/token → canonical IPA, SEGMENTAL only (no pitch downstep) — for segmental validation. */
export function phonemizeWordSegmental(word: string): string {
    return kanaToIpa(applyReadings(word).replace(KANA_ONLY, "")) ?? "";
}

/** Build the Japanese phonemizer (kana + numbers + kanji readings + bunsetsu segmentation). */
export function createJapanese(): Phonemizer {
    return new JapanesePhonemizer();
}
