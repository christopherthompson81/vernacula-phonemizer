/**
 * Kabuverdianu / kriolu (kea) phonemizer — Cape Verdean Creole (Portuguese-lexified), canonical IPA,
 * Written in the ALUPEC/AK unified orthography (a standardized PHONEMIC alphabet), so this is a
 * greedy grapheme scan (digraphs ⟨dj tx nh lh rr⟩ first) + Portuguese-creole NASALIZATION (a coda ⟨n/m⟩ nasalizes the
 * preceding vowel; the nasal is [ŋ] before a velar, else absorbed) + STRESS (a written accent marks the stressed
 * syllable, else penultimate). Targets the Santiago (Sotavento/Badiu) variety. No machine referee exists → authored
 * from ALUPEC + the 7 kaikki IPA anchors.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface KabuverdianuDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<KabuverdianuDef>(import.meta.url, "kabuverdianu.jsonc");
const DI = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const VOWEL_PH = new Set([..."ɐeɛioɔu"]);
const ACCENTED = new Set([..."áàâéèêíìîóòôúùû"]); // a written accent carries the stress

interface Seg {
    ph: string;
    vowel: boolean; // the phoneme is a vowel (for nasalization adjacency)
    accented: boolean;
    offglide: boolean; // a falling-diphthong ⟨i/u⟩ after another vowel — a vowel but NOT a stress-bearing nucleus
}
const VOWEL_LETTERS = new Set([..."aeiouáàâéèêíìîóòôúùûy"]);

/** Scan a lowercased Kabuverdianu word into IPA segments (digraphs first, then single graphemes). */
function scan(word: string): Seg[] {
    const w = [...word.toLowerCase()];
    const segs: Seg[] = [];
    for (let i = 0; i < w.length; i++) {
        const two = (w[i] ?? "") + (w[i + 1] ?? "");
        if (two in DI) { segs.push({ ph: DI[two]!, vowel: false, accented: false, offglide: false }); i += 1; continue; }
        const c = w[i]!;
        const ph = G[c];
        if (ph === undefined || ph === "") continue; // unknown or silent ⟨h⟩
        const vowel = VOWEL_PH.has(ph);
        // a falling-diphthong offglide: an unaccented ⟨i/u⟩ right after a vowel nucleus (oitu→oi, au…) — not a nucleus.
        const prev = segs[segs.length - 1];
        const offglide = vowel && (ph === "i" || ph === "u") && !ACCENTED.has(c) && !!prev?.vowel && !prev.offglide;
        segs.push({ ph, vowel, accented: ACCENTED.has(c), offglide });
    }
    return segs;
}

/** Portuguese-creole nasalization: a coda ⟨n/m⟩ (preceded by a vowel, not before another vowel) nasalizes that
 *  vowel; the nasal surfaces as [ŋ] before a velar (tabanka→tɐbãŋkɐ) and is otherwise absorbed (sénpri→sɛ̃pɾi). */
function nasalize(segs: Seg[]): Seg[] {
    const out: Seg[] = [];
    for (let i = 0; i < segs.length; i++) {
        const s = segs[i]!;
        const prev = out[out.length - 1];
        const next = segs[i + 1];
        if ((s.ph === "n" || s.ph === "m") && prev?.vowel && !next?.vowel) {
            prev.ph = prev.ph === "ɐ" ? "ã" : prev.ph + "̃"; // nasalize (nasal /a/ opens to [ã], not [ɐ̃])
            if (next && (next.ph === "k" || next.ph === "ɡ")) out.push({ ph: "ŋ", vowel: false, accented: false, offglide: false });
            // else: the nasal consonant is absorbed into the nasal vowel
            continue;
        }
        out.push(s);
    }
    return out;
}

/** Assemble with stress: ˈ before the accented nucleus if there is one; else the Ibero default — PENULTIMATE when the
 *  word ends in an oral vowel or ⟨s⟩ (plural), OXYTONE (final) when it ends in any other consonant (mudjer→muˈd͡ʒeɾ,
 *  amor→ɐˈmoɾ). A falling-diphthong offglide is not a nucleus (oitu→ˈoitu). */
function withStress(segs: Seg[], word: string): string {
    const nuclei = segs.map((s, i) => (s.vowel && !s.offglide ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length === 0) return segs.map((s) => s.ph).join("");
    const accented = nuclei.find((i) => segs[i]!.accented);
    let stressIdx: number;
    if (accented !== undefined) stressIdx = accented;
    else {
        const last = word.toLowerCase().at(-1) ?? "";
        const penult = VOWEL_LETTERS.has(last) || last === "s"; // ends in an oral vowel / plural -s → penult, else oxytone
        stressIdx = penult && nuclei.length >= 2 ? nuclei[nuclei.length - 2]! : nuclei[nuclei.length - 1]!;
    }
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

/** Phonemize a single Kabuverdianu word to canonical IPA (ALUPEC scan + nasalization + accent/penult-or-oxytone
 *  stress). NFC so the nasal vowels precompose consistently (õ ĩ ũ ẽ ã) — combining tildes on ɛ̃/ɔ̃ have none. */
export function phonemizeWord(word: string): string {
    return withStress(nasalize(scan(word)), word).normalize("NFC");
}

// A word (Latin incl. the ALUPEC accented vowels; ' ’ - keep clitic clusters together — d'algen, odja-l) / number /
// punctuation token. Numbers are deferred (passed through). The apostrophe/hyphen are dropped by the scan.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 *
 * ⚠ ì ù Ì Ù ARE DELIBERATELY ABSENT: the g2p has no rule for them, and drops them outright —
 * listing them here would promise a reading that does not exist. NATIVE_CLASS is a claim ABOUT
 * THE G2P, and `test/native-inventory.test.ts` measures it character by character rather than
 * trusting it.
 */
const NATIVE_CLASS = "[a-záàâéèêíîóòôúûA-ZÁÀÂÉÈÊÍÎÓÒÔÚÛ'’-]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class KabuverdianuPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // A digit run reads as Kabuverdianu number WORDS, each phonemized like any other word.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Kabuverdianu phonemizer (ALUPEC greedy g2p + nasalization + stress; numbers deferred). */
export function createKabuverdianu(): Phonemizer {
    return new KabuverdianuPhonemizer();
}
