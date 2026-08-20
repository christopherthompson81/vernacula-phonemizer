/**
 * Serbian (sr, српски) phonemizer — South Slavic, DUAL SCRIPT (Cyrillic + Gaj's Latin), fully phonemic.
 * A digraph-aware left-to-right scan (g2p reads serbian.jsonc): the Latin digraphs ⟨dž lj nj dj⟩
 * first, then the single Cyrillic OR Latin letters — every grapheme is one phoneme, no vowel reduction. Serbian's
 * lexical PITCH ACCENT is unwritten in ordinary text, so it comes from stress.tsv (101965 entries, both
 * scripts, from kaikki/Wiktionary): POSITION as ˈ before the nucleus, and the FOUR-WAY CONTOUR as a Chao tone
 * letter after it (˩˥ rising, ˥˩ falling) with ː for the accented syllable's length. Post-accentual length
 * stays folded. Out of lexicon, accent-transitions.tsv shifts a KNOWN stem's accent by its ending rather than
 * defaulting — see deriveAccent. Croatian and Bosnian import phonemizeWord from here, so all three share the lexicon — which is
 * the shape of the source too: Wiktionary ships one unified Serbo-Croatian dump.
 * docs/investigations/south_slavic_stress_investigation.md. text() tokenizes words / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeSerbian } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

const DIGRAPHS = MANIFEST.digraphs;
const LETTERS = MANIFEST.letters;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/**
 * Lexical stress: word → 0-based ordinal of the stressed NUCLEUS. Same shape and same source family as Russian's
 * stress.tsv (kaikki/Wiktionary), and it feeds the g2p that Serbian, Croatian AND Bosnian all share — hr/bs
 * import phonemizeWord from this file, so one lexicon lights up three engines, which is exactly the shape of the
 * source: Wiktionary does not split sr/hr/bs and ships them as one unified "Serbo-Croatian" dump.
 * Built by tools/serbian/build_sh_stress_lexicon.py from the ACCENTED ORTHOGRAPHY (rijéka) rather than the IPA
 * (/rjěːka/) — the two do not have the same nucleus count under the Ijekavian ⟨ije⟩ reflex, and this g2p, being
 * one-grapheme-one-phoneme, follows the spelling. The ordinal is therefore script-independent: the Latin↔Cyrillic
 * mapping is a bijection whose digraphs ⟨lj nj dž⟩ are all consonants.
 */
interface Accent { at: number; tone: "SR" | "LR" | "SF" | "LF" | "--" }
let STRESS: Map<string, Accent> | undefined;
function stressDict(): Map<string, Accent> {
    if (STRESS === undefined)
        STRESS = loadTsvMap(import.meta.url, "stress.tsv", (v) => {
            const [n, t] = v.split("\t");
            const at = Number(n);
            // ⚠ "--" IS A REAL VALUE, not a parse failure: the position is known but the spelling has two
            // recorded contours (grâd "city" vs grȁd "hail"), so the lexicon withholds the tone on purpose.
            return Number.isInteger(at) && (t === "SR" || t === "LR" || t === "SF" || t === "LF" || t === "--")
                ? { at, tone: t }
                : undefined;
        }, { optional: true });
    return STRESS;
}

/**
 * OOV TIER — the accent TRANSITION table (accent-transitions.tsv, built by
 * tools/serbian/build_sh_accent_transitions.py). Key `<ending>|<stem tone>`, value shift + resulting tone +
 * the tone's agreement + its support.
 *
 * ⚠ IT TRANSFORMS A KNOWN ACCENT; IT DOES NOT PREDICT ONE FROM NOTHING. The lexicon misses are overwhelmingly
 * inflected forms of lemmas it HAS (godine, može, bila, rekao), and across the 56899 lemmas carrying two or
 * more accented forms the accent sits on the same nucleus in 88.0%. Where it moves, the ENDING is what moves
 * it — the genitive -a shifts one nucleus right and lengthens (abažur 1 SR → abažura 2 LR) — so what is
 * learned is the shift, applied to a stem that is itself a lexicon entry.
 *
 * Held-out 80/20 over the 36248 stem/form pairs the lexicon already contains: POSITION 83.7%, against 66.8%
 * for the first-nucleus fallback it replaces. It reaches roughly a further 24pp of polysyllabic corpus tokens
 * (sr 43.7 → 68.0%).
 */
