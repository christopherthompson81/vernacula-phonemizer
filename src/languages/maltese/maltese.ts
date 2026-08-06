/**
 * Maltese (mt) phonemizer — Malti, the only Semitic language in the Latin alphabet, canonical IPA,
 * Maltese orthography is fairly phonemic, so this is a greedy grapheme scan (the ⟨ie għ⟩
 * digraphs + the silent-letter rules) + final devoicing + regressive voicing assimilation + ⟨n⟩→m before a labial.
 *   - ⟨q⟩→ʔ (glottal stop), ⟨ċ⟩→t͡ʃ, ⟨ġ⟩→d͡ʒ, ⟨ħ⟩→ħ, ⟨x⟩→ʃ, ⟨z⟩→t͡s vs ⟨ż⟩→z.
 *   - ⟨għ⟩ is SILENT (historically /ʕ ɣ/; it lengthens/pharyngealizes an adjacent vowel — folded).
 *   - ⟨h⟩ is SILENT word-medially (lengthens the adjacent vowel: deheb→dɛːp) but → [ħ] WORD-FINAL (fih→fiːħ).
 *   - ⟨ie⟩ → the long [ɪː] (folded to ɪ). Adjacent identical vowels (from a dropped silent ⟨h/għ⟩) collapse.
 * Vowel LENGTH (stress-conditioned, ~half the referee) + stress (unwritten) are folded/deferred.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { type MalteseNumbers, numberToWords, readDigits } from "./numbers.ts";

interface MalteseDef {
    graphemes: Record<string, string>;
    voicing: { devoice: Record<string, string>; voice: Record<string, string> };
    numbers: MalteseNumbers;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<MalteseDef>(import.meta.url, "maltese.jsonc");
const G = DEF.graphemes;
const DEVOICE = DEF.voicing.devoice;
const VOICE = DEF.voicing.voice;
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;
const VOWELS = new Set([..."aɛɪɔu"]);
const VOICELESS = new Set([...Object.values(DEVOICE), "t͡s", "ʃ", "ħ", "ʔ", "f", "k", "p", "t", "s"]);

/** Scan a lowercased Maltese word into IPA phoneme tokens (digraphs ⟨ie għ⟩ + the ⟨h⟩ silent/[ħ] rule). */
function scan(word: string): string[] {
    const w = [...word.toLowerCase()];
    const toks: string[] = [];
    for (let i = 0; i < w.length; i++) {
        const c = w[i]!, two = c + (w[i + 1] ?? "");
        if (two === "għ") { if (i + 2 >= w.length) toks.push("ħ"); i += 1; continue; } // ⟨għ⟩: [ħ] word-final (biegħ→bɪːħ), else silent
        if (two === "ie") { toks.push("ɪ"); i += 1; continue; } // ⟨ie⟩ → long [ɪː] (ː folded)
        if (c === "h") { if (i === w.length - 1) toks.push("ħ"); continue; } // ⟨h⟩: [ħ] word-final, else silent
        const ph = G[c];
        if (ph !== undefined) toks.push(ph);
    }
    return toks;
}

/** Collapse two adjacent identical vowels (from a dropped silent ⟨h/għ⟩) into one — deheb→dɛ(h)ɛb → dɛb (the long
 *  vowel is folded): Maltese does not write geminate short vowels, so an adjacent pair is a silent-letter artifact. */
function collapseVowels(toks: string[]): void {
    for (let i = toks.length - 1; i > 0; i--) {
        if (toks[i] === toks[i - 1] && VOWELS.has(toks[i]!)) toks.splice(i, 1);
    }
}

/** Word-final geminate DEGEMINATION: a doubled consonant collapses to a single word-finally (Ħadd→ħat, att→at) —
 *  but a MEDIAL geminate is kept (attard→attart, qattus→ʔattus). */
function degeminateFinal(toks: string[]): void {
    const n = toks.length;
    if (n >= 2 && toks[n - 1] === toks[n - 2] && !VOWELS.has(toks[n - 1]!)) toks.pop();
}

