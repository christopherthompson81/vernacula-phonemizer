/**
 * Build the Hebrew PHASE-2 restorer training corpus from a VOCALIZED Hebrew text corpus (the Nakdimon
 * `hebrew_diacritized` collection). ARCHITECTURE (see he-tagger.PROVENANCE.md): a SENTENCE-LEVEL per-consonant
 * BiLSTM that restores the NIQQUD of unvocalized Hebrew (the ar/nakdan approach), which the deterministic Phase-1
 * g2p (hebrew.ts) then converts to IPA — the neural net learns ONLY the context-dependent diacritization, not the
 * (already-validated) g2p. SENTENCE-LEVEL (the fa faTagger pattern): each example is a CLAUSE (words joined by
 * single spaces) so the bidirectional pass sees CROSS-WORD context and can resolve homographs (ספר =
 * sefer/safar/siper, ילד = jeled/jaled) a word-at-a-time model cannot.
 *
 * INPUT = the unvocalized clause skeleton (consonants + spaces); per-char LABEL = the NIQQUD (the point string on
 * that consonant, "" if bare), and a literal `" "` tag for each space (a word boundary, dropped in assembly).
 * Emits `skeleton<TAB>niqqud1|niqqud2|…`.
 *
 * PERMISSIVE-DATA policy: only the public-domain (pre-modern) + CC-BY-SA (modern/wiki) + validation subdirs.
 *   git clone https://github.com/elazarg/hebrew_diacritized /tmp/hebrew_diacritized
 *   npx tsx tools/hebrew/build_tagger_data.ts /tmp/hebrew_diacritized /tmp/he_tagger_train.tsv
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] ?? "/tmp/hebrew_diacritized";
const OUT = process.argv[3] ?? "/tmp/he_tagger_train.tsv";
// Sources + how many times each is emitted. The permissive corpus is ~89% pre-modern (Bialik/Tchernichovsky —
// archaic vocabulary, DEFECTIVE ktiv-haser spelling), but the target is MODERN running text (full ktiv-male
// spelling). On the ~20% of shared skeletons where the two registers give a CONFLICTING reading (שנים =
// šnayim/šanim, ביום = bjom/bajom), a 12:1 pre-modern majority drags the net's prior toward the archaic reading.
// OVERSAMPLING the CC-BY-SA modern/wiki (+ validation) ×5 re-weights that prior to modern WITHOUT discarding
// pre-modern coverage — measured +1.1pp on held-out modern running text (downsampling pre-modern instead LOST
// data and regressed). See he-tagger.PROVENANCE.md.
const SOURCES: { sub: string; reps: number }[] = [
    { sub: "pre_modern", reps: 1 },
    { sub: "modern/wiki", reps: 5 },
    { sub: "validation", reps: 5 },
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

/** One vocalized clause → (skeleton-with-spaces, per-char niqqud tags-with-space), or null on a malformed word. */
function clauseRow(words: string[]): string | null {
    const skel: string[] = [], tags: string[] = [];
    for (let w = 0; w < words.length; w++) {
        if (w > 0) { skel.push(" "); tags.push(" "); }
        const parts = splitNiqqud(words[w]!);
        if (!parts.length) return null;
        if (parts.map((p) => p.cons).join("") !== words[w]!.replace(NIQQUD, "")) return null;
        for (const p of parts) { skel.push(p.cons); tags.push(p.points || "∅"); } // "∅" = a bare consonant (no vowel)
    }
    return skel.length ? `${skel.join("")}\t${tags.join("|")}` : null;
}

const lines: string[] = [];
for (const { sub, reps } of SOURCES) {
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
                const row = clauseRow(words.slice(i, j));
                if (row) rows.push(row);
                i = j;
            }
        }
    }
    for (let r = 0; r < reps; r++) for (const row of rows) lines.push(row); // oversample the modern subset
    console.error(`[he-tagger] ${sub}: ${rows.length} rows ×${reps} = ${rows.length * reps}`);
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.error(`[he-tagger] ${lines.length} clause rows → ${OUT}`);
