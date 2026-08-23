/**
 * Correct the o/ɔ (loi de position) in the Lexique-derived French lexicon toward STANDARD French. Lexique 3.83
 * merges ⟨o⟩ to [o] in many closed/open syllables (comment→komɑ̃, occuper→okype) where standard Parisian — and the
 * adjudicated gold — has [ɔ] (kɔmɑ̃, ɔkype). Our g2p now does the standard loi de position (grapheme-aware, so it
 * keeps ⟨au⟩/⟨ô⟩→[o]). For each lexicon entry where the g2p agrees with Lexique on EVERYTHING EXCEPT o↔ɔ, adopt the
 * g2p's value (correct o/ɔ + same segments elsewhere); otherwise keep Lexique (real irregular). Self-contained.
 *
 *   npx tsx tools/gen/fix-fr-lexicon-loi.mts            # rewrite src/languages/french/lexicon.tsv
 *   npx tsx tools/gen/fix-fr-lexicon-loi.mts --dry      # report counts only
 */
import { readFileSync, writeFileSync } from "node:fs";
import { toIpa } from "../../src/languages/french/g2p.ts";

const LEX = new URL("../../data/languages/french/lexicon.tsv", import.meta.url)
    .pathname;
const oNeutral = (s: string) => s.replace(/[oɔ]/gu, "O");

const lines = readFileSync(LEX, "utf8").split("\n");
const out: string[] = [];
let corrected = 0,
    kept = 0;
for (const l of lines) {
    if (!l.trim() || l.startsWith("#")) {
        out.push(l);
        continue;
    }
    const [w, ipa] = l.split("\t");
    if (!w || !ipa) {
        out.push(l);
        continue;
    }
    const g = toIpa(w);
    // Same word except o↔ɔ (and the g2p actually differs) → take the g2p's standard loi de position.
    if (g !== ipa && oNeutral(g) === oNeutral(ipa)) {
        out.push(`${w}\t${g}`);
        corrected++;
    } else {
        out.push(l);
        kept++;
    }
}
console.log(`lexicon: ${corrected} entries o/ɔ-corrected toward standard, ${kept} kept (Lexique)`);
if (!process.argv.includes("--dry"))
    writeFileSync(LEX, out.join("\n").replace(/\n+$/, "\n"));
