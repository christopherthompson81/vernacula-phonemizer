/**
 * Shared ONNX-runtime plumbing for every neural path (fa tagger/seq2seq/context restorers, the rider + Arabic
 * diacritizers, the Bengali OOV tagger). `onnxruntime-node` is an OPTIONAL dependency: it is imported lazily here
 * exactly once per process, and consumers wrap `loadOrt()` in their own try/catch to fall back to the sync path
 * (or, for bare Arabic, to surface the install hint). ⚠ ONE SOURCE FOR THE Ort* INTERFACES AND THE LOADER: hand-
 * copied per consumer they drift, and they had — different `OrtTensor.data` unions, `create(path)` vs
 * `create(bytes, options)`. `setOrtLoader()` swaps the runtime (e.g. `onnxruntime-web`) without any consumer
 * changing, which is what that single source buys.
 *
 * ⚠ EVERY CONSUMER NOW PASSES MODEL **BYTES** TO `InferenceSession.create`, never a path. Khmer passed a
 * filesystem path until #1245 — the one call site no data source but the local filesystem could satisfy.
 */

/** An ORT output/input tensor. `data` is the widest union any consumer needs (int64 ids, float32 logits/states,
 *  uint8 bool masks). */
export interface OrtTensor {
    data: Float32Array | BigInt64Array | Uint8Array;
}

export interface OrtSession {
    run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>>;
}

/**
 * The session knobs every runtime behind `OrtLike` understands. `executionProviders` is the one the call
 * sites set (CPU default; the taggers opt into CUDA via an env var for fast eval); the thread knobs exist
 * for `setOrtSessionDefaults` and are never passed by a language.
 */
export interface OrtSessionOptions {
    executionProviders?: string[];
    /** Size of ORT's intra-op pool. ⚠ THE RUNTIME DEFAULT IS ONE THREAD PER CORE — see `setOrtSessionDefaults`. */
    intraOpNumThreads?: number;
    interOpNumThreads?: number;
    executionMode?: "sequential" | "parallel";
}

