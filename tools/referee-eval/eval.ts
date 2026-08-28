/**
 * Referee eval — validate a vernacula phonemizer's SEGMENTAL BACKBONE against INDEPENDENT referees (epitran /
 * wikipron). Bootstrap parity is only a regression guard; this measures linguistic
 * corroboration. Per referee it reports raw + folded agreement and the top residual divergences — the folded
 * residual is the linguistic signal to adjudicate against published phonology (referees are fallible; a
 * divergence is a candidate, not a verdict). See config.ts for the per-language fold justifications.
 *
 * Usage:  npx tsx tools/referee-eval/eval.ts <zu|si|kk> [--examples N]
 */
import { existsSync, readFileSync } from "node:fs";
import { phonemizeAsync } from "../../src/index.ts";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { phonemizeArabic as ar } from "../../src/languages/arabic/arabic.ts";
import { phonemizeWord as ca } from "../../src/languages/catalan/catalan.ts";
import { phonemizeWord as gl } from "../../src/languages/galician/galician.ts";
import { phonemizeWord as sl } from "../../src/languages/slovenian/slovenian.ts";
import { phonemizeWord as lv } from "../../src/languages/latvian/latvian.ts";
import { phonemizeWord as ltg } from "../../src/languages/latgalian/latgalian.ts";
import { phonemizeWord as mk } from "../../src/languages/macedonian/macedonian.ts";
import { phonemizeWord as et } from "../../src/languages/estonian/estonian.ts";
import { phonemizeWord as kea } from "../../src/languages/kabuverdianu/kabuverdianu.ts";
import { phonemizeWord as mt } from "../../src/languages/maltese/maltese.ts";
import { phonemizeWord as lb } from "../../src/languages/luxembourgish/luxembourgish.ts";
import { phonemizeWord as is } from "../../src/languages/icelandic/icelandic.ts";
import { phonemizeWord as fo } from "../../src/languages/faroese/faroese.ts";
import { phonemizeWord as oc } from "../../src/languages/occitan/occitan.ts";
import { phonemizeWord as mi } from "../../src/languages/maori/maori.ts";
import { phonemizeWord as haw } from "../../src/languages/hawaiian/hawaiian.ts";
import { phonemizeWord as qu } from "../../src/languages/quechua/quechua.ts";
import { phonemizeWord as bo } from "../../src/languages/tibetan/tibetan.ts";
import { phonemizeWord as gn } from "../../src/languages/guarani/guarani.ts";
import { phonemizeWord as sq } from "../../src/languages/albanian/albanian.ts";
import { phonemizeWord as tk } from "../../src/languages/turkmen/turkmen.ts";
import { phonemizeWord as tt } from "../../src/languages/tatar/tatar.ts";
import { phonemizeWord as mto } from "../../src/languages/totontepecmixe/totontepecmixe.ts";
import { phonemizeWord as chr } from "../../src/languages/cherokee/cherokee.ts";
import { phonemizeWord as smj } from "../../src/languages/lulesami/lulesami.ts";
import { phonemizeWord as nci } from "../../src/languages/nahuatl/nahuatl.ts";
import { phonemizeWord as nog } from "../../src/languages/nogai/nogai.ts";
import { phonemizeWord as sat } from "../../src/languages/santali/santali.ts";
import { phonemizeWord as quc } from "../../src/languages/kiche/kiche.ts";
import { phonemizeWord as ba } from "../../src/languages/bashkir/bashkir.ts";
import { phonemizeWord as eu } from "../../src/languages/basque/basque.ts";
import { phonemizeWord as kaa } from "../../src/languages/karakalpak/karakalpak.ts";
import { phonemizeWord as crh } from "../../src/languages/crimeantatar/crimeantatar.ts";
import { phonemizeWord as pap } from "../../src/languages/papiamento/papiamento.ts";
import { phonemizeWord as naq } from "../../src/languages/nama/nama.ts";
import { phonemizeWord as rup } from "../../src/languages/aromanian/aromanian.ts";
import { phonemizeWord as ab } from "../../src/languages/abkhaz/abkhaz.ts";
import { phonemizeWord as chv } from "../../src/languages/chuvash/chuvash.ts";
import { phonemizeWord as ee } from "../../src/languages/ewe/ewe.ts";
import { phonemizeWord as shn } from "../../src/languages/shan/shan.ts";
import { phonemizeWord as la } from "../../src/languages/latin/latin.ts";
import { phonemizeWord as ast } from "../../src/languages/asturian/asturian.ts";
import { phonemizeWord as an } from "../../src/languages/aragonese/aragonese.ts";
import { phonemizeWord as ht } from "../../src/languages/haitian/haitian.ts";
import { phonemizeWord as rkt } from "../../src/languages/rangpuri/rangpuri.ts";
import { phonemizeWord as bar } from "../../src/languages/bavarian/bavarian.ts";
import { phonemizeWord as cdo } from "../../src/languages/mindong/mindong.ts";
import { phonemizeWord as hmn } from "../../src/languages/hmong/hmong.ts";
import { phonemizeWord as shi } from "../../src/languages/tashelhit/tashelhit.ts";
import { createEnglish } from "../../src/languages/english/english.ts";
// RULE-ONLY for en-GB: the shipped phonemizeWord applies BATH/CLOTH/yod/PALM lexical-set word lists MINED FROM
// this wikipron UK referee, so evaluating it against the referee would be circular. phonemizeWordRules is the
// GenAm-engine + rule-delta signal (no lexical sets) → the honest, non-circular accent-transform number.
import { phonemizeWordRules as engb } from "../../src/languages/english-gb/english-gb.ts";
import { phonemizeWord as ff } from "../../src/languages/fula/fula.ts";
import { phonemizeWord as ha } from "../../src/languages/hausa/hausa.ts";
import { createHindi } from "../../src/languages/hindi/hindi.ts";
import { phonemizeWord as bho } from "../../src/languages/bhojpuri/bhojpuri.ts";
import { phonemizeWord as awa } from "../../src/languages/awadhi/awadhi.ts";
import { phonemizeWord as tg } from "../../src/languages/tajik/tajik.ts";
import { phonemizeWord as ja } from "../../src/languages/japanese/japanese.ts";
import { phonemizeWord as ko } from "../../src/languages/korean/korean.ts";
import { createPinyinPhonemizer } from "../../src/languages/mandarin/mandarin.ts";
import { phonemizeWord as cs } from "../../src/languages/czech/czech.ts";
import { phonemizeWord as cy } from "../../src/languages/welsh/welsh.ts";
import { phonemizeWord as de } from "../../src/languages/german/german.ts";
import { phonemizeWord as nl } from "../../src/languages/dutch/dutch.ts";
import { phonemizeWord as az } from "../../src/languages/azerbaijani/azerbaijani.ts";
import { phonemizeWord as mg } from "../../src/languages/malagasy/malagasy.ts";
import { phonemizeWord as as_ } from "../../src/languages/assamese/assamese.ts";
import { phonemizeWord as bpy } from "../../src/languages/bishnupriya/bishnupriya.ts";
import { phonemizeWord as so } from "../../src/languages/somali/somali.ts";
import { phonemizeWord as ceb } from "../../src/languages/cebuano/cebuano.ts";
import { phonemizeWord as hil } from "../../src/languages/hiligaynon/hiligaynon.ts";
import { phonemizeWordRules as ilo } from "../../src/languages/ilocano/ilocano.ts"; // RULE-ONLY: the shipped phonemizeWord consults a referee-derived lexicon → eval on rules only to stay non-circular
import { phonemizeWord as xh } from "../../src/languages/xhosa/xhosa.ts";
import { foreignLetters as srFold, phonemizeWord as srWord } from "../../src/languages/serbian/serbian.ts";
import { phonemizeWord as hu } from "../../src/languages/hungarian/hungarian.ts";
import { phonemizeWord as kmr } from "../../src/languages/kurmanji/kurmanji.ts";
import { phonemizeWord as za } from "../../src/languages/zhuang/zhuang.ts";
import { phonemizeWord as sn } from "../../src/languages/shona/shona.ts";
import { phonemizeWord as rw } from "../../src/languages/kinyarwanda/kinyarwanda.ts";
import { phonemizeWord as mad } from "../../src/languages/madurese/madurese.ts";
import { phonemizeWord as nya } from "../../src/languages/chichewa/chichewa.ts";
import { phonemizeWord as ln } from "../../src/languages/lingala/lingala.ts";
// RULE-ONLY for km: the shipped phonemizeWord consults an exceptions lexicon MINED FROM this wikipron referee
// (the Huffman-lexical residual — inherent-vowel length, internal doubling, Pali vowels), so evaluating it here
// would be circular. phonemizeWordRules is the non-circular signal (mirrors en-GB).
import { phonemizeWordRules as km } from "../../src/languages/khmer/khmer.ts";
import { phonemizeWord as tn } from "../../src/languages/setswana/setswana.ts";
import { phonemizeWord as bm } from "../../src/languages/bambara/bambara.ts";
import { phonemizeWord as wo } from "../../src/languages/wolof/wolof.ts";
import { phonemizeWord as mos } from "../../src/languages/mossi/mossi.ts";
import { phonemizeWord as ki } from "../../src/languages/kikuyu/kikuyu.ts";
import { phonemizeWord as kam } from "../../src/languages/kamba/kamba.ts";
import { phonemizeWord as ka } from "../../src/languages/georgian/georgian.ts";
import { phonemizeWord as lt } from "../../src/languages/lithuanian/lithuanian.ts";
import { phonemizeWord as luo } from "../../src/languages/luo/luo.ts";
// RULE-ONLY: the shipped phonemizeWord consults af-lexicon.tsv, which is built FROM this referee (af is
// single-source), so scoring it would be circular. phonemizeWordRules is the honest generative signal.
import { phonemizeWordRules as af } from "../../src/languages/afrikaans/afrikaans.ts";
import { phonemizeWord as fi } from "../../src/languages/finnish/finnish.ts";
import { phonemizeWord as sk } from "../../src/languages/slovak/slovak.ts";
import { phonemizeWord as be } from "../../src/languages/belarusian/belarusian.ts";
import { phonemizeWord as hy } from "../../src/languages/armenian/armenian.ts";
import { phonemizeWord as hyw } from "../../src/languages/westarmenian/westarmenian.ts";
import { phonemizeWord as ky } from "../../src/languages/kyrgyz/kyrgyz.ts";
import { phonemizeWordRules as nb } from "../../src/languages/norwegian/norwegian.ts";
import { phonemizeWord as he } from "../../src/languages/hebrew/hebrew.ts";
import { phonemizeWord as lg } from "../../src/languages/luganda/luganda.ts";
import { phonemizeWord as rn } from "../../src/languages/kirundi/kirundi.ts";
import { phonemizeWord as ug } from "../../src/languages/uyghur/uyghur.ts";
import { phonemizeWord as syl } from "../../src/languages/sylheti/sylheti.ts";
import { phonemizeWordRules as el } from "../../src/languages/greek/greek.ts";
import { phonemizeWord as grc } from "../../src/languages/ancientgreek/ancientgreek.ts";
import { phonemizeWord as es } from "../../src/languages/spanish/spanish.ts";
import { phonemizeWord as es419 } from "../../src/languages/spanish-419/spanish-419.ts";
import { phonemizeWord as fr } from "../../src/languages/french/french.ts";
import { phonemizeWord as ga } from "../../src/languages/irish/irish.ts";
import { phonemizeWord as gd } from "../../src/languages/scottishgaelic/scottishgaelic.ts";
import { phonemizeWord as kk } from "../../src/languages/kazakh/kazakh.ts";
import { phonemizeWord as kl } from "../../src/languages/kalaallisut/kalaallisut.ts";
import { phonemizeWord as mn } from "../../src/languages/mongolian/mongolian.ts";
import { phonemizeWordRules as da } from "../../src/languages/danish/danish.ts";
import { phonemizeWord as pt } from "../../src/languages/portuguese/portuguese.ts";
// RULE-ONLY for pt-BR: the shipped phonemizeWord applies a BP open/close override lexicon MINED FROM this
// wikipron BZ referee, so evaluating it against the referee would be circular. phonemizeWordRules is the
// dialect-parameterized engine WITHOUT that lexicon → the honest, non-circular number.
import { phonemizeWordRules as ptbr } from "../../src/languages/portuguese-br/portuguese-br.ts";
import { phonemizeWord as ru } from "../../src/languages/russian/russian.ts";
import { phonemizeWord as si } from "../../src/languages/sinhala/sinhala.ts";
// RULE-ONLY for bn: the shipped phonemizeWord applies a wikipron-informed lexicon, so evaluating it against
// wikipron would be circular. phonemizeWordRules bypasses the lexicon → the honest engine signal.
import { phonemizeWordRules as bn } from "../../src/languages/bengali/bengali.ts";
// RULE-ONLY (skeleton) for ur: the shipped phonemizeWord restores short vowels from a coverage lexicon MINED FROM
// wikipron+kaikki, so evaluating it against wikipron would be CIRCULAR. phonemizeWordCore is the lexicon-free g2p
// skeleton (default-ə + Ohala) → the honest, non-circular backbone signal (short vowels are folded anyway).
import { phonemizeWordCore as ur } from "../../src/languages/urdu/urdu.ts";
// RULE-ONLY for id: the shipped phonemizeWord applies a cross-source consensus ⟨e⟩ lexicon (wikipron ∩ kaikki),
// so evaluating it against those referees would be circular. phonemizeWordRules bypasses it → the honest engine
// signal (the eval folds ⟨e⟩ anyway, so the % is identical).
import { phonemizeWordRules as id } from "../../src/languages/indonesian/indonesian.ts";
// ⚠ pa scores the EVAL function, not the shipped one: gurmukhi-lexicon.tsv is mined from the pan_guru
// referee, so the shipped phonemizeWord would score the answer key (house pattern — af/en-GB/tl/ilo/km).
import { phonemizeWordEval as pa } from "../../src/languages/punjabi/punjabi.ts";
import { phonemizeWord as mr } from "../../src/languages/marathi/marathi.ts";
import { phonemizeWord as te } from "../../src/languages/telugu/telugu.ts";
import { phonemizeWord as yue } from "../../src/languages/cantonese/cantonese.ts";
// RULE-ONLY for tl: the shipped phonemizeWord appends the wikipron-sourced word-final glottal stop, so evaluating
// it against wikipron would be circular. phonemizeWordRules bypasses it → the honest engine signal.
import { phonemizeWordRules as tl } from "../../src/languages/tagalog/tagalog.ts";
import { phonemizeWord as om } from "../../src/languages/oromo/oromo.ts";
import { phonemizeWord as pl } from "../../src/languages/polish/polish.ts";
// RULE-ONLY for sd: the shipped phonemizeWord applies a kaikki short-vowel restoration lexicon; the referee eval
// FOLDS short vowels (abjad wall) so it can't reward it anyway, and kaikki is in the referee → rule-only keeps it
// honest. phonemizeWordRules is the default-schwa g2p (the consonant + long-vowel backbone the eval measures).
import { phonemizeWordRules as sd } from "../../src/languages/sindhi/sindhi.ts";
import { phonemizeWordRules as skr } from "../../src/languages/saraiki/saraiki.ts";
import { phonemizeWord as ro } from "../../src/languages/romanian/romanian.ts";
import { phonemizeWord as fa } from "../../src/languages/persian/persian.ts";
import { phonemizeWord as it } from "../../src/languages/italian/italian.ts";
import { phonemizeWord as pcm } from "../../src/languages/naija/naija.ts";
import { phonemizeWord as nan } from "../../src/languages/minnan/minnan.ts";
import { phonemizeWord as wuu } from "../../src/languages/wu/wu.ts";
import { phonemizeWord as cjy } from "../../src/languages/jin/jin.ts";
import { phonemizeWord as hak } from "../../src/languages/hakka/hakka.ts";
import { phonemizeWord as ml } from "../../src/languages/malayalam/malayalam.ts";
import { phonemizeWord as hsn } from "../../src/languages/xiang/xiang.ts";
import { phonemizeWord as gan } from "../../src/languages/gan/gan.ts";
import { phonemizeWordRules as ak } from "../../src/languages/akan/akan.ts";
import { phonemizeWord as or } from "../../src/languages/odia/odia.ts";
import { phonemizeWord as uz } from "../../src/languages/uzbek/uzbek.ts";
import { phonemizeWord as mai } from "../../src/languages/maithili/maithili.ts";
import { phonemizeWord as uk } from "../../src/languages/ukrainian/ukrainian.ts";
import { phonemizeWord as su } from "../../src/languages/sundanese/sundanese.ts";
import { phonemizeWord as ne } from "../../src/languages/nepali/nepali.ts";
import { phonemizeWord as sw } from "../../src/languages/swahili/swahili.ts";
// RULE-ONLY for gu: the shipped phonemizeWord applies a wikipron/kaikki-informed schwa lexicon, so evaluating it
// against those referees would be circular. phonemizeWordRules bypasses the lexicon → the honest engine signal.
import { phonemizeWordRules as gu } from "../../src/languages/gujarati/gujarati.ts";
// NON-CIRCULAR for ps — see `psNonCircular` below. The shipped `phonemizeWord` is NOT used here: Pashto's
// coverage lexicon is mined from wikipron and kaikki, which are the referees it would be scored against.
import { harakatLexicon as psLexicon, phonemizeWordCore as psCore } from "../../src/languages/pashto/pashto.ts";
import { restoreHarakat as psRestore } from "../../src/core/harakatLexicon.ts";
import { phonemizeWord as kn } from "../../src/languages/kannada/kannada.ts";
import { phonemizeWord as am } from "../../src/languages/amharic/amharic.ts";
import { phonemizeWord as ti } from "../../src/languages/tigrinya/tigrinya.ts";
import { phonemizeWord as bg } from "../../src/languages/bulgarian/bulgarian.ts";
// ckb: the SHIPPED path, lexicon -> BIZROKE TAGGER -> rules, assembled below. Non-circular by SOURCE rather
// than by tier: both the lexicon and the tagger come from AsoSoft, and the referees are wikipron and kaikki.
import {
    bizrokeLexiconHas, phonemizeWord as ckbLex, phonemizeWordRules as ckbRules,
} from "../../src/languages/central-kurdish/central-kurdish.ts";
import { createCentralKurdishTagger, type CentralKurdishTagger } from "../../src/languages/central-kurdish/centralKurdishTagger.ts";
import { phonemizeWord as yo } from "../../src/languages/yoruba/yoruba.ts";
import { phonemizeWord as my } from "../../src/languages/burmese/burmese.ts";
// RULE-ONLY for jv: the shipped phonemizeWord adds a cross-script ⟨e⟩ lexicon sourced from the Aksara referee;
// phonemizeWordRules bypasses it → the honest engine signal (the eval folds ⟨e⟩ anyway, so the % is identical).
import { phonemizeWordRules as jv } from "../../src/languages/javanese/javanese.ts";
import { phonemizeWord as sv } from "../../src/languages/swedish/swedish.ts";
import { phonemizeWord as ta } from "../../src/languages/tamil/tamil.ts";
import { phonemizeWord as th } from "../../src/languages/thai/thai.ts";
import { phonemizeWord as lo } from "../../src/languages/lao/lao.ts";
import { phonemizeWord as tr } from "../../src/languages/turkish/turkish.ts";
import { phonemizeWord as vi } from "../../src/languages/vietnamese/vietnamese.ts";
import { phonemizeWord as zu } from "../../src/languages/zulu/zulu.ts";
import { BACKBONE, CONFIG, type RefLang } from "./config.ts";

