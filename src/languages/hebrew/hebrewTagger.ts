/**
 * Hebrew PHASE-2 restorer — the neural NAKDAN for UNVOCALIZED Hebrew. A SENTENCE-LEVEL per-consonant BiLSTM (ONNX)
 * that RESTORES THE NIQQUD of a bare consonantal clause; the deterministic Phase-1 g2p (hebrew.ts) then converts
 * the reconstructed vocalized words to IPA. This is the ar/nakdan architecture (predict diacritics, then a fixed
 * g2p) with the fa `faTagger` sentence-context (the bidirectional pass over the WHOLE clause resolves homographs —
 * ספר = sefer/safar/siper — that a word-at-a-time model cannot). The net learns ONLY the context-dependent
 * diacritization; the g2p rules (bgdkpt, patach genuvah, mater lectionis) stay in the already-validated Phase-1.
 *
 * One forward pass over the clause; each char gets a niqqud TAG (a space char → the space tag, a word boundary). A
 * per-consonant consonant-consistency MASK constrains each letter to only the niqqud it took in training. Output
 * length == input length → cannot degenerate. Shares core/onnx.ts + core/structuralTagger.ts (maskedArgmax) with
 * the fa/bn taggers. See `hebrewNeural.ts` beside this module, and he-tagger.PROVENANCE.md.
 *
 * `onnxruntime-node` is OPTIONAL (lazy); if it — or the model — is absent, createHebrewTagger() resolves to
 * `undefined` and the caller falls back to the sync (vocalized-only) engine.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadOrt, type OrtLike, type OrtSession } from "../../core/onnx.ts";
import { maskedArgmax, type TaggerMeta } from "../../core/structuralTagger.ts";
import { phonemizeWord } from "./hebrew.ts";
import { lexiconLookup } from "./lexicon.ts";

const BARE = "∅"; // the tag for a consonant with no niqqud
const SPACE = " "; // the tag for a space char (word boundary)
const NIQQUD = /[֑-ׇ]/gu; // strip the restored niqqud back to the skeleton for a lexicon lookup

export interface HebrewTagger {
    /** Restore + phonemize a CLAUSE of bare Hebrew words (space-separated) → Modern Israeli IPA. "" if declined. */
    restore(clause: string): Promise<string>;
}

/** Build the Hebrew nakdan tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export async function createHebrewTagger(basename = "he-tagger"): Promise<HebrewTagger | undefined> {
    const dir = dirname(fileURLToPath(import.meta.url));
    let meta: TaggerMeta, modelBytes: Uint8Array;
    try {
        meta = JSON.parse(readFileSync(join(dir, `${basename}.meta.json`), "utf8")) as TaggerMeta;
        modelBytes = readFileSync(join(dir, `${basename}.int8.onnx`));
    } catch { return undefined; }
    let ortLib: OrtLike, sess: OrtSession;
    try {
        ortLib = await loadOrt("Hebrew neural restoration");
        const ep = process.env.HE_ORT_EP;
        sess = await ortLib.InferenceSession.create(modelBytes, ep ? { executionProviders: ep.split(",") } : undefined);
    } catch { return undefined; }
    const nTags = Object.keys(meta.tags).length;

    return {
        async restore(clause: string): Promise<string> {
            const chars = [...clause.normalize("NFC")];
            const T = chars.length;
            if (T === 0) return "";
            // Every char must be a known symbol (letters + space); a stray/foreign char → decline (defer to sync).
            const ids = new Array<number>(T);
            for (let i = 0; i < T; i++) {
                const id = meta.src[chars[i]!];
                if (id === undefined) return "";
                ids[i] = id;
            }
            const r = await sess.run({ chars: new ortLib.Tensor("int64", BigInt64Array.from(ids, (x) => BigInt(x)), [1, T]) });
            const logits = r.logits!.data as Float32Array;
            // Predict the niqqud per char, reassembling one VOCALIZED word per space-delimited run, then g2p each.
            const words: string[] = [""];
            for (let k = 0; k < T; k++) {
                if (chars[k] === " ") { words.push(""); continue; } // word boundary
                const best = maskedArgmax(logits, k * nTags, meta.charTags[String(ids[k])]);
                const tag = best < 0 ? BARE : meta.tags[String(best)] ?? BARE;
                if (tag === SPACE) { words.push(""); continue; }
                words[words.length - 1] += chars[k] + (tag === BARE ? "" : tag); // consonant + restored niqqud
            }
            // A known non-homograph skeleton takes its lexicon reading (in our convention); else the tagger's g2p.
            return words.filter((w) => w.length > 0).map((w) => lexiconLookup(w.replace(NIQQUD, "")) ?? phonemizeWord(w)).join(" ");
        },
    };
}
