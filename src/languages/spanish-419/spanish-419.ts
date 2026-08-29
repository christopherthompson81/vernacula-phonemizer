/**
 * Latin-American Spanish (es-419) — the "neutral"/pan-American standard, an ACCENT VARIANT of the Castilian
 * `es` engine (not a separate language). The `es` engine is Castilian (it emits /θ/ and /ʎ/); Latin-American
 * Spanish differs from it by exactly two categorical, pan-regional mergers, both a context-free surface
 * substitution on the output (no information is lost, so this is a post-process like en-GB, not an engine fork):
 *
 *   • SESEO — /θ/ merges into /s/. Latin America has no dental fricative at all: ⟨c⟩ before e/i and ⟨z⟩ are
 *     [s] (cielo → sjelo, zapato → sapato, cerveza → seɾbesa, gracias → ɡɾasjas).
 *   • YEÍSMO — /ʎ/ merges into /ʝ/ (= the ⟨y⟩ phoneme). ⟨ll⟩ and ⟨y⟩ are one sound (calle → kaʝe, llave →
 *     ʝabe, pollo → poʝo, caballo → kabaʝo).
 *
 * Deliberately NOT applied (regional, not part of the neutral standard): coda /s/-aspiration (Caribbean/coastal
 * — Mexican/Andean keep [s], and the referee keeps [s]: gracias → ɡɾasjas), word-final /n/→[ŋ], and voseo. This
 * is the locale that labels the OmniVoice FLEURS `es_419` training audio.
 */
import type { Phonemizer } from "../../registry.ts";
import {
    createSpanish,
    phonemizeWord as phonemizeWordEs,
} from "../spanish/spanish.ts";
import { noteRewrite } from "../../core/trace.ts";

/** Castilian IPA → Latin-American: seseo (θ→s) + yeísmo (ʎ→ʝ). Context-free, no information lost. */
export function toLatinAmerican(castilian: string): string {
    return castilian.replace(/θ/gu, "s").replace(/ʎ/gu, "ʝ");
}

/** One es-419 word → canonical IPA (Castilian engine + the seseo/yeísmo mergers). */
export function phonemizeWord(word: string): string {
    return toLatinAmerican(phonemizeWordEs(word));
}

/** Build the Latin-American Spanish phonemizer (Castilian engine + the seseo/yeísmo mergers). */
export function createSpanish419(): Phonemizer {
    const e = createSpanish(true); // Latin-American usage in the normalization layer (el primero de enero)
    // ⚠ AN ACCENT VARIANT IS A WHOLE-STRING DELTA over the base engine's output, so a trace token records
    // the CASTILIAN reading and the utterance ships the American one. Reported (#1150).
    return {
        text: (input: string): string => {
            const pre = e.text(input);
            const out = toLatinAmerican(pre);
            noteRewrite("accent:es-419", pre, out, true);
            return out;
        },
    };
}
