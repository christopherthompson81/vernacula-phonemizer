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
import { phonemizeWord as ff } from "../../src/languages/fula/fula.ts";
import { phonemizeWord as ha } from "../../src/languages/hausa/hausa.ts";
import { createHindi } from "../../src/languages/hindi/hindi.ts";
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
import { phonemizeWord as es } from "../../src/languages/spanish/spanish.ts";
import { phonemizeWord as fr } from "../../src/languages/french/french.ts";
import { phonemizeWord as ga } from "../../src/languages/irish/irish.ts";
import { phonemizeWord as kk } from "../../src/languages/kazakh/kazakh.ts";
import { phonemizeWord as pt } from "../../src/languages/portuguese/portuguese.ts";
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
import { phonemizeWord as sd } from "../../src/languages/sindhi/sindhi.ts";
import { phonemizeWord as fa } from "../../src/languages/persian/persian.ts";
import { phonemizeWord as it } from "../../src/languages/italian/italian.ts";
import { phonemizeWord as pcm } from "../../src/languages/naija/naija.ts";
import { phonemizeWord as nan } from "../../src/languages/minnan/minnan.ts";
import { phonemizeWord as wuu } from "../../src/languages/wu/wu.ts";
import { phonemizeWord as cjy } from "../../src/languages/jin/jin.ts";
import { phonemizeWord as hak } from "../../src/languages/hakka/hakka.ts";
import { phonemizeWord as ml } from "../../src/languages/malayalam/malayalam.ts";
import { phonemizeWord as hsn } from "../../src/languages/xiang/xiang.ts";
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
import { phonemizeWord as yo } from "../../src/languages/yoruba/yoruba.ts";
import { phonemizeWord as my } from "../../src/languages/burmese/burmese.ts";
// RULE-ONLY for jv: the shipped phonemizeWord adds a cross-script ⟨e⟩ lexicon sourced from the Aksara referee;
// phonemizeWordRules bypasses it → the honest engine signal (the eval folds ⟨e⟩ anyway, so the % is identical).
import { phonemizeWordRules as jv } from "../../src/languages/javanese/javanese.ts";
import { phonemizeWord as sv } from "../../src/languages/swedish/swedish.ts";
import { phonemizeWord as ta } from "../../src/languages/tamil/tamil.ts";
import { phonemizeWord as th } from "../../src/languages/thai/thai.ts";
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
    arz: (w: string) => ar(w, "egyptian"), // Egyptian Arabic variety — shares phonemizeArabic
    apc: (w: string) => ar(w, "levantine"), // North Levantine Arabic variety
    apd: (w: string) => ar(w, "sudanese"), // Sudanese Arabic variety (no referee — gold-anchored 🔷)
    acm: (w: string) => ar(w, "iraqi"), // Iraqi Arabic variety (Baghdadi gilit)
    afb: (w: string) => ar(w, "gulf"), // Gulf Arabic variety (Khaleeji)
    ary: (w: string) => ar(w, "moroccan"), // Moroccan Arabic variety (Darija)
    ayl: (w: string) => ar(w, "libyan"), // Libyan Arabic variety (Tripolitanian)

    bn,
    ca,
    cmn,
    nl,
    az,
    mg,
    as: as_,
    cs,
    cy,
    de,
    en,
    es,
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
    yo,
    my,
    kk,
    ko,
    mr,
    pa,
    pt,
    ru,
    si,
    sv,
    ta,
    te,
    th,
    tl,
    om,
    pl,
    sd,
    tr,
    ur,
    vi,
    yue,
    zu,
};
const HERE = dirname(fileURLToPath(import.meta.url));

/** Fold to the comparable segmental backbone: shared strip + the language's justified fold classes. */
export function makeFold(cfg: RefLang): (s: string) => string {
    return (s: string): string => {
        let out = s.normalize("NFD");
        for (const [re, rep] of cfg.preFolds ?? []) out = out.replace(re, rep); // before backbone (needs diacritics)
        for (const [re, rep] of BACKBONE) out = out.replace(re, rep);
        for (const [re, rep] of cfg.folds) out = out.replace(re, rep);
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
    const fold = makeFold(cfg);
    const out: RefereeResult[] = [];
    for (const ref of cfg.referees) {
        if (primaryOnly && ref.role !== "primary") continue; // floor test only needs the primary (skip slow 2nd)
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
