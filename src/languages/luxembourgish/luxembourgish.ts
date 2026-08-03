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
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeLuxembourgish } from "./normalize.ts";

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

// A word (Luxembourgish Latin letters incl. é ë ä + the loan vowels) / number / punctuation token.
const TOKEN = /([a-zéëäàáâôûüöA-ZÉËÄÀÁÂÔÛÜÖ'-]+)|(\d+)|([.!?…,;:])/gu;

/**
 * #562 symbol normalization. Every noun here is invariant in the plural (Kilometer, Meter, Prozent,
 * Dollar), so no `countForm` override is needed. Sourcing, per §5e:
 *   Prozent — corpus ×14 + espeak lb_list · Dollar — corpus ×7 · Euro — corpus ×1 + espeak ·
 *   Kilometer/Meter/Zentimeter/Millimeter/Gramm/Meilen/Stonn/Sekonn — espeak lb_list · Hektar — espeak.
 *   **Yen is attested in NO in-repo source** and is shipped only because ¥ carries 3 of the corpus's 6
 *   currency instances; see the investigation doc. £ is not declared — its sign is absent from the corpus
 *   and its word is unsourced.
 * The two RATE idioms are lifted verbatim from the corpus, which writes both:
 *   `240 Kilometer an der Stonn (149 Meilen an der Stonn)` and `1,5 Kilometer pro Sekonn`.
 * `g`, `t` and `ha` are deliberately NOT declared: `50 Hektar` is written out, there is no bare `\dg`
 * (the `g` in `802.11g` is a version letter), and a one-letter unit key is the Dutch `Il-76s` hazard.
 * NEITHER IS `meile`, and that one was a real defect the corpus diff caught: declaring it so that
 * `Meile/h` could compose also rewrote the corpus's own six spelled-out `(31 Meile)` into `Meilen` — and
 * the corpus's Meile/Meilen alternation is the EIFELER REGEL applied correctly seven times out of seven
 * (`(15 Meilen) nord-` keeps the ⟨n⟩ before ⟨n⟩; `(31 Meile) vu`, `(3 980 Meile) laang`, `(500 Meile)
 * breet` drop it before a consonant). `mph` and `Meile/h` are claimed in normalize.ts instead, where the
 * sandhi can be got right, and a spelled-out `Meile` is now left exactly as the writer set it.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["Prozent"],
    currency: { "$": ["Dollar"], "€": ["Euro"], "¥": ["Yen"] },
    units: { km: ["Kilometer"], m: ["Meter"], cm: ["Zentimeter"], mm: ["Millimeter"], kg: ["Kilogramm"] },
    magnitudes: ["Milliounen", "Millioune", "Millioun", "Milliarden", "Milliard"],
    unitPer: { h: "an der", s: "pro" },
    rateDenominators: { h: "Stonn", s: "Sekonn" },
    // `km²` ×3 (`19 500 km²`, `3 850 km²`, `2,2 Millioune km²`) used to leave the unit entirely raw,
    // because the tier declines an undeclared exponent. Luxembourgish fuses the measure word German-style,
    // and the corpus writes both compounds itself: `783 562 Quadratkilometer (300 948 Quadratmeilen)` and
    // `120 – 160 Kubikmeter`.
    exponentWords: { squared: ["Quadrat"], cubed: ["Kubik"], position: "compound" },
});

class LuxembourgishPhonemizer implements Phonemizer {
    text(input: string): string {
        // #562 order: the Luxembourgish rewrites (de-grouping, era, abbreviations, ORDINALS, sports
        // times, clock, decimals, ranges, degrees, signs, fractions) → the shared symbol tier. The
        // ordinals and the clock must precede the number tokenizer; the tier runs last because it needs
        // a NUMBER adjacent to its unit, and both decimal rules above leave their operands as digits so
        // that adjacency survives.
        const normalized = SYMBOLS(normalizeLuxembourgish(input));
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            // Numbers: the units-first compositor (numbers.ts) → each word back through the same g2p.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
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
