/**
 * Persian STRUCTURAL TAGGER — the DEFAULT modern fa restorer. A sentence-level BiLSTM sequence-labeller that emits
 * one IPA-chunk TAG per abjad char (the char's consonant, COPIED, plus its following short vowel / ezafe), then
 * assembles the tags into words on the space chars. Because output length == input length, it CANNOT degenerate and
 * CANNOT break the consonant skeleton — a single forward pass, no beam, no autoregressive decode loop, no
 * degeneration guard. Context (ezafe / homographs) comes from the bidirectional pass.
 *
 * It REPLACES the modern seq2seq context restorer. On the CANONICAL held-out (the fair gold — colloquial
 * fusions/elisions no canonical phonemizer would produce are excluded) it measures 93.6% per-word vs the seq2seq's
 * 92.5% on that same subset, with 0% catastrophic degeneration (the seq2seq's ~1.4% runaway-loop risk) at ~3MB vs
 * ~5MB. A per-char CONSONANT-CONSISTENCY MASK constrains each char to only the tags whose consonant it produced in
 * training (ص→s, never ʃ; غ→ɣ, never the colloquial ɡ), so the output is always canonical. See
 * fa-tagger.PROVENANCE.md and.
 *
 * `onnxruntime-node` is optional (lazy import); createFaTagger() resolves to `undefined` (no-op) if it or the model
 * is absent — identical to the seq2seq restorer's contract, so callers fall back to the word-level path.
 */
import { stressPerWord, type FaContextRestorer } from "./contextRestorer.ts";

import { loadOrt, type OrtLike, type OrtSession } from "../../core/onnx.ts";
import { maskedArgmax, type TaggerMeta } from "../../core/structuralTagger.ts";
import { dataDir } from "../../core/dataPath.ts";
import { readData, readDataText } from "../../core/dataSource.ts";
import { env } from "../../core/env.ts";


const SHORT_V = new Set(["a", "e", "o"]);
/**
 * Post-tagger FIRST-VOWEL correction — targets the tagger's /a/-prior default on the lexically-fixed first syllable
 * (the correct vowel is in the clean training data, but the lightweight BiLSTM can't memorise every lexical
 * exception, so it falls back to the majority /a/). Two parts: (1) a DETERMINISTIC rule — word-initial آ (alef madda)
 * is always ʔ + long aː, so after the leading ʔ we force a long aː: promote a short vowel (آزاد ʔazaːd→ʔaːzaːd) OR
 * INSERT aː when the tagger dropped the vowel entirely (آنان ʔnaːn→ʔaːnaːn); (2) a PIN transplant — replace the first
 * short vowel with the value pinned for frequent, consistent (non-homograph) words. Only the first vowel is touched;
 * consonants, later vowels, and ezafe are left to the tagger. Validated fix-only (0 breaks) on the GE2PE +
 * cross-source referees; no HomoRich-canonical regression.
 */
function correctFirstVowel(word: string, ipa: string, pin: Map<string, string>): string {
    const cp = [...ipa];
    if (word.startsWith("آ") && cp[0] === "ʔ") { // deterministic: آ = ʔ + long aː
        if (cp[1] === "a" && cp[2] === "ː") return ipa;                             // already ʔaː → correct
        if (cp[1] !== undefined && SHORT_V.has(cp[1])) return "ʔaː" + cp.slice(2).join(""); // ʔa/ʔe/ʔo → ʔaː
        if (cp[1] === "i" || cp[1] === "u") return ipa;                             // ʔiː/ʔuː — not our target, leave
        return "ʔaː" + cp.slice(1).join("");                                        // consonant/dropped vowel → insert aː
    }
    if (word.startsWith("آ")) return ipa;
    const v = pin.get(word);
    if (v) {
        for (let i = 0; i < cp.length; i++) {
            if (SHORT_V.has(cp[i]!) && cp[i + 1] !== "ː") return cp.slice(0, i).join("") + v + cp.slice(i + 1).join("");
        }
    }
    return ipa;
}

/** Build the structural tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export async function createFaTagger(basename = "fa-tagger"): Promise<FaContextRestorer | undefined> {
    const dir = dataDir(import.meta.url);
    let meta: TaggerMeta, modelBytes: Uint8Array;
    try {
        meta = JSON.parse(readDataText(`${dir}/${basename}.meta.json`)) as TaggerMeta;
        modelBytes = readData(`${dir}/${basename}.int8.onnx`);
    } catch { return undefined; }
    // First-syllable-vowel pin (fa-pin-vowels.tsv, skeleton→first short vowel). Optional — empty if absent.
    const pin = new Map<string, string>();
    try {
        for (const line of readDataText(`${dir}/fa-pin-vowels.tsv`).split("\n")) {
            if (!line || line.startsWith("#")) continue;
            const [w, v] = line.split("\t");
            if (w && v) pin.set(w, v);
        }
    } catch { /* no pin file → tagger output unchanged */ }
    let ortLib: OrtLike, sess: OrtSession;
    try {
        ortLib = await loadOrt("Persian neural tagging");
        // Shipping default is CPU. Opt into a GPU execution provider (fast eval iteration) with FA_ORT_EP=cuda.
        const ep = env("FA_ORT_EP");
        sess = await ortLib.InferenceSession.create(modelBytes, ep ? { executionProviders: ep.split(",") } : undefined);
    } catch { return undefined; }
    const UNK = meta.src["<unk>"] ?? 1;
    const nTags = Object.keys(meta.tags).length;

    return {
        async restore(sentence: string): Promise<string> {
            const chars = [...sentence];
            const T = chars.length;
            if (T === 0) return "";
            const ids = BigInt64Array.from(chars.map((c) => BigInt(meta.src[c] ?? UNK)));
            const r = await sess.run({ chars: new ortLib.Tensor("int64", ids, [1, T]) });
            const logits = r.logits!.data as Float32Array; // flat [T * nTags], row-major (t·nTags + tag)
            const words: string[] = [""];
            for (let k = 0; k < T; k++) {
                if (chars[k] === " ") { words.push(""); continue; } // word boundary → new word, no tag emitted
                const id = meta.src[chars[k]!] ?? UNK;
                // Masked argmax over ONLY this char's permitted tags (the consonant mask): keeps every consonant
                // canonical, a cheap scan of ~8 candidates. UNK permits all tags, so `best` is never -1 here.
                const best = maskedArgmax(logits, k * nTags, meta.charTags[String(id)]);
                const tag = best < 0 ? "" : meta.tags[String(best)] ?? "";
                if (tag !== " ") words[words.length - 1] += tag;
            }
            // Correct the lexically-fixed first vowel (آ→aː rule + pin transplant) before stress; grapheme words
            // align 1:1 with the tagged output words (both split on the input spaces).
            const gWords = sentence.split(" ");
            const fixed = words.map((w, i) => correctFirstVowel(gWords[i] ?? "", w, pin));
            return stressPerWord(fixed.join(" "));
        },
    };
}
