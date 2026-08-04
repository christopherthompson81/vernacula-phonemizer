/**
 * Native Italian (it) text phonemizer — canonical IPA, espeak-independent. Italian's Latin orthography is shallow
 * and near-phonemic, so this is a rule-based g2p: c/g soften to t͡ʃ/d͡ʒ before e/i (⟨ci⟩/⟨gi⟩+V drop a silent i),
 * ⟨sc⟩→ʃ, ⟨gl⟩i→ʎ, ⟨gn⟩→ɲ, ⟨ch⟩/⟨gh⟩→k/ɡ, ⟨qu⟩→kw; GEMINATION is written as doubled consonants (gatto→ɡatto —
 * the referee's own convention, and a real Italian contrast the shared backbone would strip if we used ː);
 * intervocalic ʎ/ɲ/ʃ geminate; i/u become glides j/w before a vowel; penultimate stress (written accent overrides).
 * The 7-vowel system a e ɛ i o ɔ u: unstressed mids are close, but STRESSED ⟨e⟩/⟨o⟩ openness (/e/~/ɛ/, /o/~/ɔ/)
 * is LEXICAL and unrecoverable from spelling — as are intervocalic ⟨s⟩ voicing and ⟨z⟩ voicing — so we take a
 * documented default and fold those axes against the referee. See docs/investigations/it_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { CURRENCY, normalizeItalian, normalizeItalianDecimals, normalizeItalianInitialisms } from "./normalize.ts";

interface NumbersDef {
    units: string[];
    teens: string[];
    tens: string[];
    hundred: string;
    thousand: string;
    thousands: string;
    million: string;
    millions: string;
    and: string;
}
interface ItalianDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    accented: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<ItalianDef>(import.meta.url, "italian.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

const VOWEL_LETTERS = "aeiouàèéìíîòóùú";
const FRONT = "eièéìí"; // c/g soften and ⟨sc⟩→ʃ before these
const VOWEL_PH = "aeɛioɔu";
const isVowelLetter = (c: string): boolean => VOWEL_LETTERS.includes(c);
const isFront = (c: string | undefined): boolean => c !== undefined && FRONT.includes(c);
const isConsLetter = (c: string): boolean =>
    /[a-z]/u.test(c) && !isVowelLetter(c);

interface Seg {
    ph: string;
    accent: boolean; // came from a written-accent vowel (à è é ì …) → bears stress
}

/** Resolve a vowel letter to its IPA, recording whether it was written with a stress accent. */
function vowelSeg(c: string): Seg {
    const acc = DEF.accented[c];
    if (acc !== undefined) return { ph: acc, accent: true };
    return { ph: DEF.vowels[c] ?? c, accent: false };
}