// Alphabetical; each maps a word → our canonical IPA (sync or async). ar goes through the async ONNX
// diacritizer pre-pass (phonemizeArabic) so the referee's voweled IPA is comparable. cmn is syllable-level. en
// and hi have no bare phonemizeWord export — instantiate their factory once and take the word through .text().
const cmn = createPinyinPhonemizer();
const enP = createEnglish();
const en = (w: string): string => enP.text(w);
const hiP = createHindi();
const hi = (w: string): string => hiP.text(w);
/**
 * ckb — the whole shipped tier: lexicon -> tagger -> rules, which is what `phonemizeAsync("…", "ckb")` runs.
 * ⚠ THIS ONLY MEANS ANYTHING BECAUSE `ckb.jsonc` NOW FOLDS THE BIZROKE TO ə RATHER THAN TO NOTHING. Under the
 * old fold the vowel was deleted from both sides, so every tier scored identically and the referee could not
 * see the one thing this engine's Sorani work has been about.
 */
let ckbTaggerP: Promise<CentralKurdishTagger | undefined> | undefined;
let ckbWarned = false;
const ckb = async (w: string): Promise<string> => {
    if (bizrokeLexiconHas(w)) return ckbLex(w);
    ckbTaggerP ??= createCentralKurdishTagger();
    const tagger = await ckbTaggerP;
    if (!tagger) {
        // ⚠ SAY SO. `onnxruntime-node` is an OPTIONAL dependency and the tagger self-falls-back, so without it
        // this reports the LEXICON-ONLY score (74.8% against the tier's 85.2% — the lexicon lookup above still
        // fires) under the tier's name: a missing instrument that reads exactly like a 10-point regression.
        // The referee-eval test skips ckb's floor in this state; a human running eval.ts by hand gets this.
        if (!ckbWarned) {
            ckbWarned = true;
            console.error("⚠ ckb: no bizroke tagger (missing model or onnxruntime-node) — reporting LEXICON-ONLY, not the shipped tier");
        }
        return ckbRules(w);
    }
    return (await tagger.tag(w)) || ckbRules(w);
};

