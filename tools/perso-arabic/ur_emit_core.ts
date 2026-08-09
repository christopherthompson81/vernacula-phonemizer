/**
 * Emit the LEXICON-FREE Urdu backbone (`phonemizeWordCore`) for a list of skeletons.
 *
 * Used by ur_build_dakshina_labels.py: the core supplies the consonant + long-vowel skeleton with
 * default [ə] in every unwritten slot, and the Dakshina romanization then overwrites the vowel
 * QUALITY. Keeping the backbone from our own engine (rather than reconstructing it from the roman)
 * means the labels are in our canonical convention by construction.
 *
 *   npx tsx tools/perso-arabic/ur_emit_core.ts <words.txt> > <out.tsv>
 */
import { readFileSync } from "node:fs";

import { phonemizeWordCore } from "../../src/languages/urdu/urdu.ts";

const path = process.argv[2];
if (!path) throw new Error("usage: ur_emit_core.ts <words.txt>");

const out: string[] = [];
for (const line of readFileSync(path, "utf8").split("\n")) {
    const w = line.trim();
    if (!w) continue;
    let ipa = "";
    try {
        ipa = phonemizeWordCore(w);
    } catch {
        continue;
    }
    if (ipa) out.push(`${w}\t${ipa}`);
}
process.stdout.write(out.join("\n") + "\n");