/** Scan a lowercased Italian word into phoneme segments (contextual c/g/s/z, digraphs, gemination, glides). */
function scan(word: string): Seg[] {
    const s = [...word];
    const n = s.length;
    const segs: Seg[] = [];
    const prevIsVowel = (): boolean =>
        segs.length > 0 && VOWEL_PH.includes(segs[segs.length - 1]!.ph[0] ?? "");
    const push = (ph: string): void => {
        segs.push({ ph, accent: false });
    };
    /** Push a consonant that geminates (emits twice) when it sits between vowels. */
    const pushGem = (ph: string, nextVowel: boolean): void => {
        if (prevIsVowel() && nextVowel) {
            push(ph);
            push(ph);
        } else push(ph);
    };

    let i = 0;
    while (i < n) {
        const c = s[i]!;
        const nx = s[i + 1];
        const nn = s[i + 2];

        // ── digraphs / contextual clusters (longest first) ──
        // ⟨gli⟩ → ʎ (intervocalic geminate); ⟨gli⟩+V drops the silent i (figlio→fiʎʎo), else keep i (figli→fiʎi).
        if (c === "g" && nx === "l" && nn === "i") {
            const after = s[i + 3];
            pushGem("ʎ", true);
            if (after !== undefined && isVowelLetter(after)) i += 3; // i silent
            else i += 2; // leave the i as a nucleus
            continue;
        }
        // ⟨gn⟩ → ɲ (intervocalic geminate).
        if (c === "g" && nx === "n") {
            pushGem("ɲ", isVowelLetter(nn ?? ""));
            i += 2;
            continue;
        }
        // ⟨sc⟩ before e/i → ʃ (geminate intervocalic); ⟨sci⟩+V drops the silent i (sciare→ʃare, scienza→ʃɛntsa).
        if (c === "s" && nx === "c" && isFront(nn)) {
            const iDot = nn === "i" || nn === "ì";
            const after = s[i + 3];
            pushGem("ʃ", true);
            if (iDot && after !== undefined && isVowelLetter(after)) i += 3;
            else i += 2;
            continue;
        }
        // ⟨c⟩: ch→k; before e/i → t͡ʃ (⟨ci⟩+V silent i); else k. Doubled ⟨cc⟩ geminates.
        if (c === "c") {
            const doubled = nx === "c";
            const follow = doubled ? nn : nx; // the letter that decides hard/soft
            const rest = doubled ? s[i + 3] : nn;
            if (follow === "h") {
                // ch → k
                if (doubled) push("k");
                push("k");
                i += doubled ? 3 : 2;
                continue;
            }
            if (isFront(follow)) {
                if (doubled) push("t͡ʃ");
                push("t͡ʃ");
                const iDot = follow === "i" || follow === "ì";
                if (iDot && rest !== undefined && isVowelLetter(rest))
                    i += doubled ? 3 : 2; // ⟨ci⟩+V: silent i (ciao, faccia) — leave the following vowel
                else i += doubled ? 2 : 1; // else the triggering e/i is a pronounced nucleus — leave it
                continue;
            }
            // hard c → k
            if (doubled) push("k");
            push("k");
            i += doubled ? 2 : 1;
            continue;
        }
        // ⟨g⟩: gh→ɡ; before e/i → d͡ʒ (⟨gi⟩+V silent i); else ɡ. Doubled ⟨gg⟩ geminates. (gl/gn already handled.)
        if (c === "g") {
            const doubled = nx === "g";
            const follow = doubled ? nn : nx;
            const rest = doubled ? s[i + 3] : nn;
            if (follow === "h") {
                if (doubled) push("ɡ");
                push("ɡ");
                i += doubled ? 3 : 2;
                continue;
            }
            if (isFront(follow)) {
                if (doubled) push("d͡ʒ");
                push("d͡ʒ");
                const iDot = follow === "i" || follow === "ì";
                if (iDot && rest !== undefined && isVowelLetter(rest))
                    i += doubled ? 3 : 2; // ⟨gi⟩+V: silent i (giorno, oggi) — leave the following vowel
                else i += doubled ? 2 : 1; // else the triggering e/i is a pronounced nucleus — leave it
                continue;
            }
            if (doubled) push("ɡ");
            push("ɡ");
            i += doubled ? 2 : 1;
            continue;
        }
        // ⟨qu⟩ → kw; ⟨q⟩ alone → k.
        if (c === "q") {
            push("k");
            if (nx === "u" && isVowelLetter(nn ?? "")) {
                push("w");
                i += 2;
            } else i += 1;
            continue;
        }
        // ⟨s⟩: ss → geminate s; single ⟨s⟩ voices to z between vowels or before a voiced consonant (default —
        // lexical, folded); else s.
        if (c === "s") {
            if (nx === "s") {
                // ⟨ss⟩ is always a long, voiceless geminate.
                push("s");
                push("s");
                i += 2;
                continue;
            }
            const nextVoiced =
                nx !== undefined && "bdglmnrvz".includes(nx);
            const voiced = (prevIsVowel() && isVowelLetter(nx ?? "")) || nextVoiced;
            push(voiced ? "z" : "s");
            i += 1;
            continue;
        }
        // ⟨z⟩ → t͡s (default; /t͡s/~/d͡z/ is lexical, folded). ⟨zz⟩ geminates.
        if (c === "z") {
            const doubled = nx === "z";
            push("t͡s");
            if (doubled) push("t͡s");
            i += doubled ? 2 : 1;
            continue;
        }

        // ── doubled simple consonant (bb dd ff ll mm nn pp rr tt vv) → geminate ──
        if (isConsLetter(c) && nx === c && DEF.consonants[c]) {
            const ph = DEF.consonants[c]!;
            if (ph) {
                push(ph);
                push(ph);
            }
            i += 2;
            continue;
        }
        // ── single simple consonant ──
        if (c in DEF.consonants) {
            const ph = DEF.consonants[c]!;
            if (ph) push(ph); // ⟨h⟩ maps to "" (silent)
            i += 1;
            continue;
        }

        // ── vowels & glides ──
        if (isVowelLetter(c)) {
            // Unaccented i/u are semivowels next to another vowel: ONGLIDE before a vowel (piano→pjano,
            // uomo→wɔmo, buono→bwɔno) or OFFGLIDE after one (aura→awra, mai→maj). Stressed hiatus (via, bugia)
            // is lexical and lost — a documented tail.
            const semivowel =
                (c === "i" || c === "u") &&
                ((nx !== undefined && isVowelLetter(nx)) || prevIsVowel());
            if (semivowel) {
                push(c === "i" ? "j" : "w");
                i += 1;
                continue;
            }
            segs.push(vowelSeg(c));
            i += 1;
            continue;
        }
        i += 1; // unknown → skip
    }
    return segs;
}

