/**
 * Tibetan (bo) phonemizer — Standard / Lhasa Tibetan (Tournadre's "Standard Spoken Tibetan"), Tibetan script
 * (U+0F00–0FFF), canonical IPA, espeak-independent. The fleet's first Bodish/Tibetic language. One of the DEEPEST
 * orthographies in the world: Classical spelling encodes Old Tibetan; the Lhasa reading diverges massively, so this
 * is a RULE ENGINE, not a scan — parse the syllable STACK (prefix · superscript · root · subscript · vowel · suffix ·
 * post-suffix) from the Unicode full (U+0F40–0F6C) vs subjoined (U+0F90–0FBC) distinction, then apply the reading
 * rules: tone from tonogenesis (voiceless root→HIGH; voiced-obstruent→LOW+aspiration-by-head; sonorant→HIGH iff a
 * prefix/superscript raises it), onset-cluster realization (ya-btags→palatal, ra-btags→retroflex affricate), and
 * suffix-driven vowel umlaut / length / nasalization / glottalization. Tone emitted as ˥ (H) / ˩ (L).
 *
 * Referees: hand-curated JIPA "Central Tibetan (Lhasa)" illustration (independent, CC-BY) + TIBMD@MUC (independent)
 * + kaikki/Module:bo-pron (reference-parity, disclosed). See docs/investigations/bo_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";

// Full consonants U+0F40–0F6C → Wylie token. Subjoined (U+0F90–0FBC) map to the same token at codepoint − 0x50.
const FULL: Record<number, string> = {
    0x0f40: "k", 0x0f41: "kh", 0x0f42: "g", 0x0f43: "g", 0x0f44: "ng", 0x0f45: "c", 0x0f46: "ch", 0x0f47: "j",
    0x0f49: "ny", 0x0f4a: "T", 0x0f4b: "Th", 0x0f4c: "D", 0x0f4e: "N", 0x0f4f: "t", 0x0f50: "th", 0x0f51: "d",
    0x0f53: "n", 0x0f54: "p", 0x0f55: "ph", 0x0f56: "b", 0x0f58: "m", 0x0f59: "ts", 0x0f5a: "tsh", 0x0f5b: "dz",
    0x0f5d: "w", 0x0f5e: "zh", 0x0f5f: "z", 0x0f60: "'", 0x0f61: "y", 0x0f62: "r", 0x0f63: "l", 0x0f64: "sh",
    0x0f66: "s", 0x0f67: "h", 0x0f68: "a",
};
// Vowel signs → base vowel (length folded; length comes from codas). Anusvara/candrabindu → nasal marker "M".
const VSIGN: Record<number, string> = {
    0x0f71: "a", 0x0f72: "i", 0x0f73: "i", 0x0f74: "u", 0x0f75: "u", 0x0f7a: "e", 0x0f7b: "e", 0x0f7c: "o",
    0x0f7d: "o", 0x0f80: "i", 0x0f81: "i",
};
const VOICELESS = new Set(["k", "kh", "c", "ch", "t", "th", "p", "ph", "ts", "tsh", "sh", "s", "h", "T", "Th"]);
const VOICED = new Set(["g", "j", "d", "b", "dz", "zh", "z", "D"]);
const SONORANT = new Set(["ng", "ny", "n", "m", "w", "y", "r", "l", "N"]);
const SUPERSCRIPT = new Set(["r", "l", "s"]);
const PREFIX = new Set(["g", "d", "b", "m", "'"]);
const SUBSCRIPT = new Set(["y", "r", "l", "w"]);
const SUFFIX = new Set(["g", "ng", "d", "n", "b", "m", "'", "r", "l", "s"]);
const POSTSUFFIX = new Set(["s", "d"]);
// Which root letters each of the 5 prefixes may legally precede (classical Tibetan spelling) — the disambiguator
// for a vowel-less stack: a leading g/d/b/m/' is a PREFIX only if it may precede the next letter, else it is the ROOT.
const PREFIX_ROOT: Record<string, Set<string>> = {
    g: new Set(["c", "ny", "t", "d", "n", "ts", "zh", "z", "y", "sh", "s"]),
    d: new Set(["k", "g", "ng", "p", "b", "m"]),
    b: new Set(["k", "g", "c", "t", "d", "ts", "zh", "z", "sh", "s"]),
    m: new Set(["kh", "g", "ng", "ch", "j", "ny", "th", "d", "n", "tsh", "dz"]),
    "'": new Set(["kh", "g", "ch", "j", "th", "d", "ph", "b", "tsh", "dz"]),
};

/** Find the root unit index of a vowel-less (inherent-/a/) syllable from its consonant units. */
function findRootIdx(units: { full: string; subs: string[] }[]): number {
    // The root is the only stackable slot: a unit that carries subjoined letters (superscript-over-root, or a
    // subscript/ha) IS the root; prefixes and suffixes are always bare single letters.
    const stacked = units.findIndex((u) => u.subs.length > 0);
    if (stacked >= 0) return stacked;
    const n = units.length;
    if (n === 1) return 0;
    const f = (i: number): string => units[i]!.full;
    if (n === 2) return PREFIX.has(f(0)) && !SUFFIX.has(f(1)) ? 1 : 0; // prefix+root only if the 2nd can't be a suffix
    // n ≥ 3: a leading prefix that legally precedes the next letter → prefix+root(+suffixes); else root+suffix+postsuffix.
    return PREFIX.has(f(0)) && PREFIX_ROOT[f(0)]!.has(f(1)) ? 1 : 0;
}

