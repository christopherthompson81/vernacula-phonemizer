/**
 * Shared INITIALISM normalization (#562) — rewrite an all-caps letter run into either its letter names
 * ("NHS" → "en aitch ess") or the word it has lexicalized into ("NASA" → "nasa"), BEFORE the tokenizer.
 * Language-independent machinery; the per-language part is pure data.
 *
 * WHY THIS EXISTS. Both engines were relying on their pronunciation dictionary to happen to contain each
 * acronym, which works until it doesn't, and the failure is silent and severe:
 *   English  NHS → [ns]        (the H vanished)        MP  → [mp]  (unpronounceable)
 *            NYC → [niːk]      (garbage)               WTO → [uːt] (letters dropped)
 *            US  → [ʌs]        (read as the word "us" — CMUdict has it as the pronoun)
 *   French   SNCF → [snkf]     (unpronounceable)       TGV, PDG → DROPPED from the output entirely
 * CMUdict happens to carry bbc/gdp/fbi/uk/dna/gps/mri, so those looked fine; the acronym space is open
 * ended, so dictionary coverage is not a strategy.
 *
 * THE DECISION ORDER, and why it is this way. Measured over the cased column of the FLEURS transcripts —
 * 228 all-caps tokens in English, 191 in French — spelling out is what the large majority want: of the
 * French tokens, 17 distinct are spelled out (AOL, UTC, IRM, ADN, PBS, FBI, DVD, RSPCA, NBA, GPS, PIB,
 * OHA, CIO, …) against 5 said as words (ONU, ACTA, COVID, UNESCO, OPEP). So SPELLING OUT IS THE DEFAULT
 * and the word reading is the marked case. An earlier version of this used phonotactic readability as the
 * default instead ("readable ⇒ say it as a word"), which measured worse: it gets ACTA and COVID right but
 * AOL, CIO, OHA and NYC wrong, and those are the more numerous class.
 *
 * Readability is still used, but narrowly, for the job it is actually good at: as a FAIL-SAFE GUARD on
 * the HAND-WRITTEN word-acronym list, so a mistaken entry there degrades to spelling out rather than to
 * unpronounceable output. It earned its place immediately — it catches `SNCB`, wrongly listed as a word
 * acronym during development, which has no vowel at all. It is deliberately NOT applied to dictionary
 * hits: the dictionary holds a real pronunciation, so pronounceability is not in question there, and
 * guarding it broke `CD` (no vowel, but CMUdict has [siːdˈiː]).
 */

export interface InitialismData {
    /** Letter → the orthographic form to emit for its NAME. English can emit most letters unchanged,
     *  because CMUdict carries all 26 single letters with their letter-name pronunciations. */
    letterName: (letter: string) => string | undefined;
    /**
     * Spell out despite the token being a dictionary word: convention beating phonotactics. This is
     * where `US`/`UK`/`UN`/`LED`/`WHO` live in English and `USA`/`ONG`/`PIB`/`RER` in French — every one
     * of them is a perfectly good word in the dictionary, and every one is spelled out in speech.
     */
    forceLetters: ReadonlySet<string>;
    /** Read as a word even though the dictionary does not carry it (NASA, UNESCO, ONU, COVID). */
    wordAcronyms: ReadonlySet<string>;
    /** Is this lowercase form an attested word of the language? (the pronunciation dictionary) */
    isWord: (lower: string) => boolean;
    /** Can this letter sequence be read as a word at all? See the fail-safe note above. */
    isUnreadable: (lower: string) => boolean;
}

/**
 * Build the text→text initialism pass.
 *
 * ORDERING CONSTRAINT FOR THE CALLER, and it bites: Roman numerals are all-caps letter runs too, so this
 * pass MUST run after the language's Roman-numeral rules. Run earlier, it spells `Louis XIV` as
 * EX-EYE-VEE. `II` occurs 8 times in the English cased column, so this is a real collision, not a
 * hypothetical. Likewise it must run after abbreviation expansion, or French `MM.` becomes EM-EM.
 */
