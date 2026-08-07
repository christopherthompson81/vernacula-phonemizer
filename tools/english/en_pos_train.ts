/**
 * Offline trainer for the English averaged-perceptron POS tagger that drives
 * homograph disambiguation ($verb/$noun/$past).
 *
 * Trains on UD English-EWT XPOS (Penn Treebank tagset) and emits a compact model
 * artifact consumed at runtime by `src/languages/english/posTagger.ts`.
 *
 * ⚠ BUILD-TIME TOOLING. Never shipped, and no bearing on the runtime's
 * zero-dependency contract. Run offline:
 *   tsx tools/english/en_pos_train.ts <train.conllu> <dev.conllu> <out.json>
 *
 * Algorithm: greedy averaged perceptron (Collins 2002 / Honnibal 2013 feature
 * set). Frequent unambiguous words are cached in a `tagdict` fast path; only
 * genuinely ambiguous words (the homographs we care about) run the perceptron.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { extractFeatures, normalizeToken, START, END } from "../../src/languages/english/posTagger.ts";

type Sentence = { words: string[]; tags: string[] };

/**
 * Parse a CoNLL-U file into (words, tags) sentences. `tagCol` selects the tag
 * column: 4 = XPOS (Penn-Treebank-style, used for English where past-tense
 * granularity matters), 3 = UPOS (coarse universal tags, used for Persian where
 * the stress rule only needs noun/adj vs verb). Both are 0-based `cols` indices.
 */
function parseConllu(path: string, tagCol = 4): Sentence[] {
    const text = readFileSync(path, "utf8");
    const sentences: Sentence[] = [];
    let words: string[] = [];
    let tags: string[] = [];
    for (const line of text.split("\n")) {
        if (line === "") {
            if (words.length > 0) sentences.push({ words, tags });
            words = [];
            tags = [];
            continue;
        }
        if (line.startsWith("#")) continue;
        const cols = line.split("\t");
        const id = cols[0] ?? "";
        // Skip multiword-token ranges (n-m) and empty nodes (n.m).
        if (id.includes("-") || id.includes(".")) continue;
        const form = cols[1];
        const tag = cols[tagCol];
        if (!form || !tag || tag === "_") continue;
        words.push(form);
        tags.push(tag);
    }
    if (words.length > 0) sentences.push({ words, tags });
    return sentences;
}

/**
 * Build the tagdict: words seen >= FREQ_THRESH times with one tag >= AMBIG_THRESH
 * of the time. Keyed on the NORMALIZED token (lowercased; years/digits folded) —
 * the runtime tag() looks words up by their normalized form (phonemize feeds
 * lowercased tokens), so keying on raw case would make the fast path dead.
 */
function makeTagdict(sentences: Sentence[]): Record<string, string> {
    const FREQ_THRESH = 20;
    const AMBIG_THRESH = 0.97;
    const counts = new Map<string, Map<string, number>>();
    for (const s of sentences) {
        for (let i = 0; i < s.words.length; i++) {
            const w = normalizeToken(s.words[i] ?? "");
            const tag = s.tags[i] ?? "";
            let m = counts.get(w);
            if (!m) counts.set(w, (m = new Map()));
            m.set(tag, (m.get(tag) ?? 0) + 1);
        }
    }
    const tagdict: Record<string, string> = {};
    for (const [word, m] of counts) {
        let total = 0;
        let bestTag = "";
        let bestN = 0;
        for (const [tag, n] of m) {
            total += n;
            if (n > bestN) {
                bestN = n;
                bestTag = tag;
            }
        }
        if (total >= FREQ_THRESH && bestN / total >= AMBIG_THRESH) tagdict[word] = bestTag;
    }
    return tagdict;
}

class AveragedPerceptron {
    weights = new Map<string, Map<string, number>>(); // feature -> class -> weight
    private totals = new Map<string, number>(); // "feat\x00class" -> accumulated
    private timestamps = new Map<string, number>(); // "feat\x00class" -> last-updated step
    private step = 0;
    classes = new Set<string>();

    predict(features: Record<string, number>): string {
        const scores = new Map<string, number>();
        for (const [feat, val] of Object.entries(features)) {
            const w = this.weights.get(feat);
            if (!w) continue;
            for (const [cls, weight] of w) scores.set(cls, (scores.get(cls) ?? 0) + weight * val);
        }
        // Deterministic argmax (tie-break by class name) so retrains are reproducible.
        let best = "";
        let bestScore = -Infinity;
        for (const cls of this.classes) {
            const sc = scores.get(cls) ?? 0;
            if (sc > bestScore || (sc === bestScore && cls < best)) {
                bestScore = sc;
                best = cls;
            }
        }
        return best;
    }

