/**
 * English OOV G2P — the neural OOV reader. A per-grapheme BiLSTM (ONNX) that labels each
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
 *
 * ⚠ FALLING BACK IS THE POLICY; BEING SILENT ABOUT IT WAS NOT. Degrading rather than throwing is right — a
 * missing OPTIONAL model must not take an utterance down — but until this comment was written the two catches
 * below were bare, so `loadOrt` built a diagnosable message ("…whose native library failed to load: <reason>")
 * and it was discarded a line later. Nothing downstream could tell a neural reading from an n-gram one, and
 * the difference is not cosmetic: on the words the dictionary misses, exact agreement with misaki's lexicon is
 * 31.0% neural against 19.9% n-gram over 80,222 words, and the `-able`/`-ible` suffix alone is misread 28.9%
 * of the time against 0.2%. A consumer measured the fallback for a full sweep and concluded the engine had a
 * rule defect; nothing in the system could have told them otherwise.
 *
 * So the reason is kept in {@link taggerUnavailableReason}. Reading it is how a caller, a CLI or a test asks
 * "did the neural path actually load?" — a question that previously had no answer.
 */

import { loadOrt, type OrtLike, type OrtSession } from "../../core/onnx.ts";
import { maskedArgmax, type TaggerMeta } from "../../core/structuralTagger.ts";
import { collapseGeminates, enforceSinglePrimary } from "./englishG2p.ts";

/** Orthographic vowel letters, for the digraph guard in `tag`. ⟨y⟩ is included: `gaywad`/`sinamay` double their
 *  vowel across ⟨ay⟩, which is the same misfire as ⟨oo⟩ and is invisible to a set without it. */
const VOWEL_LETTER = /^[aeiouy]$/u;

const base = (p: string): string => p.replace(/[0-2]$/u, "");
const stress = (p: string): string => (/[0-2]$/u.test(p) ? p.slice(-1) : "");
/** 1° beats 2° beats unstressed — for picking which of a digraph's two tagged copies keeps its mark. */
const STRENGTH: Record<string, number> = { "1": 3, "2": 2, "0": 1, "": 0 };
import { makeArpabetToIpa } from "./englishArpabet.ts";
import { MANIFEST } from "./manifest.ts";
import { dataDir } from "../../core/dataPath.ts";
import { readData, readDataText } from "../../core/dataSource.ts";
import { env } from "../../core/env.ts";

export interface EnglishTagger {
    /** A bare OOV word (letters) → canonical IPA, or "" to defer to the sync n-gram engine (out-of-vocab letter). */
    tag(word: string): Promise<string>;
}

let unavailableReason: string | undefined;

/**
 * Why the last {@link createEnglishTagger} call produced no tagger, or `undefined` when one was built (or when
 * none has been attempted). Set by the two catches below and cleared on success, so it describes the CURRENT
 * state rather than accumulating. The model is loaded once per process by enNeural.ts, so after the first
 * phonemize this is stable.
 */
export function taggerUnavailableReason(): string | undefined {
    return unavailableReason;
}

