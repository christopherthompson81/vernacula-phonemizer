/**
 * Native Romanian (ro) text phonemizer — canonical IPA.
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
 * ˈ emitted). Referee: wikipron ron_latn broad (HUMAN, 9285).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { normalizeRomanian } from "./normalize.ts";
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
    million: string; millions: string; billion: string; billions: string; and: string; of: string;
    gendered: {
        oneMasculine: string; oneFeminine: string; oneFeminineFinal: string;
        twoFeminine: string; twelveFeminine: string;
    };
};
const G = NUM.gendered;

/**
 * The GENDER a multiplier has to agree with. Romanian marks gender on the numerals whose unit figure is 1 or 2
 * only, and the magnitude words are NOUNS with their own gender: sută and mie are FEMININE, milion is NEUTER.
 * A neuter noun is masculine in the singular but FEMININE in the plural, so a neuter magnitude takes the
 * masculine form when the count ends in 1 and the feminine when it ends in 2. `"m"` is the un-agreeing case —
 * a bare number with no magnitude noun after it, which keeps the masculine counting forms (unu, doi).
 * Source: en.wikipedia.org/wiki/Romanian_numbers (quoted in romanian.jsonc).
 */
type Gender = "f" | "n" | "m";

/** One numeral WORD, in the form the following magnitude noun requires. 2 and 12 feminise for a feminine or a
 *  neuter-plural noun; 1 only for a feminine one (douăzeci și una de mii vs douăzeci și unu de milioane). */
function gendered(word: string, g: Gender): string {
    if (g === "m") return word;
    if (word === NUM.units[2]) return G.twoFeminine;
    if (word === NUM.teens[2]) return G.twelveFeminine;
    if (word === NUM.units[1] && g === "f") return G.oneFeminineFinal;
    return word;
}

/** `de` links a numeral to the noun it modifies once the count reaches 20: "for integer numbers from 20 to 100,
 *  preposition *de* is placed between the number name and the modified noun … For numbers from 0 to 19 *de* is
 *  not used" — which keys off the final two digits, so a round hundred/thousand count takes it too (o sută de
 *  mii). Source: en.wikipedia.org/wiki/Romanian_numbers. */
const needsDe = (count: number): boolean => count % 100 === 0 || count % 100 >= 20;

/** Romanian words for 0 ≤ n < 100, with the trailing unit agreeing with `g`. */
function under100(n: number, g: Gender): string {
    if (n < 10) return gendered(NUM.units[n]!, g);
    if (n < 20) return gendered(NUM.teens[n - 10]!, g);
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? NUM.tens[t]! : `${NUM.tens[t]} ${NUM.and} ${gendered(NUM.units[u]!, g)}`;
}

/** Romanian words for 0 ≤ n < 1000. The HUNDREDS multiplier always agrees with sută/sute, which are feminine
 *  regardless of what follows (o sută, două sute); `g` governs only the trailing sub-hundred remainder.
 *  `stem` drops the feminine article on a bare hundred, for the ordinal (al sutălea, not *al o sutălea). */
function under1000(n: number, g: Gender, stem = false): string {
    if (n < 100) return under100(n, g);
    const h = Math.floor(n / 100), rest = n % 100;
    const head =
        h === 1
            ? stem ? NUM.hundred : `${G.oneFeminine} ${NUM.hundred}`
            : `${gendered(NUM.units[h]!, "f")} ${NUM.hundreds}`;
    return rest === 0 ? head : `${head} ${under100(rest, g)}`;
}

/** A magnitude group: the agreeing multiplier + `de` where required + the magnitude noun. A count of exactly 1
 *  takes the ARTICLE, not the numeral — o mie, un milion (never *una mie / *unu milion). In `stem` mode (the
 *  ordinal path) the article and the `de` linker are dropped, since an ordinal is built on the bare numeral
 *  stem: al sutălea, al două miilea. */
function magnitudeGroup(count: number, g: Gender, sg: string, pl: string, stem: boolean): string {
    if (count === 1) return stem ? sg : `${g === "f" ? G.oneFeminine : G.oneMasculine} ${sg}`;
    const head = under1000(count, g, stem);
    return needsDe(count) && !stem ? `${head} ${NUM.of} ${pl}` : `${head} ${pl}`;
}

/** Romanian cardinal for a non-negative integer (up to the millions), with the magnitude nouns and their
 *  multipliers in agreement (două mii, o sută de mii, un milion, două milioane).
 *
 *  Exported so `romanOrdinals.ts` can wrap it in the `al …-lea` ordinal construction rather than
 *  re-authoring the numeral data — it passes `stem: true`, which strips the phrasal article and `de` linker
 *  that an ordinal does not take (al sutălea, not *al o sutălea). */
export function numberWords(n: number, opts: { stem?: boolean } = {}): string {
    const stem = opts.stem === true;
    if (n === 0) return NUM.units[0]!;
    // Above the miliard tier the billions multiplier would need its own thousands grouping → read the digits
    // instead of indexing past the tables (which used to leak "undefined" into the IPA at 10⁹ itself).
    if (n >= 1e12) return [...String(n)].map((d) => NUM.units[Number(d)]!).join(" ");
    const parts: string[] = [];
    const bil = Math.floor(n / 1_000_000_000),
        mil = Math.floor((n % 1_000_000_000) / 1_000_000),
        th = Math.floor((n % 1_000_000) / 1000),
        rest = n % 1000;
    // milion and miliard are NEUTER (două milioane, două miliarde); mie is FEMININE (o mie, două mii); a bare
    // remainder agrees with nothing and keeps the masculine counting forms.
    if (bil > 0) parts.push(magnitudeGroup(bil, "n", NUM.billion, NUM.billions, stem));
    if (mil > 0) parts.push(magnitudeGroup(mil, "n", NUM.million, NUM.millions, stem));
    if (th > 0) parts.push(magnitudeGroup(th, "f", NUM.thousand, NUM.thousands, stem));
    if (rest > 0) parts.push(under1000(rest, "m", stem));
    return parts.join(" ");
}

/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 *
 * ⚠ NOT QUITE VERBATIM: á é í ó ú à were REMOVED, because the g2p has no rule for them and DROPPED them outright.
 * The old token class listed them anyway, and the word-level fold hid the mismatch — a word containing one was
 * rejected whole, so everything in it got folded and the letter came out readable by accident. Judging each
 * character on its own exposes the over-claim instead of masking it: `Thérèse` in Romanian read *ˈthrese*, the é
 * gone, because the class promised a rule that did not exist. NATIVE_CLASS is a claim about the G2P, and
 * `test/native-inventory.test.ts` now measures it rather than trusting it.
 */
const NATIVE_CLASS = "[a-zA-ZăâîșțA-ZĂÂÎȘȚ]";
/**
 * NATIVISE a foreign name: fold an out-of-inventory accent to a base this g2p has a rule for. `NATIVE_CLASS`
 * above is the inventory — a word it rejects carries a letter this language does not use. See
 * `core/hostWord.ts` for why the inventory and the script boundary are two different questions (#657).
 */
const nat = makeNativiser(NATIVE_CLASS, "u");

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES (#657).
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.?!,;:])`, "gu");

/** Build the Romanian phonemizer. */
export function createRomanian(): Phonemizer {
    return {
        text(rawInput: string): string {
            // #562: everything the g2p cannot read is rewritten to Romanian words FIRST — see
            // normalize.ts, in particular why there is NO ordinal-dot rule here despite it being the
            // largest rule in the Germanic languages.
            return assembleClauses(normalizeRomanian(rawInput), TOKEN, (m, sink) => {
                if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
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
