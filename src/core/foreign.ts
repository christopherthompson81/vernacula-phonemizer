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
