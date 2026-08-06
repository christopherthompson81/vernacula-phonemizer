/**
 * Zhuang / Vahcuengh (za) phonemizer — Tai-Kadai, Standard Zhuang (Wuming), the 1982 Latin orthography, canonical
 * IPA. A longest-match scan: multi-letter onsets (mb→ɓ, nd→ɗ, gv→kʷ, ng→ŋ, …) + vowel digraphs
 * before single letters; the pinyin-style ⟨b d g⟩=/p t k/ and ⟨s⟩→θ / ⟨r⟩→ɣ / ⟨c⟩→ɕ / ⟨v⟩→β; a word-initial
 * vowel takes a [ʔ] onset. TONES are written as syllable-final letters — ⟨z j x q h⟩ = tones 2-6, none = tone 1,
 * a p/t/k coda = a checked tone — and emitted as Chao contour letters after each syllable's vowel (the referee
 * eval strips them, so corroboration is segmental). ⟨z x q j⟩ are never onsets; ⟨h⟩ is an onset before a vowel and
 * tone-6 otherwise.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { sawndipToReadings } from "./sawndip.ts";

const ONSETS = MANIFEST.onsets;
const CONS = MANIFEST.consonants;
const VDIGRAPH = MANIFEST.vowelDigraphs;
const VOWELS = MANIFEST.vowels;
const TONE = MANIFEST.tones;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

const isVowelStart = (w: string, i: number): boolean =>
    i < w.length && (VOWELS[w[i]!] !== undefined || Object.keys(VDIGRAPH).some((d) => w.startsWith(d, i)));
// The tone letters that are NEVER onsets (z/x/q/j); ⟨h⟩ is contextual, handled inline.
const TONE_LETTER: Record<string, string> = { z: "z", j: "j", x: "x", q: "q" };
// Coda stop letters → PLAIN (unaspirated) stops (Zhuang codas never aspirate): b/p→p, d/t→t, g/k→k.
const CODA: Record<string, string> = { b: "p", p: "p", d: "t", t: "t", g: "k", k: "k", m: "m", n: "n" };

// The HIGH vowels {i, u, w=ɯ} form a diphthong offglide after another vowel (au→[au], oi→[oi], aw→[aɯ]);
// a NON-high vowel {a, e, o} after a nucleus is instead VV HIATUS — a new syllable (boad→[po.ʔat]).
const HIGH_VOWEL: Record<string, true> = { i: true, u: true, w: true };

/** Phonemize one Zhuang word to canonical IPA (segments + Chao tones). Tones fold in the eval. */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    let i = 0;
    // Per-syllable state: nucleus present? a tone already placed? an onset consonant already emitted?
    let sylVowel = false;
    let sylCoda = ""; // "" (open), or "p"/"t"/"k" (checked)
    let toneDone = false;
    let sylHasOnset = false;

    const closeSyllable = (): void => {
        if (sylVowel && !toneDone) out += sylCoda ? TONE.checked! : TONE["1"]!;
        sylVowel = false;
        sylCoda = "";
        toneDone = false;
        sylHasOnset = false;
    };
    // A vowel opening a syllable with NO onset consonant takes a glottal onset [ʔ] — word-initial, after a coda
    // or tone closed the previous syllable, or after a hiatus split (ajaeu→ʔa.ʔau, roegam→ɣok.ʔam).
    const openVowel = (): void => {
        if (!sylVowel && !sylHasOnset) out += "ʔ";
    };
    const emitOnset = (ipa: string): void => {
        if (sylVowel) closeSyllable();
        out += ipa;
        sylHasOnset = true;
    };

    while (i < w.length) {
        const c = w[i]!;
        // Tone letters z/j/x/q — always a tone; the syllable is complete (the coda, if any, precedes the tone letter).
        if (TONE_LETTER[c]) {
            if (sylVowel) {
                out += TONE[c]!;
                toneDone = true;
                closeSyllable();
            }
            i++;
            continue;
        }
        // Apostrophe — an explicit syllable-boundary marker (Sih'anh→θi.ʔan); close the syllable.
        if (c === "'") {
            if (sylVowel) closeSyllable();
            i++;
            continue;
        }
        // h — onset [h] before a vowel; tone-6 marker otherwise (which completes the syllable).
        if (c === "h") {
            if (isVowelStart(w, i + 1)) {
                emitOnset("h");
                i++;
                continue;
            }
            if (sylVowel) {
                out += TONE.h!;
                toneDone = true;
                closeSyllable();
            }
            i++;
            continue;
        }
        // CODA-FIRST: a coda-capable consonant (p t k m n, or ⟨ng⟩) that is NOT the onset of a following vowel (i.e.
        // it's before another consonant or word-end) closes the syllable as a coda — Zhuang codas are single. This
        // runs BEFORE the onset loop so a boundary cluster like ⟨nd⟩ in Yin|du is split (n coda + d onset) instead
        // of misread as an implosive ⟨nd⟩ onset (→ɗ). A single C *before a vowel* stays the next onset (maximal
        // onset: Cinanz→ɕi.nan), so morpheme-final codas before a vowel (mak+it) are not recoverable and left as
        // onsets. Only ONSET stops aspirate.
        if (sylVowel) {
            if (w.startsWith("ng", i) && !isVowelStart(w, i + 2)) {
                out += "ŋ";
                closeSyllable();
                i += 2;
                continue;
            }
            const coda = CODA[c];
            if (coda !== undefined && !isVowelStart(w, i + 1)) {
                out += coda;
                if (coda === "p" || coda === "t" || coda === "k") sylCoda = coda;
                closeSyllable();
                i++;
                continue;
            }
        }
        // Multi-letter onset (mb/nd/ng/ny/gv/by/gy/ngv/mby) — a new syllable onset.
        let matched = false;
        for (const [orth, ipa] of Object.entries(ONSETS)) {
            if (w.startsWith(orth, i) && isVowelStart(w, i + orth.length)) {
                emitOnset(ipa);
                i += orth.length;
                matched = true;
                break;
            }
        }
        if (matched) continue;
        // ⟨ae⟩ → the diphthong [ai] in an OPEN syllable (bae→pai), but short [a] before a CODA (caet→ɕat, haemh→ham).
        // A consonant after ⟨ae⟩ is only a coda if it is NOT itself an onset — i.e. ⟨ng⟩/[bdgptkmn] followed by a
        // non-vowel. Before a consonant that starts the next syllable (baedangq→pai.taːŋ, "bae" = the morpheme "go"),
        // ⟨ae⟩ stays the open [ai].
        if (w.startsWith("ae", i) && !w.startsWith("aeu", i)) {
            if (sylVowel) closeSyllable();
            openVowel();
            const rest = w.slice(i + 2);
            const coda =
                (/^ng/u.test(rest) && !isVowelStart(w, i + 4)) ||
                (/^[bdgptkmn]/u.test(rest) && !isVowelStart(w, i + 3));
            out += coda ? "a" : "ai";
            sylVowel = true;
            i += 2;
            continue;
        }
        // Vowel digraph (aeu/ie/ue/we/oe) — a nucleus; if one is already open this is a new syllable.
        let vmatched = false;
        for (const [orth, ipa] of Object.entries(VDIGRAPH)) {
            if (w.startsWith(orth, i)) {
                if (sylVowel) closeSyllable();
                openVowel();
                out += ipa;
                sylVowel = true;
                i += orth.length;
                vmatched = true;
                break;
            }
        }
        if (vmatched) continue;
        // Single vowel — a HIGH vowel continues a diphthong; a NON-high vowel after a nucleus is a new (hiatus) syllable.
        if (VOWELS[c] !== undefined) {
            if (sylVowel && !HIGH_VOWEL[c]) closeSyllable();
            openVowel();
            out += VOWELS[c]!;
            sylVowel = true;
            i++;
            continue;
        }
        // Single consonant onset (a coda would have been caught by CODA-FIRST above).
        const cp = CONS[c];
        if (cp !== undefined) {
            emitOnset(cp);
            i++;
            continue;
        }
        i++; // unknown → skip
    }
    closeSyllable();
    return out;
}

// A word (Zhuang Latin letters) / number / SAWNDIP run (CJK ideographs — the logographic script) / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "", "'")})|(\\d+)|([㐀-䶿一-鿿豈-﫿\\u{20000}-\\u{2ebef}\\u{2f800}-\\u{2fa1f}\\u{30000}-\\u{323af}]+)|([.!?…,;:])`, "giu");
/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it is no longer also
 * deciding where the script boundary falls.
 */
const NATIVE_CLASS = "[a-z']";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class ZhuangPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) // Sawndip: one glyph = one syllable → look up its reading, phonemize each through the za g2p.
                for (const reading of sawndipToReadings(m[3])) sink.emit(phonemizeWord(reading));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Zhuang phonemizer (rule g2p + tone letters). */
export function createZhuang(): Phonemizer {
    return new ZhuangPhonemizer();
}
