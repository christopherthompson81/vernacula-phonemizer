/**
 * Emit (skeleton, IPA) pairs from the two vowelized-Urdu silver sources (harakat.ur.silver.tsv + lexicon.ur.tsv)
 * by running their vocalized forms through OUR Urdu g2p — same convention the tagger must output. Merged with the
 * Hindi-derived IPA silver, this ~doubles the tagger training pool. Run 3 of the ur-tagger investigation.
 *   npx tsx tools/perso-arabic/ur_extra_pool.ts > tools/perso-arabic/ur_extra_pool.tsv
 */
import { readFileSync } from "node:fs";
import { phonemizeWord } from "../../src/languages/urdu/g2p.ts";

const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/gu;
const seen = new Set<string>();
for (const f of ["harakat.ur.silver.tsv", "lexicon.ur.tsv"]) {
    for (const line of readFileSync(`${import.meta.dirname}/${f}`, "utf8").split("\n")) {
        const p = line.split("\t");
        if (p.length < 3 || !p[2]) continue;
        const voc = p[2].normalize("NFC");           // vocalized Urdu (with harakat)
        const skel = voc.replace(HARAKAT, "");        // strip diacritics → skeleton
        if ([...skel].length < 2 || seen.has(skel)) continue;
        const ipa = phonemizeWord(voc).replace(/[ˈˌ]/gu, "");
        if (!ipa) continue;
        seen.add(skel);
        process.stdout.write(`${skel}\turd\t${ipa}\n`);
    }
}
process.stderr.write(`emitted ${seen.size} extra (skeleton, IPA) pairs\n`);
