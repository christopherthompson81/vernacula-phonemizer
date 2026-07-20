/**
 * Async neural entry for Persian (fa). The DEFAULT modern path runs the sentence-level MODERN CONTEXT model
 * (contextRestorer.ts, HomoRich-trained ONNX) over each clause, because on modern running text context beats the
 * word-level path by +44.8pp (33.5%→78.2% per-word held-out) — it can resolve ezafe and homographs, which a
 * word-at-a-time model structurally cannot. It falls back PER-WORD to the word-level restorer (lexicon → OOV
 * seq2seq → g2p) when the context decode degenerates (~1% of clauses), and falls back WHOLESALE to that word-level
 * path when the context model / `onnxruntime-node` is absent.
 *
 * This is a SEPARATE async path — the sync engine (and its C#-parity + referee-eval) is untouched. The seq2seq
 * emits IPA DIRECTLY, so this assembles IPA itself. See docs/investigations/fa_shortvowel_restoration_investigation.md.
 */
import { assembleClauses } from "./core/clauses.ts";
import { getPhonemizer } from "./registry.ts";
import { stripHarakat } from "./core/harakatLexicon.ts";
import { createFaVowelRestorer, type FaVowelRestorer } from "./languages/persian/vowelRestorer.ts";
import { createFaContextRestorer, createFaModernContextRestorer, type FaContextRestorer } from "./languages/persian/contextRestorer.ts";
import { harakatLexicon, phonemizeWord } from "./languages/persian/persian.ts";

const PERSO = "ء-ۿݐ-ݿ‌‍";
const WORD = new RegExp(`[${PERSO}]+`, "gu");
// Digit group FIRST so Persian-Indic digits (۰-۹, which also fall in the PERSO letter range) route to the number
// path instead of being fed to the word/context model. Groups: 1=digits, 2=word, 3=punctuation.
const TOKEN = new RegExp(`([\\d\\u06F0-\\u06F9]+)|([${PERSO}]+)|([۔؟،؛.?!,;:])`, "gu");
const ZWNJ = /[‌‍]/gu;
const MARK: Record<string, string> = { "۔": ".", "؟": "?", "،": ",", "؛": ",", ".": ".", "?": "?", "!": "!", ",": ",", ";": ",", ":": "," };
/** The sync number path only reads ASCII digits; fold Persian-Indic digits (۰-۹) to ASCII first. */
const toAsciiDigits = (s: string): string => s.replace(/[۰-۹]/gu, (d) => String(d.charCodeAt(0) - 0x06f0));

let restorerP: Promise<FaVowelRestorer | undefined> | undefined;
let modernCtxP: Promise<FaContextRestorer | undefined> | undefined;

/**
 * Default modern Persian phonemization: MODERN CONTEXT model per clause, word-level fallback on degeneration /
 * absence. Async because the ONNX passes are.
 */
export async function phonemizeFaNeural(text: string): Promise<string> {
    if (restorerP === undefined) restorerP = createFaVowelRestorer();
    if (modernCtxP === undefined) modernCtxP = createFaModernContextRestorer();
    const [restorer, ctx] = await Promise.all([restorerP, modernCtxP]);
    if (!ctx) return phonemizeFaWordLevel(text, restorer); // no context model → word-at-a-time path

    const lex = harakatLexicon();
    // Word-level resolver (the per-word fallback): lexicon-OOV words ≥3 letters → OOV seq2seq; else sync lexicon/g2p.
    const wordLevel = async (w: string): Promise<string> =>
        restorer && [...w].length >= 3 && !lex.has(stripHarakat(w)) ? await restorer.restore(w) : phonemizeWord(w);

    // PRE-PASS: resolve each Persian-word token to IPA, running the context model over each run of consecutive
    // words (a "clause") so it sees context; digits/punctuation break the run. ZWNJ is stripped so each token is
    // one model word (1:1 token↔IPA alignment). Guard: word-count mismatch or a degenerate token → per-word fallback.
    const ipaQueue: string[] = [];
    let run: string[] = [];
    const flush = async (): Promise<void> => {
        if (!run.length) return;
        // A 1-word run gives the context model NO context to exploit and it is less reliable on isolated words
        // (من → mannˈan); route it to the authoritative word-level path instead.
        if (run.length === 1) { ipaQueue.push(await wordLevel(run[0]!)); run = []; return; }
        const out = await ctx.restore(run.join(" "));
        const ow = out.split(" ");
        if (ow.length === run.length && !ow.some(isDegenerate)) ipaQueue.push(...ow);
        else for (const w of run) ipaQueue.push(await wordLevel(w));
        run = [];
    };
    for (const m of text.matchAll(TOKEN)) {
        if (m[2]) run.push(m[2].replace(ZWNJ, ""));
        else await flush(); // a digit or punctuation break ends the clause run
    }
    await flush();

    let wi = 0;
    return assembleClauses(text, TOKEN, (m, sink) => {
        if (m[2]) sink.emit(ipaQueue[wi++] ?? "");
        else if (m[1]) sink.emit(getPhonemizer("fa").text(toAsciiDigits(m[1]))); // digits → the sync number path
        else if (m[3]) {
            const mk = MARK[m[3]];
            if (mk) sink.pause(mk);
        }
    });
}