// Base voiceless onset per root (unaspirated / aspirated pair), by place.
const UNASP: Record<string, string> = {
    k: "k", kh: "k", g: "k", c: "t͡ɕ", ch: "t͡ɕ", j: "t͡ɕ", t: "t", th: "t", d: "t", p: "p", ph: "p", b: "p",
    ts: "t͡s", tsh: "t͡s", dz: "t͡s", T: "ʈ", Th: "ʈ", D: "ʈ",
};
const ASP: Record<string, string> = {
    k: "kʰ", kh: "kʰ", g: "kʰ", c: "t͡ɕʰ", ch: "t͡ɕʰ", j: "t͡ɕʰ", t: "tʰ", th: "tʰ", d: "tʰ", p: "pʰ", ph: "pʰ",
    b: "pʰ", ts: "t͡sʰ", tsh: "t͡sʰ", dz: "t͡sʰ", T: "ʈʰ", Th: "ʈʰ", D: "ʈʰ",
};
const FRIC: Record<string, string> = { sh: "ɕ", s: "s", zh: "ɕ", z: "s", h: "h" };
const SON: Record<string, string> = { ng: "ŋ", ny: "ɲ", n: "n", m: "m", w: "w", y: "j", r: "ɻ", l: "l", N: "n" };

interface Stack {
    prefix?: string;
    superscript?: string;
    root: string;
    subscript?: string;
    subH?: boolean; // subjoined ha (lha, hra…)
    vowel: string;
    vowel2?: string; // a second vowel from a hiatus ⟨'⟩+vowel — the diminutive འུ ('u) etc. → diphthong
    nasalMark?: boolean; // anusvara
    suffix?: string;
    postsuffix?: string;
}

