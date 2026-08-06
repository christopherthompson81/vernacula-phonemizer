/**
 * French grapheme→phoneme engine (standard/Parisian French, broad IPA). French orthography is deep but
 * rule-GOVERNED in the reading direction: a left-to-right scan with context + longest-match multigraphs,
 * plus silent-final and glide handling. Irregular words are caught by an exception lexicon upstream
 * (french.ts). for the convention (ø œ ʁ ɥ ɲ nasals).
 */

import { MANIFEST } from "./manifest.ts";

// All French DATA — letter inventory, oral/nasal vowel-multigraph tables, yod groups, sounded-final set — is
// consolidated in french.jsonc; here we bind it to the local names the scanning algorithm below uses.
const VOWEL_LETTERS = MANIFEST.vowelLetters;
const isV = (c: string): boolean => c !== "" && VOWEL_LETTERS.includes(c);
const VOWEL_GROUPS = MANIFEST.vowelGroups;
const NASAL_GROUPS = MANIFEST.nasalGroups;
const FINAL_SOUNDED = new Set(MANIFEST.finalSounded);
const YOD_DOUBLE = MANIFEST.yodDouble;
const YOD_FINAL = MANIFEST.yodFinal;

/** True when position k begins a silent word-final tail: end of word, or a plural -s at the end (belle, hommes). */
function silentTail(w: string, k: number): boolean {
    const c = w[k] ?? "";
    return c === "" || (c === "s" && (w[k + 1] ?? "") === "");
}

/** eu/œu is "closed" (→ œ not ø) when a pronounced consonant CLOSES the syllable: word-final sounded C
 *  (peur, seul), a coda before another consonant, or a C before a silent final -e(s) (jeune, heure). Open (→ ø)
 *  when word-final vowel/end (feu), an onset before a vowel (heureux), or an obstruent+liquid onset (o.bli). */
function euClosed(w: string, a: number): boolean {
    const c1 = w[a] ?? "";
    if (c1 === "" || isV(c1)) return false;
    if (c1 === "x" && (w[a + 1] ?? "") !== "") return true; // pronounced mid-word ⟨x⟩=[ks]/[ɡz] closes (sexuel→sɛ, texte→tɛ, examen→ɛ); word-final ⟨x⟩ is silent (deux→dø) and falls through
    const c2 = w[a + 1] ?? "";
    if (c2 === "") return "rlfcqkbɡv".includes(c1); // V+C$ → closed iff C is sounded
    // A double consonant CLOSES the preceding syllable for vowel QUALITY — standard loi de position: comme→kɔm,
    // comment→kɔmɑ̃, donner→dɔne, occuper→ɔkype, belle→bɛl (Lexique's merged [o]/[e] here is non-standard).
    if (c1 === c2) return true;
    if (c2 === "e" && silentTail(w, a + 2)) return true; // V+C+e(s)$ (jeune, heure, belle) → closed
    // obstruent + liquid before a PRONOUNCED vowel = tautosyllabic onset (pro.blème, de.vrais) → syllable stays open
    const c3 = w[a + 2] ?? "";
    if (
        "pbcdfgktv".includes(c1) &&
        (c2 === "l" || c2 === "r") &&
        !((c1 === "t" || c1 === "d") && c2 === "l") &&
        isV(c3) &&
        !(c3 === "e" && silentTail(w, a + 3))
    )
        return false;
    return !isV(c2); // V+CC → closed ; V+C+V → open
}

/** Bare ⟨o⟩ is [ɔ] by DEFAULT — standard French: closed syllables (porte→pɔʁt, comme→kɔm) AND open ones
 *  (voler→vɔle, joli→ʒɔli, photo→fɔto, poème→pɔɛm). It is [o] only in the restricted set: word-final OPEN
 *  (mot, piano, abdo), before [z] (rose, chose). (⟨ô⟩/⟨au⟩/⟨eau⟩→[o] are separate graphemes, not this case.) */
function oClosed(w: string, a: number): boolean {
    const c1 = w[a] ?? "";
    if (c1 === "") return false; // word-final open → o
    if (c1 === "z") return false; // before z → o
    if (c1 === "s" && isV(w[a + 1] ?? "")) return false; // o + intervocalic ⟨s⟩ (→[z]) → o (rose, poser, position, philosophe)
    if ((w[a + 1] ?? "") === "" && "tsdpx".includes(c1)) return false; // o + silent final C → o (mot, gros, abdo)
    return true; // everything else (closed OR open) → ɔ
}

