/**
 * Irish Gaelic (ga) phonemizer — Standard/Connacht-leaning, canonical IPA, espeak-independent. Rule-based g2p
 * (g2p.ts, the broad/slender axis) + first-syllable stress (the native default) + i-offglide and svarabhakti
 * passes, with a Connacht pronunciation lexicon (lexicon.tsv, Run 3) pinning the semi-lexical vowel detail the
 * rules defer (io/oi/eo splits). Lexicon first, g2p for OOV. See docs/ga_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { type Seg, toSegments } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

// Connacht pronunciation lexicon (Run 3): oracle-distilled, consonant+glide-skeleton-verified overrides that pin
// the semi-lexical vowel-QUALITY detail the rules defer (io/oi/eo splits). Consulted before the g2p; OOV words
// fall through to the rules. Lazily loaded (like french/swedish) so merely importing this module — e.g. from the
// referee eval to score another language — does not parse the whole TSV. See lexicon.tsv.
let LEXICON: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
    if (LEXICON === undefined) LEXICON = loadTsvMap(import.meta.url, "lexicon.tsv");
    return LEXICON;
}

// Short vowels reduce to ə when unstressed; long vowels + diphthongs (with ː) keep their quality. ɪ IS reduced:
// the independent wikipron referee transcribes unstressed short i as ə (féidir → fʲeːdʲəɾʲ, milis → mʲɪlʲəʃ),
// NOT the oracle's ɪ — espeak keeps the underlying i, but real Connacht centralizes it like a/o/u.
const SHORT = new Set(["a", "ɛ", "ɪ", "ɔ", "ʊ"]);

// A slender consonant (palatalized, or a palatal). A back vowel before a slender CODA gets an i-offglide.
const isSlenderC = (ph: string): boolean => ph.endsWith("ʲ") || ph === "c" || ph === "ɟ" || ph === "ʃ" || ph === "ç";
const BACK_V = new Set(["ɑː", "oː"]); // LONG back vowels only (áit, cóir); short a is inconsistent (gairm has none)
// /r/ or /l/ (broad or slender) triggers svarabhakti before a labial/velar/palatal consonant.
const LIQUID = new Set(["ɾˠ", "ɾʲ", "l̪ˠ", "lʲ"]);
const SVARABHAKTI_NEXT = new Set(["mˠ", "mʲ", "bˠ", "bʲ", "vˠ", "vʲ", "w", "ɡ", "ɟ", "x", "ç", "ɣ", "j", "n̪ˠ", "nʲ"]);

/** Long back vowel + a following slender consonant → insert an i-offglide ⁱ, whether that consonant is a coda
 *  (áit → ɑːⁱtʲ, cóir → oːⁱɾʲ) or an onset of the next syllable (óige → oːⁱɟə, áirithe → ɑːⁱɾʲə). A short back
 *  vowel (baile → balʲə), an ⟨eo⟩-derived oː (ceoil), or uː/iː/eː gets none. */
function offglide(segs: Seg[]): void {
    for (let i = segs.length - 1; i >= 1; i--) {
        const c = segs[i]!, prev = segs[i - 1]!;
        if (c.nucleus || !prev.nucleus) continue;
        if (isSlenderC(c.ph) && BACK_V.has(prev.ph) && !prev.noGlide) segs.splice(i, 0, { ph: "ⁱ", nucleus: false });
    }
}

/** Svarabhakti (epenthesis): a schwa between /r l/ and a following labial/velar/palatal (gorm → ɡɔɾˠəmˠ,
 *  bolg → bˠɔl̪ˠəɡ). /n/ does not trigger it (ainm → ˈanʲmˠ). */
function epenthesis(segs: Seg[]): void {
    for (let i = segs.length - 2; i >= 0; i--) {
        const coda = i + 2 >= segs.length || !segs[i + 2]!.nucleus; // the 2nd consonant must be a coda (bolg, not Gaeilge)
        if (coda && LIQUID.has(segs[i]!.ph) && SVARABHAKTI_NEXT.has(segs[i + 1]!.ph))
            segs.splice(i + 1, 0, { ph: "ə", nucleus: false });
    }
}

/** Native ⟨ng⟩ → ŋ (long → l̪ˠɔŋ), the word-final ɡ absorbed. Only before ɡ — not ⟨nc⟩, which stays n̪ˠk in the
 *  loanwords that have it (banc → bˠan̪ˠk). */
function nasalAssim(segs: { ph: string; nucleus: boolean }[]): void {
    for (let i = 0; i < segs.length - 1; i++)
        if ((segs[i]!.ph === "n̪ˠ" || segs[i]!.ph === "nʲ") && segs[i + 1]!.ph === "ɡ")
            segs[i]!.ph = "ŋ";
    const L = segs.length;
    if (L >= 2 && segs[L - 1]!.ph === "ɡ" && segs[L - 2]!.ph === "ŋ") segs.pop();
}

/** One Irish word → canonical IPA. Stress the first nucleus (native default; marked even on monosyllables);
 *  every OTHER short-vowel nucleus reduces to ə (unstressed reduction, e.g. madra → mˠˈad̪ˠɾˠə). */
export function phonemizeWord(word: string): string {
    const hit = lexicon().get(word.toLowerCase()); // Connacht lexicon override (semi-lexical vowel detail)
    return hit !== undefined ? hit : g2pWord(word);
}

/** The pure rule-based g2p (no lexicon) — the OOV path, and the reference the lexicon build compares against. */
export function g2pWord(word: string): string {
    const segs = toSegments(word.replace(/['’\-]/g, "")); // strip elision/prothesis apostrophes + hyphens
    if (segs.length === 0) return "";
    nasalAssim(segs);
    epenthesis(segs); // svarabhakti schwa (gorm → ɡɔɾˠəmˠ)
    offglide(segs); // i-offglide before a slender coda (áit → ɑːⁱtʲ)
    const nucleiIdx = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nucleiIdx.length === 0) return segs.map((s) => s.ph).join("");
    const stress = nucleiIdx[0]!;
    for (const idx of nucleiIdx) if (idx !== stress && SHORT.has(segs[idx]!.ph)) segs[idx]!.ph = "ə";
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([a-záéíóúA-ZÁÉÍÓÚ]+(?:['’-][a-záéíóúA-ZÁÉÍÓÚ]+)*)|(\d+)|([.!?…,;:])/gu;

class IrishPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Irish phonemizer (rule-based; the broad/slender axis is the core). */
export function createIrish(): Phonemizer {
    return new IrishPhonemizer();
}
