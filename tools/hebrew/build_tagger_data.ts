/**
 * Build the Hebrew PHASE-2 tagger training corpus from a VOCALIZED Hebrew text corpus (the Nakdimon
 * `hebrew_diacritized` collection). For each vocalized word: the tagger INPUT is the unvocalized skeleton (the
 * consonants that survive niqqud-stripping) and the per-consonant LABEL is the IPA chunk our Phase-1 g2p
 * (phonemizeAligned) resolves from its points — so the tagger learns to RESTORE the vowels of bare consonantal
 * Hebrew directly to IPA (the fa faTagger pattern). Emits `skeleton<TAB>chunk1|chunk2|…` (one line per word).
 *
 * PERMISSIVE-DATA policy: pass only the public-domain (pre-modern: Bialik d.1934, Tchernichovsky d.1943, …) +
 * CC-BY-SA (modern/wiki) + validation subdirs; the copyrighted modern news/blogs/lyrics are excluded from the
 * SHIPPED model's training. Clone the corpus first:
 *   git clone https://github.com/elazarg/hebrew_diacritized /tmp/hebrew_diacritized
 *   npx tsx tools/hebrew/build_tagger_data.ts /tmp/hebrew_diacritized /tmp/he_tagger_train.tsv
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { phonemizeAligned } from "../../src/languages/hebrew/hebrew.ts";

const ROOT = process.argv[2] ?? "/tmp/hebrew_diacritized";
const OUT = process.argv[3] ?? "/tmp/he_tagger_train.tsv";
// Permissively-licensed subdirs only (PD pre-modern + CC-BY-SA wiki + validation).
const SUBDIRS = ["pre_modern", "modern/wiki", "validation"];
const WORD = /[א-ת][ְ-ׇא-ת]*/gu; // a vocalized Hebrew word (letters + points)
const NIQQUD = /[ְ-ׇ]/gu;

function walk(dir: string, acc: string[]): void {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p, acc);
        else if (e.endsWith(".txt")) acc.push(p);
    }
}

const files: string[] = [];
for (const sub of SUBDIRS) {
    try { walk(join(ROOT, sub), files); } catch { console.error(`[he-tagger] missing ${sub}, skipping`); }
}
console.error(`[he-tagger] ${files.length} files from ${SUBDIRS.join(", ")}`);

const lines: string[] = [];
let words = 0, kept = 0;
for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(WORD)) {
        words++;
        const voc = m[0];
        // require the word to actually carry niqqud (skip already-bare tokens — no labels there)
        if (!NIQQUD.test(voc)) continue;
        const chunks = phonemizeAligned(voc);
        if (chunks.length < 1) continue;
        const skeleton = chunks.map((c) => c.cons).join("");
        // sanity: skeleton must equal the niqqud-stripped word (the tagger sees exactly this at inference)
        if (skeleton !== voc.replace(NIQQUD, "")) continue;
        lines.push(`${skeleton}\t${chunks.map((c) => c.ipa).join("|")}`);
        kept++;
    }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.error(`[he-tagger] ${words} words seen → ${kept} vocalized (skeleton, tags) rows → ${OUT}`);
