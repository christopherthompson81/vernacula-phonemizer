/**
 * Referee eval — validate a vernacula phonemizer's SEGMENTAL BACKBONE against INDEPENDENT referees (epitran /
 * wikipron), not against espeak. espeak-canonical parity is only a regression guard; this measures linguistic
 * corroboration. Per referee it reports raw + folded agreement and the top residual divergences — the folded
 * residual is the linguistic signal to adjudicate against published phonology (referees are fallible; a
 * divergence is a candidate, not a verdict). See config.ts for the per-language fold justifications.
 *
 * Usage:  npx tsx tools/referee-eval/eval.ts <zu|si|kk> [--examples N]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { phonemizeArabic as ar } from "../../src/languages/arabic/arabic.ts";
import { phonemizeWord as ca } from "../../src/languages/catalan/catalan.ts";
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
import { phonemizeWord as so } from "../../src/languages/somali/somali.ts";
import { phonemizeWord as ceb } from "../../src/languages/cebuano/cebuano.ts";
import { phonemizeWord as hil } from "../../src/languages/hiligaynon/hiligaynon.ts";
import { phonemizeWordRules as ilo } from "../../src/languages/ilocano/ilocano.ts"; // RULE-ONLY: the shipped phonemizeWord consults a referee-derived lexicon → eval on rules only to stay non-circular
import { phonemizeWord as xh } from "../../src/languages/xhosa/xhosa.ts";
import { phonemizeWord as sr } from "../../src/languages/serbian/serbian.ts";
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
import { phonemizeWord as lg } from "../../src/languages/luganda/luganda.ts";
import { phonemizeWord as rn } from "../../src/languages/kirundi/kirundi.ts";
import { phonemizeWord as ug } from "../../src/languages/uyghur/uyghur.ts";
import { phonemizeWord as syl } from "../../src/languages/sylheti/sylheti.ts";
import { phonemizeWordRules as el } from "../../src/languages/greek/greek.ts";
import { phonemizeWord as es } from "../../src/languages/spanish/spanish.ts";
import { phonemizeWord as es419 } from "../../src/languages/spanish-419/spanish-419.ts";
import { phonemizeWord as fr } from "../../src/languages/french/french.ts";
import { phonemizeWord as ga } from "../../src/languages/irish/irish.ts";
import { phonemizeWord as kk } from "../../src/languages/kazakh/kazakh.ts";
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
import { phonemizeWord as pa } from "../../src/languages/punjabi/punjabi.ts";
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
import { phonemizeWord as ps } from "../../src/languages/pashto/pashto.ts";
import { phonemizeWord as kn } from "../../src/languages/kannada/kannada.ts";
import { phonemizeWord as am } from "../../src/languages/amharic/amharic.ts";
import { phonemizeWord as ti } from "../../src/languages/tigrinya/tigrinya.ts";
import { phonemizeWord as bg } from "../../src/languages/bulgarian/bulgarian.ts";
import { phonemizeWord as ckb } from "../../src/languages/central-kurdish/central-kurdish.ts";
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
const PHON: Record<string, (w: string) => string | Promise<string>> = {
    ar,
    // RULE-ONLY (lexicon:false): the shipped path adds an Egyptian short-vowel lexicon MINED FROM kaikki, which
    // shares the Wiktionary tradition with the wikipron-arz referee → evaluating it would be circular.
    bho,
    awa, // Awadhi — single-source (Saksena 1937) referee; Devanagari confirmed against the Awadhi Shabd-Kosh corpus
    arz: (w: string) => ar(w, "egyptian", { lexicon: false }), // Egyptian Arabic variety — shares phonemizeArabic
    apc: (w: string) => ar(w, "levantine"), // North Levantine Arabic variety
    apd: (w: string) => ar(w, "sudanese"), // Sudanese Arabic variety (no referee — gold-anchored 🔷)
    acm: (w: string) => ar(w, "iraqi"), // Iraqi Arabic variety (Baghdadi gilit)
    afb: (w: string) => ar(w, "gulf"), // Gulf Arabic variety (Khaleeji)
    ary: (w: string) => ar(w, "moroccan"), // Moroccan Arabic variety (Darija)
    ayl: (w: string) => ar(w, "libyan"), // Libyan Arabic variety (Tripolitanian)
    ajp: (w: string) => ar(w, "southlevantine"), // South Levantine Arabic variety (Palestinian/Jordanian)
    acw: (w: string) => ar(w, "hijazi"), // Hijazi Arabic variety (western Saudi)

    bn,
    ca,
    cmn,
    nl,
    az,
    mg,
    as: as_,
    so,
    ceb,
    hil,
    ilo,
    xh,
    sr,
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
    lg,
    rn,
    ug,
    syl,
    el,
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
const HERE = dirname(fileURLToPath(import.meta.url));

/** Fold to the comparable segmental backbone: shared strip + the language's justified fold classes, plus any
 *  per-referee folds (`extra`) for folds valid only against one referee (e.g. a dual-script language's abjad). */
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
    total: number;
    raw: number;
    folded: number;
    residual: { key: string; count: number; example: string }[];
}

