/**
 * Faroese (fo) phonemizer — a greedy grapheme scan whose CORE rule is that vowel LENGTH conditions vowel
 * QUALITY, canonical IPA. This file owns the machinery: the open/closed length computation on the
 * stressed vowel, the SKERPING application sites, and the consonant passes (ð/g deletion with glide
 * choice, g/k affrication, retroflex r-clusters, ll→tl, v-vocalization, hv/hj). The grapheme values,
 * skerping remaps and the encyclopedic record live in faroese.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface FaroeseDef {
    vowels: Record<string, [string, string]>;
    consonants: Record<string, string>;
    skerping: Record<string, string>;
    skerpingGgj: Record<string, string>;
    prenasal: Record<string, string>;
}
const DEF = loadManifest<FaroeseDef>(import.meta.url, "faroese.jsonc");
// Vowel graphemes → [long, short] IPA quality (faroese.jsonc). Digraphs ⟨ei ey oy⟩ scan first (longest-match).
const VOWEL = DEF.vowels;
// Round vs front vowel GRAPHEMES — decide the glide that an intervocalic ⟨g ð⟩ becomes ([v] near round, [j] near
// front, deleted near ⟨a á⟩).
const ROUND_V = new Set([..."ouóúø"]);
const GLIDE_FRONT_V = new Set([..."eiyíýæ"]);
const VOWEL_KEYS = Object.keys(VOWEL).sort((a, b) => b.length - a.length); // digraphs first
const CONS = DEF.consonants;
// Front vowel GRAPHEMES that affricate a preceding ⟨g k⟩ → [t͡ʃ] (argi→aɹt͡ʃɪ). NOT ⟨ø⟩ — gøta→[køːta], not
// [t͡ʃøːta] (the front-rounded ⟨ø⟩ does not palatalize the velar).
const FRONT_V = new Set([..."eiyíýæ"]);
// SKERPING vowel remap before ⟨gv⟩ / ⟨ggj⟩, and the pre-nasal shift before ⟨ng nk⟩ (faroese.jsonc).
const SKERP = DEF.skerping;
const SKERP_GGJ = DEF.skerpingGgj;
const PRENASAL = DEF.prenasal;

interface Seg { g: string; ph: string; vowel: boolean; stressed: boolean; long: boolean }

/** Scan a lowercased Faroese word into vowel/consonant segments (greedy, vowel digraphs first). */
function scan(word: string): Seg[] {
    const w = word.normalize("NFC").toLowerCase();
    const segs: Seg[] = [];
    let i = 0;
    outer: while (i < w.length) {
        for (const k of VOWEL_KEYS) {
            if (w.startsWith(k, i)) {
                segs.push({ g: k, ph: "", vowel: true, stressed: false, long: false });
                i += k.length;
                continue outer;
            }
        }
        const c = w[i]!;
        segs.push({ g: c, ph: CONS[c] ?? "", vowel: false, stressed: false, long: false });
        i += 1;
    }
    return segs;
}