/**
 * ⚠ WHICH PATH THIS TABLE HOLDS IS THE WHOLE OF #1141. Most entries are `phonemizeWord` — the bare g2p — while
 * the product is `phonemize(text, lang)`, which runs normalization, tokenization and the NATIVISER first. Where
 * the two disagree the published referee percentage does not describe the product, and the divergence is
 * invisible from inside either path (#1131 was found this way, not by the referee). EXPORTED so the delta
 * between the two can be measured rather than assumed.
 */
export const PHON: Record<string, (w: string) => string | Promise<string>> = {
    ar,
    // RULE-ONLY (lexicon:false): the shipped path adds an Egyptian short-vowel lexicon MINED FROM kaikki, which
    // shares the Wiktionary tradition with the wikipron-arz referee → evaluating it would be circular.
    bho,
    awa, // Awadhi — single-source (Saksena 1937) referee; Devanagari confirmed against the Awadhi Shabd-Kosh corpus
    tg, // Tajik — Persian variety in Cyrillic (near-phonemic); wikipron tgk broad+narrow + epitran tgk-Cyrl
    arz: (w: string) => ar(w, "egyptian", { lexicon: false }), // Egyptian Arabic variety — shares phonemizeArabic
    apc: (w: string) => ar(w, "levantine"), // North Levantine Arabic variety
    apd: (w: string) => ar(w, "sudanese"), // Sudanese Arabic variety (no referee — gold-anchored)
    acm: (w: string) => ar(w, "iraqi"), // Iraqi Arabic variety (Baghdadi gilit)
    afb: (w: string) => ar(w, "gulf"), // Gulf Arabic variety (Khaleeji)
    ary: (w: string) => ar(w, "moroccan"), // Moroccan Arabic variety (Darija)
    ayl: (w: string) => ar(w, "libyan"), // Libyan Arabic variety (Tripolitanian)
    ajp: (w: string) => ar(w, "southlevantine"), // South Levantine Arabic variety (Palestinian/Jordanian)
    acw: (w: string) => ar(w, "hijazi"), // Hijazi Arabic variety (western Saudi)

    bn,
    ca,
    gl,
    sl,
    lv,
    ltg,
    mk,
    et,
    kea,
    mt,
    lb,
    is,
    fo,
    oc,
    mi,
    haw,
    qu,
    bo,
    gn,
    sq,
    tk,
    tt,
    mto,
    chr,
    smj,
    nci,
    nog,
    shn,
    la,
    sat,
    quc,
    ba,
    eu,
    kaa,
    crh,
    pap,
    naq,
    rup,
    ab,
    chv,
    ee,
    ast,
    an,
    ht,
    rkt,
    bar,
    cdo,
    hmn,
    shi,
    cmn,
    nl,
    az,
    mg,
    as: as_,
    bpy,
    so,
    ceb,
    hil,
    ilo,
    xh,
    // ⚠ THROUGH THE SPELLING FOLD, so the eval measures what the ENGINE emits. `phonemizeWord` alone skips
    //   `foreignLetters`, which every BCS engine applies per word before it — the eval would score
    //   `Ellsworth → ˈelsortx` where the engine says `ˈelsʋortx`. A no-op on today's referees (both hold
    //   zero ⟨q w x y⟩ words) and correct as soon as one does not.
    sr: (w: string) => srWord(srFold(w)),
    hu,
    kmr,
    za,
    sn,
    rw,
    mad,
    nya,
    ln,
    km,
    tn,
    bm,
    wo,
    mos,
    ki,
    kam,
    ka,
    lt,
    af,
    he,
    lg,
    luo, // Luo (Dholuo) — Western Nilotic; single-source 17-word Wiktionary referee (tone/ATR unwritten → folded)
    rn,
    ug,
    syl,
    el,
    grc,
    cs,
    cy,
    de,
    en,
    "en-GB": engb,
    es,
    "es-419": es419,
    fa,
    ff,
    fr,
    ga,
    gd,
    ha,
    hi,
    id,
    it,
    ja,
    pcm,
    nan,
    wuu,
    cjy,
    hak,
    hsn,
    gan,
    ak,
    or,
    uz,
    mai,
    uk,
    su,
    ne,
    ml,
    jv,
    sw,
    gu,
    ps,
    kn,
    am,
    ti,
    bg,
    ckb,
    yo,
    my,
    kk,
    kl,
    mn,
    da,
    fi,
    sk,
    be,
    hy,
    hyw,
    ky,
    nb,
    ko,
    mr,
    pa,
    pt,
    "pt-BR": ptbr,
    ru,
    si,
    sv,
    ta,
    te,
    th,
    lo,
    tl,
    om,
    pl,
    sd,
    skr,
    ro,
    tr,
    ur,
    vi,
    yue,
    zu,
};
/**
 * WHICH PATH EACH `PHON` ENTRY MEASURES — DERIVED FROM THIS FILE'S OWN IMPORTS, never hand-kept, for the reason
 * `tools/registry-map.ts` gives about the registry: a hand-maintained list silently rots while the thing it
 * describes moves.
 *
 * ⚠ THIS IS #1141, AND THE ANSWER IS NOT "POINT IT ALL AT `phonemize`". Measured across 170 refereed languages
 * (35,057 sampled rows): the scored path and the shipped path disagree on 6.67% of rows in 53 languages. But
 * the disagreement decomposes, and most of it is CORRECT:
 *   · ~19.6% prosody — `text()` places stress the bare g2p does not (`antoine` → ɑ̃twan vs ɑ̃twˈan);
 *   · ~8.9% routing — the referee list is written in a script the product re-homes. `cmn`'s list is PINYIN, so
 *     `phonemize(pinyin, "cmn")` hands the Latin run to ENGLISH and reads `a` as *ˈə*. The comparison is
 *     meaningless there, not the engine wrong;
 *   · ~1.1% normalization firing on citation-form artifacts (`69'er` → *nioɡtʁes ɛɐ*);
 *   · the rest is dominated by SEVENTEEN languages that deliberately score `phonemizeWordRules` — the rules-only
 *     engine — because the lexicon/neural path was built from the same source as the referee. norwegian.ts,
 *     danish.ts, afrikaans.ts and bengali.ts all say so in prose: "NON-CIRCULAR (not the lexicon)". Repointing
 *     those at `phonemize` would score a lexicon against the corpus it was mined from — worse, not better.
 * So the defect is NOT the path choice. It is that the number never SAID which path it describes, and that no
 * path exercises the product-only transformations, which is how #1131 hid: `makeNativiser` runs in `text()`
 * only, so a nativiser defect was invisible to the referee no matter how good the referee was.
 */
