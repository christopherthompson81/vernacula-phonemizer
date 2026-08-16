/**
 * Language registry: code → canonical-IPA phonemizer. Deliberately tiny and explicit (one row per
 * language), built lazily and cached. No fallback — an unknown language throws.
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
import { createBishnupriya } from "./languages/bishnupriya/bishnupriya.ts";
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
import { createScottishGaelic } from "./languages/scottishgaelic/scottishgaelic.ts";
import { createWelsh } from "./languages/welsh/welsh.ts";
import { createHausa } from "./languages/hausa/hausa.ts";
import { createThai } from "./languages/thai/thai.ts";
import { createLao } from "./languages/lao/lao.ts";
import { createFula } from "./languages/fula/fula.ts";
import { createSinhala } from "./languages/sinhala/sinhala.ts";
import { createKazakh } from "./languages/kazakh/kazakh.ts";
import { createKalaallisut } from "./languages/kalaallisut/kalaallisut.ts";
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
import { createMalay } from "./languages/malay/malay.ts";
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
import { createWestArmenian } from "./languages/westarmenian/westarmenian.ts";
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
import { createFaroese } from "./languages/faroese/faroese.ts";
import { createOccitan } from "./languages/occitan/occitan.ts";
import { createMaori } from "./languages/maori/maori.ts";
import { createHawaiian } from "./languages/hawaiian/hawaiian.ts";
import { createQuechua } from "./languages/quechua/quechua.ts";
import { createTibetan } from "./languages/tibetan/tibetan.ts";
import { createGuarani } from "./languages/guarani/guarani.ts";
import { createAlbanian } from "./languages/albanian/albanian.ts";
import { createTurkmen } from "./languages/turkmen/turkmen.ts";
import { createTatar } from "./languages/tatar/tatar.ts";
import { createTotontepecMixe } from "./languages/totontepecmixe/totontepecmixe.ts";
import { createCherokee } from "./languages/cherokee/cherokee.ts";
import { createLuleSami } from "./languages/lulesami/lulesami.ts";
import { createNahuatl } from "./languages/nahuatl/nahuatl.ts";
import { createSantali } from "./languages/santali/santali.ts";
import { createKichee } from "./languages/kiche/kiche.ts";
import { createBashkir } from "./languages/bashkir/bashkir.ts";
import { createBasque } from "./languages/basque/basque.ts";
import { createKarakalpak } from "./languages/karakalpak/karakalpak.ts";
import { createCrimeanTatar } from "./languages/crimeantatar/crimeantatar.ts";
import { createNogai } from "./languages/nogai/nogai.ts";
import { createPapiamento } from "./languages/papiamento/papiamento.ts";
import { createNama } from "./languages/nama/nama.ts";
import { createAromanian } from "./languages/aromanian/aromanian.ts";
import { createAbkhaz } from "./languages/abkhaz/abkhaz.ts";
import { createChuvash } from "./languages/chuvash/chuvash.ts";
import { createEwe } from "./languages/ewe/ewe.ts";
import { createLatin } from "./languages/latin/latin.ts";
import { createAsturian } from "./languages/asturian/asturian.ts";
import { createAragonese } from "./languages/aragonese/aragonese.ts";
import { createHaitian } from "./languages/haitian/haitian.ts";
import { createRangpuri } from "./languages/rangpuri/rangpuri.ts";
import { createBavarian } from "./languages/bavarian/bavarian.ts";
import { createMinDong } from "./languages/mindong/mindong.ts";
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
import { createLatgalian } from "./languages/latgalian/latgalian.ts";
import { createAfrikaans } from "./languages/afrikaans/afrikaans.ts";
import { createHebrew } from "./languages/hebrew/hebrew.ts";
import { createLuganda } from "./languages/luganda/luganda.ts";
import { createLuo } from "./languages/luo/luo.ts";
import { createKirundi } from "./languages/kirundi/kirundi.ts";
import { createUyghur } from "./languages/uyghur/uyghur.ts";
import { createSylheti } from "./languages/sylheti/sylheti.ts";
import { createGreek } from "./languages/greek/greek.ts";
import { createAncientGreek } from "./languages/ancientgreek/ancientgreek.ts";
import { normalizeRomans, ROMAN_EXCLUSIONS, type RomanPolicy } from "./core/roman.ts";
import { ROMAN_POLICY as romanEs } from "./languages/spanish/romanOrdinals.ts";
import { ROMAN_POLICY as romanEs419 } from "./languages/spanish-419/romanOrdinals.ts";
import { ROMAN_POLICY as romanPt } from "./languages/portuguese/romanOrdinals.ts";
import { ROMAN_POLICY as romanPtBr } from "./languages/portuguese-br/romanOrdinals.ts";
import { ROMAN_POLICY as romanIt } from "./languages/italian/romanOrdinals.ts";
import { ROMAN_POLICY as romanRo } from "./languages/romanian/romanOrdinals.ts";
import { ROMAN_POLICY as romanCa } from "./languages/catalan/romanOrdinals.ts";
import { ROMAN_POLICY as romanRu } from "./languages/russian/romanOrdinals.ts";
import { ROMAN_POLICY as romanPl } from "./languages/polish/romanOrdinals.ts";
import { ROMAN_POLICY as romanUk } from "./languages/ukrainian/romanOrdinals.ts";
import { ROMAN_POLICY as romanBe } from "./languages/belarusian/romanOrdinals.ts";
import { ROMAN_POLICY as romanBa } from "./languages/bashkir/romanOrdinals.ts";
import { ROMAN_POLICY as romanHu } from "./languages/hungarian/romanOrdinals.ts";
import { ROMAN_POLICY as romanAz } from "./languages/azerbaijani/romanOrdinals.ts";
import { ROMAN_POLICY as romanKk } from "./languages/kazakh/romanOrdinals.ts";
import { ROMAN_POLICY as romanUz } from "./languages/uzbek/romanOrdinals.ts";

import { setDefaultForeign, setScriptReader, withHost } from "./core/foreign.ts";
import { CYRILLIC_HOSTS, readerFor } from "./core/scripts.ts";
import { stripMarkup } from "./core/markup.ts";
import { foldCaretExponents, foldCyrillicConfusables, foldCyrillicStressMarks, foldFullwidthLatin, foldLatinConfusables, foldNativeDigits, foldSquaredDegrees, foldVulgarFractions, repairDoubleEncoded } from "./core/unicode.ts";

export interface Phonemizer {
    /** Full text → canonical IPA. */
    text(input: string): string;
}


