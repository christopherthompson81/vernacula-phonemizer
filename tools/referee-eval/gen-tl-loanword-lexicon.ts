/**
 * Generate src/languages/tagalog/loanword-lexicon.tsv — a SHIPPED word→IPA override for the loanword FOREIGN-SEGMENT
 * class only: Spanish ⟨j⟩→[h] (abenojar→abenohaɾ) and soft ⟨c⟩→[s] (abece→abese). These are origin-specific — native
 * Tagalog has neither — so pinning them never touches native vocabulary (verified against a native canary set below).
 *
 * The BROADER loanword VV/glide/hiatus class is deliberately NOT mined: the SAME spelling is native [ij]/hiatus-ʔ vs
 * loanword glide/plain, so a referee-mined pin corrupts core words (siya→sia, tao→tao without its phonemic ʔ). That
 * class stays a documented residual. See docs/tl_native_bringup_investigation.md.
 *
 * Each pin is built by applying the foreign op to OUR OWN shipped-no-loan output (so it inherits our stress + final-ʔ)
 * and is kept ONLY if (a) all referee readings agree and (b) the op makes our folded output match the referee. The
 * baseline is phonemizeShippedNoLoan (NOT phonemizeWord) so regenerating is idempotent (it never loads this file).
 * Run: npx tsx tools/referee-eval/gen-tl-loanword-lexicon.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { phonemizeShippedNoLoan } from "../../src/languages/tagalog/tagalog.ts";
import { makeFold } from "./eval.ts";
import { CONFIG } from "./config.ts";

const fold = makeFold(CONFIG.tl!);

/** Orthography-gated foreign ops applied to our own IPA — each verified against the referee before it is kept. */
function foreignOps(word: string, ipa: string): string[] {
    const lw = word.toLowerCase();
    const out: string[] = [];
    if (lw.includes("j")) out.push(ipa.replace(/d͡ʒ/g, "h")); // Spanish ⟨j⟩ → [h]
    if (/c[eiy]/.test(lw)) out.push(ipa.replace(/k/g, "s")); // soft ⟨c⟩ → [s] (verified: only fires where all [k]→[s] matches)
    return out;
}

// native canaries: if any of these is ever pinned, the mining is unsafe — abort.
const NATIVE_CANARIES = ["siya", "kaniya", "tao", "maaari", "niya", "tiya", "biyaya", "kaniyang", "siyang"];

const rows = readFileSync(new URL("./referees/tl.wikipron-tgl-broad.tsv", import.meta.url), "utf8")
    .split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t"));

const out: string[] = [];
const pinnedCanaries: string[] = [];
for (const r of rows) {
    const w = r[0]!;
    const refs = [...new Set(r.slice(1).map((x) => x.replace(/\s+/g, "")))];
    if (!refs.length) continue;
    const ours = phonemizeShippedNoLoan(w);
    if (refs.some((rf) => fold(rf) === fold(ours))) continue; // already correct
    if (new Set(refs.map(fold)).size !== 1) continue; // referees disagree → abstain
    const fixed = foreignOps(w, ours).find((c) => c !== ours && refs.some((rf) => fold(rf) === fold(c)));
    if (!fixed) continue;
    out.push(`${w}\t${fixed}`);
    if (NATIVE_CANARIES.includes(w)) pinnedCanaries.push(w);
}
if (pinnedCanaries.length) throw new Error(`native canaries pinned (unsafe): ${pinnedCanaries.join(", ")}`);
out.sort();
const header =
    "# Tagalog LOANWORD lexicon (SHIPPED override) — the FOREIGN-SEGMENT loanword class only: Spanish ⟨j⟩→[h]\n" +
    "# (abenojar→abenohaɾ) and soft ⟨c⟩→[s] (abece→abese). Origin-specific (native Tagalog has neither), so pinning\n" +
    "# never touches native words. Built by applying the foreign op to our OWN shipped output (inherits our stress +\n" +
    "# final-ʔ) and keeping it only where all wikipron readings agree AND the op matches the referee. The broader VV/\n" +
    "# glide/hiatus loanword class is NOT mined (same spelling = native [ij]/hiatus-ʔ vs loanword glide → would corrupt\n" +
    "# siya/tao). SHIPPED-only: phonemizeWordRules (the eval) skips it → non-circular. See the investigation doc.\n";
writeFileSync(new URL("../../src/languages/tagalog/loanword-lexicon.tsv", import.meta.url), header + out.join("\n") + "\n");
console.log(`pinned ${out.length} loanwords (foreign-segment class); native canaries clean`);
console.log("samples:", out.slice(0, 6));