export type ScoredPath = "rules" | "word" | "engine-text";
/**
 * ⚠ HAND-KEPT, AND ONLY BECAUSE IT HAS TO BE. Most entries are derivable from the import symbol below, but
 * three are hand-written WRAPPERS with no symbol to key on — `arz` is `ar(w, "egyptian", {lexicon:false})`.
 * A derived list cannot rot; this one can, so `test/referee-eval.test.ts` cross-checks every entry against
 * the RULE-ONLY / NON-CIRCULAR prose this file already writes beside each such import.
 */
const PATH_OVERRIDE: Record<string, ScoredPath> = {
    arz: "rules", // RULE-ONLY (lexicon:false) — see the note at its PHON entry
    ps: "rules", // PS_HONEST — psCore over a referee-filtered harakat restore; see the note at the import
};
export const PATH_OF: Record<string, ScoredPath> = (() => {
    const src = readFileSync(fileURLToPath(import.meta.url), "utf8");
    const key = (alias: string): string | undefined => {
        // an alias only labels a language if it IS the table's entry for one. `en-GB` is keyed with a hyphen
        // its identifier cannot carry, and a reserved word takes a trailing underscore (`as_` → `as`), so try
        // both spellings, case-insensitively.
        if (alias in PHON) return alias;
        const bare = alias.replace(/_$/u, "").toLowerCase();
        return Object.keys(PHON).find((k) => k.replace(/-/gu, "").toLowerCase() === bare);
    };
    const out: Record<string, ScoredPath> = {};
    // ⚠ BOTH LEXICON-FREE SYMBOLS. `phonemizeWordRules` is the common one; `ur` and `ps` expose their
    // lexicon-free skeleton as `phonemizeWordCore`, and keying only on the first labelled them "word" —
    // asserting the wrong engine on the very field whose job is to stop that.
    // ⚠ MATCHED ANYWHERE IN THE IMPORT, not just after `import {`: `ckb` pulls three symbols from one
    // statement. And ⚠ ONLY IF THE ALIAS IS ITSELF A PHON ENTRY — `ckbRules` is not, which is load-bearing:
    // `ckb`'s entry is a COMPOSITE (bizroke lexicon → ONNX tagger → rules fallback), not a rules measurement.
    for (const m of src.matchAll(/phonemizeWord(?:Rules|Core) as ([A-Za-z_$][\w$]*)/gu)) {
        const k = key(m[1]!);
        if (k !== undefined) out[k] = "rules";
    }
    for (const m of src.matchAll(/^const (\w+) = \(w: string\)[^\n]*\.text\(w\)/gmu)) {
        const k = key(m[1]!);
        if (k !== undefined) out[k] = "engine-text";
    }
    Object.assign(out, PATH_OVERRIDE);
    // ⚠ FAIL LOUDLY, NOT CLOSED. This reads its own source and matches TYPE ANNOTATIONS; under any transform
    // that strips them (a compiled dist, a bundled tools build) every match fails, and an empty map would
    // silently report every language as the bare word g2p — a wrong answer that looks like a right one.
    if (Object.keys(out).length === 0)
        throw new Error("referee-eval: PATH_OF derived nothing — eval.ts source not readable as written");
    return out;
})();
export const pathOf = (lang: string): ScoredPath => PATH_OF[lang] ?? "word";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * ps: the shipped lexicon MINUS every row whose key came from a REFEREE source.
 *
 * ⚠ WITHOUT THIS, THE ps NUMBER MEASURES THE REFEREE AGAINST ITSELF. Pashto's coverage layer
 * (`pashto/lexicon.tsv`) is mined by tools/perso-arabic/invert_harakat.ts from `silver.tsv` and
 * `silver.kaikki.tsv` — which ARE wikipron and kaikki. Measured on ps.wikipron-pbt.tsv (investigation Run 11):
 * shipped 892/1281 = 69.6%, no lexicon at all 601/1281 = 46.9%. **The 22.7pp gap is feedback**, not engine
 * quality: 503 of the referee's words carry a lexicon row and score 90.1% against 56.3% for the rest.
 *
 * ⚠ THE FIX IS NOT A RULE-ONLY ENTRY POINT, WHICH IS WHAT en-GB / km / af / ilo / gu DO. That would throw
 * away a legitimate layer: 95.4% of this lexicon is espeak-ng's ps_list and 548 rows are ps.wiktionary, and
 * NO referee has seen either. Only rows whose KEY came from wikipron/kaikki have to go, and that set is
 * derivable from files already committed — so this costs the shipped artifact nothing, needs no re-mine, and
 * keeps the full 1,281-word denominator (a held-out split would have left ~85 words).
 *
 * ⚠ EXCLUDING BY KEY IS PRECISE HERE, NOT MERELY SAFE, and that turns on the miner's source ORDER. The shipped
 * file has no provenance column, so a key present in two pools cannot be attributed by inspection — but
 * invert_harakat.ts reads the CC-BY-SA silver FIRST and `seenSkel` keeps the first vocalization per skeleton,
 * so for any word wikipron/kaikki also covers, the referee-derived reading IS the one that shipped. Excluding
 * every such key removes exactly the feedback and nothing else. Effect: 432 of 14,021 rows (3.1%) set aside,
 * and referee words still holding a referee-derived entry go 503 → 0.
 *
 * ⚠ IT STILL READS LOWER THAN WHAT A USER GETS, because those 432 words really are covered in the shipped
 * artifact. That is the right direction to err — the alternative is a number nobody can interpret. The shipped
 * figure is recorded in tools/referee-eval/langs/ps.jsonc; it is a COVERAGE statistic, not an engine one.
 *
 * A FUNCTION DECLARATION, not a const, because `PHONEMIZERS` above is built before `HERE` exists and refers to
 * `ps` by shorthand. Hoisting resolves the reference; the body is lazy, so `HERE` is initialized by call time.
 */