// A geminated AFFRICATE surfaces as its STOP + the affricate (⟨ġġ⟩→[dd͡ʒ], ⟨ċċ⟩→[tt͡ʃ], ⟨zz⟩→[tt͡s]).
const AFFRICATE_STOP: Record<string, string> = { "d͡ʒ": "d", "t͡ʃ": "t", "t͡s": "t" };
/** Affricate gemination: two adjacent identical affricates → stop + affricate (mweġġa'→mwɛdd͡ʒa). */
function geminateAffricate(toks: string[]): void {
    for (let i = 0; i < toks.length - 1; i++) {
        if (toks[i]! in AFFRICATE_STOP && toks[i] === toks[i + 1]) toks[i] = AFFRICATE_STOP[toks[i]!]!;
    }
}

/** ⟨n⟩ → m before a labial (b/p/m): ġenb→d͡ʒɛmp. */
function labialNasal(toks: string[]): void {
    for (let i = 0; i < toks.length - 1; i++) {
        if (toks[i] === "n" && ["b", "p", "m"].includes(toks[i + 1]!)) toks[i] = "m";
    }
}

/** Regressive voicing assimilation over obstruent clusters + word-final devoicing (Attard→attart, ħobż→ħɔps). */
function applyVoicing(toks: string[]): void {
    const last = toks.length - 1;
    if (last >= 0 && toks[last]! in DEVOICE) toks[last] = DEVOICE[toks[last]!]!; // word-final devoicing
    for (let k = toks.length - 2; k >= 0; k--) {
        const b = toks[k]!, nb = toks[k + 1]!;
        if (b in DEVOICE && VOICELESS.has(nb)) toks[k] = DEVOICE[b]!; // devoice before a voiceless obstruent
        else if (b in VOICE && nb in DEVOICE) toks[k] = VOICE[b]!; // voice before a voiced obstruent
    }
}

/** Phonemize a single Maltese word to canonical IPA (segmental; length + stress folded/deferred). */
export function phonemizeWord(word: string): string {
    const toks = scan(word);
    collapseVowels(toks);
    degeminateFinal(toks);
    geminateAffricate(toks);
    labialNasal(toks);
    applyVoicing(toks);
    return toks.join("");
}

// A word (Maltese Latin letters incl. ċ ġ ħ ż) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls.
 *
 * ⚠ NOT QUITE VERBATIM: à ò À Ò were REMOVED, because the g2p has no rule for them and DROPPED them outright.
 * The old token class listed them anyway, and the word-level fold hid the mismatch — a word containing one was
 * rejected whole, so everything in it got folded and the letter came out readable by accident. Judging each
 * character on its own exposes the over-claim instead of masking it: `Thérèse` in Romanian read *ˈthrese*, the é
 * gone, because the class promised a rule that did not exist. NATIVE_CLASS is a claim about the G2P, and
 * `test/native-inventory.test.ts` now measures it rather than trusting it.
 */
const NATIVE_CLASS = "[a-zċġħżèìùA-ZĊĠĦŻÈÌÙ']";
const nat = makeNativiser(NATIVE_CLASS, "u");

class MaltesePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // ≤12 digits stays inside the attested range (< 10¹²); longer reads the raw digit string so the
                // Number() conversion can't lose precision or go exponential. See numbers.ts for the sources.
                const words = m[2].length <= 12 ? numberToWords(Number(m[2]), NUM) : readDigits(m[2], NUM);
                // "tnax-il" is one WORD whose hyphen the grapheme scan simply skips (→ ħdaxil), which is the
                // correct Maltese pronunciation of the linker; it is not a token boundary.
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Maltese phonemizer (grapheme g2p + silent-letter rules + devoicing; length/stress folded/deferred). */
export function createMaltese(): Phonemizer {
    return new MaltesePhonemizer();
}
