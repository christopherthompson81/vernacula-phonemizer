/**
 * THE WORD ARM OF A TOKENIZER, DERIVED FROM A SCRIPT — not hand-enumerated letters.
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
 * The word arm for an engine that writes in `scripts`: a lead character, then letters, combining marks and
 * whatever `extra` characters continue a word in this orthography (apostrophes, an internal hyphen).
 *
 * Returned as a STRING, because most engines build their `TOKEN` by template — a native-script arm, a number arm,
 * a punctuation arm. `extra` and `medialOnly` are inserted into character classes, so they must already be
 * class-safe (put `-` last).
 *
 * ⚠ `medialOnly` EXISTS BECAUSE THE LEAD POSITION IS NOT THE SAME QUESTION as the continuation, and getting it
 * wrong silently deletes a phoneme. The first version of this required a LETTER in lead position, which reads as
 * the obviously-right thing and is wrong for any orthography where a mark is word-initial and phonemic: Hausa
 * writes `'yan` with a leading apostrophe for the glottalised /ʲ/, and requiring a letter first left the
 * apostrophe outside the token — `ʔʲan` became *jan*, the glottal simply gone. The old hand-written classes were
 * flat (`[a-zɓɗƙƴ'’]+`), so anything in them was lead-legal; an engine whose arm instead spelled the join out
 * (`[X]+(?:['’-][X]+)*`) meant those characters MEDIALLY only. Both shapes have to survive the migration, so the
 * caller says which it had. Found by a corpus diff, not by a test — which is the fourth time on this issue that
 * the diff caught what the probe could not.
 */
export function hostWordRun(scripts: readonly ScriptName[], extra = "", medialOnly = ""): string {
    const letters = scripts.map((s) => `\\p{Script=${s}}`).join("");
    // ⚠ NEVER CLAIM A DIGIT. `\p{Script=X}` includes X's DIGITS — N'Ko's ߀–߉ are Script=Nko and Adlam's 𞥐–𞥙 are
    // Script=Adlam — and because the word arm precedes the number arm, a script-derived class silently swallowed
    // every native-digit numeral in Bambara and Fula. The number arm exists precisely to read those, so the word
    // arm must decline them. (`[\p{Script=Nko}--\p{Nd}]` would say this directly but needs the `v` flag, which
    // these engines' tokenizers do not use; a lookahead per position says the same thing under `u`.)
    const nd = "(?!\\p{Nd})";
    const run = `${nd}[${letters}${extra}](?:${nd}[${letters}\\p{M}${extra}${medialOnly}])*`;
    // ⚠ VALIDATED, NOT DOCUMENTED. `extra` and `medialOnly` are spliced into a character class, so a `-` in the
    // wrong place becomes a RANGE: Min Dong passed `"-·"` and produced `[\p{M}-·]`, a range from a property
    // escape, which is a hard SyntaxError the first time the engine runs. Compiling here turns that into a
    // named failure at construction instead.
    //
    // ⚠ AND VALIDATION RATHER THAN REWRITING, which was the first attempt: moving every `-` to the end looks
    // like the robust fix and silently destroys a legitimate RANGE — Serbian and Bosnian pass their whole
    // Cyrillic alphabet as `"а-шђјљњћџ"`, and helpfully relocating that hyphen collapsed `а-ш` to `аш` and
    // dropped twenty-two letters out of the inventory. A guard that edits its input is not a guard.
    try {
        new RegExp(run, "u");
    } catch (e) {
        throw new Error(
            `hostWordRun: extra=${JSON.stringify(extra)} medialOnly=${JSON.stringify(medialOnly)} does not form a `
            + `valid character class (put a literal "-" LAST; a range like "а-ш" is fine as written): ${String(e)}`,
        );
    }
    return run;
}

/** The Latin word arm — the overwhelmingly common case, spelled once so call sites do not repeat the array. */
export const LATIN_RUN = hostWordRun(["Latin"]);

/**
 * ⚠ LETTERS NFD CANNOT REACH. `ö` decomposes to `o` + a combining mark, so discarding marks folds it. `æ`, `ø`,
 * `þ`, `ð`, `ß`, `ł`, `ŋ`, `ɛ` and the rest below are DISTINCT LETTERS with no decomposition at all — NFD leaves
 * them exactly as they are, the g2p has no rule for them, and the letter is then silently DROPPED. Measured
 * across the fleet: 86 languages dropped at least one of these, ~80 languages per letter. `Æthelred` in German
 * read *thˈɛlʁət*, the Æ simply gone.
 *
 * Dropping is the worst of the available answers: an explicitly typed character is content, and deleting it is
 * neither nativising nor routing. So each maps to the nearest letter the language's own g2p is guaranteed to have
 * a rule for.
 *
 * ⚠ SINGLE LETTERS, NOT DIGRAPHS, and that is the deliberate choice. The conventional ASCII transliterations are
 * digraphs (`æ`→ae, `ø`→oe, `þ`→th, `ŋ`→ng), but a g2p reading `ae` as two vowel segments turns one sound into
 * two — a worse error than an imprecise single vowel. `ß`→`ss` is the one exception, because that IS the German
 * orthographic identity and every g2p reads `ss` as a single /s/.
 *
 * These are approximations by phonetic proximity, not claims about any orthography. A language for which one of
 * these letters is NATIVE never reaches this table — the conditional fold leaves its own letters alone, which is
 * why Akan keeps `ɛ` and Nama keeps its clicks.
 */