let TRANS: Map<string, { shift: number; tone: Accent["tone"]; agree: number; support: number }> | undefined;
function transitions() {
    if (TRANS === undefined)
        TRANS = loadTsvMap(import.meta.url, "accent-transitions.tsv", (v) => {
            const [d, t, ag, sup] = v.split("\t");
            const shift = Number(d);
            return Number.isInteger(shift) && t !== undefined
                ? { shift, tone: t as Accent["tone"], agree: Number(ag), support: Number(sup) }
                : undefined;
        }, { optional: true });
    return TRANS;
}

/**
 * ⚠ THE TONE GATE, AND WHY IT IS TIGHT. Position is always worth taking — its alternative is a fallback
 * measured at 66.8% — but tone has no such floor, so a low-confidence contour is withheld exactly as a
 * homograph's is.
 *
 * ⚠ AND THE THRESHOLD WAS SET FROM THE FREQUENCY-WEIGHTED SWEEP, NOT THE TYPE-LEVEL ONE, because the two
 * disagree sharply. By type, tone at θ≥0.7 looked 82.6% correct; weighted by how often the words actually
 * occur it is 73.6%, since the frequent words are short and the tier's type-level win sits on the rare long
 * tail. A support floor then matters more than the threshold — θ≥1.00 alone COLLAPSES to 62.8%, which is
 * single-observation contexts, not signal:
 *
 *     support≥1  θ≥0.80   answers 18.5% of the OOV mass, right 86.4%
 *     support≥5  θ≥0.80   answers 15.9%,                 right 93.9%
 *     support≥5  θ≥0.90   answers 11.0%,                 right 98.3%   ← here
 *
 * At 98.3% the derived contour is lexicon-grade (the lexicon tier measures 99.7%), so it extends the tone
 * without diluting it: blended precision 99.6%, tone coverage 43.7 → 46.4% of polysyllabic tokens. Taking the
 * looser gate would have bought 5pp more coverage at 94%, which is the wrong direction for a stream whose
 * whole design rule has been to abstain rather than assert a coin flip.
 */
const TONE_AGREEMENT = 90;
const MIN_SUPPORT = 5;
const MAX_CUT = 3; // ending length; measured against reach in the builder's header

/** Derive an OOV word's accent from the longest stem that IS in the lexicon, plus the ending's transition. */
function deriveAccent(w: string): Accent | undefined {
    const lex = stressDict();
    for (let c = 1; c <= MAX_CUT; c++) {
        if (w.length - c < 3) break;
        const stem = lex.get(w.slice(0, -c));
        if (stem === undefined) continue;
        const tr = transitions().get(`${w.slice(w.length - c)}|${stem.tone}`);
        // Give up rather than trying a longer ending, which keeps inference identical to how the builder
        // selects a stem (shortest cut wins). Measured: carrying on instead answers 6 more words out of 7250
        // and moves accuracy not at all, so the simpler invariant wins.
        if (tr === undefined) return undefined;
        // ⚠ ABSTENTION PROPAGATES. If the stem's own contour was withheld, a contour derived from it would be
        // laundering an unknown into a known, whatever the ending's statistics say.
        const tone =
            stem.tone === "--" || tr.agree < TONE_AGREEMENT || tr.support < MIN_SUPPORT ? "--" : tr.tone;
        return { at: Math.max(0, stem.at + tr.shift), tone };
    }
    return undefined;
}

/** Whether the lexicon knows this word's accent. ⚠ NEEDED BECAUSE ABSENCE IS AMBIGUOUS IN OUTPUT: an OOV word
 *  is emitted with a fallback ˈ and NO tone, which looks the same as any other untoned word. Serbo-Croatian has
 *  no toneless words, so the missing tone means "not in the lexicon", never "no accent" — and an eval has to be
 *  able to tell those apart. Same reason japanese/pitch.ts exports pitchLexiconHas. */
export function accentLexiconHas(word: string): boolean {
    return stressDict().has(word.toLowerCase());
}

