/**
 * Latgalian (ltg) phonemizer — a greedy scan + the Latgalian PALATALIZATION system, canonical IPA. This
 * file owns the passes: whole-onset palatalization before a front vowel with its /r/-opacity, the ⟨v⟩
 * coda rule, and the Baltic voicing assimilation. Numbers are composed by numbers.ts (the East-Baltic
 * counted-noun concord + the FEMININE "tyukstūša"). The grapheme tables, voicing pairs and the
 * encyclopedic record live in latgalian.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";
import { latinPhone } from "../../core/latinPhones.ts";

interface LatgalianDef {
    digraphs: [string, string][];
    vowels: Record<string, string>;
    consonants: Record<string, string>;
    voice: Record<string, string>;
    devoice: Record<string, string>;
}
const DEF = loadManifest<LatgalianDef>(import.meta.url, "latgalian.jsonc");
// Grapheme tables + voicing pairs (latgalian.jsonc). Palatalization and assimilation are the passes below.
const DIGRAPHS = DEF.digraphs;
const VOWEL = DEF.vowels;
const CONS = DEF.consonants;
const VOICE = DEF.voice;
const DEVOICE = DEF.devoice;
const FRONT = new Set([..."iīeē"]); // the vowel LETTERS that palatalize a preceding consonant (NOT ⟨y⟩)

interface Seg { ph: string; vowel: boolean; frontTrigger: boolean; }

/** One Latgalian word → canonical IPA (scan → palatalization → voicing assimilation). */
export function phonemizeWord(word: string): string {
    const s = [...word.normalize("NFC").toLowerCase()];
    const segs: Seg[] = [];
    for (let i = 0; i < s.length; i++) {
        const c = s[i]!;
        const dg = DIGRAPHS.find(([k]) => c === k[0] && s[i + 1] === k[1]);
        if (dg) { segs.push({ ph: dg[1], vowel: false, frontTrigger: false }); i++; continue; }
        if (VOWEL[c] !== undefined) { segs.push({ ph: VOWEL[c]!, vowel: true, frontTrigger: FRONT.has(c) }); continue; }
        // ⟨v⟩ → [w] only BEFORE A CONSONANT (sovs→sows); it stays [v] before a vowel and WORD-FINALLY (where the
        // voicing pass then devoices it: div→dʲif, not dʲiw).
        if (c === "v") {
            const nx = s[i + 1];
            const beforeCons = nx !== undefined && VOWEL[nx] === undefined && nx !== "'" && nx !== "’";
            segs.push({ ph: beforeCons ? "w" : "v", vowel: false, frontTrigger: false });
            continue;
        }
        if (CONS[c] !== undefined) { segs.push({ ph: CONS[c]!, vowel: false, frontTrigger: false }); continue; }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Reached only when every rule above has declined, so the language's own reading always wins.
        { const p = latinPhone(c, { initial: i === 0, includeH: true });
          if (p !== undefined) segs.push({ ph: p, vowel: false, frontTrigger: false }); }
    }
    // PALATALIZATION: a consonant is palatalized if its NEXT vowel (skipping the consonant cluster) is a FRONT
    // vowel ⟨i ī e ē⟩ — the whole ONSET before a front vowel softens (bazneica→bazʲnʲɛit͡sa). ⚠ /r/ IS OPAQUE: an
    // obstruent+⟨r⟩ cluster stays HARD (treis→trɛis, not tʲrʲæis) — a consonant before ⟨r⟩ doesn't soften, and ⟨r⟩ in
    // a cluster (preceded by a consonant) doesn't soften; a SIMPLE ⟨r⟩ onset still does (svareigs→sʋarʲɛiks).
    for (let k = 0; k < segs.length; k++) {
        const seg = segs[k]!;
        if (seg.vowel || seg.ph.endsWith("ʲ") || seg.ph === "j") continue;
        if (segs[k + 1]?.ph === "r") continue; // consonant before ⟨r⟩ stays hard
        if (seg.ph === "r" && k > 0 && !segs[k - 1]!.vowel) continue; // ⟨r⟩ in a cluster stays hard
        for (let m = k + 1; m < segs.length; m++) {
            const t = segs[m]!;
            if (t.ph === "r") break; // /r/ blocks leftward spread
            if (t.vowel) { if (t.frontTrigger) seg.ph += "ʲ"; break; }
        }
    }
    // t-EPENTHESIS: a word-final ⟨s⟩/⟨š⟩ after a nasal /n ņ/ surfaces with an epenthetic [t] → the affricate
    // [t͡s]/[t͡ʃ] (sens→sʲænt͡s, kaimiņš→kaimʲinʲt͡ʃ; the -ons nominatives + -eņš/-iņš diminutives).
    if (segs.length >= 2) {
        const last = segs[segs.length - 1]!, prev = segs[segs.length - 2]!;
        const prevNasal = prev.ph === "n" || prev.ph === "nʲ";
        if (prevNasal && last.ph === "s") last.ph = prev.ph === "nʲ" ? "t͡sʲ" : "t͡s";
        else if (prevNasal && last.ph === "ʃ") last.ph = "t͡ʃ";
    }
    // VOICING assimilation (regressive) within obstruent clusters: a voiced/voiceless obstruent assimilates to the
    // LAST obstruent of the cluster; a word-final obstruent devoices (Latgola→ladɡɔla; absurds→apsurt͡s).
    for (let k = segs.length - 1; k >= 0; k--) {
        const base = segs[k]!.ph.replace(/ʲ$/u, "");
        const pal = segs[k]!.ph.endsWith("ʲ") ? "ʲ" : "";
        const next = segs[k + 1];
        if (next === undefined || next.vowel || !/[bdɡzʒvszʃfxptk]|t͡s|t͡ʃ|d͡z|d͡ʒ/u.test(next.ph.replace(/ʲ$/u, ""))) {
            // word-final or before a sonorant/vowel: devoice a word-final obstruent only
            if (next === undefined && DEVOICE[base] !== undefined) segs[k]!.ph = DEVOICE[base] + pal;
            continue;
        }
        const nb = next.ph.replace(/ʲ$/u, "");
        if (DEVOICE[nb] !== undefined && VOICE[base] !== undefined) segs[k]!.ph = VOICE[base] + pal; // next voiced → voice
        else if (VOICE[nb] !== undefined && DEVOICE[base] !== undefined) segs[k]!.ph = DEVOICE[base] + pal; // next voiceless → devoice
    }
    return segs.map((x) => x.ph).join("");
}

// Latgalian Latin + macron/háček letters. Word / number / punctuation.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’")})|(\\d+)|([.?!,;:…])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zāēīōūȳčšžģķļņř'’]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class LatgalianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" "))
                    sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Latgalian phonemizer (Latin scan + the ⟨i⟩/⟨y⟩ palatalization + Baltic voicing). */
export function createLatgalian(): Phonemizer {
    return new LatgalianPhonemizer();
}
