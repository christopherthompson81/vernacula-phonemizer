/**
 * Hungarian (hu, magyar) phonemizer — Uralic, Latin, canonical IPA. A longest-match scan
 * (g2p reads the rule table in hungarian.jsonc): trigraphs / geminate-digraphs / digraphs before single letters,
 * then a doubled-single-consonant → Cː gemination pass, then FIXED first-syllable stress (Hungarian). Signature:
 * ⟨s⟩→[ʃ] / ⟨sz⟩→[s], ⟨gy⟩→[ɟ] / ⟨ty⟩→[c], ⟨a⟩→[ɒ], the full long/short vowel system. text() tokenizes words /
 * numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeHungarian } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

const RULES = MANIFEST.rules;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

interface Seg {
    ph: string;
    v: boolean;
}

/** Scan a lowercased Hungarian word into IPA segments (longest-match), then collapse a doubled single consonant
 *  to length (ll→lː, jj→jː, ss→ʃː) — the geminate DIGRAPHS (ssz→sː) are already single Cː segments from the scan. */
function toSegments(word: string): Seg[] {
    const w = word.toLowerCase();
    const segs: Seg[] = [];
    let i = 0;
    outer: while (i < w.length) {
        for (const [orth, ipa, v] of RULES) {
            // ⟨csz⟩ is c + sz across a MORPHEME BOUNDARY, never cs + z. Longest-match otherwise took the
            // ⟨cs⟩ digraph and left a bare ⟨z⟩, which regressive voicing then turned into [d͡ʒz] — so
            // *nyolcszáz* and *kilencszáz* came out ˈɲold͡ʒzaːz / ˈkilɛnd͡ʒzaːz, i.e. every numeral with 8
            // or 9 in a hundreds group (91 of them in the hu_hu corpus, the whole 18xx/19xx year range
            // among them). The productive `-szor/-szer` and compound cases (kilencszer, táncszám) take
            // the same boundary; cs+z needs a cs-final stem before a z-initial one and is vanishingly
            // rare. Skipping the digraph here lets ⟨c⟩ then ⟨sz⟩ match from the manifest table.
            if (orth === "cs" && w.startsWith("csz", i)) continue;
            if (w.startsWith(orth, i)) {
                segs.push({ ph: ipa, v });
                i += orth.length;
                continue outer;
            }
        }
        i++; // unknown char (punctuation) → skip
    }
    // Gemination: two adjacent identical single-consonant segments → one long consonant (Cː).
    const out: Seg[] = [];
    for (const s of segs) {
        const prev = out[out.length - 1];
        if (prev && !prev.v && !s.v && prev.ph === s.ph && !/ː$/.test(s.ph)) {
            prev.ph += "ː";
            continue;
        }
        out.push({ ...s });
    }
    // j-palatalization: a coronal d/t/n/l (or ɟ/c) + ⟨j⟩ → a long palatal (feddj→[fɛɟː], adj→[ɒɟː], bánja→
    // [baːɲːɒ], hallja→[hɒjːɒ]) — the productive Hungarian imperative/3sg assimilation. Consumes the ⟨j⟩.
    const PAL: Record<string, string> = { d: "ɟ", t: "c", n: "ɲ", l: "j", ɟ: "ɟ", c: "c" };
    for (let k = 0; k < out.length - 1; k++) {
        if (out[k + 1]!.ph === "j" && PAL[base(out[k]!.ph)]) {
            out[k]!.ph = PAL[base(out[k]!.ph)]! + "ː";
            out.splice(k + 1, 1);
        }
    }
    // Nasal PLACE assimilation: /n/ takes the place of a following stop — [ŋ] before velar k/ɡ (hang→hɒŋɡ),
    // [ɲ] before palatal ɟ/c (angyal→ɒɲɟɒl, Lengyel→lɛɲɟɛl), [m] before labial p/b (színpad→siːmpɒd).
    for (let k = 0; k < out.length - 1; k++) {
        if (out[k]!.ph !== "n") continue;
        const nb = base(out[k + 1]!.ph);
        if (nb === "k" || nb === "ɡ") out[k]!.ph = "ŋ";
        else if (nb === "ɟ" || nb === "c") out[k]!.ph = "ɲ";
        else if (nb === "p" || nb === "b") out[k]!.ph = "m";
    }
    voicingAssimilation(out);
    mergeGeminates(out); // devoicing can create an identical-consonant pair across a boundary (feddte→fɛtːɛ)
    return out;
}

/** Merge two adjacent consonants with the same BASE phoneme into one long consonant (t+t / tː+t / t+tː → tː). */
function mergeGeminates(segs: Seg[]): void {
    for (let k = segs.length - 2; k >= 0; k--) {
        const a = segs[k]!,
            b = segs[k + 1]!;
        if (!a.v && !b.v && base(a.ph) === base(b.ph)) {
            a.ph = base(a.ph) + "ː";
            segs.splice(k + 1, 1);
        }
    }
}

// Obstruent voicing pairs (base phoneme, no length). Hungarian has REGRESSIVE voicing assimilation: an obstruent
// takes the voicing of a following obstruent (biztat→[bistɒt] z→s; lég·szivattyú→[leːk…] ɡ→k; vasgolyó→[vaʒɡ…]).
const DEVOICE: Record<string, string> = { b: "p", d: "t", ɡ: "k", v: "f", z: "s", ʒ: "ʃ", "d͡z": "t͡s", "d͡ʒ": "t͡ʃ", ɟ: "c" };
const VOICE: Record<string, string> = { p: "b", t: "d", k: "ɡ", f: "v", s: "z", ʃ: "ʒ", "t͡s": "d͡z", "t͡ʃ": "d͡ʒ", c: "ɟ" };
const VOICELESS_TRIGGER = new Set(MANIFEST.voicelessTriggers);
// Voiced obstruents that TRIGGER voicing of a preceding one — /v/ and /h/ are excluded (v devoices but does not
// voice a preceding obstruent; h is not a trigger).
const VOICED_TRIGGER = new Set(MANIFEST.voicedTriggers);
const base = (ph: string): string => ph.replace(/ː$/u, "");

/** Regressive obstruent voicing assimilation (right-to-left so a cluster propagates). Preserves length. */
function voicingAssimilation(segs: Seg[]): void {
    for (let k = segs.length - 2; k >= 0; k--) {
        const b = base(segs[k]!.ph),
            nb = base(segs[k + 1]!.ph),
            long = segs[k]!.ph.endsWith("ː");
        if (VOICELESS_TRIGGER.has(nb) && DEVOICE[b]) segs[k]!.ph = DEVOICE[b] + (long ? "ː" : "");
        else if (VOICED_TRIGGER.has(nb) && VOICE[b]) segs[k]!.ph = VOICE[b] + (long ? "ː" : "");
    }
}

/** One Hungarian word → canonical IPA with FIXED first-syllable stress. Hungarian primary stress is always
 *  word-initial, so the ˈ precedes the first syllable's onset — i.e. the very start of the word. */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    if (segs.length === 0) return "";
    return "ˈ" + segs.map((s) => s.ph).join("");
}

// A word (Hungarian letters incl. accented vowels) / number / punctuation token.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-záéíóöőúüű]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class HungarianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(normalizeHungarian(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Hungarian phonemizer (longest-match g2p + gemination + fixed first-syllable stress). */
export function createHungarian(): Phonemizer {
    return new HungarianPhonemizer();
}
