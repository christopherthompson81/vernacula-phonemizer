/**
 * NGUNI LOANWORD LEXICON — the words whose reading cannot be derived, only listed.
 *
 * ⚠ THE PROBLEM THIS SOLVES. `isForeignNguniWord` (zulu.ts / xhosa.ts) decides whether a token
 * carrying ⟨c⟩, ⟨q⟩ or ⟨x⟩ is a foreign name or a native word with a click, and it does so from three
 * signals — the letter, an English-dictionary hit, and Nguni phonotactics. Its own note already
 * records the cost: *"a vowel-final CV English name is shaped exactly like a Nguni word — `china` and
 * `cima` are indistinguishable orthographically"*. No orthographic rule can separate `canada` from
 * `cabanga`, because there is nothing in the spelling to separate.
 *
 * So they are LEXICALISED, which is what English does with its own loans and what these words are:
 * borrowings whose pronunciation is a fact about the word, not a consequence of its shape.
 *
 * ⚠ AND THE READINGS SPLIT TWO WAYS, WHICH IS THE REASON A RULE COULD NEVER HAVE WORKED. Measured
 * against the FLEURS audio with wav2vec2, Nguni readers do NOT treat these alike:
 *
 *   canada   ASR `b a s e k a n a d`      -> /kanada/, NATIVISED with a plain k
 *   congo    ASR `l i k o o v k o ŋ ɡ`    -> /kongo/,  nativised
 *   mexico   ASR `u m e ð u k s i k o`    -> /meksiko/, nativised (⟨x⟩ read as its Latin /ks/)
 *   china    ASR `tʃ h aɪ n n a`          -> English /tʃaɪna/
 *   chile    ASR `o d i tʃ aɪ l`          -> English
 *   carolina ASR `e r o l aɪ n a`         -> English (the ⟨aɪ⟩ is the tell)
 *
 * Long-established borrowings are nativised; newer or less integrated names keep English phonology.
 * That is an ordinary sociolinguistic fact and it is not predictable from the string, so each entry
 * carries its own verdict.
 *
 *   `declick` — read with NGUNI phonology, but the click letters as their Latin values (c/q → k,
 *               x → ks). The word stays Nguni; only the letter that caused the defect changes.
 *   `foreign` — hand the token to the English reader, the same path the 435 already-routing tokens
 *               take.
 *
 * ⚠ SCOPE, AND WHY IT IS SMALL. This list is NOT a general foreign-name dictionary. Every entry is a
 * token that (a) currently gets a WRONG CLICK in the FLEURS xh/zu corpora and (b) has high
 * cross-language spread — it appears in 9-21 of the 28 parallel corpora, which is the discriminator
 * that separates an international name from a native word (a native Nguni word appears in 1-2). The
 * surnames are here for a different reason: they are phonotactically impossible in Nguni, so signal 3
 * already clears them, and they fail only because the English dictionary does not carry proper nouns.
 *
 * ⚠ WHAT IS DELIBERATELY NOT FIXED. `isForeignNguniWord`'s signal 2 (the dictionary check) is NOT
 * relaxed. Dropping it was measured and it routes real Nguni words: `xakuvakashelwa`,
 * `xawusezantsi`, `qinsekisa`, `qhwa'`, and — worst — `compyutha`, the NATIVISED borrowing of
 * "computer", which must stay Nguni. A lexicon adds words one at a time; loosening a signal removes
 * a guard from all of them at once.
 */

/** How a listed loan is read. See the module note for why one verdict cannot serve both. */
export type LoanReading = "declick" | "foreign";

export const NGUNI_LOANS: ReadonlyMap<string, LoanReading> = new Map<string, LoanReading>([
    // ── NATIVISED: Nguni phonology, click letter read as its Latin value. Each ASR-confirmed above.
    ["canada", "declick"],
    ["congo", "declick"],
    ["mexico", "declick"],
    // COVID has no ASR reading clear enough to cite, but it is a post-2019 coinage carried into every
    // language as /kovid/ and is not in any English dictionary this repo ships; nativised is the safe
    // reading and is what the other established borrowings above take.
    ["covid", "declick"],

    // ── ENGLISH-READ place names: the recogniser shows English vowels, notably the ⟨aɪ⟩ diphthong
    // that Nguni does not have.
    ["china", "foreign"],
    ["chile", "foreign"],
    ["carolina", "foreign"],

    // ── FOREIGN SURNAMES. These already satisfy signal 3 (no Nguni onset licenses ⟨rn⟩, ⟨dw⟩, ⟨pz⟩,
    // ⟨chh⟩, ⟨dh⟩), and fail ONLY because an English pronunciation dictionary does not carry proper
    // nouns. Listing them supplies the missing signal, and cannot reach a native word because signal 3
    // still independently gates every one of them.
    ["cuerden", "foreign"],
    ["cadwalder", "foreign"],
    ["corniglia", "foreign"],
    ["choudhary", "foreign"],
    ["capuzzo", "foreign"],
    ["chhatrapati", "foreign"],
]);

/**
 * Read the click letters as their Latin values, leaving the rest of the spelling for the Nguni g2p.
 *
 * ⚠ ORDER MATTERS: ⟨x⟩ becomes the two-letter ⟨ks⟩, so it must be substituted before anything that
 * could match the ⟨s⟩ it introduces. Applied to `mexico` this yields `meksiko`, which is exactly the
 * form the recogniser heard.
 */
export function deClick(word: string): string {
    return word.replace(/x/gu, "ks").replace(/[cq]/gu, "k");
}
