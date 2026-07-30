/**
 * Shared INITIALISM handling (#562) — decide what to do with an all-caps letter run before the tokenizer.
 *
 * THE ARCHITECTURE, which is the whole point of this file being this small: a known acronym's reading is a
 * LEXICAL fact, and an unpronounceable one is an OOV case. Those are the only two things here.
 *
 *   · LEXICAL. Whether `NASA` is a word and `NHS` is letters is not derivable from spelling — it is
 *     recorded knowledge, so it belongs in the language's DATA, not in logic. The pronunciation dictionary
 *     already carries most of it (CMUdict has bbc/gdp/fbi/cia/uk/dna/gps/mri with LETTER readings and
 *     scuba/radar/nasa/nato as WORDS), and this pass simply leaves such tokens alone for the normal
 *     lexicon lookup to resolve — the engines lowercase before lookup anyway. What the dictionary cannot
 *     express is the case-keyed pair: `US` the country versus `us` the pronoun. Those are listed per
 *     language in its manifest as `acronymLetters`, alongside the language's other hand-authored facts.
 *
 *   · OOV. When the acronym is recorded nowhere, the one thing that CAN be derived from spelling is
 *     whether the letters could be read as a word at all. If they cannot, spelling out is the only
 *     sensible reading; if they can, the existing OOV g2p already produces that word, so this pass gets
 *     out of the way. This is the failure it exists for, and it was severe: English `NHS` → [ns] with the
 *     H gone, `MP` → [mp], `NYC` → [niːk], `WTO` → [uːt], `DSLR` → [ʌdslɚ]; French `SNCF` → [snkf] and
 *     `TGV`/`PDG` DROPPED from the output entirely. Every one of those has no vowel or an illegal cluster.
 *
 * An earlier version of this file also carried a word-acronym list and a length-based "lexicalization
 * threshold" (4+ letters and pronounceable ⇒ read as a word). Both were removed: they were logic trying to
 * re-derive lexical facts, and the threshold duplicated what the OOV g2p already does — measured against
 * the wikipron referee, the g2p was ALREADY right on the pronounceable acronyms it records as words
 * (BAMF, SNES, CUPE, TESDA, CAGR, USAR, VUSA), so the correct move is to leave them to it.
 *
 * The cost of that simplification is honest and small: an acronym that IS spelled out in speech but is
 * pronounceable and unrecorded (ROV, NYC, SUV) now needs a data entry, where the threshold would have
 * guessed at it — and guessed wrong about as often (it read USAF as a word). On the wikipron referee the
 * threshold scored 1650/4558 folded against 1648 here, i.e. two words, for a rule that could not be
 * justified. Both are above the 1644 the engine started at.
 */

export interface InitialismData {
    /** Letter → the orthographic form to emit for its NAME. English can emit most letters unchanged,
     *  because CMUdict carries all 26 single letters with their letter-name pronunciations. */
    letterName: (letter: string) => string | undefined;
    /**
     * LEXICAL: acronyms read letter-by-letter although their lowercase form is an ordinary word, so the
     * dictionary cannot express the distinction — `US`/`UN`/`IT`/`LED`/`WHO` in English, `USA`/`ONG`/`PIB`
     * in French. Authored in the language's manifest, not here.
     */
    acronymLetters: ReadonlySet<string>;
    /**
     * Is this lowercase form RECORDED in the pronunciation dictionary? The OOV rule below applies only to
     * tokens that are genuinely out of vocabulary — `CD` has no vowel and so looks unreadable, but CMUdict
     * carries it as [siːdˈiː], one token with one stress, which is both correct and better prosody than
     * spelling it out. A recorded pronunciation is not the OOV tier's business.
     */
    isRecorded: (lower: string) => boolean;
    /** OOV strategy: can this letter sequence be read as a word at all? */
    isUnreadable: (lower: string) => boolean;
}

/**
 * Build the text→text initialism pass.
 *
 * ORDERING CONSTRAINT FOR THE CALLER, and it bites: Roman numerals are all-caps letter runs too, so this
 * pass MUST run after the language's Roman-numeral rules. Run earlier, it spells `Louis XIV` as
 * EX-EYE-VEE. `II` occurs 8 times in the English cased column, so the collision is real, not a
 * hypothetical. Likewise it must run after abbreviation expansion, or French `MM.` becomes EM-EM.
 */
export function makeInitialismNormalizer(d: InitialismData): (text: string) => string {
    return (text: string): string => {
        // Gated on the text containing lowercase: in an all-caps DOCUMENT the capitals carry no signal
        // and spelling out every word would be absurd. A lone all-caps token is exempt — there is no
        // shouting document to misread, and it is the "user typed an acronym" case.
        if (!/\p{Ll}/u.test(text) && /\s/u.test(text.trim())) return text;
        // Two shapes. A free-standing all-caps run of 2+ letters is the ordinary initialism. A run
        // ATTACHED TO DIGITS is an alphanumeric code (CG4684, A380, B747, X5) and needs claiming
        // separately, because there is no word boundary between the letters and the digits for `\b` to
        // find — so those letters reached the g2p raw and came out as an unpronounceable cluster ([kɡ])
        // or, in French, with a letter silently DROPPED. A single letter counts in the attached case only:
        // `A380` must be the letter name, and English read the bare `A` as the reduced article [ə].
        return text.replace(/\b\p{Lu}{2,}\b|\p{Lu}+(?=\d)/gu, (tok) => {
            const lower = tok.toLowerCase();
            const spelled = spellOut(lower, d.letterName);
            if (tok.length < 2) return spelled ?? tok; // attached code: a letter, never a word
            if (d.acronymLetters.has(lower)) return spelled ?? tok; // lexical: a listed exception
            if (d.isRecorded(lower)) return tok; // lexical: the dictionary owns it
            if (d.isUnreadable(lower)) return spelled ?? tok; // OOV: nothing else could be said
            return tok; // OOV but pronounceable — the OOV g2p reads it as a word
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
