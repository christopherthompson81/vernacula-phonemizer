/**
 * Welsh (cy) phonemizer — canonical IPA, espeak-independent, Northern-leaning. Rule-based g2p (g2p.ts) +
 * PENULTIMATE stress + the Welsh vowel-length rule. A stressed monophthong in a long context — open, or before a
 * single voiced/fricative coda — takes full length (ː) in a monosyllable/final syllable (mis → miːs); in a penult
 * it stays SHORT and LAX (pobol → pɔbɔl, nesaf → nɛsav — the NW referee shows lax, not the espeak-tensed [o]/[e]).
 * Elsewhere it stays lax and short (bore → bɔrɛ). Diphthongs and circumflex vowels are already long and untouched.
 * See docs/investigations/cy_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { type Seg, toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeWelsh } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

// LEXICON (lexicon.tsv, kaikki/Wiktionary NW-derived): pronunciations the rules mis-derive — per-word ⟨ae⟩/⟨ai⟩
// diphthong QUALITY (aeres→eɨ), lexical ⟨y⟩-obscure/clear irregularities, loan vowels, monosyllable length. See
// tools/gen/build-cy-kaikki-dict.mts.
let LEX: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
    if (LEX === undefined)
        LEX = loadTsvMap(import.meta.url, "lexicon.tsv", undefined, {
            optional: true,
        });
    return LEX;
}

const LONG = MANIFEST.longVowel; // lax short → long tense (adds ː): ɛ→eː, ɔ→oː, …
const LENGTHENS = new Set([...MANIFEST.lengthenBefore]); // single coda consonants that give a long/tense context

/** Apply the vowel-length rule to the stressed nucleus. `stress` is its index; `isFinal` = no nucleus follows. */
function applyLength(segs: Seg[], stress: number, isFinal: boolean): void {
    const v = segs[stress]!;
    if (v.long || v.ph === "ə") return; // diphthong / circumflex / schwa: never length-adjusted
    // coda = the consonants between this nucleus and the next nucleus (or word end)
    let coda = 0,
        single = "";
    for (let j = stress + 1; j < segs.length && !segs[j]!.nucleus; j++) {
        coda++;
        single = segs[j]!.ph;
    }
    const longContext = coda === 0 || (coda === 1 && LENGTHENS.has(single));
    if (!longContext) return; // lax + short (voiceless stop, m, ŋ, ɬ, cluster, or the deferred n/r/l)
    // Full length ː only in a monosyllable / final syllable; a PENULT keeps its short LAX quality (pobol→pɔbɔl,
    // nesaf→nɛsav — the NW referee shows lax; the espeak-tensed penult [o]/[e] was an oracle artifact, cf. i→ɨ).
    if (isFinal) v.ph = LONG[v.ph] ?? v.ph;
}

const EXCEPTIONS = MANIFEST.exceptions; // irregular function words (short/lax where the rule would lengthen)
const ENCLITICS = MANIFEST.enclitics; // apostrophe-contracted enclitics (o'r, hi'n)

