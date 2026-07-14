/**
 * Language registry: code → canonical-IPA phonemizer. Deliberately tiny and explicit (one row per
 * language), built lazily and cached. No espeak, no fallback — an unknown language throws.
 */
import { createHindi } from "./languages/hindi/hindi.ts";
import { createEnglish } from "./languages/english/english.ts";
import { createMandarin } from "./languages/mandarin/mandarin.ts";
import { createSpanish } from "./languages/spanish/spanish.ts";
import { createArabic } from "./languages/arabic/arabic.ts";
import { createFrench } from "./languages/french/french.ts";
import { createPortuguese } from "./languages/portuguese/portuguese.ts";
import { createRussian } from "./languages/russian/russian.ts";
import { createGerman } from "./languages/german/german.ts";
import { createJapanese } from "./languages/japanese/japanese.ts";
import { createTurkish } from "./languages/turkish/turkish.ts";
import { createVietnamese } from "./languages/vietnamese/vietnamese.ts";
import { createTamil } from "./languages/tamil/tamil.ts";
import { createKorean } from "./languages/korean/korean.ts";
import { createSwedish } from "./languages/swedish/swedish.ts";
import { createCatalan } from "./languages/catalan/catalan.ts";
import { createHausa } from "./languages/hausa/hausa.ts";
import { createThai } from "./languages/thai/thai.ts";
import { createFula } from "./languages/fula/fula.ts";
import { createSinhala } from "./languages/sinhala/sinhala.ts";
import { createKazakh } from "./languages/kazakh/kazakh.ts";
import { createZulu } from "./languages/zulu/zulu.ts";
import { createCzech } from "./languages/czech/czech.ts";

export interface Phonemizer {
    /** Full text → canonical IPA. */
    text(input: string): string;
}

const cache = new Map<string, Phonemizer>();

/** Get (and memoize) the phonemizer for a language code. */
export function getPhonemizer(lang: string): Phonemizer {
    let p = cache.get(lang);
    if (p === undefined) {
        p = build(lang);
        cache.set(lang, p);
    }
    return p;
}

function build(lang: string): Phonemizer {
    switch (lang) {
        case "en":
            return createEnglish();
        // Embedded Latin in Chinese text routes to the English phonemizer (lazy — loaded only if it appears).
        case "cmn":
            return createMandarin((latin) => getPhonemizer("en").text(latin));
        case "es":
            return createSpanish();
        case "ar":
            return createArabic();
        case "fr":
            return createFrench();
        case "pt":
            return createPortuguese();
        case "ru":
            return createRussian();
        case "de":
            return createGerman();
        case "ja":
            return createJapanese();
        case "tr":
            return createTurkish();
        case "vi":
            return createVietnamese();
        case "ta":
            return createTamil();
        case "sv":
            return createSwedish();
        case "ca":
            return createCatalan();
        case "ko":
            return createKorean();
        case "ha":
            return createHausa();
        case "th":
            return createThai();
        case "ff":
            return createFula();
        case "si":
            return createSinhala();
        case "kk":
            return createKazakh();
        case "zu":
            return createZulu();
        case "cs":
            return createCzech();
        // Embedded Latin in Hindi text routes to the English phonemizer (lazy — loaded only if it appears).
        case "hi":
            return createHindi((latin) => getPhonemizer("en").text(latin));
        default:
            throw new Error(
                `vernacula-phonemizer: no phonemizer registered for "${lang}"`,
            );
    }
}
