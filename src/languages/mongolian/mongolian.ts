/**
 * Mongolian (mn) phonemizer — Standard Khalkha, canonical IPA, espeak-independent. Cyrillic Khalkha is a DEEP
 * orthography: only the first-syllable vowel is realised full; a written non-initial SHORT vowel reduces to ə, or
 * deletes word-finally (Дани→tän, Сири→sir). Long vowels (doubled) and diphthongs stay full everywhere. On top of
 * the greedy g2p scan (g2p.ts) this module applies that reduction/deletion, final obstruent devoicing (в→f, г→k,
 * ж→t͡ʃ, з→t͡s), and final н→ŋ, then tokenizes words/numbers/punctuation. See docs/investigations/mn_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { bichigToCyrillic, isBichig } from "./mongolBichig.ts";
import { MANIFEST } from "./manifest.ts";

// Word-final obstruent devoicing: only в→f (Женев→dʒɛnɛf). Final г stays voiced (хаг→xaɡ, хурга→xʊrəɢ).
const DEVOICE: Record<string, string> = { w: "f" };
// A non-initial SHORT vowel reduces to a quality that keeps the ORIGINAL letter's rounding (судар а→ə, but Орос о→ʊ,
// Төвөд ө→ɵ). Unround → ə, back-round → ʊ, front-round → ɵ/u.
const REDUCED_OF: Record<string, string> = { a: "ə", e: "ə", i: "ə", æ: "ə", ɔ: "ʊ", ʊ: "ʊ", o: "ʊ", ɵ: "ɵ", œ: "ɵ", u: "u" };
const isCons = (s: Seg | undefined): boolean => s !== undefined && !s.nucleus;

/** Apply the deep-orthography vowel reduction: keep the first nucleus full; a non-initial non-final SHORT vowel
 *  reduces (quality by the original letter's rounding); a word-final short vowel DELETES (Дани→tän, хаана→xaːn). If
 *  deleting a final vowel leaves a final consonant CLUSTER, an epenthetic reduced vowel breaks it (хурга→xʊrəɢ). Long
 *  vowels / diphthongs stay full. */
function reduce(segs: Seg[], initialFull = true, keepNonFinal = false): Seg[] {
    let seen = !initialFull; // a bound morpheme (a -suffix entry) has NO full first vowel — everything reduces
    const out: Seg[] = [];
    let epenthesis: string | null = null; // reduced quality of a deleted final vowel, to break a resulting cluster
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        if (!s.nucleus) { out.push(s); continue; }
        if (!seen) { seen = true; out.push(s); continue; } // first vowel is full
        if (!s.short) { out.push(s); continue; } // long vowel / diphthong stays full
        const reduced = REDUCED_OF[s.ph] ?? "ə";
        if (i === segs.length - 1) { epenthesis = reduced; continue; } // word-final short vowel → delete
        // A mixed-harmony (loanword) word keeps its non-final vowels FULL — reduction is a native-word process.
        out.push(keepNonFinal ? s : { ph: reduced, nucleus: true, short: true });
    }
    // Epenthesis: a deleted final vowel that leaves a final consonant cluster surfaces as a reduced vowel inside it.
    if (epenthesis && out.length >= 2 && isCons(out[out.length - 1]) && isCons(out[out.length - 2])) {
        out.splice(out.length - 1, 0, { ph: epenthesis, nucleus: true, short: true });
    }
    return out;
}

/** One Mongolian word → canonical IPA. A word in the traditional Mongolian script (Mongol bichig) is transliterated
 *  to Cyrillic first (mongolBichig.ts) and then run through the same pipeline. */
export function phonemizeWord(word: string): string {
    if (isBichig(word)) word = bichigToCyrillic(word);
    const w = word.toLowerCase();
    const raw = toSegments(w);
    if (!raw.some((s) => s.nucleus)) return raw.map((s) => s.ph).join(""); // vowelless (a letter name) — no rules
    // Final н → ŋ keyed on the ORIGINAL spelling (before vowel deletion): н that is word-final or before a velar/
    // uvular → ŋ (заан→tsaːŋ), but н still followed by a (to-be-deleted) vowel stays n (хаана→xaːn).
    for (let i = 0; i < raw.length; i++) {
        if (raw[i]!.ph !== "n") continue;
        const next = raw[i + 1]?.ph;
        if (next === undefined || /^[ɡɢkxχq]/u.test(next)) raw[i]!.ph = "ŋ";
    }
    const bound = /^[-­]/u.test(word); // a -suffix entry (hyphen / soft-hyphen): its leading vowel is non-initial
    // A word mixing BACK (а/о/у/я/ё/ю) and FRONT (э/ө/ү/е) vowels violates Mongolian vowel harmony → it is a loanword
    // (Герман, Австри), whose non-initial vowels stay FULL rather than reducing. (и/ы are neutral.)
    const loan = /[аоуяёю]/u.test(w) && /[эөүе]/u.test(w);
    let segs = reduce(raw, !bound, loan);
    // Final obstruent devoicing on the last segment — but NOT when the written word ends in ь (the soft sign was
    // dropped, so the obstruent isn't truly final: Говь → ɢow, not ɢof).
    const last = segs[segs.length - 1];
    if (last && DEVOICE[last.ph] && !w.endsWith("ь")) last.ph = DEVOICE[last.ph]!;
    return segs.map((s) => s.ph).join("");
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN = /([Ѐ-ӿᠠ-ᡂ᠋-᠎‌‍ ]+)|(\d+)|([.!?…,;:])/gu;

class MongolianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd)); // cardinal → words → IPA
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Mongolian phonemizer (greedy Cyrillic g2p + deep-orthography reduction + final devoicing). */
export function createMongolian(): Phonemizer {
    return new MongolianPhonemizer();
}