/**
 * Per-language ROMAN NUMERAL policy: how this language reads a Roman numeral, including whether a
 * century is a cardinal or an ordinal. The data lives in each language's own directory (so it can build
 * on that language's cardinal compositor) and is assembled here because the pass runs ABOVE the engines.
 *
 * Only the languages where Roman numerals measurably occur are wired — evidence from the FLEURS corpora,
 * which is also why es/pt/ca supply an ordinal for anniversaries but leave CENTURIES cardinal, the
 * reading those languages actually use.
 */
const ROMAN_POLICIES: Readonly<Record<string, RomanPolicy>> = {
    es: romanEs, "es-419": romanEs419, pt: romanPt, "pt-BR": romanPtBr,
    it: romanIt, ro: romanRo, ca: romanCa,
    ru: romanRu, pl: romanPl, uk: romanUk, be: romanBe, hu: romanHu,
    az: romanAz, kk: romanKk, uz: romanUz, ba: romanBa,
};

// Embedded FOREIGN runs (a brand name, acronym or code-switched phrase in a script the engine does not
// own) are read as English — the same choice the engines that already handle Latin make. Registered
// here rather than imported by core/, so core keeps its no-dependency position. Without this, the 47
// engines whose tokenizer matches only their own script DROP such text silently (core/foreign.ts).
setDefaultForeign((text) => getPhonemizer("en").text(text));

