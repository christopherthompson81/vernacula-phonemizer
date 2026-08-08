/**
 * Standard Turkmen (tk) phonemizer — Türkmençe, Oghuz Turkic, Latin script, canonical IPA. The
 * Near-phonemic (no digraphs — one sound per letter), so a direct grapheme scan. The
 * HALLMARK is the INTERDENTAL fricatives ⟨s⟩→[θ] / ⟨z⟩→[ð] (shared with Bashkir). 9 vowels (⟨ä⟩→[æ], ⟨ö⟩→[ø],
 * ⟨ü⟩→[y], ⟨y⟩→[ɯ]) + UNWRITTEN phonemic length (not emitted); ⟨ç⟩→t͡ʃ, ⟨j⟩→d͡ʒ, ⟨ž⟩→ʒ, ⟨ş⟩→ʃ, ⟨ň⟩→ŋ, ⟨ý⟩→j (the
 * glide), ⟨h⟩→x, ⟨w⟩→w, ⟨r⟩→ɾ. Word-final (oxytone) stress, the Turkic default.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";

interface TurkmenDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    numbers: NumbersDef; // units[0..9], tens{"10".."90"} (Turkic: 10 IS a tens entry), magnitudes{}
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<TurkmenDef>(import.meta.url, "turkmen.jsonc");
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const VOWEL = IPA_VOWEL;
const NASAL = new Set(["m", "n", "ŋ"]);

/** Sonority class (higher = more sonorous): vowel 6, glide 5, liquid 4, nasal 3, fricative 2, affricate 1, stop 0. */
function sonority(seg: string): number {
    if (VOWEL.has(seg)) return 6;
    if (seg === "j" || seg === "w") return 5;
    if (["l", "ɾ", "r"].includes(seg)) return 4;
    if (NASAL.has(seg)) return 3;
    if (seg.includes("͡")) return 1; // affricate (t͡ʃ d͡ʒ)
    if (["f", "v", "θ", "ð", "ʃ", "ʒ", "x", "χ", "h"].includes(seg)) return 2;
    return 0; // stop (p b t d k ɡ)
}

/** Phonemize one Turkmen word → canonical IPA: direct grapheme scan + word-final stress. */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const segs: string[] = [];
    let at0 = 0;
    for (const ch of w) {
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Reached only when every rule above has declined, so the language's own reading always wins.
        const ph = G[ch] ?? latinPhone(ch, { initial: at0 === 0, includeH: true });
        at0 += 1;
        if (ph !== undefined) segs.push(ph);
    }
    // Word-final (oxytone) stress — the Turkic default: ˈ before the MAXIMAL onset of the last vowel's syllable.
    // Native Turkmen has no onset clusters; loanwords do (plan, sport→θp, klub), so back up over the whole onset by
    // sonority sequencing (rising toward the vowel) + fricative-initial (θp, θt) and nasal-initial clusters.
    const vidx = segs.map((s, idx) => (VOWEL.has(s) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length) {
        const nucleus = vidx[vidx.length - 1]!;
        let at = nucleus;
        if (at > 0 && !VOWEL.has(segs[at - 1]!)) at--; // always include the immediate onset consonant
        while (at > 0 && !VOWEL.has(segs[at - 1]!)) {
            // extend only over a valid COMPLEX onset: obstruent + liquid/glide (pl, kr), fricative + stop (θp, θt),
            // or nasal + stop — NOT nasal/liquid + liquid/glide (those are a coda + the next onset).
            const p = segs[at - 1]!,
                l = segs[at]!;
            const obstruentLiquid = sonority(p) <= 2 && sonority(l) >= 4;
            const fricStop = sonority(p) === 2 && sonority(l) <= 1;
            const nasalStop = NASAL.has(p) && sonority(l) <= 1;
            if (!(obstruentLiquid || fricStop || nasalStop)) break;
            at--;
        }
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

/**
 * TURKMEN number composition (Oghuz Turkic, thousands-scaled decimal). Every round ten is its own lexeme (10 = on
 * sits in `tens`), and the parts are simply JUXTAPOSED with no connector: on bir (11), ýigrimi bäş (25),
 * ýüz ýigrimi bir (121). The multiplier "bir" is DROPPED before ýüz (100 = ýüz) but KEPT before müň and
 * million/milliard — the cited grammar's worked example is "bir müň dokuz ýüz togsan iki" (1992), the same
 * asymmetry Kazakh shows (жүз vs бір мың). Data + provenance: turkmen.jsonc `numbers`.
 */
function turkmenNumberWords(n: number, d: NumbersDef): (string | null)[] {
    if (n < 10) return [d.units[n]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10,
            u = n % 10;
        return [d.tens[String(t)]!, ...(u ? [d.units[u]!] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return [...(h > 1 ? [d.units[h]!] : []), d.magnitudes.hundred, ...(r ? turkmenNumberWords(r, d) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return [...turkmenNumberWords(th, d), d.magnitudes.thousand, ...(r ? turkmenNumberWords(r, d) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000),
            r = n % 1_000_000;
        return [...turkmenNumberWords(m, d), d.magnitudes.million!, ...(r ? turkmenNumberWords(r, d) : [])];
    }
    const b = Math.floor(n / 1_000_000_000),
        r = n % 1_000_000_000;
    return [...turkmenNumberWords(b, d), d.magnitudes.billion!, ...(r ? turkmenNumberWords(r, d) : [])];
}

/** A digit run → spoken Turkmen, phonemized through the same grapheme scan. */
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, DEF.numbers, phonemizeWord, turkmenNumberWords);
}

// A word (Turkmen Latin letters incl. ä ç ž ň ö ş ü ý) / number / punctuation token.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zäçžňöşüýA-ZÄÇŽŇÖŞÜÝ]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class TurkmenPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Turkmen phonemizer (direct grapheme g2p + the interdental hallmark + final stress). */
export function createTurkmen(): Phonemizer {
    return new TurkmenPhonemizer();
}