/** Parse one Tibetan syllable (codepoints between tsheg) into its stack components. */
function parseSyllable(cps: number[]): Stack | null {
    // Collect consonant UNITS (a full letter + its trailing subjoined letters), the vowel sign, and its position.
    const units: { full: string; subs: string[] }[] = [];
    let vowel = "a";
    let vowel2: string | undefined;
    let nasalMark = false;
    let rootIdx = -1; // the unit index the vowel sign attaches to (= the root), if a vowel sign is present
    let pendingAchung = false; // a non-initial ⟨'⟩ (a-chung) that may carry a hiatus vowel (the diminutive འུ etc.)
    for (const c of cps) {
        if (c >= 0x0f40 && c <= 0x0f6c && FULL[c]) {
            if (c === 0x0f60 && units.length >= 1) pendingAchung = true; // hold: ⟨'⟩ after a root → maybe a hiatus carrier
            else units.push({ full: FULL[c]!, subs: [] });
        } else if (c >= 0x0f90 && c <= 0x0fbc) {
            const w = FULL[c - 0x50];
            if (w && units.length) units[units.length - 1]!.subs.push(w);
        } else if (VSIGN[c] !== undefined) {
            if (pendingAchung) vowel2 = VSIGN[c]!; // ⟨'⟩+vowel → the syllable's second (diphthong) vowel
            else {
                vowel = VSIGN[c]!;
                rootIdx = units.length - 1; // the vowel sits on the root, which is the current last unit
            }
            pendingAchung = false;
        } else if (c === 0x0f7e || c === 0x0f83) {
            nasalMark = true; // anusvara / candrabindu
        }
        // else: tsheg / marks / halanta — ignore
    }
    if (pendingAchung) units.push({ full: "'", subs: [] }); // a bare ⟨'⟩ (no hiatus vowel) is an ordinary suffix (དགའ)
    if (!units.length) return null;
    // No vowel sign (inherent /a/): the root can't be found by vowel position — resolve it from the stack shape
    // (subjoined-bearing unit, else the prefix-root / suffix orthographic rules).
    if (rootIdx < 0) rootIdx = findRootIdx(units);
    const prefix = rootIdx >= 1 ? units[rootIdx - 1]!.full : undefined; // at most one prefix
    const rootUnit = units[rootIdx]!;
    const sufUnits = units.slice(rootIdx + 1);
    // Decompose the root unit: an r/l/s superscript sits OVER a subjoined root; ya/ra/la/wa are subscripts; a
    // subjoined ha forms the voiceless-lateral/retroflex digraphs (lha, hra).
    const subs = rootUnit.subs;
    const rootFromSub = subs.find((x) => !["y", "r", "l", "w", "h"].includes(x));
    let superscript: string | undefined;
    let root = rootUnit.full;
    if (SUPERSCRIPT.has(rootUnit.full) && rootFromSub) {
        superscript = rootUnit.full;
        root = rootFromSub;
    }
    const subH = subs.includes("h");
    const subscript = subs.find((x) => ["y", "r", "l", "w"].includes(x));
    return { prefix, superscript, root, subscript, subH, vowel, vowel2, nasalMark, suffix: sufUnits[0]?.full, postsuffix: sufUnits[1]?.full };
}

/** Realize a parsed stack as Lhasa IPA (onset + vowel + tone + coda). `first` = word-initial syllable: Lhasa word
 *  tone is contrastive only on syllable 1 (Tournadre) — non-initial syllables default HIGH and de-aspirate. */