// The four-way accent, in the fleet's tone notation: a Chao tone letter immediately after the nucleus, exactly
// where Vietnamese and Thai put theirs (kʰˈaː˥˩w, mˈaː˧˥). ⚠ NOT the combining caron/circumflex the sources use
// (ǎ, â) — that is the Serbo-Croatian philological convention, and every OTHER tone language in this fleet
// writes Chao letters. One notation for tone across 190 languages beats one notation per tradition.
const TONE: Record<Accent["tone"], string> = { SR: "˩˥", LR: "˩˥", SF: "˥˩", LF: "˥˩", "--": "" };
const LONG = new Set(["LR", "LF"]); // "--" is not here: withholding the contour withholds its length too

/**
 * PROCLITICS AND ENCLITICS — the closed class that carries no accent of its own in a running phrase, though the
 * dictionary gives each a citation form. They were harmless while only ˈ was emitted (all monosyllabic, and a
 * monosyllable takes no ˈ); a tone letter would assert an accent the utterance does not have. Standard list:
 * the verbal and pronominal enclitics, the question particle, negation, and the monosyllabic prepositions and
 * conjunctions. ⚠ Only the forms that are ALWAYS clitic — `mi`/`ti`/`nas`/`vas` are omitted deliberately,
 * since each is also a full stressed pronoun and the spelling does not say which.
 */
const CLITIC = new Set([
    "sam", "si", "je", "smo", "ste", "su", "ću", "ćeš", "će", "ćemo", "ćete", "bih", "bi", "bismo", "biste",
    // ⟨te⟩ is both the enclitic pronoun and the conjunction; it is listed once.
    "me", "te", "ga", "mu", "joj", "ih", "im", "se", "li", "ne",
    "i", "a", "ni", "da", "u", "na", "o", "po", "za", "od", "do", "iz", "s", "sa", "k", "ka", "uz", "niz",
    // the same list in Cyrillic — a word is one script, and the corpus for sr is written in the other one
    "сам", "си", "је", "смо", "сте", "су", "ћу", "ћеш", "ће", "ћемо", "ћете", "бих", "би", "бисмо", "бисте",
    "ме", "те", "га", "му", "јој", "их", "им", "се", "ли", "не",
    "и", "а", "ни", "да", "у", "на", "о", "по", "за", "од", "до", "из", "с", "са", "к", "ка", "уз", "низ",
]);

// The letters that head a syllable, derived from the manifest rather than restated — a vowel letter is one whose
// IPA value is a vowel, in either script, so this cannot drift from the table above.
const VOWEL_LETTER = new Set(
    Object.keys(LETTERS).filter((c) => "aeiou".includes(LETTERS[c]!)),
);
// ⟨r⟩ is a nucleus when it has no vowel beside it — the syllabic r of kȓv, pȑst, sȑce, dr̀žava.
const RHOTIC_LETTER = new Set(["r", "р"]);
function isNucleus(w: string, i: number): boolean {
    const c = w[i]!;
    if (VOWEL_LETTER.has(c)) return true;
    if (!RHOTIC_LETTER.has(c)) return false;
    return !VOWEL_LETTER.has(w[i - 1] ?? "") && !VOWEL_LETTER.has(w[i + 1] ?? "");
}