/** One Faroese word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const segs = scan(word);
    // Stress = the first vowel (Faroese has fixed initial stress, modulo a few unstressed prefixes we ignore for now).
    const firstV = segs.findIndex((s) => s.vowel);
    if (firstV >= 0) {
        segs[firstV]!.stressed = true;
        // LENGTH: count consonant segments between the stressed vowel and the next vowel (or word end). Long if ≤1
        // (open syllable), short if ≥2 (closed). A word-final stressed vowel (no following consonant) is long.
        let nCons = 0;
        for (let k = firstV + 1; k < segs.length; k++) {
            if (segs[k]!.vowel) break;
            if (segs[k]!.g === "ð") continue; // ⟨ð⟩ is silent → doesn't close the syllable (Urð→uːɹ, long)
            nCons++;
        }
        segs[firstV]!.long = nCons <= 1;
    }
    // Assign vowel qualities: the stressed vowel by its length; every other vowel takes the SHORT quality (unstressed).
    for (const s of segs) {
        if (!s.vowel) continue;
        const pair = VOWEL[s.g]!;
        s.ph = s.stressed && s.long ? pair[0] : pair[1];
    }
    // ⚠ SKERPING (skerping/"sharpening"): a vowel before ⟨gv⟩ raises/shortens — ó→[ɛ], ú→[ɪ], í ý→[ʊi] (dúgva→tɪkva,
    // ógv→ɛkv); the ⟨g⟩ stays [k]. A hallmark of the deep orthography.
    for (let k = 0; k < segs.length - 2; k++) {
        const v = segs[k]!;
        if (!v.vowel) continue;
        const g1 = segs[k + 1]!.g, g2 = segs[k + 2]!.g;
        if (g1 === "g" && g2 === "v") v.ph = SKERP[v.g] ?? v.ph; // ⟨gv⟩
        else if (g1 === "g" && g2 === "g") v.ph = SKERP_GGJ[v.g] ?? v.ph; // ⟨ggj⟩ (í/ý drop the offglide → [ʊ])
    }
    consonantPasses(segs);
    nasalPass(segs);
    return segs.map((s) => s.ph).filter((p) => p !== "").join("");
}

const isV = (s: Seg | undefined): boolean => s !== undefined && s.vowel;

// Vowel graphemes (incl. digraphs) that make a neighbouring intervocalic ⟨g ð⟩ a FRONT glide [j] vs a ROUND glide
// [v]. A front (i-type) neighbour WINS over a round one (Eyður→ɛiːjʊɹ: ey[front]+u[round]→j). ⟨e⟩ and ⟨a⟩ are
// NEUTRAL — they defer to the OTHER neighbour (vegur: e + u → the round u wins → [v], but Bogi: o + i → the front
// i wins → [j]).
const FRONT_GLIDE = new Set(["i", "y", "í", "ý", "æ", "ei", "ey", "oy"]);
const ROUND_GLIDE = new Set(["o", "u", "ó", "ú", "ø", "á"]);
/** The glide an intervocalic ⟨g ð⟩ becomes, decided by the surrounding vowels: [j] if EITHER neighbour is front
 *  (Bogi→poːjɪ, Eyður→ɛiːjʊɹ), else [v] if either is round (dagur→tɛaːvʊɹ, bága→pɔːwa), else deleted (agað→ɛaːa). */
function gdGlide(prev: Seg | undefined, next: Seg | undefined): string {
    const near = [prev, next].filter((s): s is Seg => s !== undefined && s.vowel);
    if (near.some((s) => FRONT_GLIDE.has(s.g))) return "j";
    if (near.some((s) => ROUND_GLIDE.has(s.g))) return "v";
    return ""; // between ⟨a⟩ (or otherwise) → silent
}