/**
 * The pre-context word-at-a-time path (lexicon → OOV seq2seq → g2p, NO cross-word context). Kept as the fallback
 * for when the context model is unavailable, and as the guard target for degenerate context decodes.
 */
async function phonemizeFaWordLevel(text: string, restorer: FaVowelRestorer | undefined): Promise<string> {
    if (!restorer) return getPhonemizer("fa").text(text); // no model at all → sync lexicon+default path
    const lex = harakatLexicon();
    const neural = new Map<string, string>();
    for (const m of text.matchAll(WORD)) {
        const w = m[0];
        // The seq2seq is unreliable on 1–2 letter function words (و، به، او), which the lexicon/g2p handles anyway.
        if ([...w].length >= 3 && !lex.has(stripHarakat(w)) && !neural.has(w)) neural.set(w, await restorer.restore(w));
    }
    return assembleClauses(text, TOKEN, (m, sink) => {
        if (m[2]) sink.emit(neural.get(m[2]) ?? phonemizeWord(m[2]));
        else if (m[1]) sink.emit(getPhonemizer("fa").text(toAsciiDigits(m[1])));
        else if (m[3]) {
            const mk = MARK[m[3]];
            if (mk) sink.pause(mk);
        }
    });
}

let contextP: Promise<FaContextRestorer | undefined> | undefined;
/**
 * OPTIONAL: phonemize a CLASSICAL Persian hemistich/sentence via the sentence-level CONTEXT model — it resolves
 * ezafe / homographs / connectors from context (Run 15, +18.8pp in-domain). ⚠ Classical-scoped: excellent on
 * Shahnameh-style verse, but it can hallucinate on short/modern out-of-domain text, so this is NOT the default —
 * use `phonemizeFaNeural` for general/modern text. Falls back to the sync path when the model is unavailable.
 */
export async function phonemizeFaContext(sentence: string): Promise<string> {
    if (contextP === undefined) contextP = createFaContextRestorer();
    const ctx = await contextP;
    if (!ctx) return getPhonemizer("fa").text(sentence);
    const clean = sentence.replace(/[^ء-ۿٰ-ۓ ]/gu, " ").replace(/\s+/gu, " ").trim();
    return clean ? ctx.restore(clean) : "";
}

/**
 * MODERN single-sentence context API — the HomoRich-trained restorer (83.2% held-out per-word, canonical IPA)
 * applied to one clean sentence, no digit/punctuation handling. `phonemizeFaNeural` is the full DEFAULT path (this
 * model, per clause, with digits/punctuation); use this when you have a single already-clean sentence.
 *
 * Greedy seq2seq degenerates on ~1% of sentences (a runaway final token). GUARD: if the output word-count differs
 * from the input's, or any token is implausibly long, fall back to `phonemizeFaNeural` so a malformed result can
 * never surface. Falls back to the sync path when the model / onnxruntime-node is unavailable.
 */
export async function phonemizeFaModernContext(sentence: string): Promise<string> {
    if (modernCtxP === undefined) modernCtxP = createFaModernContextRestorer();
    const ctx = await modernCtxP;
    if (!ctx) return getPhonemizer("fa").text(sentence);
    const clean = sentence.replace(/[^ء-ۿٰ-ۓ ]/gu, " ").replace(/\s+/gu, " ").trim();
    if (!clean) return "";
    const out = await ctx.restore(clean);
    const inWords = clean.split(" ").length;
    const outWords = out.split(" ");
    // degeneration guard: word-count mismatch, a runaway token, or a repeated bigram (the seq2seq loop
    // signature, e.g. ɾaft→ɾaftatmatnatft where "at" recurs) → fall back to the word-level neural path.
    if (outWords.length !== inWords || outWords.some(isDegenerate)) return phonemizeFaNeural(sentence);
    return out;
}

/** A restored word is degenerate if it is implausibly long or contains a bigram repeated ≥3× (greedy-decode loop). */
function isDegenerate(w: string): boolean {
    const chars = [...w];
    if (chars.length > 20) return true;
    const bigrams = new Map<string, number>();
    for (let i = 0; i + 1 < chars.length; i++) {
        const bg = chars[i]! + chars[i + 1]!;
        const n = (bigrams.get(bg) ?? 0) + 1;
        if (n >= 3) return true;
        bigrams.set(bg, n);
    }
    return false;
}