// SCRIPT ROUTING (core/scripts.ts). The line above reads every foreign run as ENGLISH, which is correct
// for Latin and wrong for every other script — and in practice a non-Latin run never reached it at all,
// because `emitUnclaimed` surfaced only Latin. So `Ο Πούτιν και ο Владимир` read as "o putin ce o" with
// the Cyrillic silently gone. The router picks a reader from the run's SCRIPT, with the host language's
// own overrides applied (a Han run inside Japanese is Japanese, not Mandarin).
setScriptReader((run, host) => {
    // `text` is the run itself except for the LONE GREEK LETTER, which core/scripts.ts rewrites to its
    // Greek-spelled NAME (⟨α⟩ → «άλφα») — the run used to be declined here, and a declined run is deleted.
    const routed = readerFor(run, host);
    if (routed === undefined) return undefined;
    const { target, text } = routed;
    try {
        return getPhonemizer(target).text(text);
    } catch {
        // An unbuilt or unknown target must not take the whole utterance down; declining here falls back
        // to the Latin-to-English path, which is what happened before this existed.
        return undefined;
    }
});

/** Languages whose own script has a digit that is not always a digit; they fold inside normalize.ts. */
const FOLD_OPT_OUT: ReadonlySet<string> = new Set(["te"]);

/** Languages whose own normalization already reads the VULGAR FRACTIONS, and reads them BETTER than the fold
 *  can — with the "and" that joins a mixed number. ca says *vint-i-nou I tres quarts* and mk *…ˈи три
 *  четврт…*; the fold, which only rewrites `¾` to ` 3/4`, drops that conjunction because supplying it needs a
 *  per-language word in a per-language position. Measured over the artifacts: 36 languages carry a vulgar
 *  fraction, 27 DROP it and these 9 already handle it, so the fold is for the 27 and must not pre-empt the 9.
 *  Found by the test suite — ca's and mk's fraction tests failed on the missing conjunction, which is exactly
 *  the regression an opt-out exists to prevent. */
const VULGAR_FOLD_OPT_OUT: ReadonlySet<string> = new Set(["az", "ca", "el", "ga", "hr", "kn", "mk", "te", "uz"]);

const cache = new Map<string, Phonemizer>();

/** The UNWRAPPED `text` of each built engine — the function the pre-passes are wrapped around, keyed by the
 *  code it was built for. Populated when `getPhonemizer` installs the shadow; read by `renderInHost` for the
 *  one caller that has already run the pre-passes itself (see there). */
const unwrapped = new Map<string, (input: string) => string>();

/** Languages whose own normalization already resolves Roman numerals, with more context than a shared
 *  pass can have — English distinguishes regnal ("henry viii" → the eighth) from cardinal ("world war
 *  ii" → two); French reads the ordinal `XIVe`. The shared pass must not pre-empt them. */
const ROMAN_NATIVE: ReadonlySet<string> = new Set(["en", "en-GB", "en-IN", "fr", "fr-CA"]);

/** Shared ROMAN NUMERAL pass (core/roman.ts), applied at the single dispatch point rather than in 190
 *  engines — and BEFORE the engine's tokenizer, which is what lets it work in the engines that drop Latin
 *  runs (`XIX век` would otherwise lose the numeral). It rewrites to DIGITS, so each language's own cardinal
 *  compositor does the pronouncing. A no-op for the languages that read Roman numerals themselves. */
function romanPass(lang: string, input: string): string {
    if (ROMAN_NATIVE.has(lang)) return input;
    // A language's own policy wins; otherwise it still gets its homograph exclusions.
    const policy: RomanPolicy = ROMAN_POLICIES[lang] ?? { exclude: ROMAN_EXCLUSIONS[lang] };
    return normalizeRomans(input, policy);
}

