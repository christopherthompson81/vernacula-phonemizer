/**
 * THE PHONE A LATIN LETTER DENOTES, for a g2p that has NO RULE FOR IT.
 *
 * ## What this is for, and where it is allowed to fire
 *
 * Every rule-scan g2p in this repo has the same shape: match the longest digraph, else match a single letter, else
 * advance one character. That last branch is a silent DELETION, and it is where a borrowed name loses a segment:
 *
 *     mi   Cañitas → anitas       (`C` and `s` are not Maori letters)
 *     sr   kayo    → kao          (Serbian Latin has no q w x y)
 *
 * ⚠ Measured across the fleet, **45 engines cannot read at least one ASCII letter** — `x` in 30 of them, `q` in 29,
 * `c` in 17; Maori is missing thirteen of twenty-six. An explicitly typed character is content, and deleting it is
 * neither nativising nor routing.
 *
 * ⚠ IT FIRES ONLY WHERE THE LANGUAGE SAYS NOTHING. This is consulted at the g2p's own fall-through branch, AFTER
 * every digraph and single-letter rule has been tried, so it can never override a language-specific reading. That
 * placement is the whole design, not an implementation detail — see below.
 *
 * ## ⚠ WHY NOT A LETTER→LETTER SUBSTITUTION BEFORE THE G2P
 *
 * The orthographic alternative — a central table rewriting `q`→`k`, `x`→`ks`, `c`→`k` before the engine runs,
 * driven by removing the unreadable letters from each engine's inventory — breaks on multigraphs, and the reason
 * generalises.
 *
 * Uzbek cannot read a bare `c`, so `c` leaves its inventory — and **Uzbek writes /t͡ʃ/ as the DIGRAPH `ch`**:
 *
 *     ikkinchi → ikkinkhi        uch → ukh        kichik → kikhik
 *
 * *A letter can be unreadable ALONE and essential as part of a SEQUENCE.* An inventory is per-character; a g2p
 * reads sequences. Rewriting the spelling before the engine runs makes every multigraph collateral damage, and no
 * amount of care in the table fixes the layer it sits in.
 *
 * Consulting a phone at the FALL-THROUGH cannot do that: the digraph loop has already consumed `ch` and the
 * fallback never sees it. It also needs no per-language override data, because it is not trying to approximate the
 * host's phonology — it is preserving the sound the letter denotes.
 *
 * ## ⚠ THE TRADE, ACCEPTED DELIBERATELY
 *
 * These phones can be OUTSIDE the host language's inventory. A Maori voice may have no /t͡ʃ/ and no /s/. That is a
 * chosen cost: the alternative on the table was folding the letter into the host's own alphabet, which keeps the
 * phone set clean and destroys the sound (`ç`→`c`→`k`). Preserving what the writer typed wins.
 *
 * ## ⚠ AMBIGUOUS ROWS, AND WHY THE AMBIGUITY IS HARMLESS HERE
 *
 * A few letters denote different sounds in different SOURCE orthographies, and nothing in the host text says where
 * a name came from — `c` is /k/ in Latin, /s/ before a front vowel in French, /t͡ʃ/ in Italian; `j` is /j/ in
 * German, /d͡ʒ/ in English, /x/ in Spanish. Those rows take the most common value and name the alternatives.
 *
 * The ambiguity costs little because of WHERE this fires: any language with an opinion about `c` has a rule for
 * `c`, and its rule wins before this table is reached. What is left is the languages with no opinion at all, and
 * for those every value in the range is better than silence.
 *
 * ## Interaction with the accent fold
 *
 * For an engine with a `makeNativiser`, an out-of-inventory ACCENT is already folded to its base before the g2p
 * runs (`ö`→`o`), so what reaches this table is mostly plain ASCII. The accented rows below matter for the
 * engines that have no nativiser, where the letter arrives intact.
 */

/**
 * Letter → the phone it denotes. Canonical IPA, as everywhere else in this repo.
 *
 * Rows are the letter's own phonetic identity, NOT an approximation toward any host language — that is what makes
 * the table language-neutral and override-free.
 */
export const LATIN_PHONE: Readonly<Record<string, string>> = {
    // ── ASCII: the letters an engine's scan actually falls through on.
    b: "b",
    c: "k", // ⚠ AMBIGUOUS: /k/ (Latin, Slavic ⟨c⟩=/ts/, Italian /t͡ʃ/ before front vowels, French /s/). /k/ is the
    //          alphabet's older value and the one a language with no ⟨c⟩ rule most likely intends in a name.
    d: "d",
    f: "f",
    g: "ɡ", // ⚠ AMBIGUOUS: /ɡ/ vs /d͡ʒ/ before a front vowel (English, Italian). The plosive is the base value.
    h: "h", // ⚠ See the note below — `h` is the one row that can contradict a CORRECT silence.
    j: "j", // ⚠ AMBIGUOUS: /j/ (German, Dutch, Slavic, and the IPA value itself) vs /d͡ʒ/ (English) vs /x/
    //          (Spanish). The IPA value is the least surprising default for a letter nobody has a rule for.
    k: "k",
    l: "l",
    m: "m",
    n: "n",
    p: "p",
    q: "k", // /q/ is uvular in Arabic transcription but a plain velar in every Latin orthography using ⟨q⟩
    r: "r",
    s: "s",
    t: "t",
    v: "v",
    w: "w",
    x: "ks", // ⚠ POSITIONAL — see `X_INITIAL`. This is the medial/final value; word-initially it is /z/.
    y: "j", // ⚠ AMBIGUOUS: consonantal /j/ (English, Latin) vs vowel /i~y/ (Scandinavian, Welsh, Slavic ⟨y⟩)
    z: "z",
    // Vowels, for completeness — a scan rarely falls through on these, but the table should not have holes.
    a: "a",
    e: "e",
    i: "i",
    o: "o",
    u: "u",
    // ── Accented letters, for the engines with no nativiser, where the letter reaches the g2p intact.
    ç: "t͡ʃ", // ⚠ AMBIGUOUS: /t͡ʃ/ (Turkish, Azerbaijani, Albanian) vs /s/ (French, Portuguese, Catalan)
    ñ: "ɲ",
    ß: "s",
    ø: "ø",
    æ: "æ",
    œ: "œ",
    å: "oː",
    ö: "ø",
    ü: "y",
    ä: "ɛ",
    þ: "θ",
    ð: "ð",
    ł: "w", // Polish ⟨ł⟩ is /w/, not /l/ — the one accented row where the obvious guess is wrong
    ŋ: "ŋ",
    ɛ: "ɛ",
    ɔ: "ɔ",
    š: "ʃ",
    ž: "ʒ",
    č: "t͡ʃ",
    ć: "t͡ɕ",
    đ: "d͡ʒ",
    ħ: "ħ",
};

