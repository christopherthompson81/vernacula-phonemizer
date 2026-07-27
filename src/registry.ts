/**
 * Language registry: code → canonical-IPA phonemizer. Deliberately tiny and explicit (one row per
 * language), built lazily and cached. No espeak, no fallback — an unknown language throws.
 */
import { createHindi } from "./languages/hindi/hindi.ts";
import { createEnglish, EnglishPhonemizer } from "./languages/english/english.ts";
import { createEnglishGB } from "./languages/english-gb/english-gb.ts";
import { createEnglishIN } from "./languages/english-in/english-in.ts";
import { createFrenchCA } from "./languages/french-ca/french-ca.ts";
import { createMandarin } from "./languages/mandarin/mandarin.ts";
import { createSpanish } from "./languages/spanish/spanish.ts";
import { createSpanish419 } from "./languages/spanish-419/spanish-419.ts";
import { createArabic } from "./languages/arabic/arabic.ts";
import { createFrench } from "./languages/french/french.ts";
import { createPortuguese } from "./languages/portuguese/portuguese.ts";
import { createPortugueseBR } from "./languages/portuguese-br/portuguese-br.ts";
import { createRussian } from "./languages/russian/russian.ts";
import { createGerman } from "./languages/german/german.ts";
import { createDutch } from "./languages/dutch/dutch.ts";
import { createJapanese } from "./languages/japanese/japanese.ts";
import { createTurkish } from "./languages/turkish/turkish.ts";
import { createAzerbaijani } from "./languages/azerbaijani/azerbaijani.ts";
import { createMalagasy } from "./languages/malagasy/malagasy.ts";
import { createAssamese } from "./languages/assamese/assamese.ts";
import { createSomali } from "./languages/somali/somali.ts";
import { createCebuano } from "./languages/cebuano/cebuano.ts";
import { createHiligaynon } from "./languages/hiligaynon/hiligaynon.ts";
import { createIlocano } from "./languages/ilocano/ilocano.ts";
import { createVietnamese } from "./languages/vietnamese/vietnamese.ts";
import { createTamil } from "./languages/tamil/tamil.ts";
import { createKorean } from "./languages/korean/korean.ts";
import { createSwedish } from "./languages/swedish/swedish.ts";
import { createCatalan } from "./languages/catalan/catalan.ts";
import { createGalician } from "./languages/galician/galician.ts";
import { createIrish } from "./languages/irish/irish.ts";
import { createWelsh } from "./languages/welsh/welsh.ts";
import { createHausa } from "./languages/hausa/hausa.ts";
import { createThai } from "./languages/thai/thai.ts";
import { createLao } from "./languages/lao/lao.ts";
import { createFula } from "./languages/fula/fula.ts";
import { createSinhala } from "./languages/sinhala/sinhala.ts";
import { createKazakh } from "./languages/kazakh/kazakh.ts";
import { createTajik } from "./languages/tajik/tajik.ts";
import { createZulu } from "./languages/zulu/zulu.ts";
import { createXhosa } from "./languages/xhosa/xhosa.ts";
import { createSerbian } from "./languages/serbian/serbian.ts";
import { createHungarian } from "./languages/hungarian/hungarian.ts";
import { createKurmanji } from "./languages/kurmanji/kurmanji.ts";
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
import { createSaraiki } from "./languages/saraiki/saraiki.ts";
import { createRomanian } from "./languages/romanian/romanian.ts";
import { createPersian } from "./languages/persian/persian.ts";
import { createItalian } from "./languages/italian/italian.ts";
import { createNaija } from "./languages/naija/naija.ts";
import { createWu } from "./languages/wu/wu.ts";
import { createJin } from "./languages/jin/jin.ts";
import { createHakka } from "./languages/hakka/hakka.ts";
import { createXiang } from "./languages/xiang/xiang.ts";
import { createGan } from "./languages/gan/gan.ts";
import { createAkan } from "./languages/akan/akan.ts";
import { createSwahili } from "./languages/swahili/swahili.ts";
import { createGujarati } from "./languages/gujarati/gujarati.ts";
import { createPashto } from "./languages/pashto/pashto.ts";
import { createKannada } from "./languages/kannada/kannada.ts";
import { createMalayalam } from "./languages/malayalam/malayalam.ts";
import { createOdia } from "./languages/odia/odia.ts";
import { createUzbek } from "./languages/uzbek/uzbek.ts";
import { createMaithili } from "./languages/maithili/maithili.ts";
import { createBelarusian } from "./languages/belarusian/belarusian.ts";
import { createArmenian } from "./languages/armenian/armenian.ts";
import { createKyrgyz } from "./languages/kyrgyz/kyrgyz.ts";
import { createNorwegian } from "./languages/norwegian/norwegian.ts";
import { createUkrainian } from "./languages/ukrainian/ukrainian.ts";
import { createSundanese } from "./languages/sundanese/sundanese.ts";
import { createNepali } from "./languages/nepali/nepali.ts";
import { createAmharic } from "./languages/amharic/amharic.ts";
import { createTigrinya } from "./languages/tigrinya/tigrinya.ts";
import { createBulgarian } from "./languages/bulgarian/bulgarian.ts";
import { createMacedonian } from "./languages/macedonian/macedonian.ts";
import { createKabuverdianu } from "./languages/kabuverdianu/kabuverdianu.ts";
import { createMaltese } from "./languages/maltese/maltese.ts";
import { createLuxembourgish } from "./languages/luxembourgish/luxembourgish.ts";
import { createIcelandic } from "./languages/icelandic/icelandic.ts";
import { createOccitan } from "./languages/occitan/occitan.ts";
import { createMaori } from "./languages/maori/maori.ts";
import { createQuechua } from "./languages/quechua/quechua.ts";
import { createTibetan } from "./languages/tibetan/tibetan.ts";
import { createGuarani } from "./languages/guarani/guarani.ts";
import { createAlbanian } from "./languages/albanian/albanian.ts";
import { createTurkmen } from "./languages/turkmen/turkmen.ts";
import { createTatar } from "./languages/tatar/tatar.ts";
import { createSantali } from "./languages/santali/santali.ts";
import { createBashkir } from "./languages/bashkir/bashkir.ts";
import { createEwe } from "./languages/ewe/ewe.ts";
import { createLatin } from "./languages/latin/latin.ts";
import { createAsturian } from "./languages/asturian/asturian.ts";
import { createHaitian } from "./languages/haitian/haitian.ts";
import { createRangpuri } from "./languages/rangpuri/rangpuri.ts";
import { createBavarian } from "./languages/bavarian/bavarian.ts";
import { createFoochow } from "./languages/foochow/foochow.ts";
import { createHmong } from "./languages/hmong/hmong.ts";
import { createTashelhit } from "./languages/tashelhit/tashelhit.ts";
import { createCentralKurdish } from "./languages/central-kurdish/central-kurdish.ts";
import { createBalochi } from "./languages/balochi/balochi.ts";
import { createBhojpuri } from "./languages/bhojpuri/bhojpuri.ts";
import { createMagahi } from "./languages/magahi/magahi.ts";
import { createZhuang } from "./languages/zhuang/zhuang.ts";
import { createChhattisgarhi } from "./languages/chhattisgarhi/chhattisgarhi.ts";
import { createAwadhi } from "./languages/awadhi/awadhi.ts";
import { createMinnan } from "./languages/minnan/minnan.ts";
import { createMongolian } from "./languages/mongolian/mongolian.ts";
import { createUmbundu } from "./languages/umbundu/umbundu.ts";
import { createCroatian } from "./languages/croatian/croatian.ts";
import { createBosnian } from "./languages/bosnian/bosnian.ts";
import { createSlovenian } from "./languages/slovenian/slovenian.ts";
import { createDanish } from "./languages/danish/danish.ts";
import { createFinnish } from "./languages/finnish/finnish.ts";
import { createEstonian } from "./languages/estonian/estonian.ts";
import { createSlovak } from "./languages/slovak/slovak.ts";
import { createYoruba } from "./languages/yoruba/yoruba.ts";
import { createIgbo } from "./languages/igbo/igbo.ts";
import { createBurmese } from "./languages/burmese/burmese.ts";
import { createShan } from "./languages/shan/shan.ts";
import { createJavanese } from "./languages/javanese/javanese.ts";
import { createShona } from "./languages/shona/shona.ts";
import { createKinyarwanda } from "./languages/kinyarwanda/kinyarwanda.ts";
import { createMadurese } from "./languages/madurese/madurese.ts";
import { createChichewa } from "./languages/chichewa/chichewa.ts";
import { createLingala } from "./languages/lingala/lingala.ts";
import { createKhmer } from "./languages/khmer/khmer.ts";
import { createSetswana } from "./languages/setswana/setswana.ts";
import { createSesotho } from "./languages/sesotho/sesotho.ts";
import { createSepedi } from "./languages/sepedi/sepedi.ts";
import { createBambara } from "./languages/bambara/bambara.ts";
import { createWolof } from "./languages/wolof/wolof.ts";
import { createMossi } from "./languages/mossi/mossi.ts";
import { createKikuyu } from "./languages/kikuyu/kikuyu.ts";
import { createKamba } from "./languages/kamba/kamba.ts";
import { createGeorgian } from "./languages/georgian/georgian.ts";
import { createLithuanian } from "./languages/lithuanian/lithuanian.ts";
import { createLatvian } from "./languages/latvian/latvian.ts";
import { createAfrikaans } from "./languages/afrikaans/afrikaans.ts";
import { createHebrew } from "./languages/hebrew/hebrew.ts";
import { createLuganda } from "./languages/luganda/luganda.ts";
import { createLuo } from "./languages/luo/luo.ts";
import { createKirundi } from "./languages/kirundi/kirundi.ts";
import { createUyghur } from "./languages/uyghur/uyghur.ts";
import { createSylheti } from "./languages/sylheti/sylheti.ts";
import { createGreek } from "./languages/greek/greek.ts";

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
        // British English (SSBE/"BBC") — the GenAm engine + an RP lexical-set delta (accent variant of `en`).
        case "en-GB":
            return createEnglishGB();
        // General Indian English — the GenAm engine + a GIE delta (retroflexion, TH-stopping, v/w, monophthongs).
        case "en-IN":
            return createEnglishIN();
        // Embedded Latin in Chinese text routes to the English phonemizer (lazy — loaded only if it appears).
        case "cmn":
            return createMandarin((latin) => getPhonemizer("en").text(latin));
        case "es":
            return createSpanish();
        // Latin-American Spanish (neutral/pan-American) — Castilian engine + seseo (θ→s) + yeísmo (ʎ→ʝ).
        case "es-419":
            return createSpanish419();
        case "ar":
            return createArabic();
        case "arz": // Egyptian Arabic — shares the Arabic engine, Egyptian variety data
            return createArabic("egyptian");
        case "apc": // North Levantine Arabic (Syrian/Lebanese) — Levantine variety data
            return createArabic("levantine");
        case "apd": // Sudanese Arabic — Sudanese variety data (authored; ق→ɡ, ج→ɟ, interdentals kept)
            return createArabic("sudanese");
        case "acm": // Iraqi Arabic (Baghdadi gilit) — ق→ɡ, ج=d͡ʒ, interdentals kept
            return createArabic("iraqi");
        case "afb": // Gulf Arabic (Khaleeji) — ق→ɡ, خ→χ, ج=d͡ʒ, interdentals kept
            return createArabic("gulf");
        case "ary": // Moroccan Arabic (Darija) — ق kept q, ج→ʒ, interdentals→stops
            return createArabic("moroccan");
        case "ayl": // Libyan Arabic (Tripolitanian) — ق→ɡ, ج→ʒ, خ→χ, interdentals kept
            return createArabic("libyan");
        case "ajp": // South Levantine Arabic (Palestinian/Jordanian) — ق→ʔ, ج→ʒ, ث/ذ→t/d, ظ→zˤ (sibling of apc)
            return createArabic("southlevantine");
        case "acw": // Hijazi Arabic (western Saudi) — ق→ɡ, ج=d͡ʒ retained, خ=x, interdentals→stops/zˤ
            return createArabic("hijazi");
        case "fr":
            return createFrench();
        // Québécois French — the France engine + a Canadian delta (affrication t/d→t͡s/d͡z, high-vowel laxing).
        case "fr-CA":
            return createFrenchCA();
        case "pt":
            return createPortuguese();
        // Brazilian Portuguese (neutral/paulistano) — the EP engine in `dialect: "bp"` mode (accent variant of `pt`).
        case "pt-BR":
            return createPortugueseBR();
        case "ru":
            return createRussian();
        case "de":
            return createGerman();
        case "nl":
            return createDutch();
        case "ja":
            return createJapanese();
        case "tr":
            return createTurkish();
        case "az":
            return createAzerbaijani();
        case "mg":
            return createMalagasy();
        case "vi":
            return createVietnamese();
        case "ta":
            return createTamil();
        case "sv":
            return createSwedish();
        case "ca":
            return createCatalan();
        // Galician (galego) — Ibero-Romance sister of Portuguese; the Spanish-shaped engine + Galician deltas
        // (⟨x⟩/⟨j⟩→ʃ, ⟨g⟩→ɡ no jota, ⟨nh⟩→ŋ, coda/pre-velar ⟨n⟩→ŋ).
        case "gl":
            return createGalician();
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
        // Shan (Tai Long) — Southwestern Tai in the SHAN ABUGIDA (Myanmar-script variant); syllable scan + EXPLICIT lexical tone marks.
        case "shn":
            return createShan();
        // Lao — Brahmic abugida, Thai sibling with a more phonemic orthography; leaner authored rule g2p + tone.
        case "lo":
            return createLao();
        case "ff":
            return createFula();
        case "si":
            return createSinhala();
        case "kk":
            return createKazakh();
        case "tg":
            return createTajik();
        case "zu":
            return createZulu();
        case "xh":
            return createXhosa();
        case "sr":
            return createSerbian();
        // Croatian (hrvatski) — a THIN module that REUSES the Serbian engine's Serbo-Croatian g2p (identical
        // grapheme→IPA: č=t͡ʃ, ć=t͡ɕ, đ=d͡ʑ, dž=d͡ʒ, lj=ʎ, nj=ɲ, h=x, v=ʋ; same deferred pitch accent) and overrides only
        // the CARDINAL NUMBER WORDS (Croatian tisuća/milijun/dvjesto vs Serbian hiljada/milion/dvesta). The segmental
        // referee is wikipron hbs_latn (the Serbo-Croatian macrolanguage, which contains the Croatian words).
        case "hr":
            return createCroatian();
        case "bs":
            return createBosnian();
        // Slovenian (slovenščina) — South Slavic, its OWN engine (not the BCS shared g2p): l-vocalization (coda ⟨l⟩→ʋ),
        // ⟨lj/nj⟩ coda-j-drop, syllabic-r→ər, voicing/devoicing; vowel quality/length/pitch/schwa unwritten → folded.
        case "sl":
            return createSlovenian();
        case "da":
            return createDanish();
        case "fi":
            return createFinnish();
        // Estonian (eesti keel) — Uralic/Finnic sibling of Finnish; phonemic scan + gemination + first-syllable stress.
        case "et":
            return createEstonian();
        case "sk":
            return createSlovak();
        case "hu":
            return createHungarian();
        case "kmr":
            return createKurmanji();
        case "cs":
            return createCzech();
        // Embedded Latin in Hindi text routes to the English phonemizer (lazy — loaded only if it appears).
        case "hi":
            return createHindi((latin) => getPhonemizer("en").text(latin));
        case "bn":
            return createBengali((latin) => getPhonemizer("en").text(latin));
        case "as":
            return createAssamese((latin) => getPhonemizer("en").text(latin));
        case "so":
            return createSomali();
        case "ceb":
            return createCebuano();
        case "hil":
            return createHiligaynon();
        case "ilo":
            return createIlocano();
        case "ur":
            return createUrdu((latin) => getPhonemizer("en").text(latin));
        case "id":
            return createIndonesian();
        // Standard Malay (Malaysian/Bruneian) — ALIAS to the Indonesian engine as a labelled approximation. Malay and
        // Indonesian are mutually intelligible standardisations of the same Malayic language, sharing the reformed
        // Latin orthography and largely the same grapheme→IPA phonology. There is no independent Malay referee wired,
        // and the documented differences (Malaysian final open ⟨a⟩ leaning to [ə], some vowel realisations) are
        // accent-level, not a categorical grapheme→IPA delta — so `id` is its nearest verified sibling. First-class
        // code, transparent that no Malay-specific phonology is claimed. See tools/language-catalogue (served_by='id').
        case "zsm":
            return createIndonesian();
        case "pa":
            return createPunjabi((latin) => getPhonemizer("en").text(latin));
        // Western Punjabi / Lahnda (Shahmukhi, Pakistan) — the SAME Punjabi engine; the scanner auto-detects the
        // Perso-Arabic script and applies the shared phonology (tonogenesis, gemination, nasal assimilation).
        case "pnb":
            return createPunjabi((latin) => getPhonemizer("en").text(latin));
        // Saraiki (Shahmukhi, Pakistan) — the NON-tonal Lahnda sibling of Punjabi: reuses the shared Shahmukhi
        // front-end + Lahnda phonology but keeps the voiced aspirates & aspirated sonorants (no tonogenesis) and
        // adds the four implosives ٻɓ ڄʄ ڳɠ ݙɗ.
        case "ro":
            return createRomanian();
        case "skr":
            return createSaraiki((latin) => getPhonemizer("en").text(latin));
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
        case "gan":
            return createGan((latin) => getPhonemizer("en").text(latin));
        case "ak":
            return createAkan((latin) => getPhonemizer("en").text(latin));
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
        case "or":
            return createOdia((latin) => getPhonemizer("en").text(latin));
        case "uz":
            return createUzbek();
        case "am":
            return createAmharic((latin) => getPhonemizer("en").text(latin));
        case "ti":
            return createTigrinya((latin) => getPhonemizer("en").text(latin));
        case "bg":
            return createBulgarian();
        // Macedonian (македонски) — South Slavic, Cyrillic; phonemic g2p + fixed antepenultimate stress.
        case "mk":
            return createMacedonian();
        // Kabuverdianu (kriolu) — Portuguese-lexified creole of Cape Verde; ALUPEC phonemic g2p + nasalization.
        case "kea":
            return createKabuverdianu();
        // Maltese (Malti) — Semitic in the Latin alphabet; grapheme g2p + q→ʔ + final devoicing + silent għ/h.
        case "mt":
            return createMaltese();
        // Luxembourgish (Lëtzebuergesch) — West Germanic; grapheme g2p + the diphthong system + German-style rules.
        case "lb":
            return createLuxembourgish();
        // Icelandic (íslenska) — North Germanic; deep orthography, fortis/lenis neutralization + epenthetic clusters.
        case "is":
            return createIcelandic();
        // Occitan (lenga d'òc) — Occitano-Romance; Languedocien g2p (o→u, final-a→ɔ).
        case "oc":
            return createOccitan();
        // Māori (te reo Māori) — Eastern Polynesian; a near-1:1 phonemic g2p (macron length, wh→ɸ, ng→ŋ).
        case "mi":
            return createMaori();
        // Quechua (Runasimi) — Southern Quechua; 3 vowels, overt 3-way stop series (plain/aspirate/ejective), penult stress.
        case "qu":
            return createQuechua();
        // Tibetan (Standard/Lhasa) — deep orthography; syllable-stack rule engine (tonogenesis, cluster realization, suffix umlaut/length/nasalization).
        case "bo":
            return createTibetan();
        // Guaraní (Avañe'ẽ) — Tupian; 12 vowels (6 nasal + ⟨y⟩→ɨ), prenasalized ⟨mb nd⟩, glottal ⟨'⟩, glide formation.
        case "gn":
            return createGuarani();
        // Albanian (Shqip) — Indo-European (own branch); digraph-rich (dh th sh zh xh, palatals gj/q), 7 vowels, penult stress.
        case "sq":
            return createAlbanian();
        // Turkmen (Türkmençe) — Oghuz Turkic; the interdental hallmark s→θ/z→ð, 9 vowels (a→ɑ, ä→æ, ü→y, y→ɯ), final stress.
        case "tk":
            return createTurkmen();
        // Tatar (Татар теле) — Kipchak Turkic, Cyrillic; vowel-harmony backing of к/г→q/ʁ, ә→æ ө→ø ү→y җ→ʑ, final stress.
        case "tt":
            return createTatar();
        // Latin (Classical, Vox Latina) — Italic; macron length, short-vowel laxing, c→k, v→w, qu→kʷ, x→ks, final -Vm→Ṽː.
        case "la":
            return createLatin();
        // Santali (ᱥᱟᱱᱛᱟᱲᱤ) — Munda (Austroasiatic), the Ol Chiki alphabet; ᱷ aspiration, ᱹ→ə, ᱸ nasal, word-final CHECKED stops.
        case "sat":
            return createSantali();
        // Bashkir (Башҡорт теле) — Kipchak Turkic; interdentals ҫ→θ ҙ→ð, written uvulars ҡ→q ғ→ʁ, vowel shift; Russian loans routed to ru.
        case "ba":
            return createBashkir();
        // Ewe (Eʋegbe) — Gbe (Niger-Congo, Kwa); labial-velars gb/kp, bilabial ƒ→ɸ/ʋ→β, w/ɰ + r/l allophony, toneless.
        case "ee":
            return createEwe();
        // Asturian (asturianu) — Astur-Leonese (Ibero-Romance); x→ʃ, distinción, no final deletion.
        case "ast":
            return createAsturian();
        // Haitian Creole (kreyòl ayisyen) — French-lexified creole; phonemic IPN g2p + nasal-vowel rule.
        case "ht":
            return createHaitian();
        // Rangpuri (KRNB) — Eastern Indo-Aryan, Devanagari; reuses the Hindi abugida engine + a KRNB manifest.
        case "rkt":
            return createRangpuri((latin) => getPhonemizer("en").text(latin));
        // Bavarian (Boarisch) — Upper German (Austro-Bavarian), Latin; greedy scan + falling diphthongs + r-vocalization.
        case "bar":
            return createBavarian();
        // Min Dong / Eastern Min (Fuzhou) — Sinitic, tonal; Bàng-uâ-cê (BUC) → IPA converter (Phase 1: segmental + citation tone).
        case "cdo":
            return createFoochow();
        // Hmong (White Hmong / Hmoob Dawb) — Hmong-Mien, tonal; RPA → IPA (final consonant letter = tone).
        case "hmn":
            return createHmong();
        // Tashelhit / Shilha — Berber (Amazigh), Latin; near-1:1 phonemic grapheme scan + gemination + labialisation.
        case "shi":
            return createTashelhit();
        case "ckb":
            return createCentralKurdish((latin) => getPhonemizer("en").text(latin));
        // Balochi (Southern) — NW Iranian, Balochi Arabic script. Authored (Jahani & Korn); ⛔ (defective vowel
        // encoding: short vowels unwritten + و/ی conflate uː/oː, iː/eː). Fills the retroflex-Iranian census gap.
        case "bal":
            return createBalochi((latin) => getPhonemizer("en").text(latin));
        case "bho":
            return createBhojpuri((latin) => getPhonemizer("en").text(latin));
        // Magahi (Magadhan, Bihar) — BESPOKE (was a mag→bho alias). Shares the Bihari core with Bhojpuri (no vowel
        // length, श/ष→s, ण/ञ→n) but the comparative phonology (Vinod Kumar 2026) documents a Magahi-specific GLIDE
        // HARDENING — word-initial व→[b], य→[d͡ʒ] — that the alias got wrong, so it earns its own module.
        case "mag":
            return createMagahi((latin) => getPhonemizer("en").text(latin));
        // Haryanvi (Bangaru — Western Hindi, Haryana) — ALIAS to the Hindi engine. Haryanvi is segmentally ~Hindi
        // (same 28–30 consonants / 4-way stop contrast); its documented differences (vowel free-variation a~e,
        // a marked retroflexion tendency, intonation) are allophonic/prosodic, NOT a categorical grapheme→IPA
        // delta, and there is NO referee to verify one. So we serve it via `hi` (its nearest verified sibling —
        // Western Hindi) as a labelled approximation. See tools/language-catalogue (served_by='hi').
        case "bgc":
            return createHindi((latin) => getPhonemizer("en").text(latin));
        // Chhattisgarhi (Eastern Hindi) — ⛔ cannot-verify stub on the shared Hindi engine.
        case "hne":
            return createChhattisgarhi((latin) => getPhonemizer("en").text(latin));
        case "za":
            return createZhuang();
        // Awadhi (Eastern Hindi) — Saksena-sourced ⛔ stub on the shared Hindi engine.
        case "awa":
            return createAwadhi((latin) => getPhonemizer("en").text(latin));
        case "mai":
            return createMaithili((latin) => getPhonemizer("en").text(latin));
        case "uk":
            return createUkrainian();
        case "be":
            return createBelarusian();
        case "hy":
            return createArmenian();
        case "ky":
            return createKyrgyz();
        case "nb":
            return createNorwegian();
        case "su":
            return createSundanese();
        case "ne":
            return createNepali((latin) => getPhonemizer("en").text(latin));
        case "nan":
            return createMinnan((latin) => getPhonemizer("en").text(latin));
        case "mn":
            return createMongolian();
        case "umb":
            return createUmbundu();
        case "yo":
            return createYoruba((latin) => getPhonemizer("en").text(latin));
        case "ig":
            return createIgbo((latin) => getPhonemizer("en").text(latin));
        case "my":
            return createBurmese((latin) => getPhonemizer("en").text(latin));
        case "sn":
            return createShona();
        case "rw":
            return createKinyarwanda();
        case "mad":
            return createMadurese();
        case "nya":
            return createChichewa();
        case "ln":
            return createLingala();
        case "km":
            return createKhmer();
        case "tn":
            return createSetswana();
        case "st":
            return createSesotho();
        case "nso":
            return createSepedi();
        case "bm":
            return createBambara();
        case "wo":
            return createWolof();
        case "mos":
            return createMossi();
        case "ki":
            return createKikuyu();
        case "kam":
            return createKamba();
        case "ka":
            return createGeorgian();
        case "lt":
            return createLithuanian();
        // Latvian (latviešu) — Baltic sibling of Lithuanian; written palatals/length + fixed first-syllable stress.
        case "lv":
            return createLatvian();
        case "af":
            return createAfrikaans();
        case "he":
            return createHebrew();
        case "lg":
            return createLuganda();
        case "luo":
            return createLuo();
        case "rn":
            return createKirundi();
        case "ug":
            return createUyghur();
        case "syl":
            return createSylheti();
        case "el":
            return createGreek();
        default:
            throw new Error(
                `vernacula-phonemizer: no phonemizer registered for "${lang}"`,
            );
    }
}
