/**
 * Async neural entry for Persian (fa). The DEFAULT modern path runs the sentence-level STRUCTURAL TAGGER
 * (faTagger.ts, a BiLSTM sequence-labeller) over each clause, because on modern running text sentence context beats
 * the word-level path — it resolves ezafe and homographs, which a word-at-a-time model structurally cannot. The
 * tagger emits one IPA-chunk tag per abjad char, so its output length == input length: it CANNOT degenerate and
 * word counts always align, unlike the seq2seq it replaced. It falls back WHOLESALE to the word-level restorer
 * (lexicon → OOV seq2seq → g2p) when the tagger model / `onnxruntime-node` is absent; the per-word guard below is
 * retained as defence but the tagger's structural word-count invariance means it effectively never fires.
 *
 * This is a SEPARATE async path — the sync engine (and its C#-parity + referee-eval) is untouched. The tagger emits
 * IPA DIRECTLY, so this assembles IPA itself.
 */
import { assembleClauses } from "../../core/clauses.ts";
import { getPhonemizer } from "../../registry.ts";
import { stripHarakat } from "../../core/harakatLexicon.ts";
import { createFaVowelRestorer, type FaVowelRestorer } from "./vowelRestorer.ts";
import { createFaContextRestorer, type FaContextRestorer } from "./contextRestorer.ts";
import { createFaTagger } from "./faTagger.ts";
import { harakatLexicon, normalizePersianOrthography, normalizePersianText, phonemizeWord } from "./persian.ts";

const PERSO = "ء-ۿݐ-ݿ‌‍";
const WORD = new RegExp(`[${PERSO}]+`, "gu");
// Digit group FIRST so Persian-Indic digits (۰-۹, which also fall in the PERSO letter range) route to the number
// path instead of being fed to the word/context model. Groups: 1=digits, 2=word, 3=punctuation.
const TOKEN = new RegExp(`([\\d\\u06F0-\\u06F9]+)|([${PERSO}]+)|([۔؟،؛.?!,;:])`, "gu");
const ZWNJ = /[‌‍]/gu;
// The context model was trained on ≤120-char sentences (p99≈97). Chunk longer runs to stay in-distribution.
const MAX_CLAUSE_CHARS = 100;
const MARK: Record<string, string> = { "۔": ".", "؟": "?", "،": ",", "؛": ",", ".": ".", "?": "?", "!": "!", ",": ",", ";": ",", ":": "," };
/** The sync number path only reads ASCII digits; fold Persian-Indic digits (۰-۹) to ASCII first. */
const toAsciiDigits = (s: string): string => s.replace(/[۰-۹]/gu, (d) => String(d.charCodeAt(0) - 0x06f0));

let restorerP: Promise<FaVowelRestorer | undefined> | undefined;
let modernCtxP: Promise<FaContextRestorer | undefined> | undefined;

/**
 * Default modern Persian phonemization: structural TAGGER per clause, word-level fallback when the model is absent.
 * Async because the ONNX pass is.
 */
export async function phonemizeFaNeural(text: string): Promise<string> {
    text = normalizePersianOrthography(text); // fold Arabic yeh/kaf → Farsi so the tagger doesn't garble (Run 27)
    // …then the #562 text-normalization pass, so the tagger sees the SAME rewritten text as the sync path (a
    // clock/percentage/ordinal becomes ordinary Persian words, which is exactly what the model was trained on).
    // Everything it emits is bare orthography: the tagger's source alphabet carries no harakat (fa-tagger.meta).
    text = normalizePersianText(text);
    if (restorerP === undefined) restorerP = createFaVowelRestorer();
    if (modernCtxP === undefined) modernCtxP = createFaTagger();
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
        // Route EVERY run — including 1-word — through the tagger. It labels each char, so it is reliable on
        // ISOLATED words too (دیوار→diːvaːɾ), unlike the seq2seq it replaced (which garbled 1-word input, من→mannˈan,
        // and motivated a word-level detour here). Sending isolated words to the sync g2p instead both garbled
        // uncovered words (دیوار→djuːjɾ) and made the SAME word inconsistent isolated-vs-in-clause (مدرسه madɾase vs
        // madɾese). wordLevel now remains only the model-absent fallback (phonemizeFaWordLevel) + degeneration guard.
        const out = await ctx.restore(run.join(" "));
        const ow = out.split(" ");
        // The tagger emits one tag per char and only the input's space chars start a new word, so the output aligns
        // 1:1 with the input words by construction — this branch always holds. The word-COUNT fallback is retained
        // as cheap defence (e.g. if a future model file broke that invariant) but does not fire for the tagger.
        if (ow.length === run.length) ipaQueue.push(...ow);
        else for (const w of run) ipaQueue.push(await wordLevel(w));
        run = [];
    };
    for (const m of text.matchAll(TOKEN)) {
        if (m[2]) {
            const w = m[2].replace(ZWNJ, "");
            // LENGTH-CAP CHUNKER: the model was trained on sentence-length units (≤120 chars, p99≈97); a longer run
            // is out-of-distribution and degenerates. So before a run would exceed MAX_CLAUSE_CHARS, flush it and
            // start a fresh chunk at this word boundary. Alignment is preserved (each word still yields one IPA);
            // only cross-chunk context is lost, which is unavoidable for input longer than the model can hold.
            const curLen = run.reduce((a, x) => a + [...x].length + 1, 0);
            if (run.length && curLen + [...w].length > MAX_CLAUSE_CHARS) await flush();
            run.push(w);
        } else {
            await flush(); // a digit or punctuation break ends the clause run
        }
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
    const clean = normalizePersianOrthography(sentence).replace(/[^ء-ۿٰ-ۓ ]/gu, " ").replace(/\s+/gu, " ").trim();
    return clean ? ctx.restore(clean) : "";
}

/**
 * MODERN single-sentence context API — the structural tagger (canonical IPA, 93.6% on the canonical held-out)
 * applied to one clean sentence, no digit/punctuation handling. `phonemizeFaNeural` is the full DEFAULT path (this
 * model, per clause, with digits/punctuation); use this when you have a single already-clean sentence.
 *
 * No degeneration guard: the tagger emits one tag per char, so output word-count == input word-count by
 * construction and no token can run away — the malformed outputs the seq2seq needed guarding against cannot occur.
 * Falls back to the sync path when the model / onnxruntime-node is unavailable.
 */
export async function phonemizeFaModernContext(sentence: string): Promise<string> {
    if (modernCtxP === undefined) modernCtxP = createFaTagger();
    const ctx = await modernCtxP;
    if (!ctx) return getPhonemizer("fa").text(sentence);
    const clean = normalizePersianOrthography(sentence).replace(/[^ء-ۿٰ-ۓ ]/gu, " ").replace(/\s+/gu, " ").trim();
    return clean ? ctx.restore(clean) : "";
}