let PS_HONEST: ((w: string) => string) | undefined;
function ps(word: string): string {
    if (!PS_HONEST) {
        // ⚠ FILTERED TO lang=="pus". `silver.tsv` is MULTI-LANGUAGE and Perso-Arabic spellings collide across
        // ur/fa/pa/ps, so an unfiltered read would exclude rows the ps miner never saw — inflating the penalty
        // and making this look worse than it is. Same trap that skewed the licence count in export_lexicons.sh.
        const refDerived = new Set<string>();
        for (const f of ["silver.tsv", "silver.kaikki.tsv"]) {
            const p = join(HERE, "..", "perso-arabic", f);
            if (!existsSync(p)) continue;
            for (const line of readFileSync(p, "utf8").split("\n")) {
                const a = line.split("\t");
                if (a.length >= 3 && a[1] === "pus") refDerived.add(a[0]!.normalize("NFC"));
            }
        }
        // ⚠ FAIL LOUD ON AN EMPTY EXCLUSION SET. Silently excluding nothing restores the circular number, and
        // it would present as a ~20-point improvement — the most dangerous possible failure mode here.
        if (refDerived.size === 0)
            throw new Error(
                "ps non-circular eval: no lang=pus rows found in perso-arabic/silver.tsv or silver.kaikki.tsv. " +
                    "The exclusion set would be EMPTY and the score would silently revert to the circular one.",
            );
        // ⚠ ps.wiktionary (silver.pswikt-ps.tsv) is deliberately NOT excluded — it is independent of every
        // referee, so its rows are honest coverage. Only add a file here if it IS a referee source.
        const filtered = new Map<string, string>();
        for (const [k, v] of psLexicon()) if (!refDerived.has(k.normalize("NFC"))) filtered.set(k, v);
        PS_HONEST = (w: string): string => psCore(psRestore(w, filtered));
    }
    return PS_HONEST(word);
}

