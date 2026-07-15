/**
 * Swedish (Central Standard) grapheme→phoneme engine. Latin, largely rule-governed. Handles the sje-sound ɧ
 * (sj/skj/stj/sch, sk+front), the tje-sound ɕ (tj/kj, k+front), g→j before front vowels, retroflex assimilation
 * (rt/rd/rn/rs/rl → ʈ/ɖ/ɳ/ʂ/ɭ), word-initial silent digraphs (hj/lj/dj/gj → j), geminate consonants
 * (doubling → Cː + short vowel), and the complementary vowel-length rule on the stressed syllable. A `compound`
 * (NST secondary stress) drives length from an NST-long ordinal set (boundary-safe) and fires softening at the
 * secondary onset too. Stress + clause assembly are added downstream (swedish.ts). See docs/sv_bringup_investigation.md.
 */

import { MANIFEST } from "./manifest.ts";

const VOWELS = "aeiouyåäöé"; // é (idé, armé, kafé) is an always-long /eː/ loanword vowel
const isV = (c: string): boolean => c !== "" && VOWELS.includes(c);
const FRONT = MANIFEST.frontVowels.toLowerCase();
const isFront = (c: string): boolean => c !== "" && FRONT.includes(c);

const LONG = MANIFEST.vowels.long;
const SHORT = MANIFEST.vowels.short;
const LBR = MANIFEST.vowels.longBeforeR;
const SBR = MANIFEST.vowels.shortBeforeR;
const DIG = MANIFEST.digraphs;
const CONS = MANIFEST.consonants;
const RETRO = MANIFEST.retroflex;
const RETRO_2ND = "tdnsl"; // r + one of these → a single retroflex consonant

export interface Seg {
    ph: string;
    vowel: boolean;
}

/** Compound prosody from NST (secondary stress). secOrd = the secondary-stressed nucleus; longOrds = every NST-long
 *  vowel ordinal. When present, compound length comes from NST (the coda rule is boundary-unaware — storkök's ⟨o⟩ is
 *  long [stuːr] but the rule sees "rk" and shortens it) and consonant softening fires at the secondary onset too
 *  (storkök k→ɕ). */
export interface Compound {
    secOrd: number;
    longOrds: Set<number>;
}

/** Is the stressed vowel at index i LONG? Count coda consonant LETTERS to the next vowel/end, collapsing a
 *  retroflex r+dental to one. 0–1 → long (open syllable / single coda C); ≥2 (cluster, geminate, ck, ng) → short. */
function stressedLong(w: string, i: number): boolean {
    let j = i + 1,
        count = 0;
    while (j < w.length && !isV(w[j]!)) {
        if (w[j] === "r" && RETRO_2ND.includes(w[j + 1] ?? "")) {
            count++; // retroflex r+dental = one consonant
            j += 2;
        } else if (w[j] === "x") {
            count += 2; // ⟨x⟩ = the cluster /ks/ → closes the syllable (sex → sɛks, not seːks)
            j++;
        } else {
            count++;
            j++;
        }
    }
    return count <= 1;
}

/** Scan a lowercased Swedish word into IPA segments (no stress mark). `stressOrd` (0-based nucleus index) is the
 *  syllable that carries the complementary-length contrast — its vowel is long/short by the coda rule; every
 *  other (unstressed) vowel is short. Defaults to the first syllable (the native rule). */
