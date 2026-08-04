/**
 * Bavarian (bar) phonemizer — Boarisch, Upper German (Austro-Bavarian), Latin script, canonical IPA,
 * espeak-independent. Bavarian has no codified state orthography, but the Bavarian Wikipedia / Wiktionary uses a
 * de-facto German-derived convention (⟨å⟩ for the dark [ɔ], ⟨ä ö ü⟩, ⟨ß⟩); that is what the wikipron referee
 * transcribes, so the g2p is well-defined against it. A greedy longest-match grapheme scan (diphthongs + digraphs,
 * length-desc) + code rules the table can't express:
 *   - the FALLING diphthongs ⟨ia ua oa⟩→[iɐ̯ uɐ̯ oɐ̯] (Biaschtl, Duafa, Boarisch) — Bavarian's hallmark — plus the closing
 *     ⟨ei⟩→[ɑɛ̯], ⟨au⟩→[ɑɔ̯], ⟨eu äu⟩→[ɔy̯] (offglides fold in the backbone);
 *   - the voiceless-LENIS stops ⟨b d g⟩→[b̥ d̥ ɡ̥] (under-ring; the Austro-Bavarian fortis/lenis contrast) vs fortis ⟨p t k⟩;
 *   - R-VOCALIZATION: a coda ⟨r⟩→[ɐ̯], the ending ⟨-er⟩→[ɐ] (Dreier→dräɐ, Wåssa-type);
 *   - the DORSAL FRICATIVE ⟨ch⟩→[ç] after a front vowel/consonant, [x] after a back vowel (the German ich/ach split);
 *   - initial ⟨st sp⟩→[ʃt ʃp], ⟨n⟩→[ŋ] before a velar, geminate collapse (no coda length contrast).
 * Vowel LENGTH and the fine dialect vowel qualities (ɑ~a~ɒ, e~e̞~ɛ) are folded/deferred; the referee is a NARROW
 * transcription with ~1.29 dialect variants/headword (credited any). See docs/investigations/bar_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface BarDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<BarDef>(import.meta.url, "bavarian.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
// Multi-letter graphemes scanned longest-first so ⟨sch⟩ beats ⟨s⟩+⟨ch⟩, ⟨tsch⟩ beats ⟨t⟩+⟨sch⟩, etc.
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
const VOWEL_PH = new Set([..."aeiouyɑɔɛœøɒəɐ"]); // IPA vowel heads (for r-vocalization + ch front/back tests)
// A FRONT vowel head triggers the ⟨ch⟩→[ç] realization; anything else (a back vowel) → [x].
const FRONT_VOWEL = new Set([..."eiyɛœøɐ"]);

/** One scan token: the IPA phones for a grapheme + a flag marking a single ⟨r⟩ (may vocalize to [ɐ̯]/[ɐ] in a coda)
 *  and a single ⟨c⟩+⟨h⟩ ⟨ch⟩ (front/back realization, resolved in code). */
interface Tok { ph: string; rVar?: boolean; chVar?: boolean }

// The base characters of a phone, dropping combining diacritics (U+0300–036F incl. the ◌̯ offglide + the ◌̥ lenis
// under-ring + the ◌͡ tie) and the length mark ◌ː — so a diphthong (iɐ̯) / long vowel (aː) is still recognised as
// vowel-{initial,final} and a lenis [b̥] as its base [b].
function coreChars(ph: string): string[] {
    return [...ph.normalize("NFD")].filter((c) => {
        const x = c.codePointAt(0)!;
        return !(x >= 0x300 && x <= 0x36f) && x !== 0x2d0;
    });
}
function startsWithVowel(ph: string): boolean { const a = coreChars(ph); return a.length > 0 && VOWEL_PH.has(a[0]!); }
function endsWithVowel(ph: string): boolean { const a = coreChars(ph); return a.length > 0 && VOWEL_PH.has(a[a.length - 1]!); }
function endsWithFrontVowel(ph: string): boolean { const a = coreChars(ph); return a.length > 0 && FRONT_VOWEL.has(a[a.length - 1]!); }

/** Scan a lowercased Bavarian word into phone tokens (longest-match digraphs, then single graphemes). ⟨ch⟩ is kept
 *  as a marked token so its front/back realization can be resolved against the PRECEDING vowel in code. */
