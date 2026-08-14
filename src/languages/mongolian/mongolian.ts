/**
 * Mongolian (mn) phonemizer — Standard Khalkha, canonical IPA. Cyrillic Khalkha is a DEEP
 * orthography: only the first-syllable vowel is realised full; a written non-initial SHORT vowel reduces to ə, or
 * deletes word-finally (Дани→tän, Сири→sir). Long vowels (doubled) and diphthongs stay full everywhere. On top of
 * the greedy g2p scan (g2p.ts) this module applies that reduction/deletion, final obstruent devoicing (в→f, г→k,
 * ж→t͡ʃ, з→t͡s), and final н→ŋ, then tokenizes words/numbers/punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments, type Seg } from "./g2p.ts";
import { numberToWords, spellDigits } from "./numbers.ts";
import { bichigToCyrillic, isBichig } from "./mongolBichig.ts";
import { normalizeMongolian } from "./normalize.ts";
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

/**
 * ⟨ї⟩ U+0457 IS ⟨ү⟩ — A LEGACY-CODEPAGE ARTEFACT, not a Ukrainian letter that wandered in.
 *
 * The pre-Unicode Mongolian Cyrillic fonts (and the Windows-1251 remaps that came with them) had no slot for
 * ⟨ү⟩ or ⟨ө⟩ and borrowed the Ukrainian/Church-Slavonic codepoints for them; text typed that way and pasted
 * into the wiki keeps the wrong codepoint. The corpus reads unambiguously: ⟨ї⟩ ×8 against ⟨ү⟩ ×2,703, and
 * every one of the eight is a word that exists with ⟨ү⟩ — `бїр` (бүр), `бїлэг` (бүлэг), `їр` (үр). It is
 * outside the letter tables, so the words read `pr`, `pɮeɡ`, `r` — a vowelless consonant string.
 *
 * ⟨ѳ⟩ U+0473 (fita) → ⟨ө⟩ is the OTHER HALF OF THE SAME PAIR, and it is ×0 in this artifact — it is included
 * because Bashkir's artifact carries exactly that substitution (⟨ѳ⟩ ×7 against ⟨ө⟩ ×1,323, `кѳньяғында`,
 * `һѳрѳлгән`) from the same font generation, and because fita is in no modern Cyrillic alphabet at all, so
 * there is no reading it could be taken from. Stated rather than left silent: unattested HERE, today.
 *
 * ⚠ NOT A REGISTRY-LEVEL CONFUSABLE FOLD. `foldCyrillicConfusables` maps LATIN look-alikes into Cyrillic; ⟨ї⟩
 * is a real Cyrillic letter of another language's alphabet, and folding it fleet-wide would corrupt Ukrainian,
 * where it is the letter ⟨ї⟩ /ji/. The claim is about MONGOLIAN text specifically, so it lives here.
 */
const LEGACY_CODEPAGE: Readonly<Record<string, string>> = { "ї": "ү", "ѳ": "ө" };
const LEGACY_RE = new RegExp(`[${Object.keys(LEGACY_CODEPAGE).join("")}]`, "gu");
const foldLegacyCodepage = (w: string): string => w.replace(LEGACY_RE, (c) => LEGACY_CODEPAGE[c]!);

/** One Mongolian word → canonical IPA. A word in the traditional Mongolian script (Mongol bichig) is transliterated
 *  to Cyrillic first (mongolBichig.ts) and then run through the same pipeline. */
export function phonemizeWord(word: string): string {
    if (isBichig(word)) word = bichigToCyrillic(word);
    const w = foldLegacyCodepage(word.toLowerCase());
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
        // NORMALIZATION FIRST — see normalize.ts. Every unit, sign, ordinal and initialism reading lives
        // there rather than in `core/normalizeSymbols.ts`: Mongolian glues a CASE SUFFIX to the percent sign
        // (`67%-ийг` → *хувийг*), which is trap 14 and which the tier's invariant strings cannot express.
        return assembleClauses(normalizeMongolian(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            // cardinal → words → IPA. ⚠ ABOVE 2^53 `numberToWords` RETURNS "" AND THE NUMBER USED TO VANISH:
            // the split produced one empty word and nothing was emitted, so the sentence scanned without its
            // numeral. Refusing to compose is right (the float has lost the low digits); the else was missing.
            else if (m[2]) {
                const composed = numberToWords(Number(m[2]));
                for (const wd of (composed === "" ? spellDigits(m[2]) : composed).split(" "))
                    sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Mongolian phonemizer (greedy Cyrillic g2p + deep-orthography reduction + final devoicing). */
export function createMongolian(): Phonemizer {
    return new MongolianPhonemizer();
}
