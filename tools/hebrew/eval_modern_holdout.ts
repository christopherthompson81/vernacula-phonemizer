/**
 * The MODERN-HOLDOUT running-text eval for the Hebrew nakdan — end-to-end word-exact on modern prose.
 *
 * ⚠ THIS HARNESS WAS NEVER COMMITTED, AND IT IS THE ONE THAT MATTERED. Every architecture and data decision in
 * `docs/investigations/he_native_bringup_investigation.md` Runs 3–6 was made on its number — word-level →
 * sentence-level 72.1% → 84.4%, ×5 oversampling → 85.6%, targeted suppression → 86.4% (the shipped model's
 * headline) — yet no commit in this repo's history has ever contained it. Rediscovered 2026-08-19 when a
 * packing retrain could not be judged: the trainer's own per-consonant figure is a POOR proxy, moving 94.0 →
 * 95.9 across a change worth only 84.5 → 85.6 word-exact. Reconstructed from Run 3's description plus PR #422.
 *
 * WHAT IT MEASURES. Take vocalized modern prose the model never trained on, strip the niqqud, have the tagger
 * restore it, and run BOTH the restored and the gold pointing through the SAME Phase-1 g2p. Because both sides
 * share that g2p, every IPA mismatch IS a niqqud-prediction error — the property that made the residual mining
 * in Run 5 possible.
 *
 * ⚠ THE EVAL SOURCES ARE THE COPYRIGHTED SUBDIRS, DELIBERATELY. `modern/news`, `modern/blogs`, `test_modern`
 * and `dictaTestCorpus` are EXCLUDED from training by the permissive-data policy (build_tagger_data.ts SOURCES
 * takes only pre_modern + modern/wiki + validation), which is exactly what makes them a clean holdout. They
 * are read, never redistributed.
 *
 *   npx tsx tools/hebrew/eval_modern_holdout.ts /tmp/hebrew_diacritized [maxWords]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { phonemizeWord } from "../../src/languages/hebrew/hebrew.ts";
import { createHebrewTagger } from "../../src/languages/hebrew/hebrewTagger.ts";

const ROOT = process.argv[2] ?? "/tmp/hebrew_diacritized";
const MAX = Number(process.argv[3] ?? 8004); // Run 5's denominator, so the numbers line up with the record
const SOURCES = ["modern/news", "modern/blogs", "test_modern", "dictaTestCorpus"];
const CLAUSE = /[א-ת][ְ-ׇא-ת]*(?:[ \t]+[א-ת][ְ-ׇא-ת]*)*/gu; // identical to build_tagger_data.ts
const NIQQUD = /[ְ-ׇ]/gu;

function walk(dir: string, out: string[]): void {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (!e.startsWith(".")) out.push(p);
    }
}

const clauses: string[] = [];
for (const sub of SOURCES) {
    const files: string[] = [];
    try { walk(join(ROOT, sub), files); } catch { console.error(`missing ${sub} — skipping`); continue; }
    for (const f of files)
        for (const cm of readFileSync(f, "utf8").matchAll(CLAUSE))
            if (NIQQUD.test(cm[0]) && cm[0].split(/[ \t]+/u).length >= 2) clauses.push(cm[0]);
}
console.log(`${clauses.length} vocalized clauses from ${SOURCES.join(", ")}`);

const tagger = await createHebrewTagger();
if (!tagger) { console.error("no tagger (missing model or onnxruntime-node) — cannot evaluate"); process.exit(1); }

let words = 0, exact = 0, clausesRun = 0;
for (const gold of clauses) {
    if (words >= MAX) break;
    const goldWords = gold.split(/[ \t]+/u).filter(Boolean);
    const skeleton = goldWords.map((w) => w.replace(NIQQUD, "")).join(" ");
    let restored: string;
    try { restored = await tagger.restore(skeleton); } catch { continue; }
    const predWords = restored.split(/\s+/u).filter(Boolean);
    if (predWords.length !== goldWords.length) { words += goldWords.length; clausesRun++; continue; } // counted as all-wrong
    clausesRun++;
    for (let i = 0; i < goldWords.length; i++) {
        words++;
        // ⚠ `restore()` ALREADY RETURNS IPA (it reassembles the vocalized word, consults the lexicon, and runs
        // Phase-1 itself) — only the GOLD side needs phonemizing. The first draft phonemized both and scored
        // 0.0%, which is the useful shape of that bug: a harness can be wrong in a way that looks like a dead
        // model. Both sides still pass through the same g2p, so a mismatch remains a niqqud error.
        if (predWords[i] === phonemizeWord(goldWords[i]!)) exact++;
    }
}
console.log(`modern-holdout: ${exact}/${words} = ${(exact / words * 100).toFixed(1)}% word-exact  (${clausesRun} clauses)`);