/**
 * The shared CHARACTER-LEVEL pre-passes, in order. Runs AFTER `romanPass` — see `prePass`.
 *
 * MARKUP first, and for EVERY language including the ROMAN_NATIVE ones: a tag is not text in any of them.
 * Without it `km<sup>2</sup>` was spoken as "sup … sup" (core/markup.ts).
 *
 * NATIVE DIGITS ARE FOLDED FOR EVERY LANGUAGE, at the single dispatch point.
 *
 * A digit is script-MARKED but language-NEUTRAL in value, and that is what separates it from a letter. A
 * Cyrillic word inside English text is Russian and wants the script router; `٢٠٢٤` inside English text is
 * just 2024, and an English reader says "twenty twenty-four" — routing it to Arabic would be wrong.
 *
 * Two defects this closes at once. Embedded foreign digits were DROPPED everywhere: the gap pass surfaces
 * runs of `\p{L}`, so a digit run matched nothing and the router never saw it — `phonemize("Year ٢٠٢٤",
 * "en")` was "jˈɪɹ". And seven engines read their OWN digits as an empty string (sd ug ps bal syl rkt shn),
 * because a raw block range in the tokenizer's LETTER class swallowed them — the Central Kurdish defect,
 * which no gate could see because a claimed-but-empty token leaves no gap.
 *
 * Per-language folds already in twelve normalize.ts files stay: folding is idempotent, and they document the
 * reason locally where the corpus proved it.
 * ⚠ A NATIVE DIGIT IS NOT ALWAYS A DIGIT. Telugu ౦ (DIGIT ZERO) is a homoglyph for the anusvara ం and is a
 * typo for it in all 144 corpus instances; folding it to "0" globally would pre-empt the language's own
 * disambiguation, which uses context the registry does not have. Such a language opts out and folds inside
 * its own normalize.ts, AFTER the homoglyph rule — see telugu/normalize.ts.
 * ℃/℉ ARE FOLDED FOR EVERY LANGUAGE TOO, and unconditionally — there is no opt-out list because there is no
 * language for which `℃` means something other than `°C`. 52 of the 65 languages with an artifact already
 * read `°C` and dropped `℃` entirely, losing the unit and not merely the sign; the 13 that handled both had
 * written the arm out by hand, and folding is idempotent so they are unaffected. See `foldSquaredDegrees`
 * for why the list stops at two characters instead of being NFKC.
 * DOUBLE-ENCODED UTF-8 IS REPAIRED FIRST, before anything reads a character: mojibake is the one corruption
 * that makes every downstream guard misfire, because the injected `Â` and `Ã` are LETTERS. `19.500 kmÂ²`
 * lost its whole unit that way — the tier's trailing guard saw a letter after `km` and refused the match.
 * Measured safe across all 67 corpora (31 occurrences, all in id_id, none elsewhere); see
 * `repairDoubleEncoded`.
 * `foldLatinConfusables` sits with the other repairs, and AFTER the mojibake decode: a double-encoded
 * sequence can produce Latin-1 letters, so the confusable check wants the decoded string.
 * THE CYRILLIC STRESS MARK IS FOLDED LAST, and after the Cyrillic confusable fold on purpose: the confusable
 * pass rewrites a Latin look-alike inside a Cyrillic word to its Cyrillic letter, so running this one first
 * would leave the annotation sitting on a Latin `a` and miss it. It is applied for EVERY language rather than
 * for `CYRILLIC_HOSTS`, because the discriminator is the BASE CHARACTER — a Cyrillic quotation inside a
 * non-Cyrillic article splits exactly the same way, and the fold makes no claim about a Latin or Greek base.
 * Measured across all 162 mined artifacts before shipping: it moves the reading of 14 languages, in every case
 * by rejoining a word the annotation had split, and is byte-identical for the other 148. See
 * `foldCyrillicStressMarks`.
 */
function foldPass(lang: string, input: string): string {
    const folded = foldCyrillicStressMarks(foldCaretExponents(foldLatinConfusables(foldCyrillicConfusables(foldFullwidthLatin(foldSquaredDegrees(repairDoubleEncoded(stripMarkup(input)))), CYRILLIC_HOSTS.has(lang)))));
    const pre = VULGAR_FOLD_OPT_OUT.has(lang) ? folded : foldVulgarFractions(folded);
    return FOLD_OPT_OUT.has(lang) ? pre : foldNativeDigits(pre);
}

