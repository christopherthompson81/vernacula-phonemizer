/**
 * The DEFAULT foreign-run phonemizer: how an engine reads a run of text in a script it does not own
 * (in practice, embedded Latin — a brand name, acronym, loanword or code-switched phrase).
 *
 * Registered by the registry rather than imported from it, so `core/` keeps its no-dependency
 * position and there is no import cycle. Set once at registry module load; read lazily.
 *
 * Why this exists: an engine's tokenizer only matches its own script, and `assembleClauses` skips
 * whatever the tokenizer does not claim — so before this, 47 engines DROPPED embedded Latin outright.
 * `phonemize("hello век", "ru")` returned just the Cyrillic. Measured in the FLEURS corpora that is
 * 3–15% of utterances per language (Greek 15.3%, Thai 15.4%, Korean 14.1%), losing real content:
 * "new mexico", "covid", "gps", "ebay craigslist", "aol im".
 *
 * The 144 engines that already handle Latin do so with their own tokenizer group plus an injected
 * `ForeignPhonemizer`; they claim the text, leave no gap, and are unaffected by this fallback.
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
 * SCRIPT-AWARE reading (see core/scripts.ts). `defaultForeign` above always read a run as ENGLISH, which
 * is right for Latin and wrong for everything else — and in practice every non-Latin run was dropped
 * before it ever got here. The reader below is given the run AND the host language so it can route by
 * script, with the host's own overrides applied.
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