/** Stressed nucleus index: the written accent if any, else penultimate vowel (or the only/last nucleus). */
function stressIndex(segs: Seg[]): number {
    const nuclei = segs
        .map((sg, i) => (VOWEL_PH.includes(sg.ph[0] ?? "") ? i : -1))
        .filter((i) => i >= 0);
    if (nuclei.length === 0) return -1;
    const accented = nuclei.find((i) => segs[i]!.accent);
    if (accented !== undefined) return accented;
    if (nuclei.length === 1) return nuclei[0]!;
    return nuclei[nuclei.length - 2]!; // default penultimate (antepenult is lexical/unmarked)
}

/** One Italian word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const segs = scan(word.toLowerCase());
    if (segs.length === 0) return "";
    const stress = stressIndex(segs);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out.normalize("NFC");
}

// ── Numbers (compositional, with the tens+unit fusion) ────────────────────────
/** Build the fused Italian word for 0 ≤ n < 1000 (ventuno, duecentotrentaquattro). */
function under1000(n: number): string {
    if (n < 10) return NUM.units[n]!;
    if (n < 20) return NUM.teens[n - 10]!;
    if (n < 100) {
        const t = Math.floor(n / 10),
            u = n % 10;
        let tens = NUM.tens[t]!;
        if (u === 1 || u === 8) tens = tens.slice(0, -1); // ventuno, ventotto (drop final vowel)
        const unit = u === 3 ? "tré" : u ? NUM.units[u]! : ""; // ventitré carries the accent
        return tens + unit;
    }
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundreds = (h > 1 ? NUM.units[h]! : "") + NUM.hundred;
    return hundreds + (r ? under1000(r) : "");
}

/** Spoken Italian for a non-negative integer → space-separated magnitude words (thousands fused, millions split).
 *  Exported so `romanOrdinals.ts` can derive the ORDINAL from it (`-esimo` on the cardinal) instead of
 *  re-authoring the numeral data. */
