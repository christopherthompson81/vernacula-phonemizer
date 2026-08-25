/**
 * Golden outputs for the C# port — PURE ENGINE, no corpus tooling.
 *
 * ⚠ THE byid TSVs ARE NOT USABLE AS PORT GOLDENS: phonemize-fleurs.mts runs the corpus repair path
 * (initialism casing, abbreviation dots, numeralSegments) before phonemizing, so those rows test the
 * repair pipeline plus the engine. The port's contract is `phonemize(text, lang)` alone, so the golden
 * is exactly that call and nothing else.
 * ⚠ BUT THAT ARGUMENT WAS OVER-APPLIED, AND IT COST THE GOLDENS THEIR CASING. Avoiding the repair
 * PIPELINE is right; avoiding the repaired TEXT is not. This generator used to take FLEURS column 3, the
 * LOWERCASED, punctuation-stripped field — so every golden row in the fleet was lowercase, and the parity
 * corpus never exercised casing at all: not initialisms, not proper nouns, not a case-sensitive rule.
 * Italian's compass shipped a wrong reading INTO a golden for exactly that reason (`35°w` read as
 * "thirty-fifth double-u"), and the golden recorded it as correct.
 * The alignment ledger already holds the right string: `utt.read_text` is what the phonemizer actually
 * read — raw casing and punctuation carried through, `restoreInitialismCasing` applied on the 22k `auto`
 * rows, and 209 `hand` rows where a reader diverged from the written text. Feeding it to `phonemize()` is
 * still exactly one call, so the port's contract is untouched — the INPUT is simply no longer impoverished.
 * ⚠ ROWS CARRYING A CODE-SWITCH SPAN (`{en:nineteen forty five}`) ARE SKIPPED: those braces are corpus
 * notation for a multi-engine read, and `phonemize()` would voice them literally.
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
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { phonemizeAsync } from "../src/index.ts";
import { clearForeignOov } from "../src/core/foreign.ts";

const FLEURS = "/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data";
/** The alignment ledger. `read_text.py` and its siblings own it; this reads it and never writes. */
const ALIGN_DB = `${process.env["ASR_ALIGN_ROOT"] ?? "/mnt/data/omnivoice_ipa"}/work/asr_align/align.sqlite`;
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
/**
 * `read_text` per language, out of the alignment ledger, keyed by this repo's language code.
 *
 * ⚠ ONE SUBPROCESS FOR THE WHOLE FLEET, not one per language: the ledger is 337 MB over 270k rows and
 * paying the open cost 190 times is minutes of nothing.
 * ⚠ `node:sqlite` IS NOT AVAILABLE HERE (Node 22.12 predates it) and the `sqlite3` CLI on this machine is
 * an Android SDK build, so neither is a dependency worth taking. Python's stdlib `sqlite3` is, and the
 * corpus tooling next door is already Python.
 * ⚠ READ-ONLY, VIA `mode=ro`. This generator must never be the thing that writes to the ledger.
 */
function readTextByCode(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!existsSync(ALIGN_DB)) return out;
  const py = `
import sqlite3, sys
db = sqlite3.connect("file:${ALIGN_DB}?mode=ro", uri=True)
q = """select lang, read_text from utt
       where read_text is not null and read_text <> ''
         and read_text not like '%{%:%}%'
       order by lang, sentence_id, wav"""
for lang, txt in db.execute(q):
    # chr(9)/print rather than an escape: this source is embedded in a TS template literal, and a
    # backslash escape here is consumed by the wrong language before Python ever sees it.
    print(lang + chr(9) + " ".join(txt.split()))
`;
  const dump = execFileSync("python3", ["-c", py], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  for (const line of dump.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 1) continue;
    const dir = line.slice(0, tab);
    const code = VARIETY[dir] ?? dir.split("_")[0]!;
    // ⚠ FIRST DIRECTORY WINS, matching `fleursFor` above — a language with two FLEURS varieties must not
    // have its golden silently assembled from both.
    if (fleursFor.get(code) !== dir) continue;
    const list = out.get(code) ?? [];
    if (list.length < N) list.push(line.slice(tab + 1));
    out.set(code, list);
  }
  return out;
}
const readTextFor = readTextByCode();

/** Optional filter: `npx tsx tools/gen_parity_goldens.mts it de` regenerates only those. */
const only = new Set(process.argv.slice(2));

for (const code of codes) {
  if (only.size > 0 && !only.has(code)) continue;
  // ⚠ THE MEMO IS GLOBAL AND THIS LOOP IS ONE PROCESS. A mixed-script language's prewarm leaves BiLSTM
  // readings behind, and a Latin-script language rendered later picks them up through the foreign reader —
  // producing a golden row that only exists because of what ran BEFORE it. Measured: 15 Māori rows the
  // engine cannot reproduce on its own, `duxbury` among them. Clearing per language makes the artifact a
  // function of the language alone, which is the whole point of a reference file.
  clearForeignOov();
  let rows: string[] = (readTextFor.get(code) ?? []).slice(0, N);
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
