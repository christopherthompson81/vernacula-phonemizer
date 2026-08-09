/**
 * Emit BOTH the raw g2p output (maximal default-[ə], before finalizeUrduIpa) and the finished core,
 * so schwa-placement policies can be compared offline without editing the engine.
 *
 * The raw form is what the abjad licenses: a default [ə] after every non-final consonant. The core
 * is that after Ohala medial deletion. Run 17 measures which policy actually matches Urdu.
 *
 *   npx tsx tools/perso-arabic/ur_emit_raw.ts <words.txt> > <out.tsv>   # word \t raw \t core
 */
import { readFileSync } from "node:fs";

import { phonemizeWord as g2p } from "../../src/languages/urdu/g2p.ts";
import { phonemizeWordCore } from "../../src/languages/urdu/urdu.ts";

const path = process.argv[2];
if (!path) throw new Error("usage: ur_emit_raw.ts <words.txt>");

const out: string[] = [];
for (const line of readFileSync(path, "utf8").split("\n")) {
    const w = line.trim();
    if (!w) continue;
    try {
        const raw = g2p(w).replace(/̲/gu, "");
        const core = phonemizeWordCore(w);
        if (raw) out.push(`${w}\t${raw}\t${core}`);
    } catch {
        continue;
    }
}
process.stdout.write(out.join("\n") + "\n");