/**
 * ⚠ WORD-INITIAL ⟨x⟩ IS /z/, NOT /ks/. The cluster is the letter's value between or after vowels (`Xerox` →
 * *…oks*, `taxi`), but no language that borrows ⟨x⟩ begins a word with the cluster — `Xerox`, `xylophone`,
 * `Xanthe` all start /z/. Emitting /ks/ there manufactures an initial cluster that the source language does not
 * have either, which is the worst of both: illegal in the host AND wrong about the loan.
 */
const X_INITIAL = "z";

export interface PhoneOpts {
    /** Is this the first character of the word? Selects the initial allophone (currently ⟨x⟩ only). */
    initial?: boolean;
    /**
     * Consult the table for ⟨h⟩. Off by default: `h` is written and read as NOTHING in Italian, Galician,
     * Aragonese and Asturian, and those engines fall through on it for that reason — correctly. Measuring "the g2p
     * says nothing" cannot tell deliberate silence from a missing rule, so the caller declares it.
     */
    includeH?: boolean;
}

/** The table proper, with the two positional rows applied — no fallback. */
function tablePhone(c: string, opts: PhoneOpts): string | undefined {
    if (c === "h") return opts.includeH === true ? LATIN_PHONE.h : undefined;
    if (c === "x" && opts.initial === true) return X_INITIAL;
    return LATIN_PHONE[c];
}

/**
 * The phone for `ch`, or `undefined` if this table has nothing to say — which is the correct answer for anything
 * that is not a letter.
 *
 * ⚠ NOT FOR COMBINING MARKS, and the guard is here rather than left to each caller: the scan branch this is
 * consulted from also swallows stray combining marks, and a mark is not a segment. Giving one a phone would invent
 * a sound where the orthography has a diacritic the engine has already handled or declined.
 *
 * ## ⚠ THE LAST RESORT — A MARK IS DROPPED BEFORE THE LETTER IS
 *
 * The rows above are precomposed letters that are their own PHONEME somewhere (`ñ`, `ç`, `ß`, `ł`). They can
 * never cover the open set: `é á ó à è â ô ï í ú ã õ ë ǎ ...` is thousands of code points, and an engine that
 * fell through on one deleted it —
 *
 *     ki  café → ɕaf      mos café → kaf      umb naïve → nave      kam Márquez → mkez
 *
 * so before returning `undefined` this decomposes and looks the BASE letter up. `é` → `e`, `ï` → `i`, `ǹ` → `n`.
 *
 * ⚠ IT IS A LAST RESORT AND THE ORDER IS THE WHOLE POINT. The table is consulted on the precomposed character
 * FIRST, so a letter with a phonemic identity of its own keeps it — `ñ` stays /ɲ/ and does not become /n/, `ç`
 * stays /t͡ʃ/, `ü` stays /y/. Only a character the table has never heard of is stripped to its base. Folding
 * first would silently destroy four rows this module was written to protect.
 *
 * ⚠ AND IT DOES NOT DECIDE WHAT THE LETTER MEANS IN THE HOST LANGUAGE, because it cannot: it fires only where
 * the language said nothing (see the placement note at the top of this file). The claim it makes is the weak,
 * defensible one — an `é` is at worst an `e`, and reading it as an `e` is nearer the writer's intent than
 * deleting a vowel and welding two syllables into one. A language for which `é` is its OWN letter (Akan,
 * Yoruba, Vietnamese) has a rule for it and never arrives here.
 *
 * ⚠ NOT A NATIVISER, EITHER. `hostWord.foldLatinToBase` rewrites the SPELLING before the g2p runs and is
 * conditional on the engine's inventory; this returns a PHONE at the fall-through and has no opinion on
 * spelling. An engine that has a nativiser rarely reaches this at all.
 */
export function latinPhone(ch: string, opts: PhoneOpts = {}): string | undefined {
    if (/\p{M}/u.test(ch)) return undefined;
    const c = ch.toLowerCase();
    const direct = tablePhone(c, opts);
    if (direct !== undefined) return direct;
    // Last resort: the letter under the marks. NFD of a precomposed letter is exactly one base + its marks, so
    // this is a single character; anything with no decomposition (`ə`, `ɨ`, a digit, punctuation) is unchanged
    // by the strip and returns `undefined` as before.
    const base = c.normalize("NFD").replace(/\p{M}+/gu, "");
    if (base === c || base.length !== 1) return undefined;
    return tablePhone(base, opts);
}