/** Build the English OOV tagger, or `undefined` if the model / onnxruntime-node is unavailable. */
export async function createEnglishTagger(basename = "en-g2p-tagger"): Promise<EnglishTagger | undefined> {
    const dir = dataDir(import.meta.url);
    let meta: TaggerMeta, modelBytes: Uint8Array;
    try {
        meta = JSON.parse(readDataText(`${dir}/${basename}.meta.json`)) as TaggerMeta;
        modelBytes = readData(`${dir}/${basename}.int8.onnx`); // dynamic-int8 quantised (9.4MB fp32 → 2.4MB)
    } catch (e) {
        // The model files, not the runtime — this is the ordinary "data tree without the optional model" case.
        unavailableReason = `the English neural OOV G2P model is not readable (${dir}/${basename}.*): ${String(
            (e as Error)?.message ?? e,
        )}`;
        return undefined;
    }
    let ortLib: OrtLike, sess: OrtSession;
    try {
        ortLib = await loadOrt("English neural OOV G2P");
        const ep = env("EN_ORT_EP"); // CPU default; opt into a GPU execution provider for fast eval
        sess = await ortLib.InferenceSession.create(modelBytes, ep ? { executionProviders: ep.split(",") } : undefined);
    } catch (e) {
        // loadOrt already names the runtime and why it failed; keep ITS message rather than a summary of it.
        unavailableReason = String((e as Error)?.message ?? e);
        return undefined;
    }
    unavailableReason = undefined;
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
            // ⚠ WHICH CHARACTER PRODUCED THE LAST PHONE, for the vowel-digraph guard below. Tracked here rather
            // than recovered afterwards because by the time `phones` is a flat list the alignment is gone.
            let lastFromChar = -2;
            for (let k = 0; k < T; k++) {
                const best = maskedArgmax(logits, k * nTags, meta.charTags[String(ids[k])]);
                if (best < 0) return "";
                const chunk = meta.tags[String(best)] ?? ""; // an ARPABET chunk: "K", "AE1", "HH AH0", or "" (silent)
                if (!chunk) continue;
                for (const p of chunk.split(" ")) {
                    // ⚠ A VOWEL DIGRAPH TAGGED ON BOTH OF ITS LETTERS. This model emits one chunk PER CHARACTER with
                    // no global constraint, so ⟨oo⟩/⟨ay⟩/⟨ei⟩/⟨au⟩ can get the vowel twice: `atishoo` came out
                    // ˈæt̬ɪʃˌuːˌuː, `anteroom` ˈæntɚˌuːˌuːm, `gaywad` ɡˌeᶦeᶦwˈɑːd. Reported as a malformedness in
                    // #1334's ten-row diagnosis; every instance in the referee is a digraph.
                    //
                    // ⚠ IT IS GUARDED ON THE TWO LETTERS BEING ADJACENT, AND THAT IS THE WHOLE RULE. The obvious
                    // fix — let the shared `collapseGeminates` drop doubled vowels too — IS WRONG, and the dictionary
                    // says so: 95 rows carry a real adjacent identical vowel pair and 89 of them are `ER0 ER0`, the
                    // `-erer` agentive (`acquirer` AH0 K W AY1 ER0 ER0, `adventurer`, `gatherer`, `emperor`). There
                    // the stem's /ər/ meets the suffix's /ər/ and collapsing DELETES A SYLLABLE — `acquirer` becomes
                    // `acquire`. That class is separated from a digraph by exactly this test: its two `ER0`s come
                    // from letters two apart with a silent consonant between them, never from adjacent vowels.
                    //
                    // ⚠ AND `tools/english/en_g2p_ngram.ts` HAS THE OPPOSITE BUG, still unfixed here: its own copy of
                    // collapseGeminates has no vowel exemption and its comment claims the collapse is "Lossless vs
                    // CMUdict". It is not — it changes 186 rows, and the 95 vowel ones are this same `-erer` class.
                    // So the trainer's targets/scoring and the shipped engine disagree. Fixing that means retraining.
                    const prev = phones[phones.length - 1];
                    if (
                        prev !== undefined &&
                        // ⚠ THE BASE, NOT THE WHOLE PHONE. The two copies of a digraph's vowel often carry
                        // DIFFERENT stress digits — `gaywad` tags EY2 then EY0, `Yenisei` EY2 then EY1 — so a
                        // byte-equality test (which is what the shared collapseGeminates uses) sees them as two
                        // different phones and lets every one of those through. Measured: base-matching catches
                        // all of them, byte-matching catches four.
                        base(prev) === base(p) &&
                        vowels.has(base(p)) &&
                        k - 1 === lastFromChar &&
                        VOWEL_LETTER.test(chars[k]!) &&
                        VOWEL_LETTER.test(chars[k - 1]!)
                    ) {
                        // ⚠ KEEP THE STRONGER STRESS. The digraph is ONE syllable and the model may have put the
                        // beat on either letter — dropping the second blindly loses `Yenisei`'s primary and leaves
                        // the word with its tonic on the wrong syllable (or, after enforceSinglePrimary promotes
                        // one, on an arbitrary one).
                        if (STRENGTH[stress(p)]! > STRENGTH[stress(prev)]!)
                            phones[phones.length - 1] = base(p) + stress(p);
                        continue;
                    }
                    phones.push(p);
                    lastFromChar = k;
                }
            }
            if (phones.length === 0) return "";
            // finish the SAME way the n-gram path does: one primary stress, collapse seam geminates, then render to IPA
            // (pass the word so the single-morpheme de-/re- reduction + barred-i rules fire, as for source "N").
            return arpabetToIpa(enforceSinglePrimary(collapseGeminates(phones, vowels), vowels), word);
        },
    };
}