function readStack(s: Stack, first: boolean): string {
    const head = s.prefix !== undefined || s.superscript !== undefined || !first; // non-initial patterns like a headed (unaspirated) onset
    let onset = "";
    let high: boolean;

    // Onset + tone from the root's tonogenetic class.
    if (VOICELESS.has(s.root)) {
        high = true;
        onset = s.root in FRIC ? FRIC[s.root]! : s.root.endsWith("h") ? ASP[s.root]! : UNASP[s.root]!;
    } else if (VOICED.has(s.root)) {
        high = false; // voiced obstruents → LOW
        onset = s.root in FRIC ? FRIC[s.root]! : head ? UNASP[s.root]! : ASP[s.root]!;
    } else if (SONORANT.has(s.root)) {
        high = head; // sonorant raised to HIGH by a prefix/superscript
        onset = SON[s.root]!;
        if (s.root === "l" && s.subH) onset = "ɬ"; // lha
    } else {
        // vowel-initial root (' or a) — Lhasa gives a syllable-initial vowel a glottal onset (ཨ a→HIGH, འ '→LOW)
        high = s.root === "a";
        onset = "ʔ";
    }
    if (!first) high = true; // non-initial syllables take the default HIGH of the Lhasa word-tone template

    // Subscript modifications (place).
    if (s.subscript === "y") {
        const asp = onset.includes("ʰ");
        if (["k", "kʰ"].includes(onset)) onset = asp ? "kʲʰ" : "kʲ"; // palatalized velar (JIPA notation)
        else if (["p", "pʰ"].includes(onset)) onset = asp ? "t͡ɕʰ" : "t͡ɕ";
        else if (onset === "m") onset = "ɲ";
    } else if (s.subscript === "r") {
        const asp = onset.includes("ʰ");
        if (["k", "kʰ", "t", "tʰ", "p", "pʰ"].includes(onset)) onset = asp ? "ʈ͡ʂʰ" : "ʈ͡ʂ";
        else if (onset === "s" || onset === "h") onset = "ʂ";
    } else if (s.subscript === "l") {
        if (s.root === "z") {
            onset = "t"; // zla-btags lexical exception: ⟨zl⟩ → [t] (ཟླ zla 'moon' → tawa), NOT [l]; keeps root-z LOW tone
        } else {
            onset = "l";
            high = true; // la-btags (bl/gl/rl…) → [l], always HIGH in Lhasa (Tournadre)
        }
    }
    if (s.subH) high = true; // a subjoined ha devoices the onset (ɬ, ʂ) and raises the tone to HIGH
    // db- cluster: prefix ⟨d⟩ + root ⟨b⟩ is historically /w/ (HIGH) — དབང dbang→waŋ, དབུ dbu→ʔu, དབྱངས dbyangs→jaŋ.
    if (s.prefix === "d" && s.root === "b") {
        high = true;
        onset = s.subscript === "y" ? "j" : s.vowel === "u" || s.vowel === "o" ? "ʔ" : "w";
    }

    // Hiatus/diminutive diphthong (⟨'⟩+vowel, e.g. བེའུ be'u→pʰiu, རྟའུ rta'u→tau): the two vowels form a diphthong
    // (the pre-/u/ raising e→i per the JIPA illustration); this closes the syllable, so suffix effects don't apply.
    if (s.vowel2) {
        const d = s.vowel === "e" && s.vowel2 === "u" ? "iu" : s.vowel + s.vowel2;
        return onset + d + (high ? "˥" : "˩");
    }

    // Vowel + suffix effects (umlaut / length / nasalization / glottalization).
    let v = s.vowel;
    let coda = "";
    let long = false;
    let nasal = s.nasalMark;
    const front = (x: string): string => ({ a: "ɛ", o: "ø", u: "y" })[x] ?? x;
    switch (s.suffix) {
        case "d": v = front(v); coda = "ʔ"; break;
        case "s": v = front(v); long = true; break;
        case "l": v = front(v); long = true; break;
        case "n": v = front(v); nasal = true; long = true; break;
        case "m": coda = "m"; break;
        case "ng": coda = "ŋ"; break;
        case "g": coda = "ʔ"; break;
        case "b": coda = "p"; break;
        case "r": long = true; break;
        case "'": long = true; break;
    }
    let vowel = v + (nasal ? "̃" : "") + (long ? "ː" : "");
    return onset + vowel + coda + (high ? "˥" : "˩");
}

/** Phonemize one Tibetan word (one or more tsheg-separated syllables). */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC");
    // Split into syllables on tsheg (U+0F0B) / space (U+0F0C non-breaking tsheg) / shad handled by tokenizer.
    const sylls = w.split(/[་༌]/u).filter((x) => x.length > 0);
    const out: string[] = [];
    for (const syl of sylls) {
        const cps = [...syl].map((ch) => ch.codePointAt(0)!);
        const st = parseSyllable(cps);
        if (st) out.push(readStack(st, out.length === 0));
    }
    return out.join("");
}

