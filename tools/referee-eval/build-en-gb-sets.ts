/**
 * Build the en-GB lexical-set word lists (BATH/CLOTH/yod/PALM) from the wikipron UK referee. For each referee
 * word, run the RULE-ONLY GenAm→RP transform; where a single lexical-set edit (æ→ɑː, ɔː→ɒ, Cuː→Cjuː, or keeping
 * [ɑː] against the LOT rule) turns a folded MISS into a folded MATCH, that word joins the set. This is the
 * SHIPPED refinement — the honest eval stays on phonemizeWordRules (no sets) so the headline % is non-circular.
 *
 *   npx tsx tools/referee-eval/build-en-gb-sets.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { phonemizeWordRules } from "../../src/languages/english-gb/english-gb.ts";
import { CONFIG } from "./config.ts";
import { makeFold } from "./eval.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const fold = makeFold(CONFIG["en-GB"]!);

const rows = readFileSync(join(HERE, "referees", "en-gb.wikipron-uk.tsv"), "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((l) => l.split("\t"))
    .filter((a) => a.length >= 2 && a[0] && a[1]);

const bath: string[] = [], cloth: string[] = [], yod: string[] = [], palm: string[] = [], lotr: string[] = [];
// BATH/CLOTH/PALM/LOTR: a single edit whose folded form must match a referee variant OUTRIGHT.
const edits: [string[], (s: string) => string][] = [
    [bath, (s) => s.replace(/æ/u, "ɑː")],
    [cloth, (s) => s.replace(/ɔː/u, "ɒ")],
    [lotr, (s) => s.replace(/ɑːɹ/u, "ɒɹ")], // LOT before intervocalic r (sorry→sɒɹi; starry stays stɑːɹi → won't match)
    [palm, (s) => s.replace(/ɒ/u, "ɑː")], // LOT rule mis-fired on a PALM word → restore [ɑː]
];
const CORONAL_YOD = /[tdnszθl]j/u; // a post-coronal yod glide (position marker, not a full match)
const CORONAL_U = /[tdnszθl]ʰ?[ˈˌ]?uː/u; // our coronal + (aspiration) + (stress) + GOOSE, the yod-eligible slot

// A word joins a set when the lexical-set edit produces a form the referee ATTESTS — even if a yod-less /
// un-split variant also appears. The BBC target prefers the RP-diagnostic realisation (njuː, ɑː, ɒ) whenever
// it is attested, so yod-retention etc. apply to new/tune/duty even though the referee also lists nuː.
let claimed = 0;
for (const row of rows) {
    const w = row[0]!;
    const refFolded = row.slice(1).map((r) => fold(r));
    const ours = phonemizeWordRules(w);
    // yod first, by POSITION: the referee attests a post-coronal yod that our GOOSE slot lacks (student, tune —
    // caught even when the rest of the word differs, e.g. our schwa vs the referee's syllabic n̩).
    if (CORONAL_U.test(ours) && !CORONAL_YOD.test(ours) && row.slice(1).some((r) => CORONAL_YOD.test(r.normalize("NFD")))) {
        yod.push(w); claimed++; continue;
    }
    for (const [set, edit] of edits) {
        const e = edit(ours);
        if (e !== ours && refFolded.includes(fold(e))) { set.push(w); claimed++; break }
    }
}

const write = (file: string, words: string[]): void => {
    words.sort();
    writeFileSync(join(HERE, "..", "..", "data", "languages", "english-gb", file), words.map((w) => `${w}\t1`).join("\n") + "\n");
    console.log(`  ${file}: ${words.length}`);
};
write("en-gb-bath.tsv", bath);
write("en-gb-cloth.tsv", cloth);
write("en-gb-yod.tsv", yod);
write("en-gb-palm.tsv", palm);
write("en-gb-lotr.tsv", lotr);
console.log(`lexical-set words claimed ${claimed} of ${rows.length}`);
