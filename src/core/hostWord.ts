/**
 * Tokenizer word-matching derived from Unicode script properties rather than a hand-listed alphabet.
 *
 * A word arm answers two questions with different scopes, and this module keeps them apart:
 *
 *   1. `hostWordRun` — is this run in a script the engine writes? A ROUTING question, a property of the script.
 *   2. `makeNativiser` — does the g2p have rules for these letters? An INVENTORY question, per-language.
 *
 * Answering (1) with a letter list (`/[a-zäöüßA-ZÄÖÜ]+/`) cuts any word containing an omitted letter: the orphan
 * reaches the shared router, which reads it as an English letter name (`Cañitas` → `kaː ˈɛn ˈiːtaːs`). Nothing
 * vanishes and no raw mark survives, so neither the leak classes nor the differential DROP test catches it.
 *
 * Routing only fires ACROSS scripts, so it cannot help a Latin word inside a Latin language — there the g2p simply
 * has no rule for `ã` and drops it (`Klöcker` → *klkkeɾ*). That is what (2) folds.
 *
 * Which does an engine need? Phonemize an English loan (`computer`): output matching English means it ROUTES and
 * `hostWordRun` suffices; its own output means it NATIVISES and also needs `makeNativiser`. Engines vary too much
 * structurally to identify by source pattern — `test/latin-tokenizers.test.ts` is the measurement.
 */
import type { ScriptName } from "./scripts.ts";

/**
 * Word arm for an engine writing in `scripts`, as a STRING (engines assemble `TOKEN` by template from word,
 * number and punctuation arms).
 *
 * `extra` is lead-legal; `medialOnly` may only join two letters. The distinction is phonemic: Hausa `'yan` opens
 * on an apostrophe for glottalised /ʲ/, and requiring a letter first drops it (`ʔʲan` → *jan*). Both are spliced
 * into character classes, so put a literal `-` LAST.
 */
export function hostWordRun(scripts: readonly ScriptName[], extra = "", medialOnly = ""): string {
    const letters = scripts.map((s) => `\\p{Script=${s}}`).join("");
    // `\p{Script=X}` includes X's DIGITS (N'Ko ߀–߉, Adlam 𞥐–𞥙), and the word arm runs before the number arm, so
    // without this the word arm would swallow every native-digit numeral. `--\p{Nd}` needs the `v` flag, which
    // these tokenizers do not use.
    const nd = "(?!\\p{Nd})";
    const run = `${nd}[${letters}${extra}](?:${nd}[${letters}\\p{M}${extra}${medialOnly}])*`;
    // Compile now so a malformed class fails here, named, rather than at first use: a misplaced `-` becomes a
    // RANGE (`"-·"` → `[\p{M}-·]`, a SyntaxError). Validate but never rewrite — relocating hyphens would collapse
    // the legitimate ranges Serbian and Bosnian pass (`"а-шђјљњћџ"`), silently dropping twenty-two letters.
    try {
        new RegExp(run, "u");
    } catch (e) {
        throw new Error(
            `hostWordRun: extra=${JSON.stringify(extra)} medialOnly=${JSON.stringify(medialOnly)} does not form a ` +
                `valid character class (put a literal "-" LAST; a range like "а-ш" is fine as written): ${String(e)}`,
        );
    }
    return run;
}

/** The Latin word arm — the overwhelmingly common case, spelled once so call sites do not repeat the array. */
export const LATIN_RUN = hostWordRun(["Latin"]);

/**
 * Letters NFD cannot reach, mapped to the nearest base every Latin g2p has a rule for. `ö` decomposes and folds
 * itself; these have no decomposition, so without the map they are dropped outright (`Æthelred` → *thˈɛlʁət*).
 *
 * Single letters, not the conventional digraphs (`æ`→ae, `þ`→th): a g2p reading `ae` as two vowels turns one sound
 * into two, worse than an imprecise vowel. `ß`→`ss` is the exception — that is the German orthographic identity.
 * A language for which one of these is NATIVE never reaches here; the fold is conditional, so Akan keeps `ɛ`.
 */
