/**
 * Build src/languages/khmer/km-lexicon-dict.tsv — the SECOND-TIER Khmer lexicon, from an independent dictionary.
 *
 * Run: npx tsx tools/gen/build-km-dict-lexicon.mts <km/data/lexicon.tsv>
 *   source: https://github.com/google/language-resources — km/data/lexicon.tsv, CC BY 4.0, © 2018 Google Inc.
 *
 * ## Why a second tier, and why it excludes most of the dictionary
 *
 * `km-lexicon.tsv` is an EXCEPTIONS lexicon mined from the wikipron referee: it holds the words where the RULES
 * disagree with a human transcription. That has a consequence which is easy to miss and which decides this whole
 * design — for any referee word ABSENT from it, the rules already match wikipron, by construction. Measured:
 *
 *     referee words in the dictionary, NOT in our exceptions lexicon: 3,486
 *       the rules today          3486/3486 = 100.0%
 *       converted dictionary     3071/3486 =  88.1%   ← a REGRESSION of 12pp
 *
 * So adding dictionary entries for referee words would make the engine worse on precisely the words we can check.
 * They are excluded. What is left is the population where no human transcription exists at all, and there the
 * dictionary is measurably the better bet:
 *
 *     referee words in the dictionary (the comparable population): 5,734
 *       the rules            3629/5734 = 63.3%
 *       converted dictionary 4491/5734 = 78.3%   ← +15pp against the same human gold
 *
 * ⚠ AND THE REACHABLE GAIN IS 8.7% OF TOKENS, NOT 60%. A first estimate compared raw lexicon coverage (14.7%)
 * against dictionary coverage (60.4%) and read it as a 4x improvement. That was wrong, because it ignored that the
 * rules already handle most of what the dictionary would cover. Decomposing running text by the evidence actually
 * available for each token:
 *
 *     14.7%  in our exceptions lexicon (wikipron-verified)      → unchanged
 *     37.6%  a referee word not in it (wikipron says rules OK)  → unchanged, and must stay that way
 *      8.7%  NO wikipron, but the dictionary has it             → the only place this file can help
 *     38.9%  nothing anywhere                                   → rules, unverified
 *
 * At +15pp on 8.7% of tokens the expected gain is ~1.3pp overall. Real, and an order of magnitude smaller than the
 * naive framing.
 *
 * ⚠ AND THESE SHARES WERE FIRST MEASURED ON THE WRONG UNIT. They were computed over WRITER-DELIMITED tokens — the
 * ZWSP/space-separated strings a Khmer writer produced — which is not what the engine looks up. Khmer writers
 * delimit inconsistently, so those "tokens" average 19.7 characters against 4.2 for a covered one: a 19.7-character
 * token is not a word, it is an unsegmented multi-word run. The engine looks up what the SEGMENTER hands it, and
 * on that unit the picture is very different:
 *
 *     22.5%  in our exceptions lexicon (wikipron-verified)
 *     61.3%  a referee word not in it (wikipron says the rules are right)
 *      8.7%  NO wikipron, but the dictionary has it            ← unchanged, and the reachable population
 *      7.4%  nothing anywhere                                  ← NOT 38.9%
 *
 * The "38.9% with nothing anywhere" was almost entirely unsegmented runs whose PARTS are covered: segment them and
 * 90.0% of the resulting pieces are in a source, with 62.0% of those tokens splitting entirely into known pieces.
 * Lexicon coverage of running text is therefore 22.5% → 31.3%, not 14.7% → 23.4%. The DELTA this file contributes
 * is the same either way (+8.7pp); what was wrong was the absolute picture, and it made the language look far less
 * covered than it is.
 *
 * ## The phone mapping, and why it stops at 78%
 *
 * The dictionary's 54-phone inventory is not ours. The mapping below was derived by iterating against wikipron
 * agreement — not against our own lexicon, which would only have measured notation drift between two of our own
 * files. Ten further candidate mappings were tried and NINE made agreement worse (ɗ→t −261, ie→ei −411, ɓ→p −419),
 * which is the evidence that the residual 21.7% is genuine disagreement between two independent sources about
 * Khmer vowel realisation rather than a notation gap still to be closed.
 *
 * ⚠ `w` IS POSITIONAL: ʋ as an onset, w as a coda (ʋit, but ʔəw). A flat mapping turned every coda into ʋ.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Dictionary phone → our IPA. Derived by iteration against wikipron; see the header on why it stops here. */
const MAP: Record<string, string> = {
    // aspiration is written as a digraph upstream
    th: "tʰ", ph: "pʰ", kh: "kʰ", ch: "cʰ",
    // length is written by doubling upstream
    aa: "aː", ii: "iː", oo: "oː", ee: "eː", ɑɑ: "ɑː", əə: "əː", uu: "uː", ɛɛ: "ɛː", ɔɔ: "ɔː", ɨɨ: "ɨː",
    // centering diphthongs
    oa: "oə", ea: "eə", ie: "iə",
    // the dictionary carries a /g/ for loanwords; Khmer has no voiced velar stop
    g: "k",
};

