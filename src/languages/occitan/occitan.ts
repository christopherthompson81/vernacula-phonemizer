/**
 * Occitan (oc) phonemizer — occitan / lenga d'òc, Occitano-Romance (Gallo-Romance), Latin script, canonical IPA,
 * espeak-independent (beyond-espeak). Targets LANGUEDOCIEN (the central reference standard). A greedy longest-match
 * grapheme scan + code rules:
 *   - the signature vowels: unstressed ⟨o⟩→[u], final unstressed ⟨a⟩→[ɔ], ⟨u⟩→[y] ([w] as a diphthong offglide),
 *     ⟨ò⟩→[ɔ], ⟨è⟩→[ɛ];
 *   - ⟨c g⟩ softening before a front vowel (⟨c⟩→[s], ⟨g⟩→[d͡ʒ]), ⟨qu gu⟩→[k ɡ] (+[kw ɡw] before a back vowel);
 *   - ⟨lh⟩→[ʎ], ⟨nh⟩→[ɲ], ⟨ch⟩→[t͡ʃ], ⟨j⟩→[d͡ʒ], ⟨v⟩→[b] (betacism), ⟨h⟩ silent; intervocalic ⟨s⟩→[z];
 *   - the Languedocien FINAL-CONSONANT DELETION: a word-final ⟨n r⟩ after a vowel drops (Japon→dʒapu, cantar→kanta).
 * SPIRANTIZATION (intervocalic b/d/g→β/ð/ɣ), the rhotic tap/trill, and STRESS (unwritten, not emitted) are
 * folded/deferred. See docs/investigations/oc_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface OccitanDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<OccitanDef>(import.meta.url, "occitan.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
const VOWEL_LETTER = new Set([..."aeiouáéíóúàèòïü"]);
const FRONT_LETTER = new Set([..."eiéèíï"]); // ⟨c g qu gu⟩ soften before these
const VOWEL_PH = new Set([..."aeiɔouyɛ"]); // IPA vowel heads (intervocalic + final-consonant tests)

/** One scan token: the IPA phones for a grapheme + a flag marking a single ⟨s⟩ that may voice to [z] intervocalically. */
interface Tok { ph: string; sVar?: boolean }

/** Scan a lowercased Occitan word into phone tokens: digraphs, ⟨qu gu⟩, ⟨c g⟩ softening, ⟨u⟩→[w] offglide. */
function scan(word: string): Tok[] {
    const w = word.normalize("NFC").toLowerCase();
    const toks: Tok[] = [];
    let i = 0;
    outer: while (i < w.length) {
        const c = w[i]!, next = w[i + 1] ?? "";
        for (const key of ORDER) {
            if (w.startsWith(key, i)) { toks.push({ ph: DIGRAPHS[key]! }); i += key.length; continue outer; }
        }
        // ⟨qu gu⟩ → [k ɡ] before a front vowel, [kw ɡw] before a back vowel (the ⟨u⟩ is a glide, not [y]).
        if ((c === "q" || c === "g") && next === "u" && VOWEL_LETTER.has(w[i + 2] ?? "")) {
            const base = c === "q" ? "k" : "ɡ";
            toks.push({ ph: FRONT_LETTER.has(w[i + 2]!) ? base : base + "w" });
            i += 2;
            continue;
        }
        if (c === "c") { toks.push({ ph: FRONT_LETTER.has(next) ? "s" : "k" }); i += 1; continue; }
        if (c === "g") { toks.push({ ph: FRONT_LETTER.has(next) ? "d͡ʒ" : "ɡ" }); i += 1; continue; }
        if (c === "u") { // ⟨u⟩ → [w] only as a FALLING offglide (after a vowel: au/eu/èu); a plain ⟨u⟩ before a vowel
            // in hiatus is the nucleus [y] (afluent→aflyent), and the rising [w] after ⟨q g⟩ was consumed above.
            toks.push({ ph: VOWEL_LETTER.has(w[i - 1] ?? "") ? "w" : "y" });
            i += 1;
            continue;
        }
        // ⟨i⟩ → [j] before a vowel — but NOT before ⟨u⟩ (the falling diphthong [iw]: arriu→ariw, estiu→estiw).
        if (c === "i" && next !== "u" && VOWEL_LETTER.has(next)) { toks.push({ ph: "j" }); i += 1; continue; }
        const ph = G[c];
        if (ph !== undefined && ph !== "") toks.push({ ph, sVar: c === "s" });
        i += 1;
    }
    return toks;
}