const VOWEL_PH = MANIFEST.vowelPhonemes; // IPA vowel starts (for schwa-deletion consonant counting)
const isConsPh = (ph: string): boolean =>
    ph.length >= 1 && !VOWEL_PH.includes(ph[0]!);
// A phoneme carries a syllable nucleus if any of its chars is a vowel (catches multi-char glides+vowel: wa, ɥi, jɛ̃).
const hasNucleus = (ph: string): boolean =>
    [...ph].some((c) => VOWEL_PH.includes(c));
// A front vowel softens c→s / g→ʒ. NB: guard "" — "abc".includes("") is true, which would soften a word-final c/g.
const isFront = (ch: string): boolean => ch !== "" && "eiéèêyœæ".includes(ch);

/** French word → broad IPA (no stress; French is phrase-final-stressed, added at the prosody layer). */
export function toIpa(word: string): string {
    const w = word.toLowerCase();
    const n = w.length;
    const at = (k: number): string => w[k] ?? "";
    const seg: { ph: string; s: number }[] = []; // phoneme + source start index (for silent-final/doubles)
    const out = {
        push: (ph: string, s: number): void => {
            seg.push({ ph, s });
        },
    };
    let i = 0;

    // Special endings resolved up front (they override the letter scan).
    // -ent as a 3rd-person-plural verb ending is silent; but we can't know POS, so treat word-final "ent"
    // after a vowel-stem as silent only for the common "-ent" verb pattern is ambiguous → leave to lexicon.

    while (i < n) {
        const c = at(i),
            nx = at(i + 1),
            nx2 = at(i + 2),
            nx3 = at(i + 3);
        const rest = w.slice(i);
        const atEnd = (len: number): boolean => i + len >= n;

        // vowel + ill/il → yod (aille → aj, travail → tʁavaj, fille handled below).
        let yod = false;
        for (const [g, ipa] of YOD_DOUBLE)
            if (rest.startsWith(g)) {
                out.push(ipa, i);
                i += g.length;
                yod = true;
                break;
            }
        if (!yod)
            for (const [g, ipa] of YOD_FINAL)
                if (rest.startsWith(g) && i + g.length >= n) {
                    out.push(ipa, i);
                    i += g.length;
                    yod = true;
                    break;
                }
        if (yod) continue;

        // Nasal vowel: a vowel-group + n/m, not followed by a vowel, not doubled. (Runs before `ai` so pain→pɛ̃
        // is taken as a nasal, while laine/aime fall through to `ai` below.)
        let nasal = false;
        for (const [g, ipa] of NASAL_GROUPS) {
            if (rest.startsWith(g)) {
                const after = at(i + g.length);
                const doubled =
                    (g.endsWith("n") && after === "n") ||
                    (g.endsWith("m") && after === "m");
                if (!isV(after) && !doubled) {
                    out.push(ipa, i);
                    i += g.length;
                    nasal = true;
                    break;
                }
            }
        }
        if (nasal) continue;

        // ai → ɛ (laine, mais, vraiment, maison) — the Lexique convention renders it ɛ across positions.
        if (rest.startsWith("ai")) {
            out.push("ɛ", i);
            i += 2;
            continue;
        }

        // ou before a vowel → glide w (oui → wi, accouer → akwe).
        if (rest.startsWith("ou") && isV(nx2)) {
            out.push("w", i);
            i += 2;
            continue;
        }
        // t before i+vowel → s (nation → nasjɔ̃, abbatial → abasjal), except after s (question → kɛstjɔ̃).
        if (c === "t" && nx === "i" && isV(nx2) && at(i - 1) !== "s") {
            out.push("s", i);
            i++;
            continue;
        }

        // eu / œu / eû: œ in a closed syllable (peur, seul), ø in open (deux, feu, jeûne).
        if (
            rest.startsWith("eu") ||
            rest.startsWith("œu") ||
            rest.startsWith("eû")
        ) {
            const g = rest.startsWith("œu")
                ? "œu"
                : rest.startsWith("eû")
                  ? "eû"
                  : "eu";
            out.push(euClosed(w, i + g.length) ? "œ" : "ø", i);
            i += g.length;
            continue;
        }

        // ⟨au⟩/⟨eau⟩ before ⟨r⟩ lowers to [ɔ] (standard: restaurant→ʁɛstɔʁɑ̃, aurais→ɔʁɛ, dinosaure→dinozɔʁ,
        // Laure→lɔʁ). Everywhere else ⟨au⟩/⟨eau⟩ stays [o] (handled by the vowel-group table below).
        if (rest.startsWith("au") || rest.startsWith("eau")) {
            const g = rest.startsWith("eau") ? "eau" : "au";
            if (at(i + g.length) === "r") {
                out.push("ɔ", i);
                i += g.length;
                continue;
            }
        }

        // Oral vowel multigraphs (longest first).
        let vg = false;
        for (const [g, ipa] of VOWEL_GROUPS) {
            if (rest.startsWith(g)) {
                out.push(ipa, i);
                i += g.length;
                vg = true;
                break;
            }
        }
        if (vg) continue;

        // Consonant digraphs / context.
        if (c === "c" && (nx === "'" || nx === "’")) {
            out.push("s", i);
            i++;
            continue;
        } // elided c' (ce/ça) → s, not k
        if (c === "c" && nx === "h") {
            out.push("ʃ", i);
            i += 2;
            continue;
        }
        if (c === "p" && nx === "h") {
            out.push("f", i);
            i += 2;
            continue;
        }
        if (c === "t" && nx === "h") {
            out.push("t", i);
            i += 2;
            continue;
        }
        if (c === "g" && nx === "n") {
            out.push("ɲ", i);
            i += 2;
            continue;
        }
        if (c === "q" && nx === "u") {
            out.push("k", i);
            i += 2;
            continue;
        } // qu → k
        if (c === "g" && nx === "u" && isFront(nx2)) {
            out.push("ɡ", i);
            i += 2;
            continue;
        } // gue/gui → ɡ (u silent)
        if (
            c === "i" &&
            "ll".includes(nx) &&
            at(i + 2) === "l" &&
            !"mtv".includes(at(i - 1))
        ) {
            // -ill- → ij (fille → fij). Rough; ville/mille/tranquille exceptions handled by lexicon.
            out.push("ij", i);
            i += 3;
            continue;
        }

        switch (c) {
            case "a":
            case "à":
                out.push("a", i);
                i++;
                break;
            case "e": {
                // e: silent word-final; ə mid-word; but before a double consonant / two consonants → ɛ.
                // final e — silent (choses → ʃoz), also before a silent plural -s (e + final s); ə in a monosyllable (le, je)
                if (atEnd(1) || (nx === "s" && atEnd(2))) {
                    if (!seg.some((s) => hasNucleus(s.ph))) out.push("ə", i);
                    i++;
                    break;
                }
                if (
                    nx === "r" &&
                    atEnd(2) &&
                    seg.some((s) => hasNucleus(s.ph))
                ) {
                    out.push("e", i);
                    i += 2;
                    break;
                } // -er → e (polysyllable: manger); monosyllable mer/cher falls through → ɛʁ
                if (nx === "z" && atEnd(2)) {
                    out.push("e", i);
                    i += 2;
                    break;
                } // -ez → e
                if (nx === "t" && atEnd(2)) {
                    out.push("ɛ", i);
                    i += 2;
                    break;
                } // -et → ɛ
                // e → ɛ in a closed syllable (mer, sel, accentuel, belle); ə in an open one (later maybe deleted).
                out.push(euClosed(w, i + 1) ? "ɛ" : "ə", i);
                i++;
                break;
            }
            case "i":
            case "y": {
                // i/y before a PRONOUNCED vowel → glide j; before a silent final -e = nucleus i
                const glide = isV(nx) && !(nx === "e" && atEnd(2));
                const p1 = seg[seg.length - 1],
                    p2 = seg[seg.length - 2];
                // after an obstruent+liquid cluster (bʁ, tʁ, kl…) an i-glide needs a supporting [i]: abrier → abʁije
                const clusterBefore =
                    p1 &&
                    p2 &&
                    isConsPh(p1.ph) &&
                    isConsPh(p2.ph) &&
                    (p1.ph === "ʁ" || p1.ph === "l");
                if (glide && clusterBefore) {
                    out.push("i", i);
                    out.push("j", i);
                } else out.push(glide ? "j" : "i", i);
                i++;
                break;
            }
            case "o": // [o] word-final / open / before z (rose, abdo); [ɔ] in a closed syllable (porte)
                out.push(oClosed(w, i + 1) ? "ɔ" : "o", i);
                i++;
                break;
            case "u":
                out.push(isV(nx) ? "ɥ" : "y", i);
                i++;
                break; // u before vowel → glide ɥ (huit → ɥi)
            case "b":
                out.push("b", i);
                i++;
                break;
            case "c":
                out.push(isFront(nx) ? "s" : "k", i);
                i++;
                break;
            case "ç":
                out.push("s", i);
                i++;
                break;
            case "d":
                out.push("d", i);
                i++;
                break;
            case "f":
                out.push("f", i);
                i++;
                break;
            case "g":
                out.push(isFront(nx) ? "ʒ" : "ɡ", i);
                i++;
                break;
            case "h":
                i++;
                break; // silent
            case "j":
                out.push("ʒ", i);
                i++;
                break;
            case "k":
                out.push("k", i);
                i++;
                break;
            case "l":
                out.push("l", i);
                i++;
                break;
            case "m":
                out.push("m", i);
                i++;
                break;
            case "n":
                out.push("n", i);
                i++;
                break;
            case "p":
                out.push("p", i);
                i++;
                break;
            case "r":
                out.push("ʁ", i);
                i++;
                break;
            case "s":
                out.push(isV(at(i - 1)) && isV(nx) ? "z" : "s", i);
                i++;
                break; // intervocalic s → z
            case "t":
                out.push("t", i);
                i++;
                break;
            case "v":
            case "w":
                out.push("v", i);
                i++;
                break;
            case "x":
                out.push("ks", i);
                i++;
                break;
            case "z":
                out.push("z", i);
                i++;
                break;
            case "œ":
                out.push("œ", i);
                i++;
                break;
            default:
                i++;
                break; // unknown/apostrophe
        }
    }

    // Post-pass 1 — collapse geminate consonants first (French has no phonemic length): homme → ɔm, belle → bɛl.
    const dedup: { ph: string; s: number }[] = [];
    for (const s of seg) {
        const prev = dedup[dedup.length - 1];
        if (prev && prev.ph === s.ph && isConsPh(s.ph) && s.ph.length === 1)
            continue;
        dedup.push(s);
    }

    // Post-pass 2 — hiatus-schwa deletion only: drop a word-internal ə that directly follows a VOWEL
    // (aboiement → abwamɑ̃, aient → ɛ). The loi des trois consonnes (VCəCV → VCCV, maintenant) is a prosodic
    // reduction, NOT applied here: the Lexique convention keeps the citation schwa (maintenant → mɛ̃tənɑ̃).
    const collapsed: { ph: string; s: number }[] = [];
    for (let p = 0; p < dedup.length; p++) {
        if (dedup[p]!.ph === "ə" && p > 0 && p < dedup.length - 1) {
            const before1 = dedup[p - 1],
                after = dedup[p + 1];
            const endsVowel = (s?: { ph: string }): boolean =>
                !!s && /[aeiouyɛɔøœəɑ]̃?$/.test(s.ph);
            if (endsVowel(before1) && after && isConsPh(after.ph)) continue; // hiatus schwa → delete
        }
        collapsed.push(dedup[p]!);
    }

    // Post-pass 2 — silent final consonant CLUSTER (only when the word ends in a CONSONANT; a final silent -e
    // makes the preceding consonant sounded, so homme → ɔm, table → tabl are untouched). Drop trailing
    // consonant letters that aren't sounded (c/r/f/l/q/k/b/g stay): temps → tɑ̃, corps → kɔʁ, sport → spɔʁ.
    if (w[n - 1] !== "e") {
        let cut = n;
        for (let k = n - 1; k >= 0; k--) {
            const ch = w[k]!;
            if (isV(ch)) break; // reached a vowel → stop
            if (FINAL_SOUNDED.has(ch)) break; // sounded final consonant → keep it, stop
            cut = k; // silent final consonant → drop its phoneme(s)
        }
        while (collapsed.length && collapsed[collapsed.length - 1]!.s >= cut)
            collapsed.pop();
    }

    return collapsed.map((x) => x.ph).join("");
}