/** Fold to the comparable segmental backbone: shared strip + the language's justified fold classes, plus any
 *  per-referee folds (`extra`) for folds valid only against one referee (e.g. a dual-script language's abjad). */
/**
 * Every reading of a reference row carrying OPTIONAL parenthesized segments — 2ⁿ for n groups, deduped.
 * `ˈɑr(ə)m` → [ˈɑrm, ˈɑrəm]; `(ʔ)a(ə)b` → all four. Only called when the language sets `parenOptional`.
 * ⚠ 2ⁿ IS BOUNDED IN THE DATA (the maximum in any shipped referee is 3 groups → 8 readings), but the cap
 * below keeps a pathological row from exploding the comparison set rather than trusting that forever.
 */
export function expandOptional(ipa: string, maxGroups = 6): string[] {
    const groups = [...ipa.matchAll(/\(([^)]*)\)/gu)];
    if (groups.length === 0 || groups.length > maxGroups) return [ipa.replace(/[()]/gu, "")];
    let out = [""];
    let cursor = 0;
    for (const g of groups) {
        const lead = ipa.slice(cursor, g.index);
        out = out.flatMap((p) => [`${p}${lead}`, `${p}${lead}${g[1]!}`]);
        cursor = g.index + g[0].length;
    }
    const tail = ipa.slice(cursor);
    return [...new Set(out.map((p) => `${p}${tail}`))];
}

