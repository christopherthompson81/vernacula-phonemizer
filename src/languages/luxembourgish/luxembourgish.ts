/**
 * Luxembourgish (lb) phonemizer — Lëtzebuergesch, West Germanic (Moselle Franconian), Latin script, canonical IPA,
 * espeak-independent. A greedy longest-match grapheme scan (the diphthongs + digraphs, length-desc) + German-style
 * code rules the table can't express:
 *   - the DIPHTHONGS ⟨ei ai⟩→ai̯, ⟨au⟩→æu̯, ⟨ou⟩→əu̯, ⟨éi⟩→ei̯ (⟨é⟩ alone→eː), ⟨ie⟩→iə, ⟨ue⟩→uə (offglide folds in the backbone);
 *   - ⟨w⟩→v, ⟨v⟩→f, ⟨z⟩→t͡s, ⟨ch⟩→χ, ⟨sch⟩→ʃ, ⟨qu⟩→kv;
 *   - initial ⟨st sp⟩→ʃt/ʃp (German), single ⟨s⟩→z as a syllable onset (Sonn→zon, Iesel→iəzel) but ⟨ss⟩→s;
 *   - short ⟨e⟩→[æ] stressed / [ə] reduced (Belsch→bælʃ, Decken→dækən), geminate collapse (Flott→flot);
 *   - DEVOICING: word-final + regressive before a voiceless obstruent (Hand→hant, Abt→apt), final ⟨g⟩→[χ] after a
 *     vowel (Dag→daːχ) / [k] after a consonant (Alg→alk); ⟨n⟩→[ŋ] before a velar (Bankrott→baŋkrot);
 *   - intervocalic g-spirantization ⟨g⟩→[ʁ] (Lager→laʁər).
 * Vowel LENGTH (open/closed-syllable-conditioned) is folded/deferred; the French-loan tail (Aubergine, Avion) + the
 * Romance penult-stress class are not modelled. See docs/investigations/lb_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface LuxDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<LuxDef>(import.meta.url, "luxembourgish.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
// Multi-letter graphemes scanned longest-first so ⟨sch⟩ beats ⟨s⟩+⟨ch⟩ and ⟨tsch⟩ beats ⟨tz⟩ etc.
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
const VOWEL_PH = new Set([..."aeiouəæɛɔ"]); // IPA vowel heads (for the s→z onset test)
const DEVOICE: Record<string, string> = { b: "p", d: "t", ɡ: "k", z: "s", v: "f" }; // obstruent → its voiceless pair
const VOICELESS_OBSTR = new Set(["p", "t", "k", "s", "ʃ", "f", "χ", "t͡s", "t͡ʃ"]); // triggers regressive devoicing

/** One scan token: the IPA phones for a grapheme + flags marking a single ⟨s⟩ (may voice to [z]) or a single ⟨e⟩
 *  (realized [æ] when stressed, [ə] when not — see realizeE). */
interface Tok { ph: string; sVar?: boolean; eVar?: boolean }

/** Scan a lowercased Luxembourgish word into phone tokens (longest-match digraphs, then single graphemes). */
function scan(word: string): Tok[] {
    const w = word.normalize("NFC").toLowerCase();
    const toks: Tok[] = [];
    let i = 0;
    outer: while (i < w.length) {
        for (const key of ORDER) {
            if (w.startsWith(key, i)) {
                toks.push({ ph: DIGRAPHS[key]! });
                i += key.length;
                continue outer;
            }
        }
        const c = w[i]!;
        const ph = G[c];
        if (ph !== undefined) toks.push({ ph, sVar: c === "s", eVar: c === "e" }); // single ⟨s⟩→[z], single ⟨e⟩→[æ]/[ə]
        i += 1;
    }
    return toks;
}

// Unstressed one-syllable prefixes: the stress falls on the FOLLOWING syllable (gefollegt, verhalen, erbaarmen…).
// A heuristic — it can't tell a real prefix from a root that happens to start the same way (besser, Erd), so a
// disyllabic ⟨be/er⟩-root gets its stress mislocated; measured net +3.9pp over always-first-syllable, so kept.
const UNSTRESSED_PREFIX = /^(ge|be|ver|er|zer|ze)[^aeiouyäëéô]/u;

/** Short ⟨e⟩ realizes as [æ] in the STRESSED syllable but reduces to schwa [ə] elsewhere (Belsch→bælʃ, Decken→dækən
 *  but the ⟨-en⟩ ending →ə; Gemeng→ɡəmæŋ with the ⟨ge-⟩ prefix unstressed). Stress ≈ the first vowel, past an
 *  unstressed ⟨ge/be/ver/er⟩ prefix — the Germanic default (Romance-loan penult stress is not modelled). */
function realizeE(word: string, toks: Tok[]): void {
    const vowelIdx = toks.map((t, i) => (startsWithVowel(t.ph) ? i : -1)).filter((i) => i >= 0);
    const stressOrdinal = UNSTRESSED_PREFIX.test(word.toLowerCase()) && vowelIdx.length > 1 ? 1 : 0;
    const stressTok = vowelIdx[stressOrdinal];
    for (let i = 0; i < toks.length; i++) {
        if (toks[i]!.eVar) toks[i]!.ph = i === stressTok ? "æ" : "ə";
    }
}

/** ⟨s⟩ → [z] as a voiced ONSET: word-initial before a vowel, or intervocalic (Sonn→zon, Iesel→iəzel). ⟨ss⟩ (already
 *  [s] from the digraph) and coda ⟨s⟩ stay [s]. */
