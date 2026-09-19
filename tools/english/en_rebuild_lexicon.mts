/**
 * Rebuild `accent-lexicon.tsv` from its ARPABET source through the SAME converter the engine uses, so a
 * change to `makeArpabetToIpa` (or to `isBarredI` inside it) reaches the FLAT LEXICON and not only the OOV
 * and tagger paths.
 *
 * ⚠ THIS EXISTS BECAUSE A RULE CHANGE ALONE SPLITS THE TWO PATHS APART. `services` is a flat-lexicon hit,
 * resolved before the OOV G2P ever runs, so editing the rule changes what the G2P would have produced for
 * it and changes nothing about what is actually said. Either the lexicon is rebuilt or the engine answers
 * one way for recorded words and another for unrecorded ones in the same environment.
 *
 * ⚠ THE CORRECTNESS TEST IS THE ROUND TRIP, and it is exact: on an unmodified tree every row that has an
 * ARPABET source regenerates to the byte-identical IPA already committed. That is what licenses a rebuild —
 * whatever differs after a rule change differs BECAUSE of the rule, not because the rebuild drifts.
 *
 * Rows with no `g2p-dict.tsv` entry (contractions such as `wasn't`, hand-added entries) have no source to
 * regenerate from and are passed through untouched.
 *
 *   npx tsx tools/english/en_rebuild_lexicon.mts            verify only — prints the round-trip census
 *   npx tsx tools/english/en_rebuild_lexicon.mts --write    rewrite the lexicon in place
 *   npx tsx tools/english/en_rebuild_lexicon.mts --diff     list every row whose IPA would change
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeArpabetToIpa } from "../../src/languages/english/englishArpabet.ts";
import { MANIFEST } from "../../src/languages/english/manifest.ts";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "languages", "english");
const LEXICON = join(DATA, "accent-lexicon.tsv");
const write = process.argv.includes("--write");
// ⚠ OPT-IN: a bare rebuild must stay byte-stable, so adding rows is never implicit.
const addMissing = process.argv.includes("--add-missing");
const showDiff = process.argv.includes("--diff");

// ⚠ THE SAME TABLE THE ENGINE LOADS. Rendering the flat lexicon without it would bake plain schwas
// into exactly the words the engine would now read as syllabic — the two-path split this tool exists
// to prevent, in a new place.
const syllabic = new Map<string, number[]>();
for (const line of readFileSync(join(DATA, "en-syllabic.tsv"), "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const tab = line.indexOf("\t");
    if (tab <= 0) continue;
    syllabic.set(line.slice(0, tab), line.slice(tab + 1).trim().split(",").map(Number));
}

// ⚠ AND SO MUST THE SEAM TABLE, for the same reason: the velar assimilation it blocks is baked into
// this file, so a rebuild without it would silently re-assimilate every `pan·cake` seam.
const nasalSeam = new Map<string, number[]>();
for (const line of readFileSync(join(DATA, "en-nasal-seam.tsv"), "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const tab = line.indexOf("\t");
    if (tab <= 0) continue;
    nasalSeam.set(line.slice(0, tab), line.slice(tab + 1).trim().split(",").map(Number));
}

const toIpa = makeArpabetToIpa(MANIFEST.arpabet, syllabic, nasalSeam);

const arpabet = new Map<string, string[]>();
for (const line of readFileSync(join(DATA, "g2p-dict.tsv"), "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [word, phones] = line.split("\t");
    if (word && phones) arpabet.set(word, phones.trim().split(" "));
}

let regenerated = 0, unchanged = 0, noSource = 0, malformed = 0;
const changes: string[] = [];
const out: string[] = [];

for (const line of readFileSync(LEXICON, "utf8").split("\n")) {
    // Comments, the trailing blank and anything not in the 3-column shape survive verbatim.
    if (!line || line.startsWith("#")) { out.push(line); continue; }
    const fields = line.split("\t");
    const word = fields[0], ipa = fields[2]?.trim();
    if (fields.length !== 3 || !word || !ipa) { malformed++; out.push(line); continue; }
    const phones = arpabet.get(word);
    if (!phones) { noSource++; out.push(line); continue; }
    const rebuilt = toIpa(phones, word);
    if (rebuilt === ipa) unchanged++;
    else { regenerated++; changes.push(`${word}\t${ipa}\t→\t${rebuilt}`); }
    out.push(`${word}\t${fields[1]}\t${rebuilt}`);
}

/**
 * ⚠ A DICT WORD ABSENT FROM THE LEXICON IS INVISIBLE TO THE ENGINE, and the loop above cannot see it —
 * it walks the LEXICON and looks each row's ARPABET up, so a word added to `g2p-dict.tsv` and nowhere
 * else reaches only the OOV path's compound/morph tier and is never a lookup hit. That is what the
 * 16,393-row Moby import (#1344, `moby-import.tsv`) would have been: present in the dict, absent from
 * the flat lexicon, and therefore still guessed at by the tagger at runtime.
 * ⚠ APPENDED, NOT MERGED IN PLACE, and then the whole file is re-sorted below — the lexicon is otherwise
 * byte-stable under a rebuild, and that stability is what makes the round-trip check above meaningful.
 */
let added = 0;
if (addMissing) {
    const known = new Set(out.filter((l) => l.includes("\t")).map((l) => l.split("\t")[0]!));
    for (const [word, phones] of arpabet) {
        if (known.has(word)) continue;
        out.push(`${word}\t\t${toIpa(phones, word)}`);
        added++;
    }
    // keep the file's own ordering convention rather than leaving a block bolted on the end
    // ⚠ NOT `out.push(...body)` — spreading 140k arguments overflows the call stack (RangeError).
    const head = out.filter((l) => l.startsWith("#"));
    const body = out.filter((l) => l.includes("\t")).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    out.length = 0;
    for (const l of head) out.push(l);
    for (const l of body) out.push(l);
    console.log(`rows ADDED from the dict (--add-missing): ${added}`);
}

const sourced = unchanged + regenerated;
console.log(`rows with an ARPABET source: ${sourced}`);
console.log(`  reproduce the committed IPA: ${unchanged}`);
console.log(`  would change:                ${regenerated}`);
console.log(`rows with no ARPABET source (passed through): ${noSource}`);
if (malformed) console.log(`rows not in the 3-column shape (passed through): ${malformed}`);
console.log(`round-trip fidelity on an unmodified tree: ${((100 * unchanged) / sourced).toFixed(2)}%`);

if (showDiff) for (const c of changes) console.log("  ", c);

if (write) {
    writeFileSync(LEXICON, out.join("\n"));
    console.log(`\nwrote ${LEXICON}`);
} else if (regenerated > 0) {
    console.log(`\n(${regenerated} rows would change — re-run with --write to apply, --diff to list)`);
}