function scan(word: string): Tok[] {
    const w = word.normalize("NFC").toLowerCase();
    const toks: Tok[] = [];
    let i = 0;
    outer: while (i < w.length) {
        for (const key of ORDER) {
            if (w.startsWith(key, i)) {
                toks.push({ ph: DIGRAPHS[key]!, chVar: key === "ch" });
                i += key.length;
                continue outer;
            }
        }
        const c = w[i]!;
        const ph = G[c];
        if (ph !== undefined) toks.push({ ph, rVar: c === "r" });
        i += 1;
    }
    return toks;
}

/** The DORSAL FRICATIVE split: ⟨ch⟩ → [ç] (palatal) after a front vowel or word-initially/after a consonant, but
 *  [x] (velar) after a back vowel (the German ich/ach allophony; ⟨sch⟩ is [ʃ], handled by the digraph). */
function resolveCh(toks: Tok[]): void {
    for (let i = 0; i < toks.length; i++) {
        if (!toks[i]!.chVar) continue;
        const backContext = i > 0 && endsWithVowel(toks[i - 1]!.ph) && !endsWithFrontVowel(toks[i - 1]!.ph);
        toks[i]!.ph = backContext ? "x" : "ç";
    }
}

/** R-VOCALIZATION: a syllable-CODA ⟨r⟩ (no following vowel in the same or next segment) vocalizes to the offglide
 *  [ɐ̯]; the very common ending ⟨-er⟩ (a schwa+r after a consonant, at word end) → the syllabic vowel [ɐ]
 *  (Dreier→…ɐ, Wåssa-type). A prevocalic onset ⟨r⟩ (rot, Boarisch) stays the trill/tap [r]. */
function vocalizeR(toks: Tok[]): void {
    const last = toks.length - 1;
    const firstVowelIdx = toks.findIndex((t) => startsWithVowel(t.ph));
    for (let i = 0; i <= last; i++) {
        const t = toks[i]!;
        if (!t.rVar) continue;
        const nextVowel = i < last && startsWithVowel(toks[i + 1]!.ph);
        if (nextVowel) continue; // prevocalic onset → keep [r]
        // An UNSTRESSED ⟨-er⟩ (…e + coda r) collapses to a single [ɐ] — word-final (Dreier→…ɐ) or when the ⟨e⟩ is not
        // the first (stressed) vowel (Glumpert→…bɐt). A STRESSED ⟨er⟩ keeps the vowel + offglide (Bersch→b̥e̞ɐ̯ʃ).
        const prevIsE = i > 0 && toks[i - 1]!.ph === "e";
        if (prevIsE && (i === last || i - 1 !== firstVowelIdx)) { toks[i - 1]!.ph = "ɐ"; t.ph = ""; }
        else t.ph = "ɐ̯";
    }
}

/** Word-final ⟨gn⟩ [ɡ̥n] COALESCES to the velar nasal [ŋ] (Regn→reːŋ, Segn→seːŋ, Fliagn→fliɐ̯ŋ) — a regular Bavarian
 *  coda process (the preceding vowel lengthens, folded). The [ɡ̥] drops and the [n] becomes [ŋ]. */
function coalesceGN(toks: Tok[]): void {
    const last = toks.length - 1;
    if (last > 0 && toks[last]!.ph === "n" && toks[last - 1]!.ph === "ɡ̥") { toks[last - 1]!.ph = ""; toks[last]!.ph = "ŋ"; }
}

/** Initial ⟨st sp⟩ → [ʃt ʃp] (the German rule): a word-initial [s] before a coronal/labial stop becomes [ʃ]. The
 *  stop itself is the Bavarian LENIS [d̥]/[b̥] (⟨t p⟩ lenite, see the manifest), so the cluster surfaces as [ʃd̥]/[ʃb̥]. */
function initialSCluster(toks: Tok[]): void {
    if (toks.length >= 2 && toks[0]!.ph === "s" && (toks[1]!.ph === "d̥" || toks[1]!.ph === "b̥")) toks[0]!.ph = "ʃ";
}

/** POST-VOCALIC ⟨h⟩ is SILENT — a German vowel-length/hiatus marker, not the fricative [h] (Fruah→fruɐ̯, Fühn→fyn,
 *  Gfüh→ɡ̥fy). ⟨h⟩ keeps its [h] only as a syllable ONSET: word-initial or after a consonant, before a vowel. */
function silentH(toks: Tok[]): void {
    for (let i = 1; i < toks.length; i++) {
        if (toks[i]!.ph === "h" && endsWithVowel(toks[i - 1]!.ph)) toks[i]!.ph = "";
    }
}

