/**
 * Native Romanian (ro) text phonemizer — canonical IPA, espeak-independent.
 *
 * Romanian is Eastern Romance with a shallow, near-phonemic Latin orthography (diacritics ă â î ș ț). The letter
 * maps live in romanian.jsonc; the CONTEXTUAL phonology lives here:
 *
 *   • c/g softening — ⟨ce ci⟩→t͡ʃ, ⟨ge gi⟩→d͡ʒ (⟨ci/gi⟩+V drops the silent softener i: ciorbă→t͡ʃorbə); the hard
 *     digraphs ⟨ch gh⟩→k/ɡ (chem→kem, ghem→ɡem).
 *   • rising diphthongs — ⟨ea⟩→e̯a, ⟨oa⟩→o̯a (the mid vowel is the non-syllabic on-glide: seară→se̯arə, floare→flo̯are).
 *   • i/u glides — prevocalic or postvocalic ⟨i⟩→j, ⟨u⟩→w (iarnă→jarnə, ziua→ziwa, mai→maj, eu→ew).
 *   • final-i desyllabification — an unstressed word-final ⟨i⟩ after a consonant PALATALISES it (lupi→lupʲ),
 *     ⟨ii⟩→iʲ (copii→kopiʲ); it stays syllabic after an obstruent+liquid cluster (membri) and in monosyllables (și).
 *   • word-initial ⟨e⟩→je in the copula/pronoun class (este→jeste, el→jel).
 *
 * Stress is UNWRITTEN and lexically unpredictable in Romanian; the broad referee marks none, so it is DEFERRED (no
 * ˈ emitted). Referee: wikipron ron_latn broad (HUMAN, 9285). See docs/investigations/ro_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

/** Load the optional stress lexicon (word → stressed-nucleus position from the end). Absent → rules only. */
function loadStressLex(): ReadonlyMap<string, number> {
    const raw = loadTsvMap(import.meta.url, "romanian-stress.tsv", undefined, { optional: true });
    const m = new Map<string, number>();
    for (const [k, v] of raw) {
        const n = Number(v);
        if (Number.isInteger(n) && n >= 1) m.set(k, n);
    }
    return m;
}

interface RomanianDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: Record<string, unknown>;
}