/**
 * EVERY shared pre-pass `getPhonemizer` applies, as one function — the whole of what an engine's `text` sees
 * before its own tokenizer does.
 *
 * ⚠ EXPORTED FOR THE ASYNC PATH. `phonemizeAsync` dispatches through `neuralRegistry.ts`, whose entries build
 * their engine directly (they need constructor arguments the registry's instance does not carry — Khmer's
 * `segment: false`, Arabic's variety, and the `oovOverride` extra argument the shadow below would drop). So
 * they never reach the shadow, and every pre-pass silently did not run for them: `phonemizeAsync("سال ۲۰۲۴
 * ۾", "sd")` lost its own script's digits outright. `getNeuralPhonemizer` calls this on the input instead, so
 * there is ONE definition of the chain and the opt-out lists (`te`'s digit fold above all) cannot drift
 * between the two entry points.
 *
 * ⚠ ROMANS OUTERMOST — before markup stripping, matching the layering in `getPhonemizer`. Not
 * interchangeable: `stripMarkup` decodes entities, so running it first would let `&amp;lt;` become a real
 * `<` for the numeral scan.
 */
export function prePass(lang: string, input: string): string {
    return foldPass(lang, romanPass(lang, input));
}

/**
 * Render `input` with `lang`'s engine and `lang` as the foreign-run host, WITHOUT re-running `prePass`.
 *
 * For a caller that has already pre-passed — the async entries, which pre-pass once at
 * `getNeuralPhonemizer` before their tagger sees the text. Going back through `getPhonemizer(lang).text`
 * would apply the chain a SECOND time, and it is not idempotent: `stripMarkup` decodes entities, so a
 * doubly-escaped `&amp;lt;` — an author writing ABOUT a tag, the exact case core/markup.ts orders its passes
 * to protect — would decode to `<` on the first pass and be stripped as markup on the second.
 */
export function renderInHost(lang: string, input: string): string {
    getPhonemizer(lang); // builds and installs, populating `unwrapped`
    const engine = unwrapped.get(lang);
    if (engine === undefined) throw new Error(`no engine for language: ${lang}`);
    return withHost(lang, () => engine(input));
}

