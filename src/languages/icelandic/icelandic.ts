/**
 * Icelandic (is) phonemizer — íslenska, North Germanic (Insular), Latin script + ⟨þ ð æ ö⟩, canonical IPA,
 * One of the deepest orthographies in the fleet. A greedy longest-match grapheme scan (vowel
 * digraphs + the epenthetic-stop / devoiced-sonorant clusters) + code rules:
 *   - NO voicing contrast: ⟨b d g⟩/⟨p t k⟩ neutralize to [p t k] (aspiration folded); ⟨k g gj kj⟩ → PALATAL [c]
 *     before a front vowel ⟨i í y ý æ j⟩ (kýr→ciːr, Bylgja→pɪlca); intervocalic ⟨g⟩ → [ɣ] (dagur→taɣʏr);
 *   - the DEVOICED-SONORANT onsets ⟨hr hl hn⟩ → [r l n] (the ring folds; Hrafn→rapn), ⟨hj⟩ → [ç], ⟨hv⟩ → [kv];
 *   - the EPENTHETIC-STOP clusters ⟨ll⟩→[tl], ⟨rl⟩→[rtl], ⟨rn⟩→[rtn]; ⟨nn⟩→[tn] after a long/accented vowel or a
 *     diphthong (Steinn→steitn) but [n] after a short vowel (Anna→ana); geminate stops collapse;
 *   - a glide [j] between ⟨í⟩ and a following vowel (Biblía→pɪplija) — ⟨í⟩ ALONE, measured; ⟨f⟩→[v]/[p]/[f].
 * PRIMARY STRESS is emitted on the FIRST syllable of every word (dagur→tˈaɣʏr) — see stressInitial.
 * Vowel LENGTH, ASPIRATION (pre/post), and DEVOICED SONORANTS are folded/deferred.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { normalizeIcelandic } from "./normalize.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

export interface IcelandicDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    frontVowels: readonly string[];
    hiatusGlideVowels: readonly string[];
    longNuclei: readonly string[];
    collapsingDoubles: readonly string[];
    clausePunctuation: Record<string, string>;
    /** The ordinal series, three agreement forms each. See the jsonc. */
    ordinals: Record<string, { masc: string; common: string; femOblique: string }>;
}
const DEF = loadManifest<IcelandicDef>(import.meta.url, "icelandic.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
// ⚠ DELIBERATELY NOT core/ipa.ts's shared class — the ONE engine that keeps its own vowel list. It omits
// plain ⟨e⟩, and since the digraphs ⟨ei ey⟩ scan to the two-character value "ei", startsWithVowel("ei")
// is false and the hiatus glide never fires before a diphthong.
// ⚠ MEASURED, AND SMALLER THAN IT LOOKS. Adding ⟨e⟩ here now costs 8091 → 8090/10093, and exactly one
// word moves: þríeyki → θrijeicɪ. It is NOT what keeps erkiengill glideless — that is the ⟨í⟩-only
// trigger set (hiatusGlideVowels in icelandic.jsonc), which came later and does the heavier lifting.
// Keep the two straight: the trigger set decides WHICH vowel glides, this decides what counts as a
// vowel to glide INTO. docs/investigations/icelandic_hiatus_investigation.md.
const VOWEL_PH = new Set([..."aɛɪiɔouʏœøy"]); // IPA vowel heads (for intervocalic + glide tests)
// ⚠ NOT VOWEL_PH, AND THE DIFFERENCE IS THE ONE CHARACTER ⟨e⟩. Two different questions again: VOWEL_PH asks
// "can the hiatus glide land next to this phone", and it omits ⟨e⟩ on purpose so that the ⟨ei ey⟩ diphthong
// does not attract a glide (see above). This set asks "is this character a syllable NUCLEUS", and the ⟨ei⟩
// diphthong plainly is one — ein must be ˈein, not stress-less. Adding ⟨e⟩ to VOWEL_PH instead would silently
// re-arm the glide rule the comment above spent a run measuring away.
const NUCLEUS_CH = new Set([...VOWEL_PH, "e"]);
// Grapheme-level front vowels that PALATALIZE a preceding ⟨k g⟩ → [c] (kýr→ciːr, gelda→cɛlta, Bylgja→pɪlca) — incl.
// ⟨e é⟩ and the ⟨ei ey⟩ diphthong (the referee majority palatalizes: geipa→ceipa; the un-palatalized Geir→keir is
// the minority we over-palatalize to ceir). The four letter classes are in icelandic.jsonc.
const FRONT_V = new Set(DEF.frontVowels);
const FRONT_PH = new Set([..."ɛɪijy"]); // IPA front-vowel heads — an intervocalic ⟨g⟩ → [j] (not [ɣ]) before these
// The ⟨í⟩ that triggers the hiatus glide [j] (Biblía→pɪplija). ONE letter, measured — icelandic.jsonc
// has the referee counts and why plain ⟨i⟩ and ⟨ý⟩ are not here.
const HIATUS_GLIDE = new Set(DEF.hiatusGlideVowels);
const LONG_NUCLEUS = new Set(DEF.longNuclei); // a doubled ⟨nn⟩ → [tn] only after one of these (or ⟨au ei ey⟩)
const STOPS = new Set(["p", "t", "k"]);
const OTHER_DOUBLE = new Set(DEF.collapsingDoubles); // non-stop doubles collapse to one phone (Sviss→svɪs)

/** One scan token: the IPA phones for a grapheme + flags (⟨g⟩-origin → intervocalic spirantization; a high-front
 *  vowel → the glide rule; FORTIS ⟨p t k⟩ → preaspiration). */
interface Tok { ph: string; gVar?: boolean; hiatusGlide?: boolean; fortis?: boolean }

/** Scan a lowercased Icelandic word into phone tokens: longest-match digraphs (incl. the sonorant clusters), the
 *  geminate stops, and the ⟨k g⟩→[c] palatalization + the context-dependent ⟨nn⟩. */
function scan(word: string): Tok[] {
    const w = word.normalize("NFC").toLowerCase();
    const toks: Tok[] = [];
    let i = 0;
    outer: while (i < w.length) {
        const c = w[i]!, next = w[i + 1] ?? "";
        // Context-dependent ⟨nn⟩: [tn] after a long/accented vowel or a diphthong, else a plain [n].
        if (c === "n" && next === "n") {
            const prev2 = w.slice(Math.max(0, i - 2), i);
            const afterLong = LONG_NUCLEUS.has(w[i - 1] ?? "") || prev2 === "au" || prev2 === "ei" || prev2 === "ey";
            toks.push({ ph: afterLong ? "tn" : "n" });
            i += 2;
            continue;
        }
        const prevVowel = toks.length > 0 && endsWithVowel(toks[toks.length - 1]!.ph);
        // Geminate stops: fortis ⟨pp tt kk⟩ PREASPIRATE to [h]+stop; lenis ⟨bb dd gg⟩ collapse to a bare stop
        // (⟨kk gg⟩→[c] palatal before a front V — the trigger ⟨j⟩ is absorbed: drekkja→trɛhca).
        if (c === next && (STOPS.has(c) || c === "b" || c === "d" || c === "g")) {
            const fortis = STOPS.has(c);
            const afterPair = w[i + 2] ?? "";
            let consumed = 2;
            let ph = G[c]!;
            if ((c === "k" || c === "g") && FRONT_V.has(afterPair)) {
                ph = "c";
                if (afterPair === "j") consumed = 3;
            }
            if (fortis) toks.push({ ph: "h" });
            toks.push({ ph, fortis });
            i += consumed;
            continue;
        }
        // Other doubled consonants collapse to a single phone (Sviss→svɪs, the length folds).
        if (c === next && OTHER_DOUBLE.has(c)) {
            toks.push({ ph: G[c]! });
            i += 2;
            continue;
        }
        for (const key of ORDER) {
            if (w.startsWith(key, i)) {
                toks.push({ ph: DIGRAPHS[key]! });
                i += key.length;
                continue outer;
            }
        }
        // ⟨k g⟩ → PALATAL [c] before a front vowel ⟨e é i í y ý æ⟩ or ⟨j⟩ (the ⟨j⟩ absorbed); an INTERVOCALIC ⟨g⟩
        // before a front vowel is the approximant [j] instead (deigja→teija, Logi→lɔjɪ vs word-initial gelda→cɛlta).
        if ((c === "k" || c === "g") && FRONT_V.has(next)) {
            toks.push({ ph: c === "g" && prevVowel ? "j" : "c", fortis: c === "k" });
            i += next === "j" ? 2 : 1;
            continue;
        }
        const ph = G[c];
        if (ph !== undefined) toks.push({ ph, gVar: c === "g", hiatusGlide: HIATUS_GLIDE.has(c), fortis: STOPS.has(c) });
        i += 1;
    }
    return toks;
}

function startsWithVowel(ph: string): boolean { return VOWEL_PH.has([...ph][0]!); }
function endsWithVowel(ph: string): boolean { const a = [...ph]; return VOWEL_PH.has(a[a.length - 1]!); }

/** Intervocalic ⟨g⟩ [k] → the voiced velar fricative [ɣ] (dagur→taɣʏr), or [j] before a front vowel (Logi→lɔjɪ) —
 *  only underlying ⟨g⟩, not ⟨k⟩ (Gaukur→køykʏr). */
function spirantizeG(toks: Tok[]): void {
    for (let i = 0; i < toks.length; i++) {
        if (toks[i]!.ph !== "k") continue;
        const next = toks[i + 1]?.ph;
        if (next === "t" || next === "s") { toks[i]!.ph = "x"; continue; } // ⟨k g⟩ → [x] before a voiceless stop (lukt→lʏxt)
        if (!toks[i]!.gVar || i === 0 || !endsWithVowel(toks[i - 1]!.ph)) continue;
        // post-vocalic ⟨g⟩ → [ɣ] before a voiced sound or word-finally (lag→laɣ, ég→jɛɣ, Sigmar→sɪɣmar), [j] before front.
        if (next === undefined || !VOICELESS_PH.has([...next][0]!)) {
            toks[i]!.ph = next !== undefined && FRONT_PH.has([...next][0]!) ? "j" : "ɣ";
        }
    }
}

// Before the velar nasal (⟨ng nk⟩), a short vowel DIPHTHONGIZES (bang→pauŋk, gengur→ceiŋkʏr, ungur→uːŋkʏr).
const PRENASAL_V: Record<string, string> = { a: "au", ɛ: "ei", ɔ: "ou", œ: "øy", ɪ: "i", ʏ: "u" };
/** ⟨ng nk⟩ → [ŋk]: ⟨n⟩ → [ŋ] before a velar [k] or a palatal [c] (Alþingi→alθiŋcɪ), and the preceding short vowel
 *  diphthongizes (the pre-velar-nasal change). */
function velarNasal(toks: Tok[]): void {
    for (let i = 0; i < toks.length - 1; i++) {
        if (toks[i]!.ph === "n" && (toks[i + 1]!.ph === "k" || toks[i + 1]!.ph === "c")) {
            toks[i]!.ph = "ŋ";
            const prev = toks[i - 1];
            if (prev && prev.ph in PRENASAL_V) prev.ph = PRENASAL_V[prev.ph]!;
        }
    }
}

/** PREASPIRATION: a single fortis ⟨p t k⟩ before a sonorant ⟨l m n⟩ → [h] + stop (Hekla→hɛhkla, vatn→vahtn). The
 *  fortis GEMINATES already preaspirated in scan. */
function preaspirate(toks: Tok[]): void {
    for (let i = toks.length - 2; i >= 0; i--) {
        const nph = toks[i + 1]!.ph;
        const alreadyPre = i > 0 && toks[i - 1]!.ph === "h"; // a fortis GEMINATE already carries its [h] from scan
        if (toks[i]!.fortis && !alreadyPre && (nph === "l" || nph === "m" || nph === "n" || nph === "tl" || nph === "tn")) {
            toks.splice(i, 0, { ph: "h" });
        }
    }
}

/** A glide [j] appears between a ⟨í⟩ and a following vowel (Biblía→pɪplija, María→maːrija). */
function glideJ(toks: Tok[]): void {
    for (let i = toks.length - 2; i >= 0; i--) {
        if (toks[i]!.hiatusGlide && startsWithVowel(toks[i + 1]!.ph)) toks.splice(i + 1, 0, { ph: "j" });
    }
}

/** ⟨f⟩ realization: [v] before a voiced sound or intervocalic (lofa→lɔːva), [p] before a nasal ⟨m n⟩ (höfn→hœpn),
 *  [f] otherwise (word-final / before a voiceless obstruent). */
const VOICELESS_PH = new Set([..."ptksθfhc"]);
function realizeF(toks: Tok[]): void {
    for (let i = 0; i < toks.length; i++) {
        if (toks[i]!.ph !== "f") continue;
        const next = toks[i + 1]?.ph;
        if (next === "n" || next === "m") toks[i]!.ph = "p";
        else if (i > 0 && (next === undefined || !VOICELESS_PH.has([...next][0]!))) toks[i]!.ph = "v"; // voiced / word-final
    }
}

/**
 * PRIMARY STRESS → the first syllable. Icelandic is the easy case in the fleet: stress is fixed on the initial
 * syllable of the word, with no lexical exceptions to look up and no prefix class to except (contrast Afrikaans,
 * where ver-/ont-/ge- push it off σ1 and the placement had to be learned from a stressed lexicon). Loanwords are
 * nativised to initial stress too (banani → pˈananɪ), so there is nothing to dictionary.
 *
 * The mark goes before the NUCLEUS, not before the onset — the repo convention (nˈaða, not ˈnaða). That is why
 * this scans for the first nucleus CHARACTER rather than prefixing the word: ⟨é⟩ scans to the two-character
 * value "jɛ" whose [j] is an onset glide inside the grapheme, so ég is jˈɛɣ; a preaspirated Hekla is hˈɛhkla.
 *
 * ⚠ NOT VALIDATED AGAINST THE REFEREE, AND IT CANNOT BE. The only Icelandic referee is wikipron isl_latn_broad,
 * which carries ZERO stress marks in all 10093 rows — the wikipron broad scrape strips them universally — and
 * `tools/referee-eval/config.ts` strips [ˈˌ] from both sides anyway, so the eval is blind to this by
 * construction. The score is expected to be byte-identical before and after (8091/10093); what the tests below
 * pin instead is that stripping the mark reproduces the previous output exactly, i.e. that the rule ADDS a mark
 * and changes nothing else. Correctness of the placement rests on the fixed-initial generalization, which needs
 * no corpus.
 *
 * ⚠ SECONDARY STRESS IS NOT EMITTED, and this one IS a real deferral. Icelandic gives later compound members
 * their own (secondary) stress — the placement is a function of the compound seam, and this engine has no
 * decomposer to find it. Guessing a trochaic ˌ on odd syllables the way Czech can (Czech has no such seam
 * dependence) would put marks inside morphemes. It waits on a compound splitter, not on a decision.
 */
function stressInitial(ipa: string): string {
    const ch = [...ipa];
    const i = ch.findIndex((c) => NUCLEUS_CH.has(c));
    return i < 0 ? ipa : ch.slice(0, i).join("") + "ˈ" + ch.slice(i).join(""); // no nucleus (bare consonants) → no mark
}

/** Phonemize a single Icelandic word to canonical IPA (segmental + initial stress; length + aspiration + sonorant-devoicing folded). */
export function phonemizeWord(word: string): string {
    const toks = scan(word);
    velarNasal(toks);
    spirantizeG(toks);
    preaspirate(toks);
    glideJ(toks);
    realizeF(toks);
    return stressInitial(toks.map((t) => t.ph).join(""));
}

// A word (Icelandic Latin letters incl. á é í ó ú ý þ ð æ ö) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-záéíóúýþðæöA-ZÁÉÍÓÚÝÞÐÆÖ'-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class IcelandicPhonemizer implements Phonemizer {
    text(rawInput: string): string {
        // everything the g2p cannot read is rewritten to Icelandic words FIRST — see normalize.ts,
        // in particular why the ordinal form is selected by the FOLLOWING noun (Icelandic ordinals agree
        // in gender and case, unlike the Norwegian and Danish single-form tables).
        return assembleClauses(normalizeIcelandic(rawInput), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // Numbers: the tens-first / gender-concord compositor (numbers.ts) → each word back through the same g2p.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Icelandic phonemizer (grapheme g2p + fortis/lenis neutralization + the epenthetic clusters). */
export function createIcelandic(): Phonemizer {
    return new IcelandicPhonemizer();
}
