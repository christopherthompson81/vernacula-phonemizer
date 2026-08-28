/**
 * Tagalog (tl) TEXT NORMALIZATION — the pre-tokenizer rewrites, the slot `normalizeNaija`/`normalizeHausa`
 * occupy. The SYMBOL tier (%, currency, &, magnitudes, units) lives in `tagalog.ts` with the engine data, as
 * it does for ha/af/pcm; what belongs here is text a reader rewrites before any token boundary is decided.
 * This runs BEFORE the symbol tier, and that order is load-bearing for the entity rule below.
 *
 * Evidence base: the mined tl artifact (259 utterances, tools/corpus/mined/tl.jsonc) for shapes and counts,
 * with tl.wikipedia (~48k articles) as the sense-check for contested words, the same two-source method the
 * pcm and km normalizations used.
 */
import { rewrite } from "../../core/provenance.ts";

/**
 * HTML ENTITIES, before anything can voice them. The mined corpus carries 44 entities against 23 real
 * ampersands (`116°&nbsp;40'`, `Enero 14 &ndash;`), and the shared symbol tier's ampersand rule reads EVERY
 * ⟨&⟩ — so `&nbsp;` became "at nbsp" (the km lesson: its ampersand read "… and nbsp …" until the converter
 * was fixed, and a local guard kept the survivors quiet). Spacing/dash entities become their character so
 * the neighbouring rules (ranges, units) see the text a reader sees; the rest are dropped whole rather than
 * voiced piecemeal.
 */
const ENTITY = /&(nbsp|ndash|mdash|amp|quot|lt|gt|#\d+);/gu;
const ENTITY_CHAR: Record<string, string> = { nbsp: " ", ndash: "–", mdash: "—", amp: "&" };

/**
 * DIGIT RANGES. ⟨–⟩/⟨—⟩ between digits reads ⟨hanggang⟩ ("until/up to") — the corpus's own range idiom,
 * written out 32 times as an en-dash and repeatedly as a word: "sa pagitan ng 1995 hanggang 2000", "mula
 * ika-3 buwan hanggang ika-5 buwan". The hyphen is NOT included: Tagalog writes real hyphen compounds
 * (kaibigan-ko) and the tokenizer's LATIN_RUN preserves them — but a hyphen BETWEEN DIGITS cannot be a
 * compound (compounds are letter-joined), and the artifact's digit-hyphen-digit instances are year ranges
 * ("(1-100 CE/AD)", "100-600"), so that one hyphen shape is a range too. ⟨ika-3⟩ is safe: its hyphen has a
 * letter on the left. A leading dash with no left digit ("taong -73 000") is NOT touched — that is the
 * prehistoric-year notation whose refusal is recorded in ACCEPTED_SIGN_SILENCE.
 */
const RANGE = /(\d)\s*[–—]\s*(?=\d)|(\d)-(?=\d)/gu;

/** Tagalog text → text, before tokenization. */
export function normalizeTagalog(input: string): string {
    return rewrite(rewrite(input
        , ENTITY, (_m, name: string) => ENTITY_CHAR[name] ?? " ")
        , RANGE, "$1$2 hanggang ");
}