/** Get (and memoize) the phonemizer for a language code. */
export function getPhonemizer(lang: string): Phonemizer {
    let p = cache.get(lang);
    if (p === undefined) {
        p = build(lang);
        // The shared PRE-PASSES (`prePass` above) run here, at the single dispatch point, before the
        // engine's own tokenizer sees a character.
        //
        // This SHADOWS `text` on the engine instance rather than wrapping it in a fresh `{ text }` object,
        // because some engines expose more than the interface — the registry itself casts the English
        // phonemizer to reach `knownWord` for Naija — and a wrapper object silently drops those members.
        // Binding the original keeps private state resolving against the real instance.
        {
            const engine = p;
            const original = engine.text.bind(engine);
            unwrapped.set(lang, original);
            (engine as { text: (input: string) => string }).text = (input) =>
                // The host language has to be known while the engine runs, because a foreign run is
                // resolved DURING tokenization, deep inside `emitUnclaimed`. A stack, since reading a
                // foreign run re-enters this same wrapper for another language.
                withHost(lang, () => original(foldPass(lang, input)));
        }
        if (!ROMAN_NATIVE.has(lang)) {
            // Roman numerals OUTSIDE the shadow, so they are rewritten to digits before markup stripping —
            // see `prePass`, which reproduces this layering for the async path.
            const engine = p;
            p = { text: (input) => engine.text(romanPass(lang, input)) };
        }
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
            return createVietnamese((latin) => getPhonemizer("en").text(latin));
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
        case "gd":
            return createScottishGaelic();
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
        case "kl":
            return createKalaallisut();
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
        case "bpy":
            return createBishnupriya((latin) => getPhonemizer("en").text(latin));
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
            return createIndonesian((latin) => getPhonemizer("en").text(latin));
        // Standard Malay (Malaysian/Bruneian) — ALIAS to the Indonesian engine as a labelled approximation. Malay and
        // Indonesian are mutually intelligible standardisations of the same Malayic language, sharing the reformed
        // Latin orthography and largely the same grapheme→IPA phonology. There is no independent Malay referee wired,
        // and the documented differences (Malaysian final open ⟨a⟩ leaning to [ə], some vowel realisations) are
        // accent-level, not a categorical grapheme→IPA delta — so `id` is its nearest verified sibling. First-class
        // code, transparent that no Malay-specific phonology is claimed. See tools/language-catalogue (served_by='id').
        // the PHONOLOGY is still Indonesian's — createMalay wraps createIndonesian — but the two standards'
        // orthographic conventions differ (Malay groups thousands with a comma and writes the decimal dot, the exact
        // inverse of Indonesian), so Malay owns its own text-normalization pre-pass. See languages/malay/normalize.ts.
        // `ms` IS THE SAME LANGUAGE, and its absence was a live gap rather than a policy: `zsm` is the ISO 639-3
        // code for Standard Malay, `ms` the ISO 639-1 two-letter one, and `ms` is what nearly every caller and
        // dataset writes — including this repo's own `tools/corpus/mined/ms.jsonc`, whose `source` reads
        // "FLEURS ms_my". So the artifact was filed under a code the registry threw on, and a fleet sweep that
        // iterated the artifacts reported Malay as unreachable while `zsm` had been working the whole time.
        case "ms":
        case "zsm":
            return createMalay((latin) => getPhonemizer("en").text(latin));
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
            // ⚠ A FOREIGN READER IS NEEDED AFTER ALL, and the old comment's reasoning was the trap: being
            // Latin-script is exactly what made this necessary, not what made it unnecessary. Oromo's word group
            // claims Latin text, so an accented foreign NAME was claimed and then mangled by a g2p with no rule
            // for the letter — `São Paulo` read *s ˈə ˈo paˈulo*.
            return createOromo((latin) => getPhonemizer("en").text(latin));
        case "pl":
            return createPolish();
        case "sd":
            return createSindhi((latin) => getPhonemizer("en").text(latin));
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
        // ⚠ NO FOREIGN READER, AND THE ABSENCE IS THE DECISION. This case read
        // `createAkan((latin) => getPhonemizer("en").text(latin))` and `createAkan` never referenced the
        // argument — wiring with no routing behind it. Akan IS written in Latin, so its tokenizer claims
        // every Latin run and NATIVISES it; there is no unclaimed-run seam for a reader to sit in, and
        // handing one in would need a discriminator ("is this word Akan?") that no lexicon in this repo can
        // answer. Reading `February` as *ˈfɛbɹuɛɹi* instead of *febrwarj* would not be a fix either: the
        // normalize.ts header makes the point that an English reader lets a defect hide as a plausible
        // English word rather than showing up as visible gibberish. Fleet: 45 cases here hand a factory a
        // reader; 9 of those factories never invoke it (this one, plus am bal ckb ig my nan ti yo, which
        // store it in a field and never read it — their embedded Latin is served by `setDefaultForeign`
        // above). Only `ak` is fixed here; the other eight are engines this change does not own.
        case "ak":
            return createAkan();
        case "jv":
            return createJavanese();
        case "sw":
            return createSwahili();
        case "gu":
            return createGujarati((latin) => getPhonemizer("en").text(latin));
        // ⚠ `ps`/`pus` IS A MACROLANGUAGE AND THIS ENGINE IS ONE OF ITS MEMBERS. ISO 639-3 `pus` covers pbt
        // (Southern/Kandahari), pbu (Northern/Peshawar) and pst (Central/Waziri), and pashto.ts implements
        // exactly one: "Dialect: ښ/ږ = Kandahari retroflex ʂ/ʐ". `pbt` is therefore the accurate code and is
        // added here; `ps` keeps resolving because it is what callers type, as a labelled approximation for
        // the umbrella — the same shape as `ms`/`zsm` above. The catalogue records the distinction (ps is an
        // unimplemented macrolanguage umbrella; pbt carries the verdict), because the phoneme question is
        // not answerable at umbrella level: the referees list Northern x/ɡ and Southern ʂ/ʐ for the same
        // orthography and no single engine can be right for both.
        case "ps":
        case "pbt":
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
        case "fo":
            return createFaroese();
        case "is":
            return createIcelandic();
        // Occitan (lenga d'òc) — Occitano-Romance; Languedocien g2p (o→u, final-a→ɔ).
        case "oc":
            return createOccitan();
        // Māori (te reo Māori) — Eastern Polynesian; a near-1:1 phonemic g2p (macron length, wh→ɸ, ng→ŋ).
        case "haw":
            return createHawaiian();
        case "mi":
            return createMaori((latin) => getPhonemizer("en").text(latin));
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
        case "mto":
            return createTotontepecMixe();
        // Cherokee (ᏣᎳᎩ ᎦᏬᏂᎯᏍᏗ) — Iroquoian, the Cherokee syllabary; deterministic 85-char CV lookup, phonemically voiceless obstruents (aspiration-not-voicing), ⟨v⟩→ə̃; tone/length/aspiration/glottal unwritten (folded).
        case "chr":
            return createCherokee();
        // Lule Sami (julevsámegiella) — Uralic (Saami); transparent segmental scan, North-Saami-style VOICELESS ⟨b d g⟩→[p t k], ⟨sj tj⟩→ʃ/t͡ʃ, diphthongs ie/uo/oa; first-syllable stress; morphophonology deferred.
        case "smj":
            return createLuleSami();
        // Classical Nahuatl (nāhuatlahtōlli) — Uto-Aztecan; position-aware scan of the Spanish-based orthography: ⟨c⟩→k/s, ⟨cu/uc⟩→kʷ, ⟨hu/uh⟩→w, saltillo ⟨h⟩→ʔ, ⟨tz tl ch⟩ affricates, the ⟨chu⟩=kw trap; length unwritten.
        case "nci":
            return createNahuatl();
        case "nog":
            return createNogai();
        // Latin (Classical, Vox Latina) — Italic; macron length, short-vowel laxing, c→k, v→w, qu→kʷ, x→ks, final -Vm→Ṽː.
        case "la":
            return createLatin();
        // Santali (ᱥᱟᱱᱛᱟᱲᱤ) — Munda (Austroasiatic), the Ol Chiki alphabet; ᱷ aspiration, ᱹ→ə, ᱸ nasal, word-final CHECKED stops.
        case "sat":
            return createSantali();
        // K'iche' (Qatzijob'al) — Mayan; ejective series b'→ɓ k'/q'/tz'/ch', aspirated plain stops, x→ʃ j→x.
        case "quc":
            return createKichee();
        // Bashkir (Башҡорт теле) — Kipchak Turkic; interdentals ҫ→θ ҙ→ð, written uvulars ҡ→q ғ→ʁ, vowel shift; Russian loans routed to ru.
        case "ba":
            return createBashkir();
        // Basque (euskara) — a LANGUAGE ISOLATE; the three-way sibilant/affricate system ⟨z s x⟩→[s̻ s̺ ʃ], ⟨tz ts tx⟩→[t͡s̻ t͡s̺ t͡ʃ]; r tap/trill.
        case "eu":
            return createBasque();
        // Karakalpak (qaraqalpaq tili) — Kipchak Turkic (close to Kazakh), 2016 Latin; written uvulars q/x/ǵ, front acute vowels á ó ú, ı→ɯ, final stress.
        case "kaa":
            return createKarakalpak();
        // Crimean Tatar (qırımtatar tili) — Kipchak+Oghuz Turkic, Turkish-based Latin; written uvular q/ğ, front-back harmony, c→d͡ʒ, ñ→ŋ, final stress.
        case "crh":
            return createCrimeanTatar();
        // Papiamentu (pap) — Iberian-lexified creole of the ABC islands; coda-n vowel nasalization, digraphs ch/sh/dj, open vowels è ò ù.
        case "pap":
            return createPapiamento();
        // Nama (Khoekhoe) — Khoe-Kwadi; the fleet.s FIRST CLICK language: 4 click types ǀ ǁ ǂ ǃ × accompaniments (bare/g/kh/h/n).
        case "naq":
            return createNama();
        // Aromanian (armãneashti) — Eastern/Balkan Romance, sibling of Romanian; digraphs ts/dz/sh/nj/lj, dh/th interdentals, ã→ə.
        case "rup":
            return createAromanian();
        // Abkhaz (аҧсуа) — NW Caucasian; huge consonant inventory (labialized/palatalized/ejective/pharyngealized), 2 vowels.
        case "ab":
            return createAbkhaz();
        // Chuvash (Чӑвашла) — the sole surviving Oghur Turkic; allophonic intervocalic/post-nasal voicing, geminate-blocking, reduced-vowel ⟨ӑ ӗ⟩ stress.
        case "chv":
            return createChuvash();
        // Ewe (Eʋegbe) — Gbe (Niger-Congo, Kwa); labial-velars gb/kp, bilabial ƒ→ɸ/ʋ→β, w/ɰ + r/l allophony, toneless.
        case "ee":
            return createEwe();
        // Asturian (asturianu) — Astur-Leonese (Ibero-Romance); x→ʃ, distinción, no final deletion.
        case "an":
            return createAragonese();
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
        // Min Dong / Eastern Min (Fuzhou) — Sinitic, tonal; Bàng-uâ-cê (BUC) → IPA converter; segmental + citation tone.
        case "cdo":
            return createMinDong();
        // Hmong (White Hmong / Hmoob Dawb) — Hmong-Mien, tonal; RPA → IPA (final consonant letter = tone).
        case "hmn":
            return createHmong();
        // Tashelhit / Shilha — Berber (Amazigh), Latin; near-1:1 phonemic grapheme scan + gemination + labialisation.
        case "shi":
            return createTashelhit();
        case "ckb":
            return createCentralKurdish((latin) => getPhonemizer("en").text(latin));
        // Balochi (Southern) — NW Iranian, Balochi Arabic script. Authored (Jahani & Korn). ⚠ THE ORTHOGRAPHY IS
        // DEFECTIVE for this purpose: short vowels are unwritten and و/ی each conflate two long vowels
        // (uː/oː, iː/eː), so those distinctions are not recoverable from the spelling. Fills the retroflex-Iranian census gap.
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
        // NORMALIZER WORDS: no source exists. bgc.wikipedia does not exist, and there is no FLEURS corpus,
        // artifact or referee — every tier of the haystack is empty.
        // Hindi's inherited percent/clock/era words are therefore the only available answer, which is
        // consistent with this being a labelled approximation served via `hi` in the first place. Recorded so
        // nobody re-investigates a settled refusal; a KRNB-style divergence check would need a Haryanvi source.
        case "bgc":
            return createHindi((latin) => getPhonemizer("en").text(latin));
        // Chhattisgarhi (Eastern Hindi) — ⚠ an unverified stub on the shared Hindi engine.
        case "hne":
            return createChhattisgarhi((latin) => getPhonemizer("en").text(latin));
        case "za":
            return createZhuang();
        // Awadhi (Eastern Hindi) — a Saksena-sourced ⚠ unverified stub on the shared Hindi engine.
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
        // Western Armenian (արեւմտահայերէն) — the Istanbul/diaspora standard; the CONSONANT SHIFT (classical voiced/aspirate ⟨բ դ գ⟩→pʰ tʰ kʰ, classical voiceless ⟨պ տ կ⟩→b d ɡ).
        case "hyw":
            return createWestArmenian();
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
        // Latgalian (latgaļu volūda) — Eastern Baltic, sibling of Latvian; ⟨i⟩/⟨y⟩ soft/hard palatalization, ⟨y⟩→ɨ.
        case "ltg":
            return createLatgalian();
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
        case "grc":
            return createAncientGreek();
        default:
            throw new Error(
                `vernacula-phonemizer: no phonemizer registered for "${lang}"`,
            );
    }
}
