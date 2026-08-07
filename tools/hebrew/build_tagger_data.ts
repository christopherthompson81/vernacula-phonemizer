/**
 * Build the Hebrew PHASE-2 restorer training corpus from a VOCALIZED Hebrew text corpus (the Nakdimon
 * `hebrew_diacritized` collection). ARCHITECTURE (see he-tagger.PROVENANCE.md): a SENTENCE-LEVEL per-consonant
 * BiLSTM that restores the NIQQUD of unvocalized Hebrew (the ar/nakdan approach), which the deterministic rule
 * g2p (hebrew.ts) then converts to IPA — the neural net learns ONLY the context-dependent diacritization, not the
 * (already-validated) g2p. SENTENCE-LEVEL (the fa faTagger pattern): each example is a CLAUSE (words joined by
 * single spaces) so the bidirectional pass sees CROSS-WORD context and can resolve homographs (ספר =
 * sefer/safar/siper, ילד = jeled/jaled) a word-at-a-time model cannot.
 *
 * INPUT = the unvocalized clause skeleton (consonants + spaces); per-char LABEL = the NIQQUD (the point string on
 * that consonant, "" if bare), and a literal `" "` tag for each space (a word boundary, dropped in assembly). A
 * third per-char MASK column (1 = train, 0 = ignore-in-loss) implements the register-balancing suppression below.
 * Emits `skeleton<TAB>niqqud1|niqqud2|…<TAB>mask1|mask2|…`.
 *
 * PERMISSIVE-DATA policy: only the public-domain (pre-modern) + CC-BY-SA (modern/wiki) + validation subdirs.
 *   git clone https://github.com/elazarg/hebrew_diacritized /tmp/hebrew_diacritized
 *   npx tsx tools/hebrew/build_tagger_data.ts /tmp/hebrew_diacritized /tmp/he_tagger_train.tsv
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { phonemizeWord } from "../../src/languages/hebrew/hebrew.ts";

const ROOT = process.argv[2] ?? "/tmp/hebrew_diacritized";
const OUT = process.argv[3] ?? "/tmp/he_tagger_train.tsv";
// Two register-balancing levers close the modern-OOD gap (the permissive corpus is ~89% pre-modern —
// Bialik/Tchernichovsky, archaic vocabulary, DEFECTIVE ktiv-haser — but the target is MODERN running text; on the
// ~20% of shared skeletons the two registers give a CONFLICTING reading, שנים = šnayim/šanim, so a 12:1 pre-modern
// majority drags the prior toward the archaic reading). See he-tagger.PROVENANCE.md.
//   (1) OVERSAMPLE the CC-BY-SA modern/wiki (+ validation) ×5 — adds modern weight without discarding pre-modern.
//   (2) `suppress`: on the pre-modern source, MASK (ignore in the loss) any word whose reading is ABSENT from the
//       modern reading-set for that skeleton — a genuinely-archaic vocalization modern never uses. Pre-modern still
//       trains context, agreeing words, and rare vocab it uniquely covers, but casts no vote on obsolete readings.
//       The absent-from-modern test (not merely "≠ the modern modal") spares the valid MINORITY reading of a real
//       homograph, so it doesn't regress homograph resolution. Measured +1.9pp over baseline / +0.8pp over
//       oversample-alone on held-out modern text. Emits a third mask column (1 = train, 0 = ignore).
const SOURCES: { sub: string; reps: number; suppress: boolean }[] = [
    { sub: "pre_modern", reps: 1, suppress: true },
    { sub: "modern/wiki", reps: 5, suppress: false },
    { sub: "validation", reps: 5, suppress: false },
];
const CLAUSE = /[א-ת][ְ-ׇא-ת]*(?:[ \t]+[א-ת][ְ-ׇא-ת]*)*/gu; // a run of Hebrew words + single spaces
const LETTER = /[א-ת]/u;
const POINT = /[֑-ׇ]/u;
const NIQQUD = /[ְ-ׇ]/gu;
const MAX_CHARS = 220;

function walk(dir: string, acc: string[]): void {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p, acc);
        else if (e.endsWith(".txt")) acc.push(p);
    }
}

/** Split a vocalized word into per-consonant (letter, niqqud-string). The niqqud string is the run of point chars
 *  that follow the letter — exactly what the tagger must restore for a bare skeleton. */