/** Score a language's phonemizer against each of its independent referees (segmental backbone). Async because
 *  some phonemizers (ar's ONNX diacritizer) are async; sync ones resolve immediately. */
export async function evaluate(
    lang: string,
    primaryOnly = false,
): Promise<RefereeResult[]> {
    const cfg = CONFIG[lang],
        phon = PHON[lang];
    if (!cfg || !phon) throw new Error(`no referee config for "${lang}"`);
    const out: RefereeResult[] = [];
    for (const ref of cfg.referees) {
        if (primaryOnly && ref.role !== "primary") continue; // floor test only needs the primary (skip slow 2nd)
        const fold = makeFold(cfg, ref.folds); // per-referee folds appended (e.g. pa's majhūl only for Shahmukhi)
        const pairs = readFileSync(join(HERE, "referees", ref.file), "utf8")
            .split("\n")
            .filter((l) => l.trim() !== "" && !l.startsWith("#"))
            .map((l) => l.split("\t"))
            .filter((a) => a.length >= 2 && a[0] && a[1]);
        let raw = 0,
            folded = 0;
        const diffClass: Record<string, number> = {};
        const example: Record<string, string> = {};
        for (const row of pairs) {
            const w = row[0]!;
            // A word may carry MULTIPLE reference pronunciations (kaikki/ca dictionaries list variants) as extra
            // tab-separated fields — credit the word if ANY of them matches (folded). Single-pron files (one field)
            // are the length-1 case, unchanged.
            const refIpas = row
                .slice(1)
                .map((ri) => (cfg.segmentJoin ? ri.replace(/\s+/g, "") : ri));
            const rawOurs = await phon(w);
            // Under segmentJoin the reference is space-stripped; strip OUR word-separator spaces too (a segmented
            // phonemizer, e.g. Burmese/Thai, joins subwords with a space) so the raw metric compares like with like.
            const ours = cfg.segmentJoin ? rawOurs.replace(/\s+/g, "") : rawOurs;
            if (refIpas.some((rf) => ours === rf)) raw++;
            const of = fold(ours);
            if (refIpas.some((rf) => fold(rf) === of)) {
                folded++;
                continue;
            }
            const key = `${of}  ≠  ${fold(refIpas[0]!)}`;
            diffClass[key] = (diffClass[key] ?? 0) + 1;
            example[key] ??= `${w}: ${ours}  |  ${row.slice(1).join(" / ")}`;
        }
        const residual = Object.entries(diffClass)
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => ({ key, count, example: example[key]! }));
        out.push({
            source: ref.source,
            role: ref.role,
            total: pairs.length,
            raw,
            folded,
            residual,
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
    for (const r of await evaluate(lang)) {
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
            `residual divergence classes (top ${nEx}, count × folded-form; investigate, don't auto-fix):`,
        );
        for (const d of r.residual.slice(0, nEx))
            console.log(`  ${d.count}×  ${d.key}\n       e.g. ${d.example}`);
    }
    const gap = CONFIG[lang]!.secondaryGap;
    if (gap) console.log(`\n⚠ secondary-source gap: ${gap}`);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
