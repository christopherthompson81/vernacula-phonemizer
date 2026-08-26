/**
 * Occitan (oc) phonemizer — occitan / lenga d'òc, Occitano-Romance (Gallo-Romance), Latin script, canonical
 * IPA. Targets LANGUEDOCIEN (the central reference standard). A greedy longest-match
 * grapheme scan + code rules:
 *   - the signature vowels: unstressed ⟨o⟩→[u], final unstressed ⟨a⟩→[ɔ], ⟨u⟩→[y] ([w] as a diphthong offglide),
 *     ⟨ò⟩→[ɔ], ⟨è⟩→[ɛ];
 *   - ⟨c g⟩ softening before a front vowel (⟨c⟩→[s], ⟨g⟩→[d͡ʒ]), ⟨qu gu⟩→[k ɡ] (+[kw ɡw] before a back vowel);
 *   - ⟨lh⟩→[ʎ], ⟨nh⟩→[ɲ], ⟨ch⟩→[t͡ʃ], ⟨j⟩→[d͡ʒ], ⟨v⟩→[b] (betacism), ⟨h⟩ silent; intervocalic ⟨s⟩→[z];
 *   - the Languedocien FINAL-CONSONANT DELETION: a word-final ⟨n r⟩ after a vowel drops (Japon→dʒapu, cantar→kanta).
 * SPIRANTIZATION (intervocalic b/d/g→β/ð/ɣ), the rhotic tap/trill, and STRESS (unwritten, not emitted) are
 * folded/deferred.
 */
import type { Phonemizer } from "../../registry.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";
import { numberToWords } from "./numbers.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeOccitan } from "./normalize.ts";

interface OccitanDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    voicelessPhones: readonly string[];
    vowelLetters: readonly string[];
    frontLetters: readonly string[];
    /** The name of the DECIMAL COMMA, between the integer and fractional parts. */
    decimalWord: string;
    /** The shared symbol tier's data — moved verbatim, comments included. See the jsonc. */
    symbolTier: {
        percent: CountForms;
        currency: Record<string, CountForms>;
        units: Record<string, CountForms>;
        magnitudes: string[];
        ampersand: string;
        exponentWords: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
    };
}
const DEF = loadManifest<OccitanDef>(import.meta.url, "occitan.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
// Letter environments (occitan.jsonc): ⟨c g qu gu⟩ soften before a FRONT letter.
const VOWEL_LETTER = new Set(DEF.vowelLetters);
const FRONT_LETTER = new Set(DEF.frontLetters);
const VOWEL_PH = IPA_VOWEL; // IPA vowel heads (intervocalic + final-consonant tests)

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

const VOICELESS_PH = new Set(DEF.voicelessPhones); // + the affricates t͡ʃ t͡s (tested by their head [t])
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
/**
 * The shared SYMBOL tier. Every word is an oc.wikipedia TOKEN attestation whose examples were read:
 * `sègle` ×182, `per` ×123, `oras` ×107, `Crist` ×98, `mètre` ×83, `èuro` ×80, `Celsius` ×73,
 * `quilograma` ×72, `cubic` ×36, `cent` ×36, `virgula` ×36, `quilomètre` ×25, `graus` ×17.
 *
 * ⚠ `gras` SCORES ×156 AND IS NOT USED. It is the homograph meaning "fat" — the Fula `tere` shape, for
 * the sixth time in this sweep. The degree word is `grau`/`graus`, the attested plural and its
 * transparent singular.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: DEF.symbolTier.percent,
    currency: DEF.symbolTier.currency,
    units: DEF.symbolTier.units,
    exponentWords: DEF.symbolTier.exponentWords,
    magnitudes: DEF.symbolTier.magnitudes,
    ampersand: DEF.symbolTier.ampersand,
});

// ⚠ THE DECIMAL COMMA IS SPANNED BY THE NUMBER BRANCH, or the tokenizer's own `,` claims it as a clause
// pause and `13,1°C` reads as *tretze , un* — a phrase break inside a quantity. normalize.ts has already
// folded the dot decimals onto the comma, so one branch covers both. `decimals` is 8,826 corpus-wide.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'\u00b7-")})|(\\d+(?:,\\d+)?)|([.!?\u2026,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zàèòáéíóúïüçA-ZÀÈÒÁÉÍÓÚÏÜÇ'·-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class OccitanPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST — its separator, era, clock, sign and degree steps need the figure and its
        // mark still adjacent, which the tier would break — then the shared symbol tier.
        return assembleClauses(SYMBOLS(normalizeOccitan(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // A digit run reads as Occitan number WORDS, each phonemized like any other word.
            else if (m[2]) {
                const [intPart, frac] = m[2].split(",");
                for (const wd of numberToWords(Number(intPart), intPart).split(" ")) sink.emit(phonemizeWord(wd));
                if (frac !== undefined) {
                    // `virgula` ×36 on oc.wikipedia — the separator's own name, the same call every other
                    // layer in this sweep makes. The fractional part is read digit by digit.
                    sink.emit(phonemizeWord(DEF.decimalWord));
                    for (const dg of frac) for (const wd of numberToWords(Number(dg), dg).split(" ")) sink.emit(phonemizeWord(wd));
                }
            }
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
