/**
 * Golden outputs for the C# port — PURE ENGINE, no corpus tooling.
 *
 * ⚠ THE byid TSVs ARE NOT USABLE AS PORT GOLDENS: phonemize-fleurs.mts runs the corpus repair path
 * (initialism casing, abbreviation dots, numeralSegments) before phonemizing, so those rows test the
 * repair pipeline plus the engine. The port's contract is `phonemize(text, lang)` alone, so the golden
 * is exactly that call and nothing else.
 *
 * ⚠ THE LANGUAGE LIST IS HARVESTED FROM registry.ts's OWN `case` LABELS — the registry has no
 * enumeration export, and a hand-kept list here would silently rot as languages land.
 *
 * Per language: up to 200 rows of (text \t ipa). Text comes from the FLEURS transcript where the
 * language has one (real running text pins normalization too); otherwise from the module's own
 * lexicon/dictionary TSV headwords (pins the g2p, thinner but real).
 *
 *   npx tsx tools/gen_parity_goldens.mts    -> csharp/goldens/<code>.tsv
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { phonemizeAsync } from "../src/index.ts";

const FLEURS = "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data";
const OUT = "csharp/goldens";
const N = 200;

const registry = readFileSync("src/registry.ts", "utf8");
const codes = [...new Set([...registry.matchAll(/^\s*case "([^"]+)":/gm)].map((m) => m[1]))];

const VARIETY: Record<string, string> = {
  cmn_hans_cn: "cmn", yue_hant_hk: "yue", ar_eg: "arz", es_419: "es", pt_br: "pt",
  fil_ph: "fil", nb_no: "nb", ckb_iq: "ckb", kea_cv: "kea", oc_fr: "oc", ast_es: "ast",
};
const fleursFor = new Map<string, string>();
for (const d of readdirSync(FLEURS)) {
  const code = VARIETY[d] ?? d.split("_")[0];
  if (!fleursFor.has(code)) fleursFor.set(code, d);
}

/** First TSV under the language's likely module dirs, first column = headwords. */
function lexiconWords(code: string): string[] {
  // ⚠ MODULES ARE IN src/, THEIR DATA IS IN data/ since the shared-tree move — this scans both:
  //   the .ts to identify which directory owns the code, the .tsv under data/ for the headwords.
  const guesses = readdirSync("src/languages").filter((d) => {
    try { return readFileSync(`src/languages/${d}/${d.includes("-") ? d : d}.ts`, "utf8").includes(`"${code}"`); }
    catch { return false; }
  });
  for (const dir of guesses.length ? guesses : readdirSync("src/languages")) {
    const base = `data/languages/${dir}`;
    if (!existsSync(base)) continue;
    for (const f of readdirSync(base)) {
      if (!f.endsWith(".tsv")) continue;
      const words: string[] = [];
      for (const line of readFileSync(`${base}/${f}`, "utf8").split("\n")) {
        if (line.startsWith("#") || !line.trim()) continue;
        const w = line.split("\t")[0]?.trim();
        if (w) words.push(w);
        if (words.length >= N) break;
      }
      if (words.length >= 20 && guesses.length) return words;
    }
  }
  return [];
}

mkdirSync(OUT, { recursive: true });
let full = 0, thin = 0;
const skipped: string[] = [];
for (const code of codes) {
  let rows: string[] = [];
  const dir = fleursFor.get(code);
  if (dir && existsSync(`${FLEURS}/${dir}/train.tsv`)) {
    for (const line of readFileSync(`${FLEURS}/${dir}/train.tsv`, "utf8").split("\n")) {
      const c = line.split("\t");
      if (c.length >= 4 && c[3]?.trim()) rows.push(c[3]);
      if (rows.length >= N) break;
    }
  }
  const isThin = !rows.length;
  if (isThin) rows = lexiconWords(code);
  const out: string[] = [];
  for (const text of rows) {
    try {
      const ipa = await phonemizeAsync(text, code);
      if (ipa) out.push(`${text.replace(/\t/g, " ")}\t${ipa}`);
    } catch { /* a row the engine rejects is not a golden */ }
  }
  if (!out.length) { skipped.push(code); continue; }
  writeFileSync(`${OUT}/${code}.tsv`, out.join("\n") + "\n", "utf8");
  isThin ? thin++ : full++;
}
console.log(`${full} full + ${thin} lexicon-only goldens; ${skipped.length} empty: ${skipped.join(" ")}`);
