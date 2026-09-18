/**
 * Import Moby headwords this dictionary LACKS, where misaki gold independently agrees.
 *
 *   MOBY=… GOLD=… npx tsx tools/english/en_import_moby.mts [--write]
 *
 * ⚠ THE DICTIONARY IS 117,482 CURATED ROWS AND THIS ADDS ~16,000, so the bar is the same two-source
 * standard every one of #1334–#1341's corrections had to clear: Moby and gold must AGREE, after both are
 * converted and folded to this engine's conventions. 57,503 Moby headwords are absent from the dict; gold
 * has no reading for 33,691 of them and disagrees on 7,414. What is left is what ships.
 *
 * ⚠ AND THE CONVERSION IS THE OPPOSITE OF THE REFEREE'S, WHICH IS THE WHOLE POINT OF DOING IT HERE.
 * `tools/gen/build-en-moby-referee.mts` deliberately does NOT fold marry–merry or the conservative yod,
 * so the referee can still catch a regression on them. A row entering the LEXICON has to go the other way:
 * it must arrive in this engine's conventions, so it is fully modernised — FORCE→NORTH, yod-dropping, and
 * æɹ→ɛɹ — or it would contradict the 402 marry–merry rows and the yod work in the dictionary it joins.
 *
 * ⚠ THE MANIFEST IS THE POINT, NOT A LOG. `en_g2p_ngram.ts --emit` REGENERATES g2p-dict.tsv FROM $CMUDICT
 * and would silently drop every row below — exactly the hazard `g2p-curated.tsv` exists for. This file is
 * the record that makes that loss visible and re-appliable, and `build-en-moby-referee.mts` READS IT to
 * exclude these words from both referee corpora: having imported Moby's reading, scoring ourselves against
 * Moby on the same word would be a mirror.
 *
 * ⚠ THESE WORDS ARE ALL OUTSIDE THE 40k FREQUENCY LIST — measured, 0 of 57,503 are in it — because the
 * dictionary was built to cover that list, so anything missing from it is rare by construction. The win is
 * coverage of the proper-noun / rare tail the OOV tier guesses at, not frequency-weighted quality.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mobyToArpabet, goldToArpabet, modernise, normalise } from "./en_source_compare.mts";
import { americanSpelling } from "../../src/languages/english/spellingVariants.ts";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EN = join(REPO, "data/languages/english");
const MOBY = process.env["MOBY"], GOLD = process.env["GOLD"];
if (!MOBY || !GOLD) throw new Error("set MOBY (mobypron.unc) and GOLD (misaki us_gold.json)");

const dict: [string, string][] = [];
const have = new Set<string>();
for (const l of readFileSync(join(EN, "g2p-dict.tsv"), "utf8").split("\n")) {
    if (l.startsWith("#") || !l.includes("\t")) continue;
    const [w, p] = l.split("\t");
    dict.push([w!, p!]); have.add(w!.toLowerCase());
}
const gold: Record<string, unknown> = JSON.parse(readFileSync(GOLD, "utf8"));
const goldOf = (w: string): string | undefined => {
    const v = gold[w] ?? gold[w[0]!.toUpperCase() + w.slice(1)];
    return typeof v === "string" ? v : undefined;
};
/** æɹ → ɛɹ: the marry–merry merger this engine applies (#1336). Moby is unmerged. */
const merge = (a: string[]): string[] =>
    a.map((p, i) => (p.replace(/[0-2]$/u, "") === "AE" && a[i + 1]?.replace(/[0-2]$/u, "") === "R"
        ? p.replace("AE", "EH") : p));

const rows: string[] = [];
const seen = new Set<string>();
let noGold = 0, disagree = 0, skipped = 0, shadowed = 0;
for (const line of readFileSync(MOBY, "latin1").split(/\r\n|\r|\n/u)) {
    const sp = line.indexOf(" "); if (sp < 0) continue;
    const w = line.slice(0, sp).toLowerCase();
    if (have.has(w) || seen.has(w)) continue;
    // ⚠ ≥3 LETTERS: a one- or two-letter headword is a GLYPH, not a word, and its reading is not constant
    // — the same reason the wikipron referee excludes them (`x` is the letter's SOUND, `m` its NAME).
    if (!/^[a-z]{3,20}$/u.test(w)) { skipped++; continue; }
    const m = mobyToArpabet(line.slice(sp + 1)); if (!m) { skipped++; continue; }
    seen.add(w);
    const g = goldOf(w); if (!g) { noGold++; continue; }
    const ga = goldToArpabet(g); if (!ga) { noGold++; continue; }
    const ours = merge(modernise(m));
    if (normalise(ours) !== normalise(ga)) { disagree++; continue; }
    // ⚠ A COMMONWEALTH SPELLING THE FOLD ALREADY RESOLVES MUST NOT BE IMPORTED. `analyse` was not in the
    // dictionary and did not need to be: `americanSpelling` mapped it to `analyze`, which carries this
    // repo's curated reading AND its `en-syllabic.tsv` marking. Giving it its own row SHADOWS the fold —
    // the lookup now hits first — and swaps a curated reading for a raw imported one. 188 rows, caught by
    // english-spelling-variants.test.ts when `analyse` lost its ə̆.
    if (americanSpelling(w, (x) => have.has(x)) !== undefined) { shadowed++; continue; }
    rows.push(`${w}\t${ours.join(" ")}`);
}
rows.sort();
console.log(`considered ${seen.size + skipped}  skipped ${skipped}  no gold ${noGold}  gold disagrees ${disagree}  shadows a spelling fold ${shadowed}`);
console.log(`IMPORTABLE (moby + gold agree): ${rows.length}`);

if (!process.argv.includes("--write")) { console.log("\n(dry run — pass --write to apply)"); process.exit(0); }

writeFileSync(join(EN, "moby-import.tsv"),
    `# THE MOBY IMPORT LAYER — headwords g2p-dict.tsv lacked, where Moby AND misaki gold agree.\n` +
    `# Moby Pronunciator II (Grady Ward, Project Gutenberg #3205), PUBLIC DOMAIN by grant from the author,\n` +
    `# January 2001. See LICENSES/PROVENANCE.md §5.3 and tools/english/en_import_moby.mts.\n` +
    `#\n` +
    `# ⚠ RE-APPLY THIS AFTER ANY \`en_g2p_ngram.ts --emit\`, which rebuilds g2p-dict.tsv from $CMUDICT and\n` +
    `# carries none of these rows — the same hazard g2p-curated.tsv exists for.\n` +
    `# ⚠ AND tools/gen/build-en-moby-referee.mts READS THIS FILE to exclude these words from both referee\n` +
    `# corpora. Having imported Moby's reading, scoring ourselves against Moby on the same word is a mirror.\n` +
    `#\n# word <TAB> ARPABET (Moby, modernised to this engine's conventions; gold concurring)\n` +
    rows.join("\n") + "\n");

const merged = [...dict, ...rows.map((r) => r.split("\t") as [string, string])]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
writeFileSync(join(EN, "g2p-dict.tsv"),
    `# word <TAB> ARPABET. CMUdict (public domain) → the OOV G2P dict (compound pieces / morph stems),\n` +
    `# plus ${rows.length} rows imported from Moby Pronunciator II where misaki gold concurs — see\n` +
    `# moby-import.tsv, which is the re-appliable record of that layer.\n` +
    merged.map(([w, p]) => `${w}\t${p}`).join("\n") + "\n");
console.log(`wrote moby-import.tsv (${rows.length}) and g2p-dict.tsv (${merged.length} rows)`);