// prettier-ignore
const UNDECOMPOSABLE: Readonly<Record<string, string>> = {
    æ: "a", Æ: "A", œ: "o", Œ: "O", ø: "o", Ø: "O", ð: "d", Ð: "D", þ: "t", Þ: "T",
    ß: "ss", ł: "l", Ł: "L", đ: "d", Đ: "D", ħ: "h", Ħ: "H", ŋ: "n", Ŋ: "N",
    ɛ: "e", Ɛ: "E", ɔ: "o", Ɔ: "O", ə: "e", Ə: "E", ɓ: "b", Ɓ: "B", ɗ: "d", Ɗ: "D",
    ƙ: "k", Ƙ: "K", ƴ: "y", Ƴ: "Y", ı: "i", ʉ: "u", ɨ: "i", ƀ: "b", ŧ: "t", ſ: "s",
    ƒ: "f", Ƒ: "F", // f with hook — /f/ in the African orthographies that use it (and the florin sign)
    // ⚠ SCRIPT G (U+0261 / U+A7AC) IS A TYPOGRAPHIC VARIANT OF ⟨g⟩, NOT A LETTER OF ANYONE'S ORTHOGRAPHY, and
    // without this row it survived the fold unchanged, reached a g2p with no rule for it and was DROPPED —
    // a whole consonant deleted: `ɡato` read *ˈato* in es, `ɡut` *uːt* in de, `luɡanda` *luaːⁿda* in lg.
    // The input is not exotic: U+0261 is the IPA voiced velar stop, and Wikipedia-derived corpus text is full
    // of inline pronunciation glosses — 11 mined/attest artifacts carry it and `csharp/goldens/hil.tsv` ships
    // a row whose INPUT contains one. Verified before adding: U+0261 is never an orthographic input key in any
    // language declaring a NATIVE_CLASS, so folding it cannot take a reading away from a g2p that had one.
    ɡ: "g", Ɡ: "G",
};
const UNDECOMPOSABLE_RE = new RegExp(`[${Object.keys(UNDECOMPOSABLE).join("")}]`, "gu");

/** Drop combining marks so precomposed and decomposed accents behave alike, then map what NFD cannot reach. */
export const foldLatinToBase = (w: string): string =>
    w
        .normalize("NFD")
        .replace(/\p{M}+/gu, "")
        .normalize("NFC")
        .replace(UNDECOMPOSABLE_RE, (c) => UNDECOMPOSABLE[c] ?? c);

/** One base character with any combining marks that belong to it — the unit a fold decision is made about. */
const CLUSTER = /\P{M}\p{M}*/gu;

/**
 * Conditional fold for a nativising engine. `nativeClass` matches exactly the letters this g2p has rules for.
 *
 * Judged PER CLUSTER, never per word: Turkish `İsveç` fails a word-level test on `İ`, and folding the whole word
 * would also flatten `ç`→`c`, which Turkish reads /d͡ʒ/ (*ɯsvˈed͡ʒ*).
 */
export function makeNativiser(nativeClass: string, flags = "u"): (w: string) => string {
    const inClass = new RegExp(`^(?:${nativeClass})+$`, flags);
    /**
     * NFC then `+`, so the test is "every character is in the inventory".
     *
     * `+` rather than one occurrence: a cluster is base plus marks, and not every mark composes — Tâi-lô tone 8
     * (base + U+030D) has no precomposed form, so requiring a single match strips the tone it should protect
     * (`ta̍k` → *tak*). NFC only, never also NFD: `ñ` decomposes to `n` + U+0303, which falls inside Tâi-lô's
     * `̀-̍`, so testing the decomposed form would judge `ñ` native and emit it raw (`Cañitas` → *cañitas˥*).
     */
    const known = (s: string): boolean => inClass.test(s.normalize("NFC"));
    return (w: string): string => {
        if (known(w)) return w;
        return (w.match(CLUSTER) ?? []).map((c) => (known(c) ? c : foldLatinToBase(c))).join("");
    };
}