export function toSegments(
    word: string,
    stressOrd = 0,
    oLong = false,
    compound?: Compound,
): Seg[] {
    const w = word.toLowerCase();
    const n = w.length;
    const segs: Seg[] = [];
    let i = 0;
    let vowelOrd = 0;
    const push = (ph: string, vowel = false): void => {
        segs.push({ ph, vowel });
    };

    while (i < n) {
        const c = w[i]!,
            nx = w[i + 1] ?? "",
            nx2 = w[i + 2] ?? "";
        const three = w.slice(i, i + 3);
        const two = w.slice(i, i + 2);
        // Consonant softening (k→ɕ, sk→ɧ, g→j, c→s) fires at a STRESSED-syllable onset: the first syllable, and —
        // in a compound — the secondary-stressed element's onset (storkök k→ɕ). vowelOrd here = the ordinal of the
        // upcoming vowel, so its onset is at vowelOrd === secOrd.
        const softenOnset =
            vowelOrd === 0 || (compound !== undefined && vowelOrd === compound.secOrd);

        // --- the -tion / -sion SUFFIX → ɧuːn. Gated to i>0 so a word-initial stem "tio…"/"sio…" (tionde) is
        //     not swallowed; the suffix is always preceded by its stem (na-tion, sta-tion, pen-sion). ---
        if (i > 0 && (two === "ti" || two === "si") && w.slice(i, i + 4) === c + "ion") {
            push("ɧ");
            push("uː", true);
            push("n");
            vowelOrd++;
            i += 4;
            continue;
        }

        // --- vowels ---
        if (isV(c)) {
            const isPrimary = vowelOrd === stressOrd;
            // Length: for a compound, the NST-long ordinal set (boundary-safe, incl. an unstressed long vowel like
            // arbetsplats' ⟨e⟩); for a simplex word, the complementary-length coda rule on the stressed syllable.
            const long = compound
                ? compound.longOrds.has(vowelOrd)
                : isPrimary && stressedLong(w, i);
            const beforeR = nx === "r";
            let ph: string;
            if (long && oLong && c === "o") ph = "oː"; // lexical: stressed ⟨o⟩ is [oː], not the default [uː]
            else if (long) ph = (beforeR && LBR[c]) || LONG[c] || c;
            else ph = (beforeR && SBR[c]) || SHORT[c] || c;
            push(ph, true);
            vowelOrd++;
            i++;
            continue;
        }

        // --- word-initial silent digraphs: hj/lj/dj/gj → j (medially these are C + j, handled below) ---
        if (i === 0 && nx === "j" && "hldg".includes(c)) {
            push("j");
            i += 2;
            continue;
        }

        // --- word-initial ⟨gn⟩ → ɡn (gnista/gno); only medial/coda ⟨gn⟩ velarises to ŋn (regn, vagn) ---
        if (i === 0 && two === "gn") {
            push("ɡ");
            push("n");
            i += 2;
            continue;
        }

        // --- three-letter sje graphemes: skj/stj/sch → ɧ ---
        if (DIG[three]) {
            push(DIG[three]!);
            i += 3;
            continue;
        }

        // --- sk before a front vowel in the STRESSED onset → ɧ (sk elsewhere → s + k) ---
        // Softening (sk/k/g/c) is a first-syllable-onset phenomenon and needs the front vowel IMMEDIATELY after,
        // else roots keep their hard consonant before front-vowel inflections (boken kk, dragen ɡ, akter k).
        if (two === "sk" && softenOnset && isFront(nx2)) {
            push("ɧ");
            i += 2;
            continue;
        }

        // --- retroflex: r + dental → single retroflex consonant ---
        if (c === "r" && RETRO[two]) {
            push(RETRO[two]!);
            i += 2;
            continue;
        }

        // --- two-letter graphemes (sj/tj/kj/ng/gn/ck/qu…) ---
        if (DIG[two]) {
            // ng/gn/ck/qu/sj/tj/kj — emit its (possibly multi-char) IPA
            for (const ch of DIG[two]!) push(ch);
            i += 2;
            continue;
        }

        // --- geminate consonant: doubled letter → single C + ː (incl. gg/kk, which aren't in CONS) ---
        if (c === nx && !isV(c)) {
            if (c === "g") push("ɡː");
            else if (c === "k") push("kː");
            else if (CONS[c]) push(CONS[c]! + "ː");
            else push(c);
            i += 2;
            continue;
        }

        // --- context-dependent single consonants (softening: first-syllable onset, immediate front vowel) ---
        if (c === "k") {
            push(softenOnset && isFront(nx) ? "ɕ" : "k");
            i++;
            continue;
        }
        if (c === "g") {
            const prev = segs[segs.length - 1]?.ph ?? "";
            if (softenOnset && isFront(nx)) push("j"); // ge/gi/gy/gä/gö in the stressed onset → j
            else if (!isV(nx) && /[rlɭ]$/.test(prev)) push("j"); // berg/älg: r/l + g → j
            else push("ɡ");
            i++;
            continue;
        }
        if (c === "c") {
            push(softenOnset && isFront(nx) ? "s" : "k");
            i++;
            continue;
        }

        // --- plain single consonants ---
        if (CONS[c]) {
            push(CONS[c]!);
            i++;
            continue;
        }

        // unknown grapheme — pass through
        push(c);
        i++;
    }

    return segs;
}