// Tibetan digits (U+0F20–0F29) → Arabic.
const TNUM: Record<string, string> = { "༠": "0", "༡": "1", "༢": "2", "༣": "3", "༤": "4", "༥": "5", "༦": "6", "༧": "7", "༨": "8", "༩": "9" };

// Cardinal number words (Tibetan spelling — the reader runs them through the engine). Tibetan tens+units use a
// DECADE-specific connective (ཉེར/སོ/ཞེ/ང/རེ/དོན/གྱ/གོ), and magnitudes join the remainder with དང dang. Authored
// from the standard cardinals; self-verified via the engine (no independent spoken-number referee exists).
const UNITS = ["", "གཅིག", "གཉིས", "གསུམ", "བཞི", "ལྔ", "དྲུག", "བདུན", "བརྒྱད", "དགུ"];
const DECADE = ["", "", "ཉི་ཤུ", "སུམ་ཅུ", "བཞི་བཅུ", "ལྔ་བཅུ", "དྲུག་ཅུ", "བདུན་ཅུ", "བརྒྱད་ཅུ", "དགུ་བཅུ"]; // 20…90
const CONNECT = ["", "", "ཉེར", "སོ", "ཞེ", "ང", "རེ", "དོན", "གྱ", "གོ"]; // decade connective before a unit (21…)

/** Compose an integer 0–99999 into Tibetan number words (tsheg-joined), or null to fall back to digits. */
function numToTibetan(n: number): string | null {
    if (n === 0) return "ཀླད་ཀོར"; // klad kor
    if (n < 10) return UNITS[n]!;
    if (n < 20) return n === 10 ? "བཅུ" : "བཅུ་" + UNITS[n - 10]!; // 11–19 = bcu + unit
    if (n < 100) {
        const t = Math.floor(n / 10),
            u = n % 10;
        return u === 0 ? DECADE[t]! : CONNECT[t]! + "་" + UNITS[u]!;
    }
    const join = (head: string, r: number): string => (r === 0 ? head : head + "་དང་" + numToTibetan(r));
    if (n < 1000) {
        const h = Math.floor(n / 100);
        return join((h === 1 ? "" : UNITS[h]! + "་") + "བརྒྱ", n % 100);
    }
    if (n < 10000) {
        const th = Math.floor(n / 1000);
        return join((th === 1 ? "" : UNITS[th]! + "་") + "སྟོང", n % 1000);
    }
    if (n < 100000) {
        const tt = Math.floor(n / 10000);
        return join((tt === 1 ? "" : UNITS[tt]! + "་") + "ཁྲི", n % 10000);
    }
    return null;
}

/** A numeral run → Tibetan number words → IPA (spelling deferred beyond the safe-integer range; digits then pass through). */
function number(digits: string): string {
    const n = Number(digits);
    const words = Number.isSafeInteger(n) ? numToTibetan(n) : null;
    return words === null ? [...digits].map((d) => TNUM[d] ?? d).join("") : phonemizeWord(words);
}

// A Tibetan numeral run, then a word (Tibetan letters/signs + intra-word tsheg), then clause punctuation
// (shad ། and Latin .?! break clauses).
const TOKEN = /([༠-༩]+)|([ༀ-࿿]+)|([.!?])|([།༎ ,;:])/gu;

class TibetanPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(number([...m[1]].map((d) => TNUM[d] ?? d).join(""))); // Tibetan numerals → number words
            else if (m[2]) sink.emit(phonemizeWord(m[2]));
            else if (m[3]) sink.pause(m[3]!);
            else if (m[4]) sink.pause(",");
        });
    }
}

/** Build the Tibetan phonemizer (Lhasa syllable-stack rule engine). */
export function createTibetan(): Phonemizer {
    return new TibetanPhonemizer();
}
