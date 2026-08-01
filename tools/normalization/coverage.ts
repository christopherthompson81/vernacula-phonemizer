/**
 * RETROACTIVE COVERAGE AUDIT (#585) — check every ALREADY-TREATED language against the FULL pattern
 * inventory, not the partial one that existed when it was treated.
 *
 * WHY THIS HAS TO EXIST. The 37 languages under #562 were done one at a time over many batches, and each
 * was judged against whatever the playbook knew at that point. The inventory in mine.ts was
 * then derived FROM those 37 — so it is strictly newer than every language in it, and no early language
 * was ever checked against the later cells. That is not hypothetical: `exponent` is declared in 24
 * language manifests and had no cell until the inventory was audited, and the first language checked
 * against it (Burmese) was silently dropping the `²` in `km²` and losing the area entirely.
 *
 * The order the work happened in guarantees the gap. A language treated in batch 1 was measured against
 * roughly a third of the cells that exist now.
 *
 * WHAT IT REPORTS, per language × cell:
 *   ·      the cell does not occur in that language's corpus — nothing to check
 *   ok     it occurs and the engine reads it without a detectable defect
 *   DROP   it occurs and a symbol in it VANISHES (differential test: the reading is byte-identical with
 *          the symbol deleted). This is the class the corpus diff was blind to — see #584.
 *   LEAK   it occurs and a digit or raw mark SURVIVES into the IPA.
 *
 * A DROP or LEAK is a defect in a language that is already marked done.
 *
 * Usage:  npx tsx tools/normalization/coverage.ts [--langs hu,ro,th] [--max 400]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CELLS } from "./mine.ts";
import { parseJsonc } from "../../src/core/jsonc.ts";

const CORPUS_ROOT = "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data";
const TEXT_COLUMN = 2;

/** The treated languages and their FLEURS corpora — every language that has both a per-language
 *  normalize.ts and transcripts. This is the set the audit is about. */
const TREATED: [string, string | undefined][] = [
    ["am", "am_et"], ["ar", "ar_eg"], ["bn", "bn_in"], ["cmn", "cmn_hans_cn"], ["de", "de_de"],
    ["el", "el_gr"], ["en", "en_us"], ["es", "es_419"], ["fa", "fa_ir"], ["fr", "fr_fr"],
    ["gu", "gu_in"], ["hi", "hi_in"], ["hu", "hu_hu"], ["id", "id_id"], ["it", "it_it"],
    ["ja", "ja_jp"], ["kn", "kn_in"], ["ko", "ko_kr"], ["ml", "ml_in"], ["mr", "mr_in"],
    ["ne", "ne_np"], ["nl", "nl_nl"], ["or", "or_in"], ["pa", "pa_in"], ["pl", "pl_pl"],
    ["pt", "pt_br"], ["ru", "ru_ru"], ["sr", "sr_rs"], ["sw", "sw_ke"], ["ta", "ta_in"],
    ["te", "te_in"], ["th", "th_th"], ["tr", "tr_tr"], ["uk", "uk_ua"], ["ur", "ur_pk"],
    ["vi", "vi_vn"], ["yue", "yue_hant_hk"],
    // No FLEURS corpus — checked entirely from its mined artifact (#585).
    ["my", undefined],
];

/** Symbol classes worth a differential drop test, with the regex that removes each. */
const DROPPABLE: [string, RegExp][] = [
    ["percent", /[%‰]/gu],
    ["currency", /\p{Sc}/gu],
    ["degree", /[°℃℉]/gu],
    ["exponent", /[²³⁰¹⁴-⁹]/gu],
    ["ampersand", /[&＆]/gu],
    ["iteration", /[ๆ々〃ヽヾゝゞៗ]/gu],
];
/** Which cell each drop class reports against. */
const DROP_CELL: Record<string, string> = {
    percent: "percent", currency: "currency", degree: "degrees",
    exponent: "exponent", ampersand: "ampersand", iteration: "iteration",
};

const LEAK = /\p{Nd}|[…。、，％℃°ºª〜～・！？²³\p{Sc}।॥۔؟،؛]/u;

