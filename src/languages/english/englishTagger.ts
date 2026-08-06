/**
 * English OOV G2P — the neural OOV reader (English divestment, Phase 4). A per-grapheme BiLSTM (ONNX) that labels each
 * letter with an ARPABET-chunk TAG in a SINGLE forward pass, replacing the joint n-gram (and the net-harmful
 * compound-splitter) on the non-lexicon tail. On a clean CMUdict held-out it roughly HALVES the phone-error-rate vs
 * the n-gram pipeline (9.3% vs 18.2%; word-exact 59% vs 37%). It emits stress-bearing ARPABET, then finishes it the
 * SAME way as the n-gram path — `enforceSinglePrimary` + `collapseGeminates` + `arpabetToIpa` (shared, so a G2P word
 * has no seam with the dict) — so the tagger's only job is the letters→ARPABET map. A per-letter CONSONANT mask
 * (charTags) keeps it from emitting an impossible tag.
 *
 * Self-contained in the English module (no C# port exists / is needed — the language is independently portable).
 * `onnxruntime-node` is an OPTIONAL dependency imported lazily; if it — or the model — is absent, createEnglishTagger()
 * resolves to `undefined` and the async path (enNeural.ts) falls back to the sync n-gram engine.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadOrt, type OrtLike, type OrtSession } from "../../core/onnx.ts";
import { maskedArgmax, type TaggerMeta } from "../../core/structuralTagger.ts";
import { collapseGeminates, enforceSinglePrimary } from "./englishG2p.ts";
import { makeArpabetToIpa } from "./englishArpabet.ts";
import { MANIFEST } from "./manifest.ts";

export interface EnglishTagger {
    /** A bare OOV word (letters) → canonical IPA, or "" to defer to the sync n-gram engine (out-of-vocab letter). */
    tag(word: string): Promise<string>;
}

/** Build the English OOV tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export async function createEnglishTagger(basename = "en-g2p-tagger"): Promise<EnglishTagger | undefined> {
    const dir = dirname(fileURLToPath(import.meta.url));
    let meta: TaggerMeta, modelBytes: Uint8Array;
    try {
        meta = JSON.parse(readFileSync(join(dir, `${basename}.meta.json`), "utf8")) as TaggerMeta;
        modelBytes = readFileSync(join(dir, `${basename}.int8.onnx`)); // dynamic-int8 quantised (9.4MB fp32 → 2.4MB)
    } catch { return undefined; }
    let ortLib: OrtLike, sess: OrtSession;
    try {
        ortLib = await loadOrt("English neural OOV G2P");
        const ep = process.env.EN_ORT_EP; // CPU default; opt into a GPU execution provider for fast eval
        sess = await ortLib.InferenceSession.create(modelBytes, ep ? { executionProviders: ep.split(",") } : undefined);
    } catch { return undefined; }
    const nTags = Object.keys(meta.tags).length;
    const arpabetToIpa = makeArpabetToIpa(MANIFEST.arpabet);
    const vowels = new Set(MANIFEST.arpabet.vowels); // ARPABET vowel bases, for the shared stress/geminate finishing

    return {
        async tag(word: string): Promise<string> {
            const chars = [...word.toLowerCase()];
            const T = chars.length;
            if (T === 0) return "";
            // DECLINE ("") on any letter outside the training vocab — its consonant isn't in the mask, so tagging it
            // would emit an arbitrary ARPABET chunk; the caller then defers the word to the sync n-gram engine.
            const ids = new Array<number>(T);
            for (let i = 0; i < T; i++) {
                const id = meta.src[chars[i]!];
                if (id === undefined) return "";
                ids[i] = id;
            }
            const r = await sess.run({ chars: new ortLib.Tensor("int64", BigInt64Array.from(ids, (x) => BigInt(x)), [1, T]) });
            const logits = r.logits!.data as Float32Array; // flat [T * nTags], row-major (t·nTags + tag)
            const phones: string[] = [];
            for (let k = 0; k < T; k++) {
                const best = maskedArgmax(logits, k * nTags, meta.charTags[String(ids[k])]);
                if (best < 0) return "";
                const chunk = meta.tags[String(best)] ?? ""; // an ARPABET chunk: "K", "AE1", "HH AH0", or "" (silent)
                if (chunk) for (const p of chunk.split(" ")) phones.push(p);
            }
            if (phones.length === 0) return "";
            // finish the SAME way the n-gram path does: one primary stress, collapse seam geminates, then render to IPA
            // (pass the word so the single-morpheme de-/re- reduction + barred-i rules fire, as for source "N").
            return arpabetToIpa(enforceSinglePrimary(collapseGeminates(phones, vowels), vowels), word);
        },
    };
}
