/**
 * Native Armenian / հայերեն (hy) text phonemizer — canonical IPA, espeak-independent. EASTERN Armenian (Yerevan
 * standard). Armenian is very nearly one letter ↔ one phoneme, so this is a left-to-right greedy scan over the
 * grapheme table (armenian.jsonc) with three code rules: the ⟨ու⟩ (ո+ւ) → [u] digraph; the WORD-INITIAL glides
 * ⟨ե⟩→[je], ⟨ո⟩→[vo], ⟨և⟩→[jev] (bare [e]/[o]/[ev] elsewhere); and the ligature ⟨և⟩→[ev]. Signatures: the three-way
 * STOP/affricate system (b/p/pʰ, d͡z/t͡s/t͡sʰ, d͡ʒ/t͡ʃ/t͡ʃʰ), the uvulars ⟨խ⟩→χ / ⟨ղ⟩→ʁ, the tap ⟨ր⟩→ɾ vs trill ⟨ռ⟩→r.
 * Validated vs wikipron hye_armn_e broad. See docs/investigations/hy_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface ArmenianDef {
    vowels: Record<string, string>;
    consonants: Record<string, string>;
    numbers: NumbersDef & { hundreds: string[] };
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<ArmenianDef>(import.meta.url, "armenian.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const MAP: Record<string, string> = { ...DEF.consonants, ...DEF.vowels }; // vowels win the shared ⟨ո⟩ key (→o bare)

const isVowelPh = (p: string): boolean => /[ɑeiouə]/u.test(p); // a phoneme that carries a vowel (je/vo/jev included)
// A valid Armenian complex ONSET: ⟨ս/շ⟩ + a voiceless stop (սպ st sk → sp, st, sk). Everything else needs a schwa.
const VOICELESS_STOP = new Set(["p", "t", "k", "pʰ", "tʰ", "kʰ"]);
const validOnset2 = (a: string, b: string): boolean => (a === "s" || a === "ʃ") && VOICELESS_STOP.has(b);
const isSonorant = (p: string): boolean => /^[lmnɾrj]/u.test(p); // sonorants (for final-cluster sonority)

/** Eastern Armenian SCHWA EPENTHESIS (Vaux 1998, simplified). Only the WORD-INITIAL and WORD-FINAL clusters are broken
 *  — MEDIAL epenthesis is left un-applied because the referee is proper-noun-heavy and foreign names keep their source
 *  clusters (Ադրիանա→ɑdɾjɑnɑ, not ɑdəɾjɑnɑ), so a blanket medial rule is net-negative. Word-initial: an s+stop stays an
 *  onset (սպ→sp), else [ə] after the 1st consonant (գն→gən, մտ→mət, խնդ→χənd); an s+stop not directly before the vowel
 *  keeps the pair (սկս→skəs). Word-final: a RISING-sonority pair (obstruent+sonorant: եզր zɾ→zəɾ) gets [ə]; a falling
 *  coda (sonorant+obstruent: ...ɑɾtʰ) is valid → no ə. */
function epenthesize(out: string[]): void {
    // word-final cluster (after the last vowel): a RISING pair (obstruent + a final sonorant) gets [ə] — but NOT
    // before /m/, which stays a bare coda (the productive -իզմ / -թմ class: կոմունիզմ→komunizm, ռիթմ→ritʰm).
    let lv = -1;
    for (let i = out.length - 1; i >= 0; i--) if (isVowelPh(out[i]!)) { lv = i; break; }
    const last = out[out.length - 1]!;
    if (out.length - 1 - lv >= 2 && !isSonorant(out[out.length - 2]!) && isSonorant(last) && last !== "m") {
        out.splice(out.length - 1, 0, "ə");
    }
    // word-initial cluster (before the first vowel)
    let fv = out.length;
    for (let i = 0; i < out.length; i++) if (isVowelPh(out[i]!)) { fv = i; break; }
    if (fv >= 2) {
        if (validOnset2(out[0]!, out[1]!)) {
            if (fv > 2) out.splice(2, 0, "ə"); // s+stop then more consonants → schwa after the onset pair (skəs)
        } else {
            out.splice(1, 0, "ə"); // ə after the first consonant (gən, mət, χənd)
        }
    }
}

/** One Armenian word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const chars = [...word.toLowerCase()];
    const out: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        // ⟨ու⟩ (ո + ւ) → [u] digraph — before the ո→vo/o rules
        if (c === "ո" && chars[i + 1] === "ւ") {
            out.push("u");
            i++;
            continue;
        }
        // WORD-INITIAL glides: ⟨ե⟩→[je], ⟨ո⟩→[vo], ⟨և⟩→[jev]
        if (i === 0) {
            if (c === "ե") { out.push("je"); continue; }
            // ⟨ո⟩ → [vo] word-initially, but [o] before ⟨վ⟩=v (haplology, avoiding *vov: ov→o, ovasis→ovɑsis)
            if (c === "ո") { out.push(chars[i + 1] === "վ" ? "o" : "vo"); continue; }
            if (c === "և") { out.push("jev"); continue; }
        }
        // the ligature ⟨և⟩ elsewhere → [ev] (Երևան→jeɾevɑn)
        if (c === "և") { out.push("ev"); continue; }
        const ph = MAP[c];
        if (ph !== undefined) out.push(ph);
        // else: unknown char (skip)
    }
    epenthesize(out);
    return out.join("");
}

// Slavic-style decimal composition: units + teens + tens + hundreds + thousand/million/billion (space-separated).
function armenianNumberWords(n: number, d: NumbersDef & { hundreds: string[] }): (string | null)[] {
    if (n < 10) return [d.units[n]!];
    if (n < 20) return [d.teens![n - 10]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10;
        const u = n % 10;
        return [d.tens[String(t)]!, ...(u ? [d.units[u]!] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100);
        const r = n % 100;
        return [d.hundreds[h]!, ...(r ? armenianNumberWords(r, d) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000);
        const r = n % 1000;
        return [...armenianNumberWords(th, d), d.magnitudes.thousand!, ...(r ? armenianNumberWords(r, d) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000);
        const r = n % 1_000_000;
        return [...armenianNumberWords(m, d), d.magnitudes.million!, ...(r ? armenianNumberWords(r, d) : [])];
    }
    const b = Math.floor(n / 1_000_000_000);
    const r = n % 1_000_000_000;
    return [...armenianNumberWords(b, d), d.magnitudes.billion!, ...(r ? armenianNumberWords(r, d) : [])];
}

function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, DEF.numbers, phonemizeWord, (m) => armenianNumberWords(m, DEF.numbers));
}

// Armenian letters (U+0530–058F) + the ligature և; number; Armenian + ASCII punctuation.
const TOKEN = /([Ա-Ֆա-ևև]+)|(\d+)|([.?!,;:…՝՞։])/gu;

class ArmenianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Armenian phonemizer. */
export function createArmenian(): Phonemizer {
    return new ArmenianPhonemizer();
}