export function numberWords(n: number): string {
    if (n === 0) return NUM.units[0]!;
    const parts: string[] = [];
    const millions = Math.floor(n / 1000000);
    const rest = n % 1000000;
    if (millions) {
        parts.push(
            millions === 1
                ? `un ${NUM.million}` // un milione (uno apocopates before milione)
                : `${numberWords(millions)} ${NUM.millions}`,
        );
    }
    if (rest || !millions) {
        const thousands = Math.floor(rest / 1000);
        const under = rest % 1000;
        let group = "";
        if (thousands === 1) group += NUM.thousand; // mille
        else if (thousands > 1) group += under1000(thousands) + NUM.thousands; // duemila
        if (under || !thousands) group += under1000(under);
        if (group) parts.push(group);
    }
    return parts.join(" ");
}

/**
 * This language's OWN inventory — the TOKEN class as it stood before the widening below, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name.
 */
const NATIVE_WORD = /^[a-zA-ZàèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]+$/u;
/**
 * Fold an OUT-OF-INVENTORY accent to its base — `ö`→`o`, `ã`→`a`. This engine NATIVISES rather than routing (its
 * loan reading is its own, not English's), so a foreign name is read with native values — which needs a letter to
 * read. The g2p has no rule for a letter outside its inventory and simply DROPS it, and dropping is not
 * nativising but deleting: that is the `Klöcker` → *klkkeɾ* trap. NFD then discard marks, so a precomposed and a
 * decomposed accent behave alike.
 * ⚠ CONDITIONAL, because a native accent must survive: folding unconditionally would destroy exactly the
 * accented letters this language CAN read (Tagalog's `ñ` was the case that showed it).
 */
const foldToBase = (w: string): string => w.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
const nat = (w: string): string => (NATIVE_WORD.test(w) ? w : foldToBase(w));

// ⚠ ALL OF LATIN, not just this language's own letters — the narrow class ended the token at an
// out-of-inventory diacritic, so that letter became an unclaimed gap read as an English LETTER NAME and the
// rest of the word started over: `São Paulo` fragmented into three pieces, none of them right. Invisible to
// every gate: no digit or raw mark survives and nothing VANISHES (#657).
const TOKEN = /(\p{Script=Latin}[\p{Script=Latin}\p{M}]*)|(\d+)|([.?!,;:])/gu;

