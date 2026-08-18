/**
 * Serbian (sr, српски) phonemizer — South Slavic, DUAL SCRIPT (Cyrillic + Gaj's Latin), fully phonemic.
 * A digraph-aware left-to-right scan (g2p reads serbian.jsonc): the Latin digraphs ⟨dž lj nj dj⟩
 * first, then the single Cyrillic OR Latin letters — every grapheme is one phoneme, no vowel reduction. Serbian's
 * lexical PITCH ACCENT is unwritten in ordinary text, so it comes from stress.tsv (101965 entries, both
 * scripts, from kaikki/Wiktionary): POSITION as ˈ before the nucleus, and the FOUR-WAY CONTOUR as a Chao tone
 * letter after it (˩˥ rising, ˥˩ falling) with ː for the accented syllable's length. Post-accentual length
 * stays folded. Croatian and Bosnian import phonemizeWord from here, so all three share the lexicon — which is
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
    "me", "te", "ga", "mu", "joj", "ih", "im", "se", "li", "ne",
    "i", "a", "ni", "da", "te", "u", "na", "o", "po", "za", "od", "do", "iz", "s", "sa", "k", "ka", "uz", "niz",
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
    let out = "";
    const nuclei: { start: number; end: number }[] = []; // output span of each nucleus, in order
    for (let i = 0; i < w.length; ) {
        const two = w.slice(i, i + 2);
        if (DIGRAPHS[two]) {
            out += DIGRAPHS[two]; // ⟨lj nj dž⟩ are consonants — never a nucleus
            i += 2;
            continue;
        }
        const c = w[i]!;
        if (LETTERS[c] !== undefined) {
            const start = out.length;
            out += LETTERS[c];
            if (isNucleus(w, i)) nuclei.push({ start, end: out.length });
        }
        i++; // unknown char (punctuation) → skip
    }
    if (nuclei.length === 0) return out;
    const acc = CLITIC.has(w) ? undefined : stressDict().get(w);
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
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
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