/** One dictionary transcription (`k ɑɑ . m aa` style) → our IPA. */
export function convert(ipa: string): string {
    return ipa.split(" . ")
        .map((syl) => syl.split(" ").filter(Boolean)
            // ⚠ positional: ʋ as an onset, w as a coda
            .map((x, k) => (x === "w" ? (k === 0 ? "ʋ" : "w") : MAP[x] ?? x)).join(""))
        .join("");
}

/**
 * ⚠ THE BODY BELOW RUNS ONLY WHEN THIS FILE IS THE ENTRY POINT, and the guard is not cosmetic. `convert` is
 * imported by `tools/khmer/eval_shipped_heldout.ts`, and an ES import executes the whole module — so importing
 * it used to REBUILD AND OVERWRITE `km-lexicon-dict.tsv` as a side effect, using whatever `process.argv[2]`
 * the importing tool happened to take. It went unnoticed because the rebuild was byte-identical; it would not
 * have been if the caller's argument had pointed at a different dictionary.
 */
const src = process.argv[2];
const isEntryPoint = process.argv[1] !== undefined
    && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isEntryPoint && src === undefined) {
    console.error("usage: build-km-dict-lexicon.mts <km/data/lexicon.tsv from google/language-resources>");
    process.exit(2);
}
if (isEntryPoint && src !== undefined) main(src);

function main(src: string): void {
const here = dirname(fileURLToPath(import.meta.url));
const KHMER_WORD = /^[ក-៓ៜ-៝]{1,}$/u;

/** Words the wikipron referee already settles — see the header: adding these would be a measured regression. */
const settled = new Set<string>();
for (const l of readFileSync(join(here, "../referee-eval/referees/km.wikipron-khm-broad.tsv"), "utf8").split("\n"))
    if (!l.startsWith("#") && l.includes("\t")) settled.add(l.split("\t")[0]!);
/** And the exceptions lexicon takes precedence at runtime anyway; excluded here so the file carries no dead rows. */
for (const l of readFileSync(join(here, "../../src/languages/khmer/km-lexicon.tsv"), "utf8").split("\n"))
    if (!l.startsWith("#") && l.includes("\t")) settled.add(l.split("\t")[0]!);

const rows: [string, string][] = [];
let skippedSettled = 0, skippedShape = 0;
for (const line of readFileSync(src, "utf8").split("\n")) {
    if (line.startsWith("#") || !line.includes("\t")) continue;
    const parts = line.split("\t");
    const word = parts[0]?.trim(), ipa = parts[1]?.trim();
    if (!word || !ipa) continue;
    if (!KHMER_WORD.test(word)) { skippedShape++; continue; }   // the upstream file is a TTS dictionary: Latin names, digits
    if (settled.has(word)) { skippedSettled++; continue; }
    rows.push([word, convert(ipa)]);
}
rows.sort((a, b) => a[0].localeCompare(b[0]));

const out = join(here, "../../src/languages/khmer/km-lexicon-dict.tsv");
writeFileSync(out, `# Khmer SECOND-TIER lexicon — word → IPA, for words no human transcription covers.
#
# SOURCE:  https://github.com/google/language-resources  (km/data/lexicon.tsv)
# LICENSE: Creative Commons Attribution 4.0 International (CC BY 4.0)
#          https://creativecommons.org/licenses/by/4.0/
#          "Copyright 2018 Google Inc. All Rights Reserved." — the upstream file's own header.
# ATTRIBUTION: Google Inc., language-resources project. Used under CC BY 4.0. Phone inventory converted to this
#          project's IPA conventions by tools/gen/build-km-dict-lexicon.mts; the readings are Google's.
#
# ⚠ CONSULTED AFTER km-lexicon.tsv, NEVER BEFORE. That file is wikipron-verified and wins every conflict.
# ⚠ AND IT DELIBERATELY OMITS EVERY WORD THE REFEREE COVERS. For a referee word absent from the exceptions
#   lexicon the RULES already match wikipron by construction, and this dictionary agrees with wikipron only 88.1%
#   of the time on those — so including them would be a measured 12pp regression. See the generator's header.
#
# Measured: on the 5,734 referee words this dictionary does cover, it agrees with wikipron 78.3% against the
# rules' 63.3%. It is the better evidence where no human transcription exists — 8.7% of the units the engine looks
# up, which is the whole reachable population for this file.
#
# Coverage of running text, measured on the SEGMENTED unit (what the engine looks up, not the writer-delimited
# token — those average 19.7 characters and are multi-word runs): the exceptions lexicon alone reaches 22.5%, and
# with this file 31.3%. Only 7.4% of lookups then have no human or curated evidence behind them.
#
# Regenerate: npx tsx tools/gen/build-km-dict-lexicon.mts <km/data/lexicon.tsv>
# ENTRIES: ${rows.length}
${rows.map(([w, p]) => `${w}\t${p}`).join("\n")}\n`, "utf8");

console.log(`  kept ${rows.length.toLocaleString()} entries`);
console.log(`  skipped ${skippedSettled.toLocaleString()} already settled by wikipron / the exceptions lexicon`);
console.log(`  skipped ${skippedShape.toLocaleString()} non-Khmer rows (the upstream file is a TTS dictionary)`);
console.log(`  → ${out}`);
}