/**
 * #562 symbol normalization — Italian. Percent is *per cento*, invariable, so a one-element form list.
 * Currency and unit names are the standard Italian ones; the corpus writes the currency sign AFTER the
 * amount ("banconote da 5 $"), which the shared tier already handles.
 *
 * `ha` (hectare) is deliberately ABSENT. It is a valid SI-adjacent abbreviation, but in Italian running
 * text `<number> ha` is overwhelmingly the verb *avere* — all four occurrences in the it_it corpus are
 * ("Chandrayaan-1 ha sganciato la sonda"), and admitting it would read them as *ettari*. Likewise `g`,
 * `l` and `t` are omitted: none is attested here, `802.11g` shows the letter-after-digit collision is
 * real, and `l'` before a vowel would be claimed as *litri* since an apostrophe is not a letter.
 */
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
    // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
    // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
    // One word, so `by` defaults to it; this language does not split dimension from product.
    multiply: { times: "per" },
    // #586 — `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
    // `e` ×1067 in this corpus. The tier spaces it on both sides, because `B&B` is two
    // initialisms and joining them would make one token.
    ampersand: "e",
    percent: ["per cento"],
    // Only the POSTPOSED sign reaches here — normalize.ts step 10 has already claimed the preposed form,
    // which needs the partitive *di* the shared magnitude hop cannot insert.
    currency: Object.fromEntries(Object.entries(CURRENCY).map(([sign, forms]) => [sign, [...forms]])),
    // #586 — DECLARED FOR THE UNIT PATH, and the reason it was withheld no longer applies. This list was
    // deliberately absent so the CURRENCY magnitude hop could not emit `5 milioni dollari` without the
    // partitive. But `magnitudes` also gates `magAltU`, the UNIT path's connective hop — so withholding it to
    // protect currency left the tier unable to cross `milioni di` to reach a unit, and
    // `2,2 milioni di km²` read as *due virgola due milioni di KM*: the exponent dropped AND the unit noun
    // left raw in the IPA. One field, two consumers, and only one of them had a problem.
    //
    // Safe because step 10 runs FIRST and consumes the whole preposed shape — sign, amount, magnitude and
    // partitive together — so the currency path here never sees a magnitude to hop. Measured: the corpus has
    // exactly ONE currency-sign sentence (`tra 2.500 ¥ e 130.000 ¥`), postposed, with no magnitude word
    // anywhere near it, and ZERO sentences carrying both a currency sign and *milioni*/*miliardi*.
    magnitudes: ["miliardi", "miliardo", "milioni", "milione", "mila"],
    magnitudeConnective: "di", // due virgola due milioni DI chilometri quadrati
    // Longest keys match first (the builder sorts by length), so km² beats km and km/h beats km.
    units: {
        "km/h": ["chilometro orario", "chilometri orari"],
        "km/s": ["chilometro al secondo", "chilometri al secondo"],
        "m/s": ["metro al secondo", "metri al secondo"],
        mph: ["miglio orario", "miglia orarie"],
        km: ["chilometro", "chilometri"], cm: ["centimetro", "centimetri"],
        mm: ["millimetro", "millimetri"], m: ["metro", "metri"],
        kg: ["chilogrammo", "chilogrammi"], mg: ["milligrammo", "milligrammi"],
        gb: ["gigabyte"], mb: ["megabyte"], tb: ["terabyte"],
        kw: ["chilowatt"], mw: ["megawatt"], hz: ["hertz"],
    },
    // MIGRATION TEST (#562): the composite km²/m² keys are gone, composed by the shared tier instead.
    exponentWords: { squared: ["quadrato", "quadrati"], cubed: ["cubo", "cubi"] },
    // #586 BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`), which every language
    // in the fleet was dropping silently. See `bareExponent` in core/normalizeSymbols.ts for why this cannot
    // reuse `exponentWords` above: that is the unit MODIFIER and this is the PREDICATE, and in most languages
    // they are different words (chilometri quadrati but venti al quadrato).
    // ⚠ PROVENANCE, stated because it is weaker than most data in this repo: these are STANDARD MATHEMATICAL
    // REGISTER, not corpus attestations. The power words are ×0 in this language's artifact, and the apparent
    // hits for other languages were substring traps of exactly the kind tools/normalization/attest.ts warns
    // about — th `กำลัง` matched the progressive-aspect marker, fa `توان` and ar `أس` matched inside unrelated
    // words. FLEURS is news and encyclopedia prose and simply does not contain spoken arithmetic.
    // The cardinal is used for the generic power, never the ordinal — see core for that argument.
    bareExponent: { squared: "{n} al quadrato", cubed: "{n} al cubo", power: "{n} elevato a {e}" , negative: "meno" },
});

class ItalianPhonemizer implements Phonemizer {
    text(input: string): string {
        // #562 normalization order: general text normalization (de-grouping, era markers, abbreviations,
        // degrees, ordinals, clock, signs, fractions) → INITIALISMS (after abbreviation expansion, so
        // `a.C.` is already words) → SYMBOLS (%, currency, units) → the DECIMAL COMMA last of all, because
        // the symbol tier matches a unit only against an ADJACENT number and "1,5 km/s" must reach it
        // intact. Roman numerals need no ordering care: `it` is not in the registry's ROMAN_NATIVE set, so
        // the shared pass converted them before text() was called.
        const normalized = normalizeItalianDecimals(
            SYMBOLS(normalizeItalianInitialisms(normalizeItalian(input))),
        );
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                const num = Number(m[2]);
                if (Number.isSafeInteger(num))
                    for (const wd of numberWords(num).split(" "))
                        sink.emit(phonemizeWord(wd));
                else sink.emit(m[2]);
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Italian phonemizer (no data files beyond the manifest — the engine is rule-based). */
export function createItalian(): Phonemizer {
    return new ItalianPhonemizer();
}