export function makeFold(
    cfg: RefLang,
    extra: readonly [RegExp, string, string][] = [],
): (s: string) => string {
    return (s: string): string => {
        let out = s.normalize("NFD");
        for (const [re, rep] of cfg.preFolds ?? []) out = out.replace(re, rep); // before backbone (needs diacritics)
        for (const [re, rep] of BACKBONE) out = out.replace(re, rep);
        for (const [re, rep] of cfg.folds) out = out.replace(re, rep);
        for (const [re, rep] of extra) out = out.replace(re, rep);
        return out.normalize("NFC");
    };
}

export interface RefereeResult {
    source: string;
    role: "primary" | "secondary";
    /** WHICH PATH the numbers below describe — see PATH_OF. Reported so a score is never ambiguous again. */
    path: ScoredPath;
    /**
     * How far the SHIPPED reading is from the one scored, over a deterministic stride sample. Not a quality
     * metric and not a defect count: a large delta usually means the referee list is not product-shaped (see
     * PATH_OF's note on `cmn`'s pinyin list) or that the scored path is deliberately the rules engine. It is
     * the number that was missing when #1131 hid inside it — the eval runs no `normalize` and no
     * `makeNativiser`, so anything living there is invisible until this line is non-zero and someone looks.
     */
    product: { differ: number; compared: number };
    total: number;
    raw: number;
    folded: number;
    residual: { key: string; count: number; example: string }[];
    // When a word-frequency list exists (tools/referee-eval/freq/<lang>.txt), the TOKEN-weighted folded accuracy over
    // the referee words that appear in the corpus — the real-text quality, unbiased by a dictionary-shaped referee
    // (which over-samples rare inflections). `freqCovered` = how many referee words carry a frequency.
    freqWeighted?: number;
    freqCovered?: number;
    // SYMBOL accuracy = 1 − phone-error-rate: 1 − (Σ min edit-distance(fold(ours), fold(ref)) / Σ symbols). A
    // partial-credit metric that (unlike word-exact `folded`) does not amplify a single-symbol variant into a whole
    // wrong word — the honest measure where the residual is pervasive 1-phone variation (English reduced vowels /
    // dialect / proper-noun anglicisation). Best-matching variant per word (credits any attested pronunciation).
    symbolAcc: number;
}

/** Levenshtein distance over two symbol arrays (IPA characters after folding). */
function editDistance(a: string[], b: string[]): number {
    const d = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let prev = d[0]!;
        d[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = d[j]!;
            d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp;
        }
    }
    return d[b.length]!;
}

/** Load `freq/<lang>.txt` (a "word count" list, desc) → word→count, or null if the language has no frequency list. */
function loadFreq(lang: string): Map<string, number> | null {
    try {
        const map = new Map<string, number>();
        for (const l of readFileSync(join(HERE, "freq", `${lang}.txt`), "utf8").split("\n")) {
            if (!l || l.startsWith("#")) continue;
            const sp = l.indexOf(" ");
            if (sp > 0) map.set(l.slice(0, sp).toLowerCase(), Number(l.slice(sp + 1)));
        }
        return map.size ? map : null;
    } catch { return null; }
}

/** Score a language's phonemizer against each of its independent referees (segmental backbone). Async because
 *  some phonemizers (ar's ONNX diacritizer) are async; sync ones resolve immediately. */