/**
 * Phonemize a single Serbian word (either script) to canonical IPA, with PRIMARY STRESS. Digraphs are
 * longest-match; every other grapheme is a one-letter lookup.
 *
 * Stress is LEXICAL in this language and unwritten in ordinary text, so it comes from stress.tsv and cannot be
 * derived. The mark goes before the NUCLEUS (the repo convention: nˈaða, not ˈnaða), which here is free — the
 * lexicon stores a nucleus ordinal, so the splice point is the nucleus by construction.
 *
 * ⚠ A MONOSYLLABLE CARRIES NO MARK, following Russian — the other lexicon-driven Slavic engine in the fleet,
 * whose stress.tsv this file's format copies. The mark would carry no information there, and it buys something
 * real besides: Serbo-Croatian's proclitics (je, se, li, ga, mu, su, sam, bi…) are prosodically unstressed but
 * the dictionary gives them citation accents, and they are almost all monosyllabic — so skipping monosyllables
 * declines to assert a stress the running utterance does not have.
 *
 * ⚠ OOV FALLS BACK TO THE FIRST NUCLEUS, and for a disyllable that is a RULE rather than a guess: the standard
 * language does not accent the final syllable of a polysyllabic word, so a disyllable must be initial-stressed.
 * The lexicon agrees on 98.9% of its own 2-nucleus entries. Beyond two syllables it degrades to a default —
 * 78.1% of 3-nucleus entries, 42.4% of 4-nucleus. Frequency-weighted over the FLEURS corpora the fallback lands
 * right on ~83–86% of tokens, because the long words are the rare ones.
 * docs/investigations/south_slavic_stress_investigation.md.
 */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    // ⚠ AN INITIALISM IS A LETTER RUN, NOT A WORD, AND MUST NOT BE DEGEMINATED. The rule below collapses a
    // doubled consonant, which is right for a loan and destroys an acronym: СССР → *sr*, MMF → *mf*,
    // BBC → *bt͡s*, www → *ʋ*.
    // The signature is NO VOWEL LETTER at all — sssr, mmf, www, bbc, cctld. A native vowelless word (krv,
    // prst, crn) takes its nucleus from a syllabic ⟨r⟩ and never doubles a consonant, so this cannot fire
    // on real BCS: the words carrying a geminate are all loans, and loans have vowels.
    // ⚠ NOT "ALL CAPS", which was tried and is wrong: it makes degemination CASE-DEPENDENT for ordinary
    // words — `Holland` → xˈoland but `HOLLAND` → xˈolland, and likewise every all-caps proper noun or
    // headline. A vowel-bearing initialism (ADD) is therefore read as the pseudo-word this engine already
    // treats it as; that is the pre-existing gap of having no initialism speller, not this rule's to fix.
    // ⚠ THE VOWEL TEST COMES FROM VOWEL_LETTER, not a literal — that set is derived from the manifest
    //   precisely so it "cannot drift from the table above", and a hardcoded copy would silently un-guard
    //   initialisms the day a vowel letter is added to serbian.jsonc.
    const isLetterRun = word.length >= 2 && ![...word].some((ch) => VOWEL_LETTER.has(ch.toLowerCase()));
    let out = "";
    let prevLetter = ""; // the last single letter this scan emitted; a digraph resets it (see the skip below)
    const nuclei: { start: number; end: number }[] = []; // output span of each nucleus, in order
    for (let i = 0; i < w.length; ) {
        const two = w.slice(i, i + 2);
        if (DIGRAPHS[two]) {
            out += DIGRAPHS[two]; // ⟨lj nj dž⟩ are consonants — never a nucleus
            prevLetter = "";
            i += 2;
            continue;
        }
        const c = w[i]!;
        // ⚠ DEGEMINATE, AND DO IT HERE RATHER THAN AFTER THE SCAN. BCS has no phonemic geminates: a doubled
        // consonant letter reaches this engine only in a loan or a foreign name (Costello, Guinness,
        // Danielle, running, Ellsworth) and is read single. Collapsing it afterwards would shift every
        // `nuclei` span recorded above and land the accent on the wrong vowel; skipping the letter keeps
        // the spans correct by construction.
        // ⚠ VOWELS ARE NOT COLLAPSED — ⟨oo⟩ in a loan is two syllables, not a long vowel.
        // ⚠ NO EXCEPTION FOR THE SUPERLATIVE SEAM, and that is measured rather than assumed. `naj-` before
        //   a ⟨j⟩-initial stem (najjednostavniji, najjeftiniji) is the one doubled consonant BCS writes
        //   natively, and it was exempted here on that reasoning — but the readers say a single /j/:
        //   `n aː j e d n o s t a v n i`, with the length on the prefix vowel, not the consonant. The
        //   corpus has no other native class: 175 distinct doubled-consonant types across hr/bs/sr, every
        //   other one a loan.
        // ⚠ THE PRODUCTIVE NATIVE SEAMS ARE `van-`/`izvan-` + n AND `nad-`/`pod-` + d — vannastavni,
        //   izvannastavni, naddržavni, poddijalekt — and they ARE collapsed here. That is a stated limit,
        //   not an oversight: they appear in neither the corpus nor either referee, so there is nothing to
        //   measure the exception against, and the one native class that COULD be measured (naj- + j)
        //   turned out to degeminate in the readers' speech against every expectation. Carving out an
        //   unmeasured class after that would be guessing twice.
        // ⚠ AGAINST THE LAST LETTER THIS SCAN EMITTED, not against `w[i-1]`. The previous input character
        //   may be the tail of a digraph already consumed as one segment, and then the comparison sees a
        //   geminate that never reached the output: `ljjubav` dropped its third ⟨j⟩ because `w[i-1]` was
        //   the ⟨j⟩ of ⟨lj⟩. Unattested in BCS, but the wrong quantity to compare.
        if (!isLetterRun && c === prevLetter && !VOWEL_LETTER.has(c) && LETTERS[c] !== undefined) {
            i++;
            continue;
        }
        if (LETTERS[c] !== undefined) {
            const start = out.length;
            out += LETTERS[c];
            prevLetter = c;
            if (isNucleus(w, i)) nuclei.push({ start, end: out.length });
        } else {
            // ⚠ AN UNKNOWN CHARACTER BREAKS THE ADJACENCY. Without this reset the two letters either side
            // of a hyphen look doubled and the second is deleted — `pop-pevač` → *popevač*, `jal-lah` →
            // *jalah*. The three engines' tokenizers exclude `-`, so this is unreachable through them, but
            // `phonemizeWord` is exported and the referee eval scores it directly over entries that can be
            // hyphenated.
            prevLetter = "";
        }
        i++; // unknown char (punctuation) → skip
    }
    if (nuclei.length === 0) return out;
    // ⚠ A CLITIC GETS NOTHING AT ALL, not merely no tone. Most are monosyllabic and so were already unmarked,
    // but ćemo/ćete/bismo/biste are not — marking those and not the rest would be an inconsistency with no
    // basis in the language, since an enclitic is unstressed whatever its length.
    if (CLITIC.has(w)) return out;
    const acc = stressDict().get(w) ?? deriveAccent(w);
    const k = Math.min(acc?.at ?? 0, nuclei.length - 1);
    const n = nuclei[k]!;
    const mark = nuclei.length > 1 ? "ˈ" : ""; // a monosyllable takes no ˈ — but it DOES take its tone
    const tail = acc === undefined ? "" : (LONG.has(acc.tone) ? "ː" : "") + TONE[acc.tone];
    if (mark === "" && tail === "") return out;
    return out.slice(0, n.start) + mark + out.slice(n.start, n.end) + tail + out.slice(n.end);
}