function voiceS(toks: Tok[]): void {
    for (let i = 0; i < toks.length; i++) {
        const t = toks[i]!;
        if (!t.sVar) continue;
        const nextVowel = i + 1 < toks.length && startsWithVowel(toks[i + 1]!.ph);
        const prevVowel = i > 0 && endsWithVowel(toks[i - 1]!.ph);
        if (nextVowel && (i === 0 || prevVowel)) t.ph = "z";
    }
}

// The base characters of a phone, dropping combining diacritics (U+0300–036F incl. the ◌̯ offglide + the ◌͡ tie) and
// the length mark ◌ː (U+02D0) — so a diphthong (ai̯) / long vowel (eː) is still recognised as vowel-{initial,final}.
function coreChars(ph: string): string[] {
    return [...ph.normalize("NFD")].filter((c) => {
        const x = c.codePointAt(0)!;
        return !(x >= 0x300 && x <= 0x36f) && x !== 0x2d0;
    });
}
function startsWithVowel(ph: string): boolean { const a = coreChars(ph); return a.length > 0 && VOWEL_PH.has(a[0]!); }
function endsWithVowel(ph: string): boolean { const a = coreChars(ph); return a.length > 0 && VOWEL_PH.has(a[a.length - 1]!); }

/** Initial ⟨st sp⟩ → [ʃt ʃp] (the German rule): a word-initial [s] before [t]/[p] becomes [ʃ]. */
function initialSCluster(toks: Tok[]): void {
    if (toks.length >= 2 && toks[0]!.ph === "s" && (toks[1]!.ph === "t" || toks[1]!.ph === "p")) toks[0]!.ph = "ʃ";
}

/** DEVOICING: word-final (Hand→hant, Frënd→fʀent) + regressive before a voiceless obstruent (Abt→apt,
 *  Bandscheif→bantʃaif). Word-final ⟨g⟩ is special: [χ] after a vowel (Dag→daːχ) but [k] after a consonant (Alg→alk). */
function applyDevoicing(toks: Tok[]): void {
    const last = toks.length - 1;
    for (let i = 0; i <= last; i++) {
        const t = toks[i]!;
        if (!(t.ph in DEVOICE)) continue;
        const wordFinal = i === last;
        const beforeVoiceless = i < last && VOICELESS_OBSTR.has(toks[i + 1]!.ph);
        if (!wordFinal && !beforeVoiceless) continue;
        if (t.ph === "ɡ" && wordFinal) t.ph = i > 0 && endsWithVowel(toks[i - 1]!.ph) ? "χ" : "k";
        else t.ph = DEVOICE[t.ph]!;
    }
}

/** ⟨n⟩ → [ŋ] before a velar [k]/[ɡ] (Bankrott→baŋkrot, and the ⟨-ng⟩ that scans as n+ɡ). */
function velarNasal(toks: Tok[]): void {
    for (let i = 0; i < toks.length - 1; i++) {
        if (toks[i]!.ph === "n" && (toks[i + 1]!.ph === "k" || toks[i + 1]!.ph === "ɡ")) toks[i]!.ph = "ŋ";
    }
}

/** INTERVOCALIC g-spirantization: a single ⟨g⟩ [ɡ] between two vowels → the voiced uvular fricative [ʁ]
 *  (Lëtzebuergesch/German g-lenition). Word-final ⟨g⟩ (→χ/k) and the ⟨ng⟩ velar are handled elsewhere. */
function spirantizeG(toks: Tok[]): void {
    for (let i = 1; i < toks.length - 1; i++) {
        if (toks[i]!.ph === "ɡ" && endsWithVowel(toks[i - 1]!.ph) && startsWithVowel(toks[i + 1]!.ph)) toks[i]!.ph = "ʁ";
    }
}

/** Geminate collapse: a doubled consonant letter (⟨tt ll nn dd mm pp ff rr bb gg kk⟩) surfaces as a single phone
 *  (Flott→flot, Bidden→bidən, Capellen→kapælən) — Luxembourgish has no phonemic length contrast in the coda. */
function degeminate(toks: Tok[]): void {
    for (let i = toks.length - 1; i > 0; i--) {
        const p = toks[i]!.ph;
        if (p === toks[i - 1]!.ph && !startsWithVowel(p)) toks.splice(i, 1);
    }
}

/** Phonemize a single Luxembourgish word to canonical IPA (segmental; vowel length folded/deferred). */
export function phonemizeWord(word: string): string {
    const toks = scan(word);
    realizeE(word, toks);
    voiceS(toks);
    initialSCluster(toks);
    degeminate(toks);
    velarNasal(toks);
    spirantizeG(toks);
    applyDevoicing(toks);
    return toks.map((t) => t.ph).join("");
}

// A word (Luxembourgish Latin letters incl. é ë ä + the loan vowels) / number / punctuation token. Numbers deferred.
const TOKEN = /([a-zéëäàáâôûüöA-ZÉËÄÀÁÂÔÛÜÖ'-]+)|(\d+)|([.!?…,;:])/gu;

class LuxembourgishPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(m[2]); // numbers deferred (digits passed through)
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Luxembourgish phonemizer (grapheme g2p + diphthongs + German-style rules; length folded/deferred). */
export function createLuxembourgish(): Phonemizer {
    return new LuxembourgishPhonemizer();
}
