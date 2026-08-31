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
 * language has one (real running text pins normalization too); failing that from `tools/corpus/mined`,
 * the normalization-mining artifacts (also real running text, see below); and only then from the module's
 * own lexicon/dictionary TSV headwords (pins the g2p, thinner but real).
 *
 * ⚠ THE MINED TIER EXISTS BECAUSE "NO GOLDEN" HAD BECOME THE BINDING CONSTRAINT ON THE PORT. 84 codes had
 * no text source at all and so shipped no golden, and every unported language above ~22M speakers was in
 * that set — pcm (121M), tl (88M), wuu (83M), pnb (66M). A language with no golden cannot be ported at
 * all, because there is nothing to be byte-identical to.
 * `tools/corpus/mined/<code>.jsonc` already holds real running text for 60 of those 84: `sample` (a
 * uniform deterministic stride — the language's real distribution when the artifact is dump-sourced) and
 * `hard` (excerpts selected ADVERSARIALLY to challenge the normalization layer, which is exactly what a
 * golden wants to pin). Both are fed to the same single `phonemize()` call as every other tier, so the
 * port's contract is untouched.
 * ⚠ FOUR THINGS ARE FILTERED, each measured over the 23,214 candidate rows — see
 * `docs/mined_goldens_investigation.md` for the numbers:
 *   · RESIDUAL MEDIAWIKI MARKUP (~1.2%: `]]`, `{{`, `== heading ==`, `| table`, a URL, a stray tag). A
 *     golden row should be text the engine is MEANT to read.
 *   · LENGTH. `segmentMode` is `paragraph`, so these are paragraphs, not sentences: median 199 characters
 *     against the existing goldens' 124, and a tail to 1,200 where the existing max is 366. A
 *     1,200-character row is a bad reference artifact — when it differs, the diff cannot be localised.
 *   · DUPLICATES, since `hard` and `sample` overlap.
 *   · nothing else. Brace code-switch notation, which the ledger tier has to skip, occurs ONCE in 23,214.
 * ⚠ CLEAN ROWS FIRST, and this is the ordering that matters. Mined text is Wikipedia, which cites
 * Latin-script sources and names constantly, so a foreign-script run — which the script router hands to
 * ANOTHER engine — is far commoner here than in the ledger corpus (chv 150 rows of 200, cdo 113, wuu 100;
 * only 8 of the 60 codes have none). A row whose reading needs an unported engine is `Registry.PortPending`
 * on the C# side: blocked, not wrong, but not gateable either. Putting the self-contained rows first makes
 * each golden gateable as early as possible. It is deliberately NOT filtered on "is the target ported
 * today" — that would make a reference artifact a function of the port's progress.
 *
 *   npx tsx tools/gen_parity_goldens.mts    -> csharp/goldens/<code>.tsv
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { phonemizeAsync } from "../src/index.ts";
import { clearForeignOov } from "../src/core/foreign.ts";
import { parseJsonc } from "../src/core/jsonc.ts";
import { scriptOf } from "../src/core/scripts.ts";

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

const MINED = "tools/corpus/mined";
/** Residual MediaWiki syntax the miner did not strip, plus the brace notation the ledger tier skips. */
const MARKUP = /\[\[|\]\]|\{\{|\}\}|<[a-z/!]|https?:\/\/|^\s*\||^=+\s|\s=+$|\{[a-z-]{2,7}:/iu;
const MIN_LEN = 20, MAX_LEN = 400;
const LETTER_RUN = /[\p{L}\p{M}]+/gu;

/**
 * Running text from the mining artifact, filtered and ordered as the header describes: markup and
 * out-of-band lengths rejected, duplicates dropped, then the rows whose every letter run is in the
 * language's OWN script first.
 *
 * ⚠ "Own script" is the artifact's own MODE, not a declared property — the manifest does not carry one and
 * a hand-kept table here would rot exactly like the language list would. Taking the most frequent script
 * across the language's own text is self-correcting and needs no new data.
 */
function minedRows(code: string): string[] {
  const path = `${MINED}/${code}.jsonc`;
  if (!existsSync(path)) return [];
  let doc: { sample?: unknown[]; hard?: { text?: unknown }[] };
  try { doc = parseJsonc(readFileSync(path, "utf8")); } catch { return []; }
  const raw = [
    ...(doc.sample ?? []),
    ...(doc.hard ?? []).map((h) => h?.text),
  ].filter((t): t is string => typeof t === "string");
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    const s = t.trim().replace(/\s+/gu, " ");
    if (s.length < MIN_LEN || s.length > MAX_LEN || MARKUP.test(s) || seen.has(s)) continue;
    seen.add(s);
    kept.push(s);
  }
  const freq = new Map<string, number>();
  for (const t of kept) for (const m of t.matchAll(LETTER_RUN)) {
    const sc = scriptOf(m[0]);
    if (sc !== undefined) freq.set(sc, (freq.get(sc) ?? 0) + 1);
  }
  const own = [...freq].sort((a, b) => b[1] - a[1])[0]?.[0];
  const isClean = (t: string): boolean => {
    for (const m of t.matchAll(LETTER_RUN)) {
      const sc = scriptOf(m[0]);
      if (sc !== undefined && sc !== own) return false;
    }
    return true;
  };
  // ⚠ A STABLE PARTITION, not a sort — `Array.prototype.sort` is not required to be stable across engines
  // for a comparator, and the row ORDER inside each half is the artifact's own and must not move.
  return [...kept.filter(isClean), ...kept.filter((t) => !isClean(t))];
}

/**
 * Codes whose ONLY text source in this repo is a referee lexicon under `tools/referee-eval/referees/`.
 *
 * ⚠ AN EXPLICIT LIST BECAUSE THE CONDITION IS NOT INFERABLE. The generator cannot tell "this language
 * has no rich source" from "the rich source is not in this checkout", and guessing in either direction
 * damages something — see `lexiconWords`. Membership is a claim about the REPO, so it is checked here
 * rather than derived: each of these has no FLEURS split, no `tools/corpus/mined/<code>.jsonc`, and no
 * `data/languages/<dir>/*.tsv`, and each yields at least the 20-headword floor from its referee.
 *
 * ⚠ `mto` IS DELIBERATELY ABSENT: its ASJP list carries only 3 usable headwords, under the floor, so it
 * stays ungated until it has a real source. `en-GB` and the other accent variants are absent because
 * they are built by `tools/gen_variant_golden.mts`, not here — an earlier draft of this tier would have
 * swept `en-gb.wikipron-uk.tsv` (76,284 headwords) into a main golden and missed doing so only because
 * the code is cased `en-GB` and the file `en-gb.*`. Coincidence is not a guard.
 *
 * ⚠ AND `nog` LEFT THIS LIST THE DAY IT GOT A BETTER SOURCE. A language with its own golden generator
 * must NOT be here, because this tier would overwrite that generator's output with the referee headwords
 * — measured, not feared: with `nog` listed, `gen_parity_goldens.mts nog` rewrote the 68-row
 * `tools/gen_nog_golden.mts` artifact down to 24, discarding every numeral-composer arm and the
 * above-2^53 digit fallback, and said "1 lexicon-only golden" while doing it. `quc` has never been here
 * for the same reason (`gen_quc_golden.mts`). The rule: this list is for codes with NO other source at
 * all, and a bespoke generator counts as a source.
 */
const REFEREE_LEXICON_ONLY = new Set(["naq", "smj"]);

/**
 * Headwords from the language's own word list, first column of the first usable TSV.
 *
 * ⚠ TWO LOCATIONS, AND THE SECOND ONE IS WHY SEVEN CODES SHIPPED UNGATED. This scanned only
 * `data/languages/<dir>/*.tsv`, so a language whose only word list lives under
 * `tools/referee-eval/referees/<code>.*.tsv` found nothing and was skipped — and a skipped golden is not
 * a thin gate, it is NO gate: `parity`, `--provenance`, `--ipaspans` and `--poison` all pass over the
 * code in silence, and the fleet count does not move when the port lands, so nothing says it is missing.
 * naq (Nama) and smj (Lule Sami) both shipped that way, each with a referee TSV sitting in the tree the
 * whole time. The referee tier is consulted only AFTER the data/ tier declines, so no existing golden
 * changes source.
 */
function lexiconWords(code: string, allowReferee = false): string[] {
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
  // The referee tier — a lexicon that lives beside the referee harness rather than under data/.
  // ⚠ OPT-IN PER CODE (`REFEREE_LEXICON_ONLY`), NEVER INFERRED. Three ways this tier can do harm, all
  // three measured rather than reasoned about:
  //   · From the mined tier's TOP-UP it grew 16 unrelated goldens (ak, hil, hmn, ilo …) by appending
  //     referee headwords to gates that were already fine. Hence the `thin` path only.
  //   · For a language whose RICH source is merely absent from THIS checkout it is worse than useless.
  //     The FLEURS ledger is a 337 MB artifact that is not always present; without it the generator
  //     yields nothing for ~24 codes and SKIPS them, leaving their committed goldens alone — that skip
  //     is the safety. This tier turns the nothing into something thin, and the thin file then
  //     OVERWRITES the good one: measured, 12 goldens rewritten, quc losing 48 rows and acm 92.
  //   · ⚠ AND THE OBVIOUS GUARD FOR THAT — "only when no golden exists yet" — IS A TRAP, which is why
  //     it is not what this does. It makes the tool's output depend on its own previous output, so the
  //     golden becomes WRITE-ONCE: corrupt `naq.tsv` to a single bogus row, regenerate, and the
  //     corruption survives, because the file existing is what switches the tier off. A reference that
  //     cannot be refreshed when its engine legitimately changes is a worse defect than the one being
  //     fixed, and the failure is silent and undiscoverable.
  // The list states the FACT — these codes have no source but a referee lexicon — instead of inferring
  // it from a file that may simply be missing. Deterministic, refreshable, and no blast radius.
  if (!allowReferee) return [];
  // ⚠ SORTED, so which file wins is deterministic when a code has more than one referee.
  const refDir = "tools/referee-eval/referees";
  if (existsSync(refDir)) {
    for (const f of readdirSync(refDir).sort()) {
      if (!f.startsWith(`${code}.`) || !f.endsWith(".tsv")) continue;
      const words: string[] = [];
      for (const line of readFileSync(`${refDir}/${f}`, "utf8").split("\n")) {
        if (line.startsWith("#") || !line.trim()) continue;
        const w = line.split("\t")[0]?.trim();
        // ⚠ A HEADWORD MUST CONTAIN A LETTER. These files carry the odd bare-mark or punctuation row
        // (naq's list opens with one), and a golden row of `-` pins nothing while reading as noise.
        if (w && /\p{L}/u.test(w)) words.push(w);
        if (words.length >= N) break;
      }
      if (words.length >= 20) return words;
    }
  }
  return [];
}

mkdirSync(OUT, { recursive: true });
let full = 0, mined = 0, thin = 0;
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
  let tier: "full" | "mined" | "thin" = "full";
  if (!rows.length) {
    rows = minedRows(code).slice(0, N);
    tier = "mined";
    // ⚠ TOPPED UP FROM THE LEXICON, so introducing this tier cannot make any golden THINNER. `ar`'s mined
    // pool yields 82 usable rows against the 200 headwords it had; without this, adding running text
    // would have cost it 118 rows of g2p coverage to buy 82 of normalization coverage. The two kinds of
    // row pin different things and a golden is free to hold both — `su`'s already was a word list.
    if (rows.length > 0 && rows.length < N) {
      const have = new Set(rows);
      for (const w of lexiconWords(code)) {
        if (rows.length >= N) break;
        if (!have.has(w)) { have.add(w); rows.push(w); }
      }
    }
  }
  // ⚠ THE REFEREE TIER IS OFFERED ONLY TO THE CODES THAT OPT IN — see `REFEREE_LEXICON_ONLY`.
  if (!rows.length) { rows = lexiconWords(code, REFEREE_LEXICON_ONLY.has(code)); tier = "thin"; }
  const out: string[] = [];
  for (const text of rows) {
    try {
      const ipa = await phonemizeAsync(text, code);
      if (ipa) out.push(`${text.replace(/\t/g, " ")}\t${ipa}`);
    } catch { /* a row the engine rejects is not a golden */ }
  }
  if (!out.length) { skipped.push(code); continue; }
  writeFileSync(`${OUT}/${code}.tsv`, out.join("\n") + "\n", "utf8");
  if (tier === "thin") thin++; else if (tier === "mined") mined++; else full++;
}
console.log(`${full} FLEURS + ${mined} mined + ${thin} lexicon-only goldens; ${skipped.length} empty: ${skipped.join(" ")}`);