const UNDECOMPOSABLE: Readonly<Record<string, string>> = {
    æ: "a", Æ: "A", œ: "o", Œ: "O", ø: "o", Ø: "O", ð: "d", Ð: "D", þ: "t", Þ: "T",
    ß: "ss", ł: "l", Ł: "L", đ: "d", Đ: "D", ħ: "h", Ħ: "H", ŋ: "n", Ŋ: "N",
    ɛ: "e", Ɛ: "E", ɔ: "o", Ɔ: "O", ə: "e", Ə: "E", ɓ: "b", Ɓ: "B", ɗ: "d", Ɗ: "D",
    ƙ: "k", Ƙ: "K", ƴ: "y", Ƴ: "Y", ı: "i", ʉ: "u", ɨ: "i", ƀ: "b", ŧ: "t", ſ: "s",
    ƒ: "f", Ƒ: "F", // f with hook — /f/ in the African orthographies that use it (and the florin sign)
};
const UNDECOMPOSABLE_RE = new RegExp(`[${Object.keys(UNDECOMPOSABLE).join("")}]`, "gu");

/**
 * Discard combining marks, so a precomposed and a decomposed accent behave alike (`ö`→`o`, `ã`→`a`), then map the
 * letters no decomposition can reach (see `UNDECOMPOSABLE` above).
 */
export const foldLatinToBase = (w: string): string =>
    w.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC")
        .replace(UNDECOMPOSABLE_RE, (c) => UNDECOMPOSABLE[c] ?? c);

/** One base character with any combining marks that belong to it — the unit a fold decision is made about. */
const CLUSTER = /\P{M}\p{M}*/gu;

/**
 * Build the CONDITIONAL fold for a nativising engine. `nativeClass` is a character class matching exactly the
 * letters this language's g2p has rules for — its former token class, lifted verbatim.
 *
 * A word entirely inside the inventory is returned untouched. Otherwise each character is judged SEPARATELY and
 * only the ones the inventory rejects are folded to base.
 *
 * ⚠ PER CHARACTER, NOT PER WORD, and the difference is not cosmetic. Folding the whole word because ONE letter
 * was foreign destroyed the native accents sitting beside it: Turkish `İsveç` failed the word test on `İ`, so the
 * fold also flattened the `ç` to `c` — and Turkish reads `c` as /d͡ʒ/, so the word came out *ɯsvˈed͡ʒ*. One
 * out-of-inventory letter was corrupting every other letter in its word. Found by a corpus diff at 10% of
 * Turkish utterances changed, which is what a fix reaching far too far looks like.
 */
export function makeNativiser(nativeClass: string, flags = "u"): (w: string) => string {
    const inClass = new RegExp(`^(?:${nativeClass})+$`, flags);
    /**
     * Is every character of `s` inside the inventory? NFC first, so a precomposed and a decomposed accent are
     * judged alike, then `+` so the test is "every character", not "exactly one".
     *
     * ⚠ `+` RATHER THAN A SINGLE OCCURRENCE, because a cluster is base PLUS its marks and NOT EVERY MARK
     * COMPOSES. Tâi-lô tone 8 is base + U+030D COMBINING VERTICAL LINE ABOVE, which has no precomposed form at
     * all, so NFC leaves it as two characters; requiring exactly one class match rejected it and the fold then
     * stripped the tone it was asked to protect — `ta̍k` read *tak*, while `tâi` (precomposed) kept its tone. A
     * tone language quietly losing one tone is as bad as this layer gets. With `+`, a base letter plus a
     * combining RANGE — Tâi-lô's `[A-Za-zàáâāǎ̀-̍]`, Hawaiian's and Latin's `̀-ͯ` — matches its own marks.
     *
     * ⚠ AND NFC ONLY, NEVER ALSO NFD. Testing the decomposed form too looks like the symmetric, generous thing
     * and it makes every combining-range class ENORMOUSLY over-permissive: `ñ` decomposes to `n` + U+0303, and
     * U+0303 sits inside Tâi-lô's `̀-̍`, so `ñ` was judged NATIVE, escaped the fold, reached a g2p with no rule
     * for it and came out VERBATIM — `Cañitas` in Min Nan read *cañitas˥*, raw orthography in the phoneme
     * string. A range written for six tone marks cannot be read as a licence for every mark in its numeric span.
     */
    const known = (s: string): boolean => inClass.test(s.normalize("NFC"));
    return (w: string): string => {
        if (known(w)) return w;
        return (w.match(CLUSTER) ?? []).map((c) => (known(c) ? c : foldLatinToBase(c))).join("");
    };
}