/** The context-sensitive consonant rules, applied left-to-right over the scanned segments. */
function consonantPasses(segs: Seg[]): void {
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        if (s.vowel) continue;
        const g = s.g;
        const prev = segs[i - 1];
        const next = segs[i + 1];
        // GEMINATE collapse: a doubled consonant → a single phone (the length is folded). ⟨ll⟩ is special (→[tl]).
        // The two segments were KEPT through the length count (so a geminate correctly closes the syllable), and
        // are collapsed here.
        if (next && next.g === g && !s.vowel) {
            if (g === "l") { s.ph = "t"; next.ph = "l"; continue; } // ⟨ll⟩ → [tl] (allur→atlʊɹ)
            // ⟨gg kk⟩ before a front vowel / ⟨j⟩ → the affricate [t͡ʃ] (eggja→ɛt͡ʃa, ikki→ɪt͡ʃa).
            const after = segs[i + 2];
            if ((g === "g" || g === "k") && after && (after.vowel ? FRONT_V.has(after.g) : after.g === "j")) {
                s.ph = "t͡ʃ"; next.ph = ""; next.g = ""; if (after.g === "j") { after.ph = ""; after.g = ""; }
                continue;
            }
            s.ph = CONS[g] ?? s.ph; next.ph = ""; next.g = ""; continue; // bb/dd/gg/pp/tt/kk/nn/… → single
        }
        // ⟨hv⟩ → [kv]; ⟨hj⟩ → [j] (the [j] comes from the ⟨j⟩); a plain ⟨h⟩ stays [h].
        if (g === "h" && next && next.g === "v") { s.ph = "k"; continue; }
        if (g === "h" && next && next.g === "j") { s.ph = ""; continue; }
        // Consonant + ⟨j⟩ palatal digraphs: ⟨tj⟩→[t͡ʃ] (tjóðra→t͡ʃ…), ⟨dj⟩→[d͡ʒ], ⟨sj⟩→[ʃ] — the ⟨j⟩ is absorbed.
        if (next && next.g === "j" && (g === "t" || g === "d" || g === "s")) {
            s.ph = g === "t" ? "t͡ʃ" : g === "d" ? "d͡ʒ" : "ʃ";
            next.ph = ""; next.g = ""; continue;
        }
        // ⟨g k⟩ → the affricate [t͡ʃ] before a FRONT vowel — but an INTERVOCALIC ⟨g⟩ is the glide instead (Bogi→poːjɪ,
        // not poːt͡ʃɪ). So: onset/post-consonant ⟨g k⟩ + front → [t͡ʃ]; intervocalic ⟨g⟩ → glide (handled next).
        if ((g === "g" || g === "k") && !(g === "g" && isV(prev) && isV(next))) {
            const fv = next && (next.vowel ? FRONT_V.has(next.g) : next.g === "j");
            if (fv) { s.ph = "t͡ʃ"; if (next && next.g === "j") next.ph = ""; continue; }
        }
        // Intervocalic ⟨ð⟩ / ⟨g⟩ → the [j]/[v]/∅ glide by the surrounding vowels (aðal→ɛaːal, Eyður→ɛiːjʊɹ,
        // dagur→tɛaːvʊɹ, Bogi→poːjɪ). Word-final / pre-consonantal ⟨ð⟩ is silent.
        if (g === "ð") { s.ph = isV(prev) && isV(next) ? gdGlide(prev, next) : ""; continue; }
        if (g === "g" && isV(prev) && isV(next)) { s.ph = gdGlide(prev, next); continue; }
        // ⟨v⟩ → [u] before a consonant (forms a diphthong: avgera→au…, avtala→au…); [v] intervocalic / onset.
        if (g === "v" && isV(prev) && next && !next.vowel) { s.ph = "u"; continue; }
        // Retroflex r-clusters: ⟨r⟩ + coronal → retroflex, and the coronal retroflexes too (ahorn→ahɔɻɳ).
        if (g === "r" && next) {
            const RETRO: Record<string, string> = { n: "ɳ", t: "ʈ", d: "ɖ", s: "ʂ", l: "ɭ" };
            if (RETRO[next.g] !== undefined) { s.ph = "ɻ"; next.ph = RETRO[next.g]!; continue; }
            s.ph = "ɹ"; continue; // a plain ⟨r⟩ → [ɹ]
        }
        if (g === "r") { s.ph = "ɹ"; continue; }
        // Word-final unstressed ⟨-um⟩ → [ʊn]: the inflectional dative-plural / -um ending (fílum→fʊiːlʊn,
        // -unum). Gated on ⟨u⟩ so a loan -am/-om keeps [m] (Adam→ɛaːtam); a stressed final ⟨m⟩ stays [m] (heim).
        if (g === "m" && i === segs.length - 1 && prev && prev.g === "u" && !prev.stressed) { s.ph = "n"; continue; }
    }
}

/** ⟨ng nk⟩: ⟨n⟩ → [ŋ] before a velar [k], → [ɲ] before the palatal affricate [t͡ʃ] (gangi→kɛɲt͡ʃɪ); the preceding
 *  short vowel shifts (a→[ɛ]). Runs on the emitted phones (after affrication). */
function nasalPass(segs: Seg[]): void {
    for (let i = 0; i < segs.length - 1; i++) {
        if (segs[i]!.ph !== "n") continue;
        const nph = segs[i + 1]!.ph;
        if (nph === "k" || nph === "t͡ʃ") {
            segs[i]!.ph = nph === "t͡ʃ" ? "ɲ" : "ŋ";
            const prev = segs[i - 1];
            if (prev && prev.vowel && PRENASAL[prev.g] !== undefined) prev.ph = PRENASAL[prev.g]!;
        }
    }
}

// A word (Faroese Latin letters incl. á í ó ú ý æ ø ð) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-záíóúýæøðþA-ZÁÍÓÚÝÆØÐÞ'-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class FaroesePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // Numbers: the units-first compositor (numbers.ts) → each word back through the same g2p.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Faroese phonemizer (length-conditioned vowel quality + the deep-orthography consonant rules). */
export function createFaroese(): Phonemizer {
    return new FaroesePhonemizer();
}