/** One Welsh word → canonical IPA: scan, penultimate stress, vowel length. */
export function phonemizeWord(word: string): string {
    const lw = word.toLowerCase();
    const exc = EXCEPTIONS[lw.replace(/['’]/g, "")];
    if (exc !== undefined) return exc; // irregular function word (i → ɨ, bod → bɔd)
    const lex = lexicon().get(word) ?? lexicon().get(lw);
    if (lex !== undefined) return lex; // kaikki NW lexicon: rules-can't-derive words
    // Apostrophe enclitic (o'r → oːr, hi'n → hiːn): phonemize the STEM as its own word so its length rule sees the
    // real (open) syllable, then append the enclitic — instead of merging them into one closed syllable.
    const clitic = lw.match(/^(.+)['’]([a-z]+)$/);
    if (clitic && ENCLITICS[clitic[2]!]) return phonemizeWord(clitic[1]!) + ENCLITICS[clitic[2]!]!;
    const segs = toSegments(word.replace(/['’]/g, "")); // strip clitic apostrophes (mae'r, cymru'n)
    if (segs.length === 0) return "";
    const nucleiIdx = segs
        .map((s, i) => (s.nucleus ? i : -1))
        .filter((i) => i >= 0);
    if (nucleiIdx.length === 0) return segs.map((s) => s.ph).join("");
    // PENULTIMATE stress (the second-to-last nucleus; the only nucleus in a monosyllable).
    const stressN = nucleiIdx.length >= 2 ? nucleiIdx.length - 2 : 0;
    const stress = nucleiIdx[stressN]!;
    applyLength(segs, stress, stressN === nucleiIdx.length - 1);
    // NB: the letter ⟨i⟩ stays FRONT (i/ɪ/iː) everywhere — Northern Welsh centralizes only ⟨u⟩ and clear ⟨y⟩ to
    // ɨ, keeping the i/ɨ contrast (melin → mɛlɪn, gwin → ɡwiːn). Run 1's i→ɨ rules matched an espeak ARTEFACT the
    // independent NW referee contradicts, and were removed in Run 3. The residual is now purely n/r/l LENGTH.
    // Secondary stress on the first syllable when the primary is the 3rd nucleus or later (cymdeithasol →
    // ˌkəmdəᶦˈθasɔl).
    // (Final unstressed ⟨e⟩→[a] — bore→bɔra, carreg→karaɡ — is a colloquial NW reduction, but not reliably
    // rule-based: at corpus scale it net-regresses [-3.5%], too many final ⟨e⟩ stay ɛ. Left as a lexical residual.)
    const secondary = stressN >= 2 ? nucleiIdx[0]! : -1;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        else if (i === secondary) out += "ˌ";
        // Degeminate: a written double consonant (nn, rr, …) is pronounced SINGLE (gorffennaf→ɡɔrfɛnav, torri→tɔrɪ).
        // It marks the preceding vowel short — applyLength already saw the doubled coda above, so only the OUTPUT
        // collapses. (ll/dd/ff/… are single digraph phonemes, not identical-adjacent, so untouched.)
        const s = segs[i]!;
        const prev = segs[i - 1];
        if (i > 0 && !s.nucleus && prev && !prev.nucleus && s.ph === prev.ph)
            continue;
        out += s.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Welsh groups thousands with COMMAS (1,400 — the TOKEN swallows the comma so the tier can still see the
// number); the dot is a DECIMAL (2.3 → "dau pwynt tri") or a version (802.11n), claimed by normalize.
const TOKEN =
    /([a-zâêîôûŵŷàèìòùïëöäüA-ZÂÊÎÔÛŴŶ]+(?:['’-][a-zâêîôûŵŷA-Z]+)*)|(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d+)|([.!?…,;:])/gu;

// #562 symbol normalization — Welsh: "y cant" after the number (40 y cant, the BBC Cymru convention);
// nouns stay SINGULAR after numerals in Welsh, so one form suffices (deg doler, not *doleri*).
// cant/doler/punt/cilogram are referee-attested; cilometr/milimetr/centimetr are the standard
// borrowings, read by rule. `m` (metre) added for the corpus's 100m/230m running events and 4892 m.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["y cant"],
    currency: { "$": ["doler"], "£": ["punt"], "¥": ["yen"] },
    units: { km: ["cilometr"], kg: ["cilogram"], mm: ["milimetr"], cm: ["centimetr"], m: ["metr"] },
});

class WelshPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/era/version steps need
        // the number and its suffix still adjacent, which the tier would break.
        return assembleClauses(SYMBOLS(normalizeWelsh(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const n = Number(m[2].replace(/,/gu, ""));
                for (const wd of numberToWords(n).split(" "))
                    sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Welsh phonemizer (rule-based; penultimate stress + vowel length). */
export function createWelsh(): Phonemizer {
    return new WelshPhonemizer();
}
