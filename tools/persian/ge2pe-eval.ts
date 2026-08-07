/**
 * Evaluate the fa structural tagger against the INDEPENDENT GE2PE referee (tools/referee-eval/referees/
 * fa.ge2pe-ezafe-homograph.tsv — modern Iranian, MIT, non-circular vs HomoRich). Reports word-level FULL and
 * BACKBONE (consonants + long vowels) agreement, overall and per test set (Kasre = ezafe-stress, Homograph =
 * homograph-stress). These are ADVERSARIAL hard-case sets, so the numbers are a lower bound, not a representative
 * accuracy — the value is INDEPENDENT corroboration of the backbone and confirmation of the ezafe/homograph
 * residual. Run: npx tsx tools/persian/ge2pe-eval.ts
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createFaTagger } from "../../src/languages/persian/faTagger.ts";

const REF = join(dirname(fileURLToPath(import.meta.url)), "../referee-eval/referees/fa.ge2pe-ezafe-homograph.tsv");
const LONG = ["aː", "uː", "iː", "eː", "oː", "t͡ʃ", "d͡ʒ"];
const SHORT = new Set([..."aeouiæə"]);
/** consonants + long vowels (drop short vowels) — the register/ezafe-invariant skeleton. */
function backbone(ipa: string): string {
    let out = "", i = 0;
    while (i < ipa.length) {
        const two = ipa.slice(i, i + 3);
        const lv = LONG.find((u) => ipa.startsWith(u, i));
        if (lv) { out += lv; i += lv.length; continue; }
        const c = ipa[i]!;
        if (!SHORT.has(c) && c !== "ː") out += c;
        i++;
    }
    return out;
}
const fold = (s: string) => s.replace(/[ˈˌ]/gu, "").replace(/ɣ/gu, "q"); // strip stress; GE2PE merges ق/غ→q

const tagger = await createFaTagger();
if (!tagger) { console.error("tagger unavailable (onnxruntime-node / model missing)"); process.exit(0); }
const cats: Record<string, [number, number, number]> = { ezafe: [0, 0, 0], homograph: [0, 0, 0] }; // full, bb, N
for (const line of readFileSync(REF, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [graw, iraw, cat] = line.split("\t");
    if (!graw || !iraw || !cat) continue;
    const gw = graw.split(" "), gold = iraw.split(" ");
    const pred = fold(await tagger.restore(graw)).split(" ");
    if (pred.length !== gw.length) continue;
    for (let k = 0; k < gw.length; k++) {
        const c = cats[cat]!; c[2]++;
        if (pred[k] === gold[k]) c[0]++;
        if (backbone(pred[k]!) === backbone(gold[k]!)) c[1]++;
    }
}
const tot: [number, number, number] = [0, 0, 0];
console.log("tagger vs INDEPENDENT GE2PE (adversarial ezafe+homograph sets; ق/غ folded):");
console.log(`  ${"set".padEnd(10)} ${"full".padStart(8)} ${"backbone".padStart(9)}   N`);
for (const [c, [f, b, n]] of Object.entries(cats)) {
    tot[0] += f; tot[1] += b; tot[2] += n;
    console.log(`  ${c.padEnd(10)} ${(100 * f / n).toFixed(1).padStart(7)}% ${(100 * b / n).toFixed(1).padStart(8)}%   ${n}`);
}
console.log(`  ${"OVERALL".padEnd(10)} ${(100 * tot[0] / tot[2]).toFixed(1).padStart(7)}% ${(100 * tot[1] / tot[2]).toFixed(1).padStart(8)}%   ${tot[2]}`);