function startsWithVowel(ph: string): boolean { return VOWEL_PH.has([...ph][0]!); }
function endsWithVowel(ph: string): boolean { const a = [...ph]; return VOWEL_PH.has(a[a.length - 1]!); }

const VOICELESS_PH = new Set([..."ptkfs"]); // + the affricates t͡ʃ t͡s (tested by their head [t])
/** Single ⟨s⟩ → [z] before a voiced sound (intervocalic Lisbona→lizbunɔ, or before a voiced consonant); ⟨ss⟩ (already
 *  [s]) and coda ⟨s⟩ before a voiceless sound stay [s]. */
function voiceS(toks: Tok[]): void {
    for (let i = 1; i < toks.length; i++) {
        const t = toks[i]!;
        if (!t.sVar || !endsWithVowel(toks[i - 1]!.ph)) continue;
        const next = toks[i + 1]?.ph;
        if (next !== undefined && !VOICELESS_PH.has([...next][0]!)) t.ph = "z";
    }
}

const DEVOICE: Record<string, string> = { b: "p", d: "t", ɡ: "k", z: "s", v: "f" };
/** Word-final obstruent DEVOICING (Nòrd→nɔɾt). */
function finalDevoice(toks: Tok[]): void {
    const last = toks[toks.length - 1];
    if (last && last.ph in DEVOICE) last.ph = DEVOICE[last.ph]!;
}

/** ⟨n⟩ → [ŋ] before a velar [k]/[ɡ] (Lengadòc→leŋɡ…, Navarrencs→…eŋk…). */
function velarNasal(toks: Tok[]): void {
    for (let i = 0; i < toks.length - 1; i++) {
        if (toks[i]!.ph === "n" && (toks[i + 1]!.ph === "k" || toks[i + 1]!.ph === "ɡ")) toks[i]!.ph = "ŋ";
    }
}

/** Final unstressed ⟨a⟩ → [ɔ] (Languedocien: França→fɾansɔ). Operates on the raw word's last letter. */
function finalA(word: string, toks: Tok[]): void {
    const w = word.normalize("NFC").toLowerCase();
    const last = toks[toks.length - 1];
    if (last && last.ph === "a" && w.endsWith("a")) last.ph = "ɔ";
}

/** Word-final ⟨n⟩ / ⟨r⟩ after a vowel DROPS — the Languedocien final-consonant deletion: the final-n (Japon→dʒapu,
 *  Perpinhan→peɾpiɲa) and the infinitive/polysyllable final-r (abandonar→abanduna, aborrir→abuɾi). */
function dropFinalNR(toks: Tok[]): void {
    const n = toks.length;
    if (n >= 2 && (toks[n - 1]!.ph === "n" || toks[n - 1]!.ph === "ɾ") && endsWithVowel(toks[n - 2]!.ph)) toks.pop();
}

/** Phonemize a single Occitan word to canonical IPA (segmental; spirantization + stress folded/deferred). */
export function phonemizeWord(word: string): string {
    const toks = scan(word);
    voiceS(toks);
    velarNasal(toks);
    dropFinalNR(toks);
    finalA(word, toks);
    finalDevoice(toks);
    return toks.map((t) => t.ph).join("");
}

// A word (Occitan Latin letters incl. the accents + ç) / number / punctuation token.
const TOKEN = /([a-zàèòáéíóúïüçA-ZÀÈÒÁÉÍÓÚÏÜÇ'·-]+)|(\d+)|([.!?…,;:])/gu;

class OccitanPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            // A digit run reads as Occitan number WORDS, each phonemized like any other word.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Occitan phonemizer (Languedocien grapheme g2p + o→u + final-a→ɔ; spirantization/stress folded). */
export function createOccitan(): Phonemizer {
    return new OccitanPhonemizer();
}