    update(truth: string, guess: string, features: Record<string, number>): void {
        this.step++;
        this.classes.add(truth);
        this.classes.add(guess);
        if (truth === guess) return;
        for (const feat of Object.keys(features)) {
            let w = this.weights.get(feat);
            if (!w) this.weights.set(feat, (w = new Map()));
            this.bump(feat, truth, w.get(truth) ?? 0, +1, w);
            this.bump(feat, guess, w.get(guess) ?? 0, -1, w);
        }
    }

    private bump(feat: string, cls: string, cur: number, delta: number, w: Map<string, number>): void {
        const key = feat + "\x00" + cls;
        this.totals.set(key, (this.totals.get(key) ?? 0) + (this.step - (this.timestamps.get(key) ?? 0)) * cur);
        this.timestamps.set(key, this.step);
        w.set(cls, cur + delta);
    }

    averageWeights(): void {
        for (const [feat, w] of this.weights) {
            for (const [cls, cur] of w) {
                const key = feat + "\x00" + cls;
                const total = (this.totals.get(key) ?? 0) + (this.step - (this.timestamps.get(key) ?? 0)) * cur;
                const avg = total / this.step;
                if (avg === 0) w.delete(cls);
                else w.set(cls, avg);
            }
            if (w.size === 0) this.weights.delete(feat);
        }
    }
}

function shuffle<T>(arr: T[], seed: number): T[] {
    // Deterministic LCG shuffle (Date/Math.random discouraged in this repo).
    let s = seed >>> 0;
    const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = a[i]!;
        a[i] = a[j]!;
        a[j] = tmp;
    }
    return a;
}

function train(sentences: Sentence[], tagdict: Record<string, string>, iterations: number): AveragedPerceptron {
    const model = new AveragedPerceptron();
    for (const s of sentences) for (const t of s.tags) model.classes.add(t);
    for (let iter = 0; iter < iterations; iter++) {
        let correct = 0;
        let total = 0;
        const order = shuffle(sentences, 1 + iter);
        for (const s of order) {
            const norm = s.words.map(normalizeToken);
            const context = [START, START, ...norm, END, END];
            let prev = START;
            let prev2 = START;
            for (let i = 0; i < norm.length; i++) {
                const word = norm[i] ?? "";
                const gold = s.tags[i] ?? "";
                let guess = tagdict[word];
                if (guess === undefined) {
                    const feats = extractFeatures(i, word, context, prev, prev2);
                    guess = model.predict(feats);
                    model.update(gold, guess, feats);
                }
                prev2 = prev;
                prev = guess;
                if (guess === gold) correct++;
                total++;
            }
        }
        process.stderr.write(`  iter ${iter + 1}/${iterations}  train acc ${((correct / total) * 100).toFixed(2)}%\n`);
    }
    model.averageWeights();
    return model;
}

function evaluate(model: AveragedPerceptron, sentences: Sentence[], tagdict: Record<string, string>): number {
    let correct = 0;
    let total = 0;
    for (const s of sentences) {
        const norm = s.words.map(normalizeToken);
        const context = [START, START, ...norm, END, END];
        let prev = START;
        let prev2 = START;
        for (let i = 0; i < norm.length; i++) {
            const word = norm[i] ?? "";
            let guess = tagdict[word];
            if (guess === undefined) {
                guess = model.predict(extractFeatures(i, word, context, prev, prev2));
            }
            prev2 = prev;
            prev = guess;
            if (guess === (s.tags[i] ?? "")) correct++;
            total++;
        }
    }
    return correct / total;
}

/**
 * A lexical word-feature key looks like `i word <tok>`, `i+1 word <tok>`, or
 * `i-1 tag+i word <tag> <tok>` — in every case the token is the LAST field, and
 * such features are exactly the ones that embed raw corpus tokens. Suffix/prefix/
 * tag/bias features carry no corpus token. Returns the token for a word feature,
 * else null.
 */
function lexicalToken(feat: string): string | null {
    if (!feat.includes("word")) return null;
    const sp = feat.lastIndexOf(" ");
    return sp < 0 ? null : feat.slice(sp + 1);
}

/**
 * PII guard. UD English-EWT incorporates real web text (including the Enron
 * email corpus), so raw lexical tokens can be real email addresses, URLs,
 * @handles, or personal identifiers. We must NOT bake those into a committed
 * artifact (repo PII policy). Drop any token that looks like an identifier.
 */
function looksLikePii(tok: string): boolean {
    return (
        tok.includes("@") ||
        tok.includes("://") ||
        tok.includes("www.") ||
        /\.(com|net|org|edu|gov|io|co|uk)\b/.test(tok) ||
        (/\d/.test(tok) && /[a-z]/.test(tok)) // mixed alnum identifiers (usernames, ids)
    );
}

