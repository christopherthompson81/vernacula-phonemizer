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
