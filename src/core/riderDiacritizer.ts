/**
 * Neural GENERALIZATION tier for the Perso-Arabic riders (Urdu, Persian, Pashto, Punjabi-Shahmukhi) — a shared
 * multilingual BiLSTM that restores short-vowel harakat on a bare skeleton, run via ONNX Runtime as an ASYNC
 * PRE-PASS. It fills the words the exact-match lexicon (harakatLexicon.ts) misses; a word the lexicon already
 * covers is LEFT BARE here so the (authoritative, gold) sync lexicon layer vocalizes it — giving the precedence
 * lexicon → neural → default. Vocalized output feeds the SYNC g2p, so phonemize() stays sync and dependency-free;
 * only this pre-pass touches ONNX. `onnxruntime-node` is an OPTIONAL dependency, imported lazily; the model is a
 * per-word restorer (one language TOKEN prepended, char sequence, argmax harakat per position). The int8 model
 * ships in-repo (like the Arabic diacritizer) but is optional at RUNTIME: if it — or `onnxruntime-node` — is
 * absent, the pre-pass degrades to a no-op and callers get the lexicon+default path. See
 * and tools/perso-arabic/export_onnx.py.
 */
import { readData, readDataText } from "./dataSource.ts";

import { HARAKAT, HARAKAT_G, stripHarakat } from "./harakatLexicon.ts";
import { loadOrt } from "./onnx.ts";
import { dataDir } from "./dataPath.ts";

// label → the combining harakat to append after a base letter. Mirrors the training VOWELS map (invert_harakat.ts /
// train_multilingual_harakat.py): a fatḥa, u damma, i kasra, o sukūn, F/N/K tanwīn, ^ dagger-alif (U+0670); a "~"
// prefix = shadda (gemination) + that vowel; "0" = bare (the model's default).
const HAR: Record<string, string> = {
    "0": "", a: "َ", u: "ُ", i: "ِ", o: "ْ",
    F: "ً", N: "ٌ", K: "ٍ", "^": "ٰ",
};
function harOf(label: string): string {
    if (label.startsWith("~")) return "ّ" + (HAR[label.slice(1)] ?? "");
    return HAR[label] ?? "";
}

// A Perso-Arabic word run: letters/joiners in U+0600–06FF + U+0750–077F, PLUS the ZWNJ/ZWJ (U+200C/200D) that
// glue morphemes in Persian/Urdu compounds — the model was trained on those as ONE sequence (a ZWNJ-split would
// change the LSTM context and the predicted harakat), MINUS the harakat (handled separately).
const WORD = /[؀-ۿݐ-ݿ‌‍]+/gu;  // ZWNJ, ZWJ

export interface RiderDiacritizerMeta {
    chars: Record<string, number>;
    labels: Record<string, number>;
    lang_tokens: Record<string, string>;
}
export interface RiderDiacritizer {
    /** Vocalize the words of `text` for `lang`, skipping any word whose skeleton is in `lexicon` (left bare for the
     *  sync lexicon layer). Position-preserving: only harakat are inserted; spacing/digits/punctuation are kept. */
    diacritize(text: string, lang: string, lexicon: ReadonlyMap<string, string>): Promise<string>;
}

/** Load a rider diacritizer from ONNX model bytes + sidecar meta. Session created once and reused. */
export async function loadRiderDiacritizer(modelBytes: Uint8Array, meta: RiderDiacritizerMeta): Promise<RiderDiacritizer> {
    const ort = await loadOrt("Rider neural diacritization");
    const session = await ort.InferenceSession.create(modelBytes);
    const ilabels: string[] = [];
    for (const [lab, idx] of Object.entries(meta.labels)) ilabels[idx] = lab;
    const UNK = meta.chars["<unk>"] ?? 1;
    const nLabels = ilabels.length;

    /** One skeleton → predicted harakat labels (per base char; the prepended lang-token position is dropped). */
    async function predict(langTokIdx: number, chars: number[]): Promise<string[]> {
        const seq = [langTokIdx, ...chars];
        const input = new ort.Tensor("int64", BigInt64Array.from(seq, BigInt), [1, seq.length]);
        const out = await session.run({ input });
        const logitsTensor = out["logits"] ?? out[Object.keys(out)[0]!];
        if (!logitsTensor) throw new Error("rider diacritizer ONNX produced no output");
        const logits = logitsTensor.data as Float32Array;
        const labels: string[] = [];
        for (let p = 1; p < seq.length; p++) { // p=0 is the lang token → skipped
            let best = 0, bestv = -Infinity;
            const base = p * nLabels;
            for (let o = 0; o < nLabels; o++) { const v = logits[base + o]!; if (v > bestv) { bestv = v; best = o; } }
            labels.push(ilabels[best]!);
        }
        return labels;
    }

    return {
        async diacritize(text: string, lang: string, lexicon: ReadonlyMap<string, string>): Promise<string> {
            const langTok = meta.lang_tokens[lang];
            const langTokIdx = langTok !== undefined ? meta.chars[langTok] : undefined;
            if (langTokIdx === undefined) return text; // unknown language → no-op
            // Rebuild the text with a single cursor (append the gap before each word, then the word's replacement),
            // avoiding shift bookkeeping and repeated full-string slicing.
            const out: string[] = [];
            let cursor = 0;
            for (const m of text.matchAll(WORD)) {
                const raw = m[0]!;
                out.push(text.slice(cursor, m.index!));
                cursor = m.index! + raw.length;
                // Respect writer-supplied harakat (like restoreHarakat) and leave lexicon-covered words BARE for the
                // authoritative sync lexicon layer — both are emitted unchanged.
                const skel = stripHarakat(raw).normalize("NFC");
                if (skel.length === 0 || HARAKAT.test(raw) || lexicon.has(skel)) { out.push(raw); continue; }
                const cps = [...skel];
                const labels = await predict(langTokIdx, cps.map((c) => meta.chars[c] ?? UNK));
                out.push(cps.map((c, k) => c + harOf(labels[k] ?? "0")).join(""));
            }
            out.push(text.slice(cursor));
            return out.join("");
        },
    };
}

/** Load the rider diacritizer from the model + meta beside this file. The model ships in-repo but this DEGRADES to
 *  undefined (callers fall back to the lexicon+default path) on ANY unavailability — a missing model or meta, OR a
 *  failed `onnxruntime-node` load (optional native dep absent / ABI mismatch) — rather than throwing. Call
 *  loadRiderDiacritizer directly if you want the underlying error surfaced. */
export async function createRiderDiacritizer(): Promise<RiderDiacritizer | undefined> {
    const dir = dataDir(import.meta.url);
    let bytes: Uint8Array, meta: RiderDiacritizerMeta;
    try {
        bytes = readData(`${dir}/riderDiacritizer.onnx`);
        meta = JSON.parse(readDataText(`${dir}/riderDiacritizer.meta.json`)) as RiderDiacritizerMeta;
    } catch { return undefined; } // model or sidecar meta absent/corrupt
    try {
        return await loadRiderDiacritizer(bytes, meta);
    } catch { return undefined; } // onnxruntime-node absent or the session failed to build → sync fallback
}
