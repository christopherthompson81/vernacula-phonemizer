/**
 * Shared onnxruntime-node plumbing for every neural path (fa tagger/seq2seq/context restorers, the rider + Arabic
 * diacritizers, the Bengali OOV tagger). `onnxruntime-node` is an OPTIONAL dependency: it is imported lazily here
 * exactly once per process, and consumers wrap `loadOrt()` in their own try/catch to fall back to the sync path
 * (or, for bare Arabic, to surface the install hint). ⚠ ONE SOURCE FOR THE Ort* INTERFACES AND THE LOADER: hand-
 * copied per consumer they drift, and they had — different `OrtTensor.data` unions, `create(path)` vs
 * `create(bytes, options)`.
 */

/** An ORT output/input tensor. `data` is the widest union any consumer needs (int64 ids, float32 logits/states,
 *  uint8 bool masks). */
export interface OrtTensor {
    data: Float32Array | BigInt64Array | Uint8Array;
}

export interface OrtSession {
    run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>;
}

export interface OrtLike {
    /** `create` accepts either a path or the model bytes, with an optional execution-provider list (CPU default;
     *  the taggers opt into CUDA via an env var for fast eval). */
    InferenceSession: {
        create(model: string | Uint8Array, options?: { executionProviders: string[] }): Promise<OrtSession>;
    };
    Tensor: new (
        type: string,
        data: BigInt64Array | Float32Array | Uint8Array,
        dims: number[],
    ) => OrtTensor;
}

/**
 * ⚠ THE SPECIFIER IS A CONST, NOT A LITERAL IN THE `import()` BELOW — DO NOT INLINE IT.
 *
 * A literal makes `tsc` RESOLVE the package, and resolution fails when the optional dependency is absent:
 * TS2307, breaking the typecheck of anyone who never asked for ONNX. npm reports a failed optional install as
 * SUCCESS (the native binary is simply missing), so this lands as an intermittent CI failure in changes that
 * touch nothing near ONNX — PR #746 saw the same commit fail once and pass on re-run, unmodified. The
 * indirection keeps the import DYNAMIC in every sense: no static resolution, no type dependency, and no ambient
 * `declare module` that would shadow a real onnxruntime-node in a consumer's project (this package exports TS
 * SOURCE, so a declaration shipped here would land in their compilation too).
 *
 * Nothing is lost: `OrtLike` above is the checked contract, and the cast below is what enforces it either way.
 * test/onnx-optional.test.ts pins both this indirection and the sole-importer rule that makes it sufficient.
 */
const ORT_SPECIFIER = "onnxruntime-node";

let ortPromise: Promise<OrtLike> | undefined;

/**
 * Lazily import onnxruntime-node once per process. `context` names the caller for the missing-dependency error (e.g.
 * "Arabic diacritization"). On import failure the memo is cleared so a later call can retry, and the rejection is
 * NOT cached — so each caller sees its own context. Callers that treat the model as optional catch and fall back.
 */
export function loadOrt(context = "Neural inference"): Promise<OrtLike> {
    if (ortPromise) return ortPromise;
    return (ortPromise = import(ORT_SPECIFIER)
        .then((m) => ((m as { default?: unknown }).default ?? m) as unknown as OrtLike)
        .catch(() => {
            ortPromise = undefined;
            throw new Error(
                `${context} needs the optional dependency \`onnxruntime-node\`. Install it with \`npm install onnxruntime-node\`.`,
            );
        }));
}