export function makeInitialismNormalizer(d: InitialismData): (text: string) => string {
    return (text: string): string => {
        // Gated on the text containing lowercase: in an all-caps DOCUMENT the capitals carry no signal
        // and spelling out every word would be absurd. A lone all-caps token is exempt — there is no
        // shouting document to misread, and it is the "user typed an acronym" case. It stays safe because
        // the dictionary branch still reads a real word as a word (HELLO → hello, not aitch-ee-ell-…).
        if (!/\p{Ll}/u.test(text) && /\s/u.test(text.trim())) return text;
        return text.replace(/\b\p{Lu}{2,}\b/gu, (tok) => {
            const lower = tok.toLowerCase();
            const spelled = spellOut(lower, d.letterName);
            if (d.forceLetters.has(lower)) return spelled ?? tok;
            // A DICTIONARY hit is trusted outright: the dictionary holds an actual pronunciation, so
            // pronounceability is not in question. Applying the readability guard here was wrong — `CD`
            // has no vowel and so reads as "unreadable", yet CMUdict carries it as [siːdˈiː], one token
            // with one stress, which is better prosody than spelling it out as [sˈiː dˈiː].
            if (d.isWord(lower)) return lower;
            // The hand-written list, by contrast, IS guarded: a mistaken entry degrades to spelling out
            // rather than to unpronounceable output. This caught `SNCB`, wrongly listed during
            // development, which has no vowel at all.
            if (d.wordAcronyms.has(lower) && !d.isUnreadable(lower)) return lower;
            return spelled ?? tok;
        });
    };
}

/** Letter-by-letter reading, or undefined if any character has no letter name — so the caller leaves the
 *  token alone rather than emitting a partial reading with characters silently missing. */
function spellOut(lower: string, letterName: (l: string) => string | undefined): string | undefined {
    const names = [...lower].map(letterName);
    return names.every((n) => n !== undefined) ? names.join(" ") : undefined;
}

export interface PhonotacticsData {
    /** Vowel LETTERS of the orthography (not phonemes) — the coarse syllabifiability test. */
    vowels: RegExp;
    /** Two-consonant clusters the language can begin a word with. */
    legalOnsets: ReadonlySet<string>;
    /** Two-consonant clusters the language can end a word with. */
    legalCodas: ReadonlySet<string>;
}

/**
 * Build a "can this letter string be read as a word at all" test for one language.
 *
 * Deliberately conservative — it reports unreadable only on high-confidence violations, so a plausible
 * string stays readable. Signals, in order of confidence:
 *   1. NO VOWEL LETTER at all: nothing can be syllabified (SNCF, TGV, PDG, NHS, MP, GDP, DVD).
 *   2. A consonant run of 3+ with no liquid to break it up.
 *   3. An illegal word-INITIAL cluster (French TVA has no /tv/ onset; English WTO no /wt/).
 *   4. An illegal word-FINAL cluster (French RATP /tp/, EDF /df/; English UTC /tc/).
 *
 * KNOWN LIMIT: readability is not convention. `ONG`, `PIB`, `RER`, `US`, `UK` are all readable yet
 * spelled out in speech, which is exactly why `forceLetters` exists — no phonotactic test can derive a
 * lexical convention.
 */
export function makeUnreadableTest(d: PhonotacticsData): (word: string) => boolean {
    const consonantRun = new RegExp(`[^${d.vowels.source.replace(/^\[|\]$/g, "")}]{3,}`, "u");
    const isConsonant = (ch: string): boolean => /\p{L}/u.test(ch) && !d.vowels.test(ch);
    return (word: string): boolean => {
        const w = word.toLowerCase();
        if (!d.vowels.test(w)) return true;
        const run = consonantRun.exec(w);
        if (run !== null && !/[lr]/u.test(run[0])) return true;
        if (w.length >= 2 && isConsonant(w[0]!) && isConsonant(w[1]!) && !d.legalOnsets.has(w.slice(0, 2)))
            return true;
        const tail = w.slice(-2);
        if (tail.length === 2 && isConsonant(tail[0]!) && isConsonant(tail[1]!) && !d.legalCodas.has(tail))
            return true;
        return false;
    };
}