const DEF = loadManifest<RomanianDef>(import.meta.url, "romanian.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

const VOWEL_LETTERS = "aeiouăâî";
const FRONT = "ei"; // c/g soften before these
const VOWEL_PH = "aeiouəɨ";
const OBSTRUENT = new Set(["b", "p", "t", "d", "k", "ɡ", "f", "v", "s", "z", "ʃ", "ʒ", "h", "t͡ʃ", "d͡ʒ", "t͡s"]);
const isVowelLetter = (c: string | undefined): boolean => c !== undefined && VOWEL_LETTERS.includes(c);
const isFront = (c: string | undefined): boolean => c !== undefined && FRONT.includes(c);

// The copula (a fi) + 3rd-person pronoun forms whose word-initial ⟨e⟩ is pronounced [je] (este→jeste). NB: ⟨eu⟩ is
// [ew] not [jew] in the broad referee, so it is excluded.
const INITIAL_JE = new Set([
    "este", "ești", "e", "el", "ea", "ei", "ele",
    "eram", "erai", "era", "erați", "erau", "esti",
]);

/** Scan a lowercased Romanian word into phoneme strings (contextual c/g, digraphs, diphthongs, glides). */
function scan(word: string): string[] {
    const s = [...word];
    const n = s.length;
    const out: string[] = [];
    const prevIsVowel = (): boolean => out.length > 0 && VOWEL_PH.includes(out[out.length - 1]!.slice(-1));
    // muta cum liquida: a branching onset obstruent+liquid (Cr/Cl) can't take a following glide, so an ⟨i⟩ after
    // it stays a syllabic nucleus (Alexandria→…dria, Austria→awstria, Abaclia→abaklia), NOT a glide.
    const afterMutaLiquida = (): boolean =>
        out.length >= 2 && "lr".includes(out[out.length - 1]!) && OBSTRUENT.has(out[out.length - 2]!);

    let i = 0;
    while (i < n) {
        const c = s[i]!;
        const nx = s[i + 1];
        const nn = s[i + 2];

        // ⟨c⟩: ch→k; before e/i → t͡ʃ (⟨ci⟩+V silent softener i); else k.
        if (c === "c") {
            if (nx === "h") { out.push("k"); i += 2; continue; } // ch → k (chem→kem, chiar→kjar via i-glide)
            if (isFront(nx)) {
                out.push("t͡ʃ");
                if (nx === "i" && isVowelLetter(nn)) i += 2; // ⟨ci⟩+V: silent i, leave the vowel (ciorbă)
                else i += 1; // else the e/i is a pronounced nucleus (ce, ci, cea via ea-rule)
                continue;
            }
            out.push("k"); i += 1; continue;
        }
        // ⟨g⟩: gh→ɡ; before e/i → d͡ʒ (⟨gi⟩+V silent i); else ɡ.
        if (c === "g") {
            if (nx === "h") { out.push("ɡ"); i += 2; continue; } // gh → ɡ
            if (isFront(nx)) {
                out.push("d͡ʒ");
                if (nx === "i" && isVowelLetter(nn)) i += 2; // ⟨gi⟩+V: silent i
                else i += 1;
                continue;
            }
            out.push("ɡ"); i += 1; continue;
        }
        // ⟨qu⟩ → kw (loanwords); ⟨q⟩ alone → k.
        if (c === "q") {
            out.push("k");
            if (nx === "u" && isVowelLetter(nn)) { out.push("w"); i += 2; } else i += 1;
            continue;
        }

        // ── vowels, diphthongs & glides ──
        if (isVowelLetter(c)) {
            // Rising diphthongs: the mid vowel ⟨e⟩/⟨o⟩ before ⟨a⟩ is the non-syllabic on-glide (ea→e̯a, oa→o̯a).
            if ((c === "e" || c === "o") && nx === "a") {
                out.push(c === "e" ? "e̯" : "o̯");
                i += 1;
                continue;
            }
            // Word-final ⟨ie⟩ after a CONSONANT is a HIATUS [i.e] (geografie→…fi.e, istorie) — keep i syllabic.
            // (After a vowel it is an off-glide: cheie→keje, so require a consonant before it.)
            if (c === "i" && nx === "e" && i + 2 === n && !prevIsVowel()) {
                out.push("i");
                i += 1;
                continue;
            }
            // ⟨i⟩/⟨u⟩ are semivowels, but only ONE vowel in a sequence glides (the other is the nucleus):
            //   • OFF-glide — a high vowel AFTER a nucleus (ai→aj, eu→ew, ui→uj, iu→iw, -ei→ej).
            //   • ON-glide — a high vowel starting the syllable BEFORE a NON-high vowel (ia→ja, ua→wa, ie→je).
            // Not before another high vowel (that keeps ⟨ui iu⟩ from double-gliding to a nucleus-less wj/jw).
            const isHigh = (x: string | undefined): boolean => x === "i" || x === "u";
            const onglide = isVowelLetter(nx) && !isHigh(nx) && !afterMutaLiquida();
            if (isHigh(c) && (prevIsVowel() || onglide)) {
                out.push(c === "i" ? "j" : "w");
                i += 1;
                continue;
            }
            out.push(DEF.vowels[c] ?? c);
            i += 1;
            continue;
        }

        // ⟨x⟩ → [ɡz] in the word-initial prefix ⟨ex⟩+V (examen→eɡzamen, exact→eɡzakt); [ks] everywhere else,
        // including medial names (Alexandru→aleksandru, taxi, text) where the intervocalic gz rule over-fires.
        if (c === "x") {
            out.push(i === 1 && s[0] === "e" && isVowelLetter(nx) ? "ɡz" : "ks");
            i += 1;
            continue;
        }
        // ── consonants ──
        if (c in DEF.consonants) {
            const ph = DEF.consonants[c]!;
            if (ph) out.push(ph);
            i += 1;
            continue;
        }
        i += 1; // unknown → skip
    }
    return out;
}

const isVowelPh = (p: string | undefined): boolean => p !== undefined && VOWEL_PH.includes(p.slice(-1));

/**
 * Final unstressed ⟨i⟩ after a consonant desyllabifies to palatalisation on that consonant (lupi→lupʲ). It stays
 * syllabic in a monosyllable (și) and after an obstruent+liquid cluster (membri). ⟨ii⟩ → iʲ (copii→kopiʲ).
 */
function finalI(segs: string[]): string[] {
    if (segs.length < 2 || segs[segs.length - 1] !== "i") return segs;
    const nuclei = segs.filter(isVowelPh).length;
    if (nuclei < 2) return segs; // monosyllable → keep syllabic i
    const prev = segs[segs.length - 2]!;
    // obstruent + liquid cluster before the i → syllabic (…bri, …tru-like): keep i
    const beforePrev = segs[segs.length - 3];
    if ((prev === "r" || prev === "l") && beforePrev !== undefined && !isVowelPh(beforePrev)) return segs;
    // palatalise the preceding segment (a consonant, or the ⟨ii⟩ nucleus i→iʲ)
    return [...segs.slice(0, -2), prev + "ʲ"];
}

/**
 * Predict the stressed nucleus, as a position FROM THE END (1 = final nucleus, 2 = penult, …). Stress is UNWRITTEN
 * and lexically unpredictable in Romanian, but strongly conditioned on the ending (derived from the kaikki
 * distribution, 7.4k words): consonant-final → FINAL (69%, up to 94% for a final stop); vowel-final → PENULT (61%;
 * -e/-ă/-o 78-85%). One nucleus → final. The rule-unpredictable residual is closed by the lexicon (STRESS_LEX).
 */
function stressFromEnd(word: string, nucleiCount: number): number {
    if (nucleiCount <= 1) return 1;
    const last = word[word.length - 1] ?? "";
    // consonant-final → final (69%; -t/-s/-r 85-94%), EXCEPT ⟨-c⟩ → penult (the -ic adjective suffix dominates:
    // politic→poˈlitik, istoric→isˈtorik; 80% penult).
    if (!VOWEL_LETTERS.includes(last)) return last === "c" ? 2 : 1;
    // ⟨-i⟩: after a VOWEL (glide, -ei/-ai genitives casei→ˈkasej) → PENULT; after a consonant (desyllabified
    // plural lupi→ˈlupʲ, elevi→eˈlevʲ) → FINAL of the remaining nuclei.
    if (last === "i") return VOWEL_LETTERS.includes(word[word.length - 2] ?? "") ? 2 : 1;
    // other vowel-final: ⟨-a⟩ leans FINAL (feminines/verbs, 54%); -e/-ă/-o/-u lean PENULT (67-85%).
    return last === "a" ? 1 : 2;
}

/** Word → stressed-nucleus position from the END (1=final, 2=penult…), mined from kaikki for the rule-miss tail. */
const STRESS_LEX: ReadonlyMap<string, number> = loadStressLex();

function phonemizeCore(word: string, useLex: boolean): string {
    const lw = word.toLowerCase();
    const segs = finalI(scan(lw));
    if (segs.length === 0) return "";
    if (INITIAL_JE.has(lw)) segs.unshift("j"); // copula/pronoun word-initial e → je (onset of syllable 1)
    const nuclei: number[] = [];
    for (let i = 0; i < segs.length; i++) if (VOWEL_PH.includes(segs[i]!) && segs[i]!.length === 1) nuclei.push(i);
    let out = "";
    if (nuclei.length > 0) {
        const fromEnd = (useLex ? STRESS_LEX.get(lw) : undefined) ?? stressFromEnd(lw, nuclei.length);
        const idx = nuclei[Math.max(0, nuclei.length - fromEnd)]!;
        // place ˈ before the syllable ONSET (walk back over onset consonants + any glide to the previous
        // nucleus), the standard convention: america→aˈmerika, floare→ˈflo̯are — not before the bare vowel.
        const isNucleus = (p: string | undefined): boolean => p !== undefined && p.length === 1 && VOWEL_PH.includes(p);
        let onset = idx;
        while (onset > 0 && !isNucleus(segs[onset - 1])) onset--;
        for (let i = 0; i < segs.length; i++) {
            if (i === onset) out += "ˈ";
            out += segs[i];
        }
    } else out = segs.join("");
    return out.normalize("NFC");
}

/** One Romanian word → canonical IPA (with primary stress ˈ); shipped path (stress rule + kaikki lexicon). */
export function phonemizeWord(word: string): string {
    return phonemizeCore(word, true);
}

/** Rule-only path (no stress lexicon) — the non-circular stress signal (~74.5% vs kaikki). Segments are identical. */
export function phonemizeWordRules(word: string): string {
    return phonemizeCore(word, false);
}

// ── Numbers (compositional) ───────────────────────────────────────────────────
const NUM = DEF.numbers as {
    units: string[]; teens: string[]; tens: string[];
    hundred: string; hundreds: string; thousand: string; thousands: string;
    million: string; millions: string; and: string; of: string;
};

/** Romanian words for 0 ≤ n < 100. */
function under100(n: number): string {
    if (n < 10) return NUM.units[n]!;
    if (n < 20) return NUM.teens[n - 10]!;
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? NUM.tens[t]! : `${NUM.tens[t]} ${NUM.and} ${NUM.units[u]}`;
}

/** Romanian words for 0 ≤ n < 1000. */
function under1000(n: number): string {
    if (n < 100) return under100(n);
    const h = Math.floor(n / 100), rest = n % 100;
    const head = h === 1 ? NUM.hundred : `${NUM.units[h]} ${NUM.hundreds}`;
    return rest === 0 ? head : `${head} ${under100(rest)}`;
}

/** Romanian cardinal for a non-negative integer (up to the millions). */
function numberWords(n: number): string {
    if (n === 0) return NUM.units[0]!;
    const parts: string[] = [];
    const mil = Math.floor(n / 1_000_000), th = Math.floor((n % 1_000_000) / 1000), rest = n % 1000;
    if (mil > 0) parts.push(mil === 1 ? `${NUM.units[1]} ${NUM.million}` : `${under1000(mil)} ${NUM.millions}`);
    if (th > 0) parts.push(th === 1 ? NUM.thousand : `${under1000(th)} ${NUM.thousands}`);
    if (rest > 0) parts.push(under1000(rest));
    return parts.join(" ");
}

const TOKEN = /([a-zA-ZăâîșțáéíóúàA-ZĂÂÎȘȚ]+)|(\d+)|([.?!,;:])/gu;

/** Build the Romanian phonemizer. */
export function createRomanian(): Phonemizer {
    return {
        text(input: string): string {
            return assembleClauses(input, TOKEN, (m, sink) => {
                if (m[1]) sink.emit(phonemizeWord(m[1]));
                else if (m[2]) {
                    const num = Number(m[2]);
                    if (Number.isSafeInteger(num)) {
                        for (const w of numberWords(num).split(" ")) sink.emit(phonemizeWord(w));
                    }
                } else if (m[3]) {
                    const mk = CLAUSE_MARK[m[3]];
                    if (mk) sink.pause(mk);
                }
            });
        },
    };
}
