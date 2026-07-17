/**
 * Language registry: code → canonical-IPA phonemizer. Deliberately tiny and explicit (one row per
 * language), built lazily and cached. No espeak, no fallback — an unknown language throws.
 */
import { createHindi } from "./languages/hindi/hindi.ts";
import { createEnglish, EnglishPhonemizer } from "./languages/english/english.ts";
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
import { createIrish } from "./languages/irish/irish.ts";
import { createWelsh } from "./languages/welsh/welsh.ts";
import { createHausa } from "./languages/hausa/hausa.ts";
import { createThai } from "./languages/thai/thai.ts";
import { createFula } from "./languages/fula/fula.ts";
import { createSinhala } from "./languages/sinhala/sinhala.ts";
import { createKazakh } from "./languages/kazakh/kazakh.ts";
import { createZulu } from "./languages/zulu/zulu.ts";
import { createCzech } from "./languages/czech/czech.ts";
import { createBengali } from "./languages/bengali/bengali.ts";
import { createUrdu } from "./languages/urdu/urdu.ts";
import { createIndonesian } from "./languages/indonesian/indonesian.ts";
import { createPunjabi } from "./languages/punjabi/punjabi.ts";
import { createMarathi } from "./languages/marathi/marathi.ts";
import { createTelugu } from "./languages/telugu/telugu.ts";
import { createCantonese } from "./languages/cantonese/cantonese.ts";
import { createTagalog } from "./languages/tagalog/tagalog.ts";
import { createOromo } from "./languages/oromo/oromo.ts";
import { createPolish } from "./languages/polish/polish.ts";
import { createSindhi } from "./languages/sindhi/sindhi.ts";
import { createPersian } from "./languages/persian/persian.ts";
import { createItalian } from "./languages/italian/italian.ts";
import { createNaija } from "./languages/naija/naija.ts";
import { createWu } from "./languages/wu/wu.ts";
import { createJin } from "./languages/jin/jin.ts";
import { createHakka } from "./languages/hakka/hakka.ts";
import { createXiang } from "./languages/xiang/xiang.ts";
import { createSwahili } from "./languages/swahili/swahili.ts";
import { createGujarati } from "./languages/gujarati/gujarati.ts";
import { createPashto } from "./languages/pashto/pashto.ts";
import { createKannada } from "./languages/kannada/kannada.ts";
import { createMalayalam } from "./languages/malayalam/malayalam.ts";
import { createAmharic } from "./languages/amharic/amharic.ts";
import { createBhojpuri } from "./languages/bhojpuri/bhojpuri.ts";
import { createAwadhi } from "./languages/awadhi/awadhi.ts";
import { createMinnan } from "./languages/minnan/minnan.ts";
import { createYoruba } from "./languages/yoruba/yoruba.ts";
import { createIgbo } from "./languages/igbo/igbo.ts";
import { createBurmese } from "./languages/burmese/burmese.ts";
import { createJavanese } from "./languages/javanese/javanese.ts";

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
        case "arz": // Egyptian Arabic — shares the Arabic engine, Egyptian variety data
            return createArabic("egyptian");
        case "apc": // North Levantine Arabic (Syrian/Lebanese) — Levantine variety data
            return createArabic("levantine");
        case "apd": // Sudanese Arabic — Sudanese variety data (authored; ق→ɡ, ج→ɟ, interdentals kept)
            return createArabic("sudanese");
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
        case "ga":
            return createIrish();
        case "cy":
            return createWelsh();
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
        case "bn":
            return createBengali((latin) => getPhonemizer("en").text(latin));
        case "ur":
            return createUrdu((latin) => getPhonemizer("en").text(latin));
        case "id":
            return createIndonesian();
        case "pa":
            return createPunjabi((latin) => getPhonemizer("en").text(latin));
        case "mr":
            return createMarathi((latin) => getPhonemizer("en").text(latin));
        case "te":
            return createTelugu((latin) => getPhonemizer("en").text(latin));
        case "yue":
            return createCantonese((latin) => getPhonemizer("en").text(latin));
        case "tl":
            return createTagalog();
        case "om":
            return createOromo();
        case "pl":
            return createPolish();
        case "sd":
            return createSindhi();
        case "fa":
            return createPersian((latin) => getPhonemizer("en").text(latin));
        case "it":
            return createItalian();
        // Naija is English-lexified: a known-English word is nativised (English dict IPA → Naija phonology), an
        // OOV word (substrate loan) falls through to the rule g2p. Pass the English DICT lookup (knownWord).
        case "pcm":
            return createNaija((latin) =>
                (getPhonemizer("en") as EnglishPhonemizer).knownWord(latin),
            );
        // Embedded Latin in Wu text routes to the English phonemizer (lazy — loaded only if it appears).
        case "wuu":
            return createWu((latin) => getPhonemizer("en").text(latin));
        // Jin Chinese (Taiyuan) — Han → Sinological IPA + Chao tones; embedded Latin routes to English.
        case "cjy":
            return createJin((latin) => getPhonemizer("en").text(latin));
        // Hakka Chinese (Meixian) — same shared Han-dict engine; embedded Latin routes to English.
        case "hak":
            return createHakka((latin) => getPhonemizer("en").text(latin));
        // Xiang Chinese (Changsha) — same shared Han-dict engine; embedded Latin routes to English.
        case "hsn":
            return createXiang((latin) => getPhonemizer("en").text(latin));
        case "jv":
            return createJavanese();
        case "sw":
            return createSwahili();
        case "gu":
            return createGujarati((latin) => getPhonemizer("en").text(latin));
        case "ps":
            return createPashto((latin) => getPhonemizer("en").text(latin));
        case "kn":
            return createKannada((latin) => getPhonemizer("en").text(latin));
        case "ml":
            return createMalayalam((latin) => getPhonemizer("en").text(latin));
        case "am":
            return createAmharic((latin) => getPhonemizer("en").text(latin));
        case "bho":
            return createBhojpuri((latin) => getPhonemizer("en").text(latin));
        // Awadhi (Eastern Hindi) — Saksena-sourced ⛔ stub on the shared Hindi engine.
        case "awa":
            return createAwadhi((latin) => getPhonemizer("en").text(latin));
        case "nan":
            return createMinnan((latin) => getPhonemizer("en").text(latin));
        case "yo":
            return createYoruba((latin) => getPhonemizer("en").text(latin));
        case "ig":
            return createIgbo((latin) => getPhonemizer("en").text(latin));
        case "my":
            return createBurmese((latin) => getPhonemizer("en").text(latin));
        default:
            throw new Error(
                `vernacula-phonemizer: no phonemizer registered for "${lang}"`,
            );
    }
}
