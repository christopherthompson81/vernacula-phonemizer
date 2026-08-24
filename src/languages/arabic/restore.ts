/**
 * Arabic short-vowel restoration — a SUPPLEMENT-ONLY pass that repairs the words the neural diacritizer
 * (diacritizer.ts) leaves under-voweled. The BiLSTM is trained on running text and hedges to sukun on isolated /
 * OOV words, producing unpronounceable skeletons (يقول → jqwl, not jaquːl). This pass runs AFTER the diacritizer:
 * for each word whose g2p output is still a SKELETON (0 vowels, or a run of ≥3 consecutive consonants — Arabic
 * forbids CCC, so a 3-run marks a dropped short vowel), it overrides that word's vocalization from a Tashkeela-
 * derived PAUSAL lexicon (direct hit, else clitic/suffix strip → stem lookup), falling back to a syllable-aware
 * epenthesis FLOOR so the output is always sayable. It NEVER touches a word the diacritizer already voweled — so
 * it can only improve, never degrade.
 */

import { toSegments } from "./g2p.ts";
import { MANIFEST } from "./manifest.ts";

const HARAKAT_G = /[ً-ْٰ]/g; // tanwīn, short vowels, shadda, sukūn, dagger alif
const stripHarakat = (w: string): string => w.replace(HARAKAT_G, "");

/**
 * Is a diacritized word's g2p output a SKELETON — 0 vowels, or a run of ≥3 consecutive consonant segments? Uses
 * the engine's own segmentation (Seg.vowel), so no IPA-vowel guessing and no digraph miscounting. This is the
 * gate: the restoration fires ONLY on skeletons, never on an already-sayable word.
 */
export function isSkeleton(diacritizedWord: string): boolean {
    const segs = toSegments(diacritizedWord);
    if (segs.length === 0) return false;
    let vowels = 0,
        run = 0,
        maxRun = 0;
    for (const s of segs) {
        if (s.vowel) {
            vowels++;
            run = 0;
        } else {
            run++;
            if (run > maxRun) maxRun = run;
        }
    }
    return vowels === 0 || maxRun >= 3;
}

// Leading proclitics (undiacritized key → VOCALIZED form to re-attach), longest-first. The vocalized form gives
// the proclitic its own short vowel so the re-attached clitic isn't itself a skeleton. Bare article ال stays
// undiacritized — the g2p adds ʔal-.
const CLITICS: ReadonlyArray<readonly [string, string]> = [
    ["وال", "وَال"], ["فال", "فَال"], ["بال", "بِال"], ["كال", "كَال"], ["لل", "لِل"],
    ["ال", "ال"], ["و", "وَ"], ["ف", "فَ"], ["ب", "بِ"], ["ك", "كَ"], ["ل", "لِ"], ["س", "سَ"],
];
// Pronominal/object suffixes (undiacritized), re-attached after the voweled stem.
const SUFFIXES: readonly string[] = ["ها", "هما", "هم", "هن", "كما", "كم", "كن", "نا", "ه", "ك", "ي"];

// ⚠ BOTH FROM THE MANIFEST, which already held every letter in them. The consonant string additionally
// takes آ, ة and ا, which are vowel carriers rather than `consonants` entries — the delta is stated here
// rather than by re-spelling the whole inventory, so adding a consonant to arabic.jsonc reaches this scan.
// (Deriving it also admits the Perso-Arabic پچژڤڭگݣ, which the literal omitted; 0 of 4,531 async probes
// moved, because the 258,784-entry restoration lexicon holds no word containing one.)
const L = MANIFEST.letters;
const ARABIC_CONSONANTS = Object.keys(MANIFEST.consonants).join("") + L.alifMadda + L.taaMarbuta + L.alif;
/** alif / wāw / alif-maqṣūra / yāʾ — mater lectionis (long vowel). */
const LONG_CARRIERS = L.alif + L.waw + L.alifMaqsura + L.ya;

/**
 * Epenthesis floor: vocalize a bare consonant SKELETON so an OOV word (no lexicon/clitic hit) is at least SAYABLE.
 * SYLLABLE-AWARE (Arabic (C)V(C)(C)): each onset consonant gets ONE nucleus (an inserted fatḥa, or a following
 * long-vowel carrier that already supplies it); the consonants that follow stay as a coda cluster up to the next
 * onset — reading the "tight skeleton" (دنمارك → دَنمارك /danmaːrk/) rather than breaking every cluster.
 */