export interface OrtLike {
    /** `create` accepts either a path or the model bytes, with optional session options. */
    InferenceSession: {
        create(model: string | Uint8Array, options?: OrtSessionOptions): Promise<OrtSession>;
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
let loader: (() => Promise<unknown>) | undefined;

/**
 * Replace the ORT provider — the second of the two seams that make the engine browser-ready (#1245).
 *
 *   setOrtLoader(() => import("onnxruntime-web"));
 *
 * `OrtLike`/`OrtSession`/`OrtTensor` were already runtime-agnostic interfaces and `loadOrt()` was already a
 * lazy dynamic import behind a const specifier, so this is the whole of seam 2: `onnxruntime-web` satisfies
 * the same contract, and every neural path reaches it through `loadOrt()`.
 *
 * ⚠ IT CLEARS THE MEMO. `loadOrt` caches the resolved library for the process, and a loader installed after
 * something had already prewarmed a model would otherwise be accepted and ignored — the caller would see a
 * successful `setOrtLoader` and keep running on the old runtime. Passing `undefined` restores the default.
 */
export function setOrtLoader(next: (() => Promise<unknown>) | undefined): void {
    loader = next;
    ortPromise = undefined;
}

let sessionDefaults: OrtSessionOptions | undefined;

/**
 * Merge these options into EVERY `InferenceSession.create` the engine makes — the seam that lets a caller
 * cap ORT's thread pool WITHOUT reaching past `loadOrt()` into `onnxruntime-node` itself, which
 * test/onnx-optional.test.ts forbids outright (core/onnx.ts is the sole importer, and that is what keeps
 * the optional dependency optional).
 *
 * ⚠ IT EXISTS BECAUSE THE DEFAULT POOL SCALES BADLY, AND A CALLER WITH ITS OWN PARALLELISM WANTS IT OUT OF
 * THE WAY. Measured over the whole golden fleet on 8 physical cores (189 languages, 36,495 rows): the
 * default per-core pool spends 254 CPU-seconds to finish in 47.5 s wall, a one-thread pool spends 93 to
 * finish in 83.5 s. That is 2.7× the CPU for 43% of the wall — so `tools/check-goldens.mts --jobs N` caps
 * the pool in each child and gets ~2× overall, where sharding at the default setting got 12% and one
 * setting lost outright (docs/investigations/en/test_wall_time_investigation.md, Run 5).
 *
 * ⚠ NOTHING IN THE LIBRARY CALLS THIS, AND NOTHING SHOULD. The default is the right one for production
 * inference latency, where a single request wants every core it can get; this is for a batch caller that
 * is already running N of them.
 *
 * ⚠ THESE WIN OVER THE CALL SITE'S OWN OPTIONS, deliberately — the point is to override a runtime default
 * the call sites never set. Nothing here sets `executionProviders`, so a tagger's CUDA opt-in survives.
 *
 * ⚠ IT CLEARS THE LOADER MEMO, AND IT MUST. Whether the runtime is wrapped at all is decided ONCE, when
 * `loadOrt` resolves; without the clear, a single earlier `loadOrt()` — a bare availability probe that
 * created no session at all — would fix the unwrapped runtime in place and this call would be a silent
 * no-op for every path, forever. Measured while reviewing this: probe, then set a one-thread cap, then
 * create a session, and the session is created at full width with no error. That is the Run 2 dead end
 * (N shards × one thread per CORE) reappearing behind a green verdict, which is the worst way to lose it.
 *
 * ⚠ IT STILL ONLY GOVERNS SESSIONS CREATED AFTER IT. Clearing the memo re-wraps the RUNTIME; it cannot
 * reach a session a neural path already built and memoised for itself. Call it before any phonemization.
 */
export function setOrtSessionDefaults(next: OrtSessionOptions | undefined): void {
    sessionDefaults = next;
    ortPromise = undefined;
}

/** ⚠ ONLY WRAPPED WHEN THERE IS SOMETHING TO MERGE. test/browser-seams.test.ts pins that `loadOrt()`
 *  resolves to the very object `setOrtLoader` installed; an unconditional wrapper would break that identity
 *  for every caller in order to serve a mode almost nobody turns on. */
function withSessionDefaults(ort: OrtLike): OrtLike {
    return {
        ...ort,
        InferenceSession: {
            create: (model, options) => ort.InferenceSession.create(model, { ...options, ...sessionDefaults }),
        },
    };
}

/**
 * Lazily import onnxruntime-node once per process. `context` names the caller for the missing-dependency error (e.g.
 * "Arabic diacritization"). On import failure the memo is cleared so a later call can retry, and the rejection is
 * NOT cached — so each caller sees its own context. Callers that treat the model as optional catch and fall back.
 */
export function loadOrt(context = "Neural inference"): Promise<OrtLike> {
    if (ortPromise) return ortPromise;
    const installed = loader;
    const load = installed ?? ((): Promise<unknown> => import(ORT_SPECIFIER));
    const mine: Promise<OrtLike> = load()
        .then((m) => {
            const ort = ((m as { default?: unknown }).default ?? m) as unknown as OrtLike;
            return sessionDefaults ? withSessionDefaults(ort) : ort;
        })
        .catch((err: unknown) => {
            // ⚠ ONLY CLEAR THE MEMO IF IT IS STILL OURS. A `setOrtLoader()` during an in-flight load
            //   installs a new promise; a blanket `ortPromise = undefined` here would then discard the
            //   NEW memo when the OLD load finally rejects, and every later loadOrt would re-run the
            //   loader. And keep `err` as the cause — for a browser runtime the underlying failure (a
            //   WASM fetch, a missing artifact) is the only actionable part of the message.
            if (ortPromise === mine) ortPromise = undefined;
            throw new Error(
                installed
                    ? `${context} failed to load the ONNX runtime installed with setOrtLoader().`
                    : `${context} needs the optional dependency \`onnxruntime-node\`. Install it with \`npm install onnxruntime-node\`.`,
                { cause: err },
            );
        });
    return (ortPromise = mine);
}