/** ⟨k⟩ LENITES to [ɡ̥] everywhere EXCEPT a word-initial prevocalic onset — i.e. non-initially (coda/medial: Dackn→dɑɡ̥…,
 *  Unterflack→…flɑɡ̥, ⟨nk⟩ Dånkschee→…ŋɡ̥ʃ) and word-initially before a LIQUID (Klass→ɡ̥lɑs). This completes the
 *  Bavarian fortis/lenis neutralization for the velar (⟨t p⟩ lenite unconditionally in the manifest); only the
 *  word-initial prevocalic ⟨k⟩ keeps its fortis [k] (Kaas→kʰɑːs). */
function lenitK(toks: Tok[]): void {
    for (let i = 0; i < toks.length; i++) {
        if (toks[i]!.ph !== "k") continue;
        const initialBeforeLiquid = i === 0 && i + 1 < toks.length && (toks[i + 1]!.ph === "l" || toks[i + 1]!.ph === "r");
        if (i > 0 || initialBeforeLiquid) toks[i]!.ph = "ɡ̥";
    }
}

/** Word-final unstressed ⟨-a⟩ [ɑ] REDUCES to [ɐ] (Bana→b̥ɑːnɐ, Beda→b̥ɛːd̥ɐ, Oida→ɔed̥ɐ) — the Bavarian counterpart
 *  of the German final-schwa. Only a single final ⟨a⟩ after a consonant; the long ⟨aa⟩→[aː] and diphthong tails
 *  (already [ɐ̯]/[e]) are untouched. */
function reduceFinalA(toks: Tok[]): void {
    const last = toks.length - 1;
    if (last > 0 && toks[last]!.ph === "ɑ" && !endsWithVowel(toks[last - 1]!.ph)) toks[last]!.ph = "ɐ";
}

/** ⟨n⟩ → [ŋ] before a velar [k]/[ɡ̥] (the ⟨ng⟩ digraph is already [ŋ]; this catches ⟨nk⟩ Bånk→b̥ɔŋɡ̥, the [k]
 *  having lenited to [ɡ̥] by this point). */
function velarNasal(toks: Tok[]): void {
    for (let i = 0; i < toks.length - 1; i++) {
        if (toks[i]!.ph === "n" && (toks[i + 1]!.ph === "k" || toks[i + 1]!.ph === "ɡ̥")) toks[i]!.ph = "ŋ";
    }
}

/** Geminate collapse: a doubled consonant letter (⟨tt ll nn mm pp ff rr bb gg kk dd⟩) surfaces as a single phone
 *  (Bappn→bɑbm, Leffl→lefl) — Bavarian has no phonemic coda length contrast in this orthography. */
function degeminate(toks: Tok[]): void {
    for (let i = toks.length - 1; i > 0; i--) {
        const p = toks[i]!.ph;
        if (p !== "" && p === toks[i - 1]!.ph && !startsWithVowel(p)) toks.splice(i, 1);
    }
}

/** Phonemize a single Bavarian word to canonical IPA (segmental; fine vowel qualities + length folded/deferred). */
export function phonemizeWord(word: string): string {
    const toks = scan(word);
    resolveCh(toks);
    silentH(toks);
    initialSCluster(toks);
    // degeminate + coalesceGN run BEFORE lenitK: gemination must collapse while both stops are still identical, and
    // ⟨gn⟩-coalescence must see only a GENUINE ⟨g⟩→[ɡ̥] — not a ⟨k⟩ that lenitK turned into [ɡ̥] (else Dackn→d̥ɑŋ).
    degeminate(toks);
    coalesceGN(toks);
    lenitK(toks);
    velarNasal(toks);
    vocalizeR(toks);
    reduceFinalA(toks);
    return toks.map((t) => t.ph).join("");
}

// A word (Bavarian Latin letters incl. å ä ö ü é ß + accents) / number / punctuation token. ⟨ß⟩ is part of the
// de-facto Bavarian-Wikipedia orthography this engine reads (dreißg), so it must not split a word.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zåäöüéèáàâßA-ZÅÄÖÜÉÈÁÀÂ'-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class BavarianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // Numbers: the units-first compositor (numbers.ts) → each word back through the same g2p.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Bavarian phonemizer (grapheme g2p + falling diphthongs + German-style rules; length/quality folded). */
export function createBavarian(): Phonemizer {
    return new BavarianPhonemizer();
}