/**
 * Serialize to a compact artifact. Three filters, in order:
 *  1. PII/frequency floor on LEXICAL word-features — drop any whose token is
 *     PII-shaped or appears < `floor` times in training. This is the privacy
 *     scrub (one-off emails/names/URLs vanish) AND the main size lever (rare
 *     lexical features are the bulk of the model). Generalizing suffix/tag
 *     features are always kept.
 *  2. Quantize weights to integers (× scale).
 *  3. Magnitude prune (drop |q| < prune).
 * Format: { scale, classes, tagdict: {word: classIdx}, weights: {feat: {classIdx: intWeight}} }
 */
function serialize(
    model: AveragedPerceptron,
    tagdict: Record<string, string>,
    tokenFreq: Map<string, number>,
    scale: number,
    prune: number,
    floor: number,
): string {
    const classes = [...model.classes].sort();
    const classIdx = new Map(classes.map((c, i) => [c, i]));
    const weights: Record<string, Record<number, number>> = {};
    let kept = 0;
    let droppedMag = 0;
    let droppedLex = 0;
    let piiDropped = 0;
    for (const [feat, w] of model.weights) {
        const tok = lexicalToken(feat);
        if (tok !== null) {
            if (looksLikePii(tok)) {
                piiDropped++;
                continue;
            }
            if ((tokenFreq.get(tok) ?? 0) < floor) {
                droppedLex++;
                continue;
            }
        }
        const entry: Record<number, number> = {};
        for (const [cls, weight] of w) {
            const q = Math.round(weight * scale);
            if (Math.abs(q) < prune) {
                droppedMag++;
                continue;
            }
            entry[classIdx.get(cls)!] = q;
            kept++;
        }
        if (Object.keys(entry).length > 0) weights[feat] = entry;
    }
    // tagdict words can also carry PII — scrub identically.
    const td: Record<string, number> = {};
    let piiTagdict = 0;
    for (const [word, tag] of Object.entries(tagdict)) {
        if (looksLikePii(word)) {
            piiTagdict++;
            continue;
        }
        td[word] = classIdx.get(tag)!;
    }
    process.stderr.write(
        `  serialize: kept ${kept} weights | dropped: lex-floor ${droppedLex}, PII-feat ${piiDropped}, PII-tagdict ${piiTagdict}, mag ${droppedMag} | ${classes.length} classes, ${Object.keys(td).length} tagdict\n`,
    );
    return JSON.stringify({ scale, classes, tagdict: td, weights });
}

// ---- main ----
const [trainPath, devPath, outPath] = process.argv.slice(2);
if (!trainPath || !devPath || !outPath) {
    process.stderr.write(
        "usage: tsx tools/english/en_pos_train.ts <train.conllu> <dev.conllu> <out.json> [iterations] [scale] [prune] [floor] [tagCol]\n  tagCol: 4=XPOS (English, default), 3=UPOS (Persian)\n",
    );
    process.exit(1);
}
const iterations = Number(process.argv[5] ?? 5);
const scale = Number(process.argv[6] ?? 1000);
const prune = Number(process.argv[7] ?? 1);
const floor = Number(process.argv[8] ?? 5);
const tagCol = Number(process.argv[9] ?? 4);

process.stderr.write(`Loading ${trainPath} (tag column ${tagCol === 3 ? "UPOS" : "XPOS"})…\n`);
const trainSents = parseConllu(trainPath, tagCol);
const devSents = parseConllu(devPath, tagCol);
process.stderr.write(`  train ${trainSents.length} sentences, dev ${devSents.length} sentences\n`);

const tagdict = makeTagdict(trainSents);
process.stderr.write(`tagdict: ${Object.keys(tagdict).length} unambiguous words\n`);

// Token frequencies (over the NORMALIZED form used by the `i word` features),
// for the lexical-feature frequency floor / PII scrub at serialize time.
const tokenFreq = new Map<string, number>();
for (const s of trainSents)
    for (const w of s.words) {
        const t = normalizeToken(w);
        tokenFreq.set(t, (tokenFreq.get(t) ?? 0) + 1);
    }

process.stderr.write(`Training ${iterations} iterations…\n`);
const model = train(trainSents, tagdict, iterations);

const devAcc = evaluate(model, devSents, tagdict);
process.stderr.write(`DEV ACCURACY: ${(devAcc * 100).toFixed(2)}%\n`);

const json = serialize(model, tagdict, tokenFreq, scale, prune, floor);
writeFileSync(outPath, json);
const bytes = Buffer.byteLength(json);
process.stderr.write(`Wrote ${outPath} (${(bytes / 1024 / 1024).toFixed(2)} MB)\n`);