function splitNiqqud(word: string): { cons: string; points: string }[] {
    const cps = [...word.normalize("NFC")];
    const out: { cons: string; points: string }[] = [];
    for (let i = 0; i < cps.length; i++) {
        if (!LETTER.test(cps[i]!)) continue;
        let j = i + 1, pts = "";
        while (j < cps.length && POINT.test(cps[j]!)) { pts += cps[j]!; j++; }
        out.push({ cons: cps[i]!, points: pts });
        i = j - 1;
    }
    return out;
}

/** The set of IPA readings each skeleton takes in the MODERN reading-set source (modern/wiki) — a word whose
 *  reading is absent here is genuinely archaic (modern never uses it) and gets masked out of the pre-modern loss. */
function modernReadingSets(sub: string): Map<string, Set<string>> {
    const files: string[] = [];
    try { walk(join(ROOT, sub), files); } catch { console.error(`[he-tagger] missing ${sub} (mask source), skipping`); return new Map(); }
    const m = new Map<string, Set<string>>();
    for (const f of files) {
        for (const cm of readFileSync(f, "utf8").matchAll(CLAUSE)) {
            if (!NIQQUD.test(cm[0])) continue;
            for (const w of cm[0].split(/[ \t]+/u).filter(Boolean)) {
                const s = w.replace(NIQQUD, "");
                (m.get(s) ?? m.set(s, new Set()).get(s)!).add(phonemizeWord(w));
            }
        }
    }
    return m;
}
const MODERN_READINGS = modernReadingSets("modern/wiki");

/** One vocalized clause → `skeleton \t niqqud-tags \t mask` (mask 1 = train, 0 = ignore), or null on a malformed
 *  word. When `suppress`, a word whose reading is absent from the modern reading-set is masked (all its consonants),
 *  suppressing genuinely-archaic pre-modern votes while keeping context + agreeing + rare-vocab words. */
function clauseRow(words: string[], suppress: boolean): string | null {
    const skel: string[] = [], tags: string[] = [], mask: string[] = [];
    for (let w = 0; w < words.length; w++) {
        if (w > 0) { skel.push(" "); tags.push(" "); mask.push("1"); }
        const parts = splitNiqqud(words[w]!);
        if (!parts.length) return null;
        if (parts.map((p) => p.cons).join("") !== words[w]!.replace(NIQQUD, "")) return null;
        let keep = "1";
        if (suppress) {
            const s = words[w]!.replace(NIQQUD, ""), modern = MODERN_READINGS.get(s);
            if (modern !== undefined && !modern.has(phonemizeWord(words[w]!))) keep = "0"; // archaic: modern never uses it
        }
        for (const p of parts) { skel.push(p.cons); tags.push(p.points || "∅"); mask.push(keep); } // "∅" = bare consonant
    }
    return skel.length ? `${skel.join("")}\t${tags.join("|")}\t${mask.join("|")}` : null;
}

const lines: string[] = [];
let masked = 0, total = 0;
for (const { sub, reps, suppress } of SOURCES) {
    const files: string[] = [];
    try { walk(join(ROOT, sub), files); } catch { console.error(`[he-tagger] missing ${sub}, skipping`); continue; }
    const rows: string[] = [];
    for (const f of files) {
        for (const m of readFileSync(f, "utf8").matchAll(CLAUSE)) {
            if (!NIQQUD.test(m[0])) continue;
            const words = m[0].split(/[ \t]+/u).filter(Boolean);
            for (let i = 0; i < words.length; ) { // chunk over-long runs at word boundaries
                let chars = 0, j = i;
                while (j < words.length && chars + words[j]!.length + 1 <= MAX_CHARS) { chars += words[j]!.length + 1; j++; }
                if (j === i) j = i + 1;
                const row = clauseRow(words.slice(i, j), suppress);
                if (row) { rows.push(row); for (const c of row.split("\t")[2]!.split("|")) { total++; if (c === "0") masked++; } }
                i = j;
            }
        }
    }
    for (let r = 0; r < reps; r++) for (const row of rows) lines.push(row); // oversample the modern subset
    console.error(`[he-tagger] ${sub}: ${rows.length} rows ×${reps} = ${rows.length * reps}`);
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.error(`[he-tagger] ${lines.length} clause rows → ${OUT}; masked ${masked}/${total} consonants (${(100 * masked / total).toFixed(1)}%)`);
