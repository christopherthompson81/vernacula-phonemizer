/**
 * THE WORD ARM OF A TOKENIZER, DERIVED FROM A SCRIPT — not hand-enumerated letters (#657).
 *
 * ## The defect this exists to make impossible
 *
 * Every engine used to hand-write its word class as a literal list of the letters it reads:
 *
 *     const TOKEN = /([a-zäöüßA-ZÄÖÜ]+)|(\d+)|([.!?…,;:])/gu;        // de
 *     const TOKEN = /([a-zçëA-ZÇË]+)|(\d+)|([.!?…,;:])/giu;          // sq
 *
 * That single regex was doing TWO unrelated jobs at once, and it is only correct for one of them:
 *
 *   1. WHICH SCRIPT IS THIS — a routing question. The answer decides whether the host engine reads the run or
 *      hands it to another language. It is a property of the SCRIPT, and a hand-written letter list is a bad
 *      approximation of a script: anything the list omits falls out of the token, lands in the gap, and gets
 *      routed by `emitUnclaimed` as if it were foreign text. One omitted letter re-routes mid-word.
 *   2. WHICH LETTERS CAN I PRONOUNCE — an inventory question, genuinely per-language and genuinely lexical.
 *
 * Conflating them means the routing boundary is decided 108 times over by 108 limited regexes, and it was wrong
 * in 108 of them. A word carrying a letter outside the list was cut at that letter; the orphaned letter went to
 * the shared router, which read it as an English LETTER NAME; and the remainder started a new word:
 *
 *     es  São Paulo → s ˈə o pˈau̯lo          hr  Cañitas → t͡sa ˈɛn itas
 *     de  Cañitas   → kaː ˈɛn ˈiːtaːs        sv  Cañitas → kɑː ˈɛn ˈìːtas
 *
 * ⚠ INVISIBLE TO EVERY GATE. No digit or raw mark survives and nothing VANISHES, so it is a WRONG-WORD defect
 * that neither the leak classes nor the differential DROP test can reach.
 *
 * ## The split
 *
 * `hostWordRun` answers (1) from the SCRIPT, once, here. An engine names the scripts it writes in and the
 * punctuation that continues a word inside one; it never enumerates letters to decide script membership, so
 * there is no list left to omit a letter from.
 *
 * `makeNativiser` answers (2), and takes the engine's own inventory — its former token class, lifted verbatim,
 * so nothing about the orthography is invented. Demoted from a routing decision to what it always was: a
 * statement about which letters the g2p has rules for.
 *
 * ⚠ THE TWO QUESTIONS HAVE DIFFERENT SCOPES, and this is why widening alone does not finish the job. Script
 * routing only ever fires ACROSS scripts. A Portuguese name inside Spanish text is Latin inside Latin — there is
 * no routing decision to get right, and the run correctly stays with the host. What is left is inventory: the
 * g2p has no rule for `ã` and simply DROPS it, and dropping is not nativising but deleting (`Klöcker` →
 * *klkkeɾ*). So a same-script foreign letter has to be FOLDED to a base the g2p can read.
 *
 * ## The two probes that say which an engine needs
 *
 * Feed it an ordinary English loan (`computer`):
 *   · output matches English → the engine ROUTES a foreign word to an injected reader. `hostWordRun` is the whole
 *     fix; the reader already knows the accent.
 *   · output is the engine's own → it NATIVISES. It also needs `makeNativiser`.
 *
 * Then feed it an accented letter already in its inventory (`Doña` for `tl`, `blåbær` for `nb`):
 *   · the accent survives → the fold must be CONDITIONAL, or it destroys exactly the letters the language CAN
 *     read. Tagalog's `ñ` is /ɲ/; an unguarded fold flattens it to /n/.
 *
 * ## ⚠ The probe is the specification, not a grep
 *
 * The first pass at this scoped the work by grepping for engines that declared their tokenizer as a top-level
 * `const TOKEN`. That found 21 of the 108 affected engines and silently dropped the rest — including `de`, `es`,
 * `sv`, `tr` and `sr`, all of which the behavioural probe had already flagged. A structural pattern is a
 * convenience; the measurement is the scope. `test/latin-tokenizers.test.ts` pins the measurement.
 */
import type { ScriptName } from "./scripts.ts";

/**
 * The word arm for an engine that writes in `scripts`: one letter of any of them, then letters, combining marks
 * and whatever `extra` characters continue a word in this orthography (apostrophes, an internal hyphen).
 *
 * Returned as a STRING, because most engines build their `TOKEN` by template — a native-script arm, a number arm,
 * a punctuation arm. `extra` is inserted into a character class, so it must already be class-safe (put `-` last).
 */
export function hostWordRun(scripts: readonly ScriptName[], extra = ""): string {
    const letters = scripts.map((s) => `\\p{Script=${s}}`).join("");
    return `[${letters}][${letters}\\p{M}${extra}]*`;
}

/** The Latin word arm — the overwhelmingly common case, spelled once so call sites do not repeat the array. */
export const LATIN_RUN = hostWordRun(["Latin"]);

/**
 * Discard combining marks, so a precomposed and a decomposed accent behave alike. `ö`→`o`, `ã`→`a`.
 * ⚠ Not every accented-looking letter decomposes: Akan's `ɛ` and Nama's clicks are DISTINCT LETTERS, and NFD
 * leaves them alone. That is correct — there is no accent to fold — but it means a test asserting "the fold
 * changed something" is vacuous for those languages. Assert the word is not SHREDDED instead.
 */
export const foldLatinToBase = (w: string): string => w.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");

/**
 * Build the CONDITIONAL fold for a nativising engine. `nativeWord` is the language's own inventory, anchored:
 * a word it matches is left exactly alone, and anything else has its accents folded to base.
 */
export const makeNativiser = (nativeWord: RegExp) => (w: string): string =>
    (nativeWord.test(w) ? w : foldLatinToBase(w));