const argv = process.argv.slice(2);
const arg = (n: string, d?: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? d : argv[i + 1];
};
const only = arg("langs")?.split(",").map((s) => s.trim());
const MAX = Number(arg("max", "400"));

function corpusLines(corpus: string): string[] {
    const dir = join(CORPUS_ROOT, corpus);
    const seen = new Set<string>();
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".tsv")))
        for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
            const col = line.split("\t")[TEXT_COLUMN];
            if (col !== undefined && col !== "") seen.add(col);
        }
    return [...seen];
}

const { phonemize } = await import(new URL("../../src/index.ts", import.meta.url).href);
const shown = CELLS.filter((c) => !c.lexical);
const rows: { lang: string; status: Record<string, string>; defects: string[] }[] = [];

/**
 * A language's evidence, artifact FIRST. Every treated language should have a committed
 * tools/corpus/mined/<lang>.jsonc — that is what makes the second round of the sweep cheap (#586), and it
 * is the only evidence a corpus-less language has at all. FLEURS is the fallback for a language whose
 * artifact has not been generated yet.
 */
function evidence(lang: string, corpus: string | undefined): string[] | undefined {
    const art = new URL(`corpus/mined/${lang}.jsonc`, import.meta.url).pathname;
    if (existsSync(art)) {
        const doc = parseJsonc(readFileSync(art, "utf8")) as { hard: { text: string }[]; sample?: string[] };
        return [...doc.hard.map((h) => h.text), ...(doc.sample ?? [])];
    }
    if (corpus === undefined) return undefined;
    try { return corpusLines(corpus); } catch { return undefined; }
}

for (const [lang, corpus] of TREATED) {
    if (only && !only.includes(lang)) continue;
    const lines = evidence(lang, corpus);
    if (lines === undefined) continue;
    const status: Record<string, string> = {};
    const defects: string[] = [];

    for (const cell of shown) {
        const hits = lines.filter((l) => cell.re.test(l));
        if (hits.length === 0) { status[cell.key] = "·"; continue; }
        status[cell.key] = "ok";
        // LEAK: does the reading still carry a digit or a raw mark?
        for (const l of hits.slice(0, MAX)) {
            try {
                if (LEAK.test(phonemize(l, lang) as string)) {
                    status[cell.key] = "LEAK";
                    defects.push(`${cell.key} LEAK: ${l.slice(0, 60)}`);
                    break;
                }
            } catch { /* a throw is its own problem, not this audit's */ }
        }
    }

    // DROP: the differential test, which the leak classes are blind to by construction.
    for (const [name, re] of DROPPABLE) {
        const cell = DROP_CELL[name]!;
        const hits = lines.filter((l) => { re.lastIndex = 0; return re.test(l); });
        if (hits.length === 0) continue;
        for (const l of hits.slice(0, MAX)) {
            try {
                const full = phonemize(l, lang) as string;
                if ((phonemize(l.replace(re, ""), lang) as string) === full) {
                    status[cell] = "DROP";
                    defects.push(`${cell} DROP: ${l.slice(0, 60)}`);
                    break;
                }
            } catch { /* not comparable */ }
        }
    }
    rows.push({ lang, status, defects });
    const bad = Object.values(status).filter((v) => v !== "ok" && v !== "·").length;
    console.error(`${lang} done — ${bad} defective cell(s)`);
}

// Compact matrix: one column per cell, one row per language.
const head = shown.map((c) => c.key.slice(0, 3)).join(" ");
console.log(`\nlang  ${head}`);
for (const r of rows) {
    const cells = shown.map((c) => {
        const v = r.status[c.key] ?? "·";
        return (v === "ok" ? " ok" : v === "·" ? "  ·" : v === "DROP" ? "DRP" : "LEK").padStart(3);
    }).join(" ");
    console.log(`${r.lang.padEnd(5)} ${cells}`);
}

console.log("\n=== defects in languages already marked DONE ===");
let total = 0;
for (const r of rows) {
    if (r.defects.length === 0) continue;
    total += r.defects.length;
    console.log(`\n${r.lang}:`);
    for (const d of r.defects) console.log(`   ${d}`);
}
console.log(`\n${total} defective cells across ${rows.filter((r) => r.defects.length).length}/${rows.length} treated languages`);