export async function evaluate(
    lang: string,
    primaryOnly = false,
    sampleCap = 0, // >0 → evaluate only a deterministic stride sample of this many rows (the floor test uses it to
    // stay fast on huge referees run through slow phonemizers, e.g. en-GB's 76k words × the neural English G2P; the
    // CLI leaves it 0 = full). A uniform stride keeps the folded% a faithful estimate of the whole.
    // ⚠ LAST, and defaulting off. It was briefly inserted before `sampleCap`, which silently reinterpreted
    // `evaluate(lang, true, 3000)` in the floor test as withDelta=3000 and sampleCap=0 — a signature change
    // that type-checks and quietly measures something else.
    withDelta = false, // compute the product-path delta — CLI only; see RefereeResult.product
): Promise<RefereeResult[]> {
    const cfg = CONFIG[lang],
        phon = PHON[lang];
    if (!cfg || !phon) throw new Error(`no referee config for "${lang}"`);
    const freq = loadFreq(lang); // token weights for the real-text (frequency-weighted) metric, when available
    const out: RefereeResult[] = [];
    for (const ref of cfg.referees) {
        if (primaryOnly && ref.role !== "primary") continue; // floor test only needs the primary (skip slow 2nd)
        const fold = makeFold(cfg, ref.folds); // per-referee folds appended (e.g. pa's majhūl only for Shahmukhi)
        let pairs = readFileSync(join(HERE, "referees", ref.file), "utf8")
            .split("\n")
            .filter((l) => l.trim() !== "" && !l.startsWith("#"))
            .map((l) => l.split("\t"))
            .filter((a) => a.length >= 2 && a[0] && a[1]);
        if (sampleCap > 0 && pairs.length > sampleCap) {
            const stride = Math.ceil(pairs.length / sampleCap);
            pairs = pairs.filter((_, i) => i % stride === 0);
        }
        let raw = 0,
            folded = 0;
        let pDiffer = 0,
            pCompared = 0,
            pSeen = 0;
        const pStride = withDelta ? Math.max(1, Math.ceil(pairs.length / 300)) : 0;
        let freqNum = 0,
            freqDen = 0,
            freqCovered = 0;
        let editSum = 0, // Σ min symbol edit-distance (for the phone-error-rate / symbol-accuracy metric)
            symTot = 0; // Σ symbols (max of ours / best-matching ref)
        const diffClass: Record<string, number> = {};
        const example: Record<string, string> = {};
        for (const row of pairs) {
            const w = row[0]!;
            const wCount = freq?.get(w.toLowerCase()) ?? 0; // corpus token count (0 = not a common word)
            // A word may carry MULTIPLE reference pronunciations (kaikki/ca dictionaries list variants) as extra
            // tab-separated fields — credit the word if ANY of them matches (folded). Single-pron files (one field)
            // are the length-1 case, unchanged.
            const refIpas = row
                .slice(1)
                .map((ri) => (cfg.segmentJoin ? ri.replace(/\s+/g, "") : ri))
                // A PARENTHESIZED GROUP IS AN OPTIONAL SEGMENT where the referee says so (`parenOptional`,
                // opt-in per language — see config.ts for why this is not fleet-wide). Expand to BOTH
                // variants and credit either, exactly like the multi-pronunciation tab fields above.
                // Stripping the group instead (the old af preFold) deleted REAL segments: "an(d)ər" lost
                // its d, and an engine emitting the epenthetic schwa could never match a reference that
                // wrote it. ⚠ EVERY COMBINATION, not just all-in/all-out: a row with two optional groups
                // has four readings, and the referee licenses each one.
                .flatMap((ri) => (cfg.parenOptional && /[()]/u.test(ri) ? expandOptional(ri) : [ri]));
            const rawOurs = await phon(w);
            // ⚠ THE PRODUCT-PATH DELTA (#1141) — folded in HERE so it reuses the reading just computed. Doing
            // it in a second pass re-invoked the engine for every sampled row, which for `ar` (ONNX
            // diacritizer), `ckb` (bizroke tagger) and `en` (beam search) meant doubling the model calls.
            if (withDelta && pStride > 0 && pSeen++ % pStride === 0) {
                try {
                    const shipped = (await phonemizeAsync(w, lang)).trim();
                    pCompared++;
                    if (rawOurs.trim() !== shipped) pDiffer++;
                } catch {
                    // a word the shipped path refuses is NOT counted as compared: including it in the
                    // denominator would let "0 differ" be printed off zero successful comparisons.
                }
            }
            // Under segmentJoin the reference is space-stripped; strip OUR word-separator spaces too (a segmented
            // phonemizer, e.g. Burmese/Thai, joins subwords with a space) so the raw metric compares like with like.
            const ours = cfg.segmentJoin ? rawOurs.replace(/\s+/g, "") : rawOurs;
            if (refIpas.some((rf) => ours === rf)) raw++;
            const of = fold(ours);
            const foldedRefs = refIpas.map(fold);
            const hit = foldedRefs.includes(of);
            // SYMBOL accuracy: best-matching variant's edit distance (0 on a hit), summed as a phone-error-rate.
            const oSyms = [...of];
            let bestEdit = Infinity, bestLen = 1;
            for (const fr of foldedRefs) {
                const d = editDistance(oSyms, [...fr]);
                if (d < bestEdit) { bestEdit = d; bestLen = [...fr].length || 1; }
            }
            editSum += bestEdit;
            symTot += Math.max(bestLen, oSyms.length);
            if (wCount > 0) { freqDen += wCount; freqCovered++; if (hit) freqNum += wCount; }
            if (hit) {
                folded++;
                continue;
            }
            const key = `${of}  ≠  ${foldedRefs[0]!}`;
            diffClass[key] = (diffClass[key] ?? 0) + 1;
            example[key] ??= `${w}: ${ours}  |  ${row.slice(1).join(" / ")}`;
        }
        const residual = Object.entries(diffClass)
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => ({ key, count, example: example[key]! }));
        out.push({
            source: ref.source,
            role: ref.role,
            path: pathOf(lang),
            product: { differ: pDiffer, compared: pCompared },
            total: pairs.length,
            raw,
            folded,
            residual,
            symbolAcc: symTot ? 1 - editSum / symTot : 0,
            ...(freq ? { freqWeighted: freqDen ? freqNum / freqDen : 0, freqCovered } : {}),
        });
    }
    return out;
}

async function main(): Promise<void> {
    const lang = process.argv[2];
    if (!lang || !CONFIG[lang]) {
        console.error(
            `usage: eval.ts <${Object.keys(CONFIG).join("|")}> [--examples N]`,
        );
        process.exit(1);
    }
    const exIdx = process.argv.indexOf("--examples");
    const nEx = exIdx >= 0 ? Number(process.argv[exIdx + 1] ?? 25) : 12;
    for (const r of await evaluate(lang, false, 0, true)) {
        console.log(
            `\n=== ${lang} vs ${r.source} [${r.role}] (${r.total} words) ===`,
        );
        console.log(
            `raw exact:      ${r.raw}/${r.total} (${((100 * r.raw) / r.total).toFixed(1)}%)`,
        );
        console.log(
            `folded backbone:${r.folded}/${r.total} (${((100 * r.folded) / r.total).toFixed(1)}%)  — after the config folds`,
        );
        console.log(
            `symbol accuracy:${(100 * r.symbolAcc).toFixed(1)}%  — 1 − phone-error-rate (partial credit; a 1-symbol variant is not a whole wrong word)`,
        );
        if (r.freqWeighted !== undefined)
            console.log(
                `frequency-weighted:${(100 * r.freqWeighted).toFixed(1)}%  — token-weighted real-text quality (${r.freqCovered} referee words have a frequency; unbiased by a dictionary-shaped referee)`,
            );
        console.log(
            `scored path:    ${r.path}${
                r.path === "rules"
                    ? "  — the rules-only engine, DELIBERATELY: the lexicon/neural path shares a source with the referee"
                    : r.path === "engine-text"
                      ? "  — this engine's OWN text(), NOT the registry-wrapped phonemize(): no romanPass/foldPass/withHost, and for en not the neural OOV path"
                      : "  — the bare word g2p"
            }`,
        );
        if (r.product.compared > 0)
            console.log(
                `product delta:  ${r.product.differ}/${r.product.compared} compared rows read differently by phonemize() — ${
                    r.product.differ === 0
                        ? "identical here, which is NOT evidence the product-only steps ran: normalize and makeNativiser are simply no-ops on most citation forms, and that silence is where #1131 hid"
                        : "NOT a defect count — see PATH_OF for the four ordinary causes (prosody, routing, normalization, a deliberately rules-only path) before treating any of it as a bug"
                }`,
            );
        console.log(
            `residual divergence classes (top ${nEx}, count × folded-form; investigate, don't auto-fix):`,
        );
        for (const d of r.residual.slice(0, nEx))
            console.log(`  ${d.count}×  ${d.key}\n       e.g. ${d.example}`);
    }
    const gap = CONFIG[lang]!.secondaryGap;
    if (gap) console.log(`\n⚠ secondary-source gap: ${gap}`);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