function epenthesize(u: string): string {
    const cs = [...u];
    const isCons = (c: string | undefined): boolean =>
        c !== undefined && ARABIC_CONSONANTS.includes(c) && !LONG_CARRIERS.includes(c);
    let out = "",
        i = 0;
    // leading definite article ال: pass through UNVOCALIZED so the g2p handles /ʔal-/ + sun-letter assimilation.
    if (cs[0] === "ا" && cs[1] === "ل" && cs.length > 3) {
        out = "ال";
        i = 2;
    }
    while (i < cs.length) {
        const c = cs[i]!;
        if (!isCons(c)) {
            out += c;
            i++;
            continue;
        }
        out += c;
        i++;
        if (i < cs.length && LONG_CARRIERS.includes(cs[i]!)) {
            out += cs[i]!;
            i++;
        } else out += "َ"; // inserted fatḥa (short nucleus)
        // coda cluster: the following consonant run MINUS its last member (which onsets the next syllable), unless
        // the run ends the word (all coda, CVCC).
        let j = i;
        while (isCons(cs[j])) j++;
        const runLen = j - i;
        const codaLen = j >= cs.length ? runLen : Math.max(0, runLen - 1);
        for (let k = 0; k < codaLen; k++) out += cs[i + k]!;
        i += codaLen;
    }
    return out;
}

/**
 * Build a candidate VOCALIZED form for an undiacritized word: direct lexicon hit, else clitic-strip → stem lookup
 * → re-attach, else suffix-strip, else clitic+suffix, else the epenthesis floor. Returns undefined for too-short
 * input.
 */
function buildRestoredText(word: string, lexicon: ReadonlyMap<string, string>): string | undefined {
    const u = stripHarakat(word);
    if (u.length < 2) return undefined;
    const direct = lexicon.get(u);
    if (direct !== undefined) return direct;
    for (const [c, voc] of CLITICS) {
        if (u.length > c.length + 1 && u.startsWith(c)) {
            const stem = lexicon.get(u.slice(c.length));
            if (stem !== undefined) return voc + stem;
        }
    }
    for (const s of SUFFIXES) {
        if (u.length > s.length + 1 && u.endsWith(s)) {
            const stem = lexicon.get(u.slice(0, -s.length));
            if (stem !== undefined) return stem + s;
        }
    }
    for (const [c, voc] of CLITICS) {
        if (u.startsWith(c)) {
            const rest = u.slice(c.length);
            for (const s of SUFFIXES) {
                if (rest.length > s.length + 1 && rest.endsWith(s)) {
                    const stem = lexicon.get(rest.slice(0, -s.length));
                    if (stem !== undefined) return voc + stem + s;
                }
            }
        }
    }
    return epenthesize(u); // floor: sayable OOV
}

// Arabic word token (letters + harakat) — everything else (spaces, digits, punctuation) passes through unchanged.
const WORD = /[ء-يٰٱً-ْـ]+/gu;

/**
 * The supplement pass: for each Arabic word in the diacritizer's output whose g2p is a SKELETON, override its
 * vocalization from the lexicon (or the epenthesis floor) — but keep the override only if it is itself NO LONGER a
 * skeleton (a bad derivation can't make things worse). Every non-skeleton word is left exactly as the diacritizer
 * produced it.
 */
export function restoreSkeletons(vocalized: string, lexicon: ReadonlyMap<string, string>): string {
    return vocalized.replace(WORD, (w) => {
        if (!isSkeleton(w)) return w;
        const cand = buildRestoredText(w, lexicon);
        if (cand !== undefined && !isSkeleton(cand)) return cand;
        return w;
    });
}

/**
 * LEXICON-PRIMARY restoration: a direct Tashkeela lexicon hit is AUTHORITATIVE — it overrides the neural
 * diacritizer for any covered word (the classical citation-form vocalization is right for isolated/dictionary
 * words, which the context-trained BiLSTM gets wrong out-of-distribution). An OOV word (no direct hit) keeps the
 * neural output, unless that output is a skeleton — then it falls to the clitic/suffix-strip + epenthesis floor.
 * (Trade-off vs restoreSkeletons: the lexicon's single reading wins even where the neural's CONTEXT would have
 * disambiguated mid-sentence — measured net-better on isolated/dictionary referees; running-text is the open Q.)
 */
export function lexiconPrimary(vocalized: string, lexicon: ReadonlyMap<string, string>): string {
    return vocalized.replace(WORD, (w) => {
        const direct = lexicon.get(stripHarakat(w));
        if (direct !== undefined) return direct;
        if (!isSkeleton(w)) return w;
        const cand = buildRestoredText(w, lexicon);
        return cand !== undefined && !isSkeleton(cand) ? cand : w;
    });
}