// A word (Serbian Cyrillic + Latin incl. diacritics) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "а-шђјљњћџ")})|(\\d+)|([.!?…,;:])`, "giu");
/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it is no longer also
 * deciding where the script boundary falls.
 *
 * ⚠ `й` IS EXCLUDED, and it is the one part of this that is not a straight lift. The old class used the coarse
 * range `а-ш`, which sweeps up `й` — a RUSSIAN letter that Serbian/Bosnian Cyrillic does not have (this
 * orthography writes `ј`, U+0458, which sits outside the range entirely and is listed separately). The g2p has no
 * rule for `й` and dropped it. Excluding it from the inventory hands it to the fold instead, and `й` DOES
 * decompose — и + combining breve — so `Толстой` now reads with a final /i/ rather than losing the letter.
 * The TOKEN above deliberately stays wide: claiming the whole Cyrillic run is the SCRIPT question, and getting
 * that right is what puts the letter in front of the fold at all.
 */
const NATIVE_CLASS = "[а-ик-шђјљњћџa-zčćšžđ]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class SerbianPhonemizer implements Phonemizer {
    text(input: string): string {
        // order: normalize.ts owns the whole sequence, INCLUDING the shared symbol tier — its step 9
        // has to sit between the clock (which needs the colon) and the decimal fold (which destroys the
        // number the tier's count agreement reads), so the tier cannot be applied around this call the
        // way most engines do it. See the ordering comments there.
        return assembleClauses(normalizeSerbian(input), TOKEN, (m, sink) => {
            // `foreignLetters` BEFORE `nat`, as in hr/bs. A no-op on Cyrillic input, which is why the
            // corpus barely exercises it here (0.7% of rows against 11.8% Bosnian) — but Serbian is
            // written in both scripts and the Latin side had the same deletion.
            if (m[1]) sink.emit(phonemizeWord(nat(foreignLetters(m[1]))));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Serbian phonemizer (phonemic dual-script g2p; pitch accent deferred). */
export function createSerbian(): Phonemizer {
    return new SerbianPhonemizer();
}

// ⚠ `xx` IS ONE CLUSTER. Expanding each ⟨x⟩ independently gives `Exxon` → *ekskson*, and the
//   doubling is invisible to degemination because it happens after this fold, in a pair the
//   scan never sees as a repeated LETTER.
const FOREIGN_LETTER = /qu|xx|th|[qwxy]/giu;
/**
 * ⚠ ⟨th⟩ IS NOT ALWAYS FOREIGN, and the obvious grapheme edit is net-negative without this. Native ⟨th⟩ is
 * a PREFIX BOUNDARY: a prefix ending in /t/ (or in /d/ devoiced to /t/) meeting an h-initial root —
 * `pred+hod` → *prethodni*, `pod+hraniti` → *pothranjenost*, `pod+hlađen` → *pothlađenost*. There the two
 * letters are separate phonemes and [tx] is CORRECT.
 *
 * ⚠ AND IT IS A SHARED FOLD: hr, bs and sr all call this. The native prefix family is common to all
 * three standards, so the guard is not a Croatian special case.
 *
 * Counted over the sr/hr/bs FLEURS corpora: 104 native tokens against 167 foreign (arthur, chatham,
 * ellsworth, lufthansa, macbeth, north, smith, thomson, the …). Folding blind would take the 167 and lose
 * the 104. The prefix is checked at WORD START and immediately before the ⟨h⟩, which admits every native
 * token in the corpus and no foreign one.
 *
 * ⚠ IT WILL BE WRONG ON `Othello`/`otherwise` — foreign words that happen to open with ⟨ot⟩+⟨h⟩. Neither
 * appears in the corpora, and the alternative (a root list of *hod, hran, hlad, hvat, hrv*…) is fragile in
 * the other direction. Recorded rather than guessed at, as with the French ⟨qu⟩ override below.
 */
const NATIVE_TH_PREFIX = /^(?:pret|pot|ot|nat)$/iu;
/**
 * ⟨q w x y⟩ — THE FOUR LETTERS GAJ'S LATIN DOES NOT HAVE, AND THIS ENGINE WAS DELETING.
 * (⟨th⟩ joined this fold later on the same reasoning; its own note is above `NATIVE_TH_PREFIX`.)
 *
 * ⚠ THE AUDIO SUPPORT IS WEAK FOR ⟨w⟩ AND ⟨y⟩, AND THE REASON IS KNOWN. Over the 364 Bosnian utterances
 * carrying one of these letters the fold is net positive on all four mappings but decisive on only one:
 *     qu/q → kv/k   23 better / 4 worse        x → ks   25 / 13
 *     w → v         93 better / 67 worse       y → i|j  107 / 91
 * The ⟨w⟩ and ⟨y⟩ words are overwhelmingly English — web, world, new, Disney, city, beauty — and the
 * readers CODE-SWITCH on them, so neither the folded nor the deleted form matches what was said. ⟨q⟩ words
 * (piquet, Qing, cirque) are nativised, which is why that arm is clean. Re-measure ⟨w⟩/⟨y⟩ once a
 * span-level language signal exists; the confound is the measurement's, not the fold's.
 *
 * Found by `silentCharsIn`: ⟨w⟩ ×19 and ⟨y⟩ ×10 in the mined artifact, inert — `Downing → doninɡ`,
 * `Whitehallu → xitexallu`, `web → eb`, `Toyota → toota`, `Dylana → dlana`. Reading the same corpus by hand
 * finds the other two behaving identically: `taxi → tai`, `quiz → uiz`. One family, four letters.
 *
 * ⚠ WHY THE NATIVISER DOES NOT CATCH THEM, which is the part worth recording. `NATIVE_CLASS` above is
 * `[a-zčćšžđ]`, so ⟨q w x y⟩ are inside it and the token is never judged foreign; and even if they were
 * outside it, `foldLatinToBase` only strips ACCENTS — `w` folds to `w`, which the shared g2p still has no
 * rule for. The nativiser handles the letter that is a decorated native letter; this is the letter that is
 * simply not in the alphabet, and that needs a reading.
 *
 * ⚠ THE FLEET ALREADY AGREES, WHICH IS HOW LARGE THE HOLE IS. The same four probes across the neighbours:
 *
 *     hr  Downing → doninɡ   taxi → tai     quiz → uiz     New York → ne ork      ← this engine, before
 *     sl  Downing → dɔʋnink  taxi → taksi   quiz → kuis    New York → nɛʋ iɔrk
 *     cs  Downing → dˈovɲɪŋk taxi → tˈaksɪ  quiz → kˈuɪs   New York → nˈɛf ˈɪjork
 *     pl  Downing → dˈɔvɲiŋk taxi → tˈaksi  quiz → kˈuis   New York → nˈɛf ˈɨɔrk
 *
 * ⚠ THE READINGS ARE THE ORTHOGRAPHY'S OWN, taken from what Croatian writes when it DOES adapt the
 * spelling — which is the least speculative evidence available for how the letter is read:
 *
 *     w → v     `Wales` keeps its ⟨W⟩ but the derivatives are *Velšani*, *velški* (hr.wikipedia, Gajica)
 *     x → ks    `taxi` → *taksi*, `boxing` → *boks*
 *     qu → kv   `quiz` → *kviz*, `quality` → *kvaliteta*, `quart` → *kvart*
 *     q → k     the residue, when no ⟨u⟩ follows
 *     y → i     `Dylan` → *Dilan*, `Barry` → *Bari*
 *     th → t    `theory` → *teorija*, `mathematics` → *matematika*, `athletics` → *atletika* — all three
 *               standards adapt foreign /θ/ as /t/, and ⟨h⟩ alone is /x/, so an unfolded ⟨th⟩ gives the
 *               impossible *txe* for `the` and *mˈatxeʋ* for `Matthew`
 *
 * The letters themselves are documented as outside the alphabet and used only in foreign material —
 * *Hrvatski pravopis* (pravopis.hr/slova): "Pri abecediranju q dolazi iza p, a w, x, y iza v", "U pisanju
 * stranih imena i stranih riječi"; hr.wikipedia (Gajica): "Slova Ww, Yy i Qq u hrvatskom jeziku koriste se
 * samo pri pisanju stranih vlastitih imena i stranih zemljopisnih imena."
 *
 * ⚠ ⟨y⟩ IS THE ONE WITH A CONDITION, and it is taken NARROWLY. Croatian reads final ⟨-ay -ey -oy⟩ as a /j/
 * offglide — *Nestroy*, *Gray*, *Hemingway* (jezicni-savjeti.com.hr, on why no epenthetic ⟨j⟩ is inserted
 * in their oblique cases: "ni kad se završno y izgovara kao j"). Everywhere else it is the vowel /i/. So:
 * ⟨y⟩ after a vowel → ⟨j⟩, otherwise → ⟨i⟩. `Toyota` → *tojota*, `Dylana` → *dilana*.
 *
 * ⚠ IT IS A SPELLING FOLD, NOT A G2P RULE, and `phonemizeWord` must stay byte-identical for its three
 * callers: it is applied per word, before `nat`, by hr, bs and sr alike. It lived in croatian.ts first and
 * was scoped there because "sr and bs are two other languages' referees"; those referees turn out to hold
 * ZERO words with any of these letters, so extending it moves them by exactly nothing.
 *
 * ⚠ WITHOUT IT THE LETTER IS DELETED OUTRIGHT — `watt` → *at*, `Ellsworth` → *ˈelsortx*, `Qing` → *inɡ* —
 * which is silent content loss, the worst of the available errors and the reason it is applied at all.
 * ⚠ AND IT WILL BE WRONG ON FRENCH ⟨qu⟩ (`Québec` is *kebek*, not *kvebek*). That is a source-language
 * override on a proper name, a much smaller and rarer error than deleting the letter, and inventing a
 * French-name detector here would be guessing at a population the artifact does not contain.
 */

export const foreignLetters = (w: string): string =>
    w.replace(FOREIGN_LETTER, (m, at: number, s: string) => {
        const lower = m.toLowerCase();
        if (lower === "qu") return "kv";
        if (lower === "q") return "k";
        if (lower === "w") return "v";
        if (lower === "x" || lower === "xx") return "ks";
        // ⟨th⟩ → t. See the ⟨th⟩ note in the docstring for the native-prefix guard.
        if (lower === "th") return NATIVE_TH_PREFIX.test(s.slice(0, at + 1)) ? m : "t";
        // ⟨y⟩: the /j/ offglide after a vowel, the vowel /i/ otherwise.
        return /[aeiouAEIOU]/u.test(s[at - 1] ?? "") ? "j" : "i";
    });

