/**
 * The DEFAULT foreign-run phonemizer: how an engine reads a run of text in a script it does not own
 * (in practice, embedded Latin — a brand name, acronym, loanword or code-switched phrase).
 *
 * Registered by the registry rather than imported from it, so `core/` keeps its no-dependency
 * position and there is no import cycle. Set once at registry module load; read lazily.
 *
 * ⚠ WHY THIS EXISTS: an engine's tokenizer only matches its own script, and `assembleClauses` skips
 * whatever the tokenizer does not claim — so without a fallback, `phonemize("hello век", "ru")` returns just
 * the Cyrillic. That is 3–15% of utterances per language, losing real content ("new mexico", "covid", "gps").
 *
 * An engine that handles Latin itself — its own tokenizer group plus an injected `ForeignPhonemizer` — claims
 * the text, leaves no gap, and is unaffected by this fallback.
 */

/** Reads a run of foreign (non-native-script) text to canonical IPA. */
export type ForeignPhonemizer = (text: string) => string;

let defaultForeign: ForeignPhonemizer | undefined;

/** Register the fallback used for unclaimed foreign runs. Called by the registry at load. */
export function setDefaultForeign(f: ForeignPhonemizer): void {
    defaultForeign = f;
}

/** The registered fallback, or `undefined` if none — in which case unclaimed runs stay dropped. */
export function getDefaultForeign(): ForeignPhonemizer | undefined {
    return defaultForeign;
}

/**
 * SCRIPT-AWARE reading (see core/scripts.ts). ⚠ `defaultForeign` above reads every run as ENGLISH, which is
 * right for Latin and wrong for everything else. This reader is given the run AND the host language, so it can
 * route by script with the host's own overrides applied.
 */
export type ScriptReader = (run: string, host: string) => string | undefined;

let scriptReader: ScriptReader | undefined;

/** Register the script router. Called by the registry at load, like `setDefaultForeign`. */
export function setScriptReader(f: ScriptReader): void {
    scriptReader = f;
}

/**
 * The host language currently being read, as a STACK — reading a foreign run calls back into another
 * engine, so this nests, and a plain variable would be clobbered by the inner call and never restored.
 * Synchronous throughout, so a stack is sufficient and no async context is needed.
 */
const hosts: string[] = [];

export function pushHost(lang: string): void {
    hosts.push(lang);
}
export function popHost(): void {
    hosts.pop();
}

/**
 * Run one SYNCHRONOUS render with `lang` as the host, restoring the previous host afterwards.
 *
 * ⚠ `fn` is typed sync ON PURPOSE, and that is the whole point of this helper existing rather than callers
 * pairing `pushHost`/`popHost` themselves. The stack above is only correct while every push and its pop sit
 * in the same synchronous turn; hold a host across an `await` and two concurrent callers interleave into
 * each other's frames. The ASYNC (neural) entries each end in a synchronous engine call, so they wrap THAT
 * — not the whole promise. Without it their foreign runs are dropped outright: `readForeignRun` declines
 * with an empty stack, and the Latin-only default never sees a non-Latin run
 * (`phonemizeAsync("বছর Владимир শেষ", "bn")` lost the name entirely).
 */
export function withHost<T>(lang: string, fn: () => T): T {
    pushHost(lang);
    try {
        return fn();
    } finally {
        popHost();
    }
}

/**
 * Read one foreign run in the current host's context. `undefined` when there is no router, no host, or
 * the router declines (an unknown script, or a target equal to the host — which would hand the engine
 * back text its own tokenizer already refused, and recurse).
 *
 * DEPTH IS CAPPED. A pathological document alternating scripts could otherwise nest engine calls without
 * bound; three levels is far past anything real (a Latin brand inside a Greek quote inside Thai).
 */
export function readForeignRun(run: string): string | undefined {
    const host = hosts[hosts.length - 1];
    if (scriptReader === undefined || host === undefined || hosts.length > 3) return undefined;
    return scriptReader(run, host);
}

/**
 * NEURAL OOV READINGS for words inside embedded foreign runs, resolved by the async entries and consulted by
 * the default (English) foreign reader.
 *
 * ⚠ WHY THIS EXISTS: `defaultForeign` is typed synchronous, so a delegated run got English's SYNC engine —
 * lexicon + n-gram OOV — even under `phonemizeAsync`. The neural BiLSTM never saw it, and delegated runs are
 * mostly proper nouns, i.e. exactly the OOV tail the BiLSTM exists for. Measured on the OmniVoice FLEURS
 * corpora, the sync reader deletes and invents phones the async one does not:
 *
 *     liguria      async ləɡjˈʊɹiʲə          sync lˈaᶦʊɹiʲə        (the ɡ is gone)
 *     adekoya      async æd̬əkʰˈɔᶦə           sync ˈædŋkoᶷjˌɑː      (ˈædŋ is not an English onset)
 *     sezen        async sˈɛzən              sync sˈɑːʃɛn
 *
 * A PLAIN MEMO, deliberately — not a scoped override like `withHost` above. The tagger reads a bare lowercased
 * g2pKey, so a reading is context-free and deterministic: there is nothing to restore, hence none of the
 * async-interleaving hazard that forces the host stack to stay inside one synchronous turn. Consulted ONLY on
 * the foreign path, so `phonemize(text, "en")` stays byte-identical no matter what ran before it.
 */
const foreignOov = new Map<string, string>();

/** Cap the memo. Readings are tiny and reused across utterances, but a long-lived process phonemizing an
 *  unbounded stream of documents should not grow one forever. Oldest-first eviction; a re-tag costs one
 *  BiLSTM call, so a miss is cheap and correctness never depends on a hit. */
const FOREIGN_OOV_MAX = 20_000;

/** Record one neural reading for `g2pKey`. Called by the async entries' pre-pass. */
export function addForeignOov(g2pKey: string, ipa: string): void {
    if (foreignOov.size >= FOREIGN_OOV_MAX) {
        const oldest = foreignOov.keys().next();
        if (!oldest.done) foreignOov.delete(oldest.value);
    }
    foreignOov.set(g2pKey, ipa);
}

/** The neural reading for `g2pKey`, or `undefined` — the shape English's `oovOverride` expects. */
export function lookupForeignOov(g2pKey: string): string | undefined {
    return foreignOov.get(g2pKey);
}
