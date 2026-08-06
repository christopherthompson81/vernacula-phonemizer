/**
 * Cross-script GOLD short-vowel miner for Sindhi (sd), from the Devanagari sister-script.
 *
 * Sindhi is written in BOTH Perso-Arabic (Pakistan; a vowel-dropping ABJAD) and Devanagari (India; a fully-voweled
 * ABUGIDA). Devanagari writes exactly the short vowels the abjad omits — including the grammatical final -u/-i that
 * Sindhi retains (اسلام → इस्लामु islāmu). Wiktionary links the two forms of the SAME word, so this is not cognate
 * transfer (the Urdu←Hindi "Hindi-fill" path, which scored only 50.3%): it is the same lexeme in two scripts.
 *
 * This is the mechanism `tools/perso-arabic/crossscript_pa.ts` built for Punjabi (Gurmukhi→Shahmukhi) and
 * explicitly named "sd↔Devanagari" as a generalization target.
 *
 * Method, mirroring crossscript_pa.ts:
 *   1. pair (Perso-Arabic, Devanagari) from the kaikki Sindhi dump via the linked `forms`
 *   2. read the Devanagari form as an abugida → fully-vocalized IPA (short vowels included)
 *   3. HARD GATE: keep the pair only if that IPA's CONSONANT SKELETON matches what the Perso-Arabic rule g2p
 *      independently produces. The vowels then come from Devanagari, not from a guess; a skeleton mismatch means
 *      the two entries are not the same word (or one side is mis-transliterated) and the row is dropped.
 *   4. calibrate: 553 of the pairs ALSO carry an attested IPA — held out as an accuracy check on step 2.
 *
 * Run:
 *   npx tsx tools/sindhi/crossscript_sd.ts            # report + write the mined TSV
 *   npx tsx tools/sindhi/crossscript_sd.ts --calibrate  # step-4 accuracy only, write nothing
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWordRules } from "../../src/languages/sindhi/sindhi.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const KAIKKI = (process.env["DUMPS"] ?? ".") + "/kaikki-Sindhi.jsonl";
const OUT = join(HERE, "sd.crossscript.tsv");

// ── Devanagari (Sindhi) → IPA ────────────────────────────────────────────────────────────────────────────
// Values deliberately mirror src/languages/sindhi/sindhi.jsonc so both scripts land in ONE inventory: ɾ (not r),
// ʋ (not v), dental t̪/d̪, and the four implosives. Sindhi Devanagari carries the implosives as dedicated letters
// ॻ ॼ ॾ ॿ — the same census gap the Perso-Arabic side spells ڳ ڄ ڏ ٻ.
const CONS: Record<string, string> = {
    "क": "k", "ख": "kʰ", "ग": "ɡ", "घ": "ɡʰ", "ङ": "ŋ",
    "च": "t͡ʃ", "छ": "t͡ʃʰ", "ज": "d͡ʒ", "झ": "d͡ʒʰ", "ञ": "ɲ",
    "ट": "ʈ", "ठ": "ʈʰ", "ड": "ɖ", "ढ": "ɖʰ", "ण": "ɳ",
    "त": "t̪", "थ": "t̪ʰ", "द": "d̪", "ध": "d̪ʰ", "न": "n",
    "प": "p", "फ": "pʰ", "ब": "b", "भ": "bʰ", "म": "m",
    "य": "j", "र": "ɾ", "ल": "l", "व": "ʋ", "ळ": "l",
    "श": "ʃ", "ष": "ʃ", "स": "s", "ह": "h",
    // Sindhi implosives (the signature series)
    "ॻ": "ɠ", "ॼ": "ʄ", "ॾ": "ɗ", "ॿ": "ɓ",
};
// Nukta-composed letters (also appear precomposed in the dump, so both spellings are listed).
const NUKTA: Record<string, string> = {
    "क़": "q", "ख़": "x", "ग़": "ɣ", "ज़": "z", "फ़": "f", "ड़": "ɽ", "ढ़": "ɽʰ", "ऱ": "ɾ",
};
const VOWEL_SIGNS: Record<string, string> = {
    "ा": "aː", "ि": "ɪ", "ी": "iː", "ु": "ʊ", "ू": "uː",
    "े": "eː", "ै": "ɛː", "ो": "oː", "ौ": "ɔː", "ृ": "ɾɪ",
};
const INDEP: Record<string, string> = {
    "अ": "ə", "आ": "aː", "इ": "ɪ", "ई": "iː", "उ": "ʊ", "ऊ": "uː",
    "ए": "eː", "ऐ": "ɛː", "ओ": "oː", "औ": "ɔː", "ॐ": "oːm",
};
const VIRAMA = "्", ANUSVARA = "ं", CHANDRABINDU = "ँ", NUKTA_SIGN = "़";
const INHERENT = "ə";

/** Anusvara ं is a homorganic NASAL CONSONANT before a stop (सिंधी sɪndʱiː, अंदरु ənd̪əɾʊ) and only nasalizes the
 *  vowel word-finally / before a continuant (असां əsãː). Chandrabindu ँ always nasalizes. Reading anusvara as
 *  nasalization everywhere was the single largest source of calibration misses. */
function anusvaraFor(nextCons: string | undefined): string {
    if (!nextCons) return "̃";
    if (/^[bpɓ]|^[bp]ʰ/.test(nextCons)) return "m";
    if (/^[ʈɖɳɽ]/.test(nextCons)) return "ɳ";
    if (/^(t͡ʃ|d͡ʒ|ʄ|ɲ)/.test(nextCons)) return "ɲ";
    if (/^[kɡɠŋx]/.test(nextCons)) return "ŋ";
    if (/^(t̪|d̪|n|s|z|l|ɾ)/.test(nextCons)) return "n";
    return "̃";
}

/** Read one Sindhi Devanagari word as an abugida → fully-vocalized IPA. No schwa deletion: unlike Hindi, Sindhi
 *  RETAINS its final short vowels (that retention is precisely the signal we are mining). */
/** `markInherent`: emit the abugida's INHERENT vowel as "ᵊ" instead of "ə".
 *  Sindhi Devanagari has its OWN default-vowel problem: an unmarked consonant carries inherent अ, but the real
 *  Sindhi vowel is often ʊ or ɪ. Measured against the kaikki-linked mine, ə→ʊ/ɪ disagreements outnumber the
 *  reverse 61:12 — a systematic bias, not noise. Marking those slots lets consumers mask them instead of
 *  training on a label that is really "unknown". Explicit vowel signs and virama stay trustworthy. */
export function devaToIpa(word: string, markInherent = false): string | null {
    const s = [...word.normalize("NFC")];
    /** IPA of the next consonant letter at or after `k` (for homorganic anusvara resolution). */
    const nextCons = (k: number): string | undefined => {
        for (let j = k; j < s.length; j++) {
            const ch = s[j]!, pair = ch + (s[j + 1] ?? "");
            const cc = NUKTA[pair] ?? (s[j + 1] === NUKTA_SIGN ? NUKTA[ch + NUKTA_SIGN] : undefined) ?? CONS[ch];
            if (cc) return cc;
            if (INDEP[ch]) return undefined;
        }
        return undefined;
    };
    let out = "";
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        const two = c + (s[i + 1] ?? "");
        // consonant (+ optional nukta) → consonant, then the inherent vowel unless a sign overrides it
        let cons: string | undefined = NUKTA[two] ?? (s[i + 1] === NUKTA_SIGN ? NUKTA[c + NUKTA_SIGN] : undefined);
        let adv = cons ? 2 : 0;
        if (!cons) { cons = CONS[c]; adv = cons ? 1 : 0; }
        if (cons) {
            out += cons;
            i += adv;
            const nx = s[i];
            if (nx === VIRAMA) { i++; continue; } // cluster: no vowel
            if (nx && VOWEL_SIGNS[nx]) { out += VOWEL_SIGNS[nx]!; i++; }
            else out += markInherent ? "ᵊ" : INHERENT;
            while (s[i] === ANUSVARA || s[i] === CHANDRABINDU) {
                out += s[i] === ANUSVARA ? anusvaraFor(nextCons(i + 1)) : "̃";
                i++;
            }
            continue;
        }
        if (INDEP[c]) {
            out += INDEP[c]!;
            i++;
            while (s[i] === ANUSVARA || s[i] === CHANDRABINDU) {
                out += s[i] === ANUSVARA ? anusvaraFor(nextCons(i + 1)) : "̃";
                i++;
            }
            continue;
        }
        if (c === ANUSVARA || c === CHANDRABINDU) {
            out += c === ANUSVARA ? anusvaraFor(nextCons(i + 1)) : "̃";
            i++;
            continue;
        }
        return null; // unknown character → refuse the word rather than emit a corrupt reading
    }
    return out.normalize("NFC") || null;
}

// ── folds ────────────────────────────────────────────────────────────────────────────────────────────────
/** Consonant skeleton: drop every vowel + suprasegmental. This is the GATE — it must be script-independent. */
export function skeleton(ipa: string): string {
    return ipa.normalize("NFD")
        .replace(/[ˈˌ.\s]/g, "")
        .replace(/[aɑæeɛiɪoɔuʊə]ː?/g, "")
        .replace(/[ː̃]/g, "")
        .replace(/̃/g, "")
        .normalize("NFC");
}
/** Calibration fold: keeps short-vowel QUALITY (that is what we are measuring) but folds the axes Sindhi's own
 *  referee config already treats as variety-variable — majhūl oː~uː / eː~iː, ɾ~r, ʋ~v~w, ɦ~h, q~k, gemination. */
export function calFold(ipa: string): string {
    return ipa.normalize("NFD")
        .replace(/[ˈˌ.\s/[\]]/g, "")
        .replace(/̪/g, "") // dental diacritic: the referee writes d/dʱ where we write d̪/d̪ʰ
        .replace(/ʱ/g, "ʰ") // breathy-voiced vs aspirated notation (dʱ ~ d̪ʰ)
        .replace(/ː/g, "") // length: the referee marks it inconsistently ([ɡolʊ] vs ɡoːlʊ); majhūl is folded anyway
        .replace(/[rɽ]/g, "ɾ").replace(/[vw]/g, "ʋ").replace(/ɦ/g, "h").replace(/q/g, "k").replace(/ʂ/g, "ʃ")
        .replace(/[ɑa]/g, "a").replace(/[oɔ]/g, "o").replace(/[eɛ]/g, "e")
        .replace(/ɪ/g, "i").replace(/ʊ/g, "u")
        .replace(/̃/g, "~") // normalize nasalization to a stable position-independent marker
        .replace(/(.)\1/g, "$1")
        .replace(/[əiu]$/, "") // final short vowel: Sindhi retains it, citation IPA often drops it (pausal)
        .normalize("NFC");
}

// ── kaikki extraction ────────────────────────────────────────────────────────────────────────────────────
const isDeva = (s: string) => [...s].some((c) => c >= "ऀ" && c <= "ॿ");
const isArab = (s: string) => [...s].some((c) => (c >= "؀" && c <= "ۿ") || (c >= "ݐ" && c <= "ݿ"));
/** kaikki `forms` carry editorial prefixes ("equivalent व") and zero-width joiners — strip to the bare word. */
const cleanForm = (s: string): string =>
    s.replace(/^(equivalent|alternative|also)\s+/i, "").replace(/[​-‍﻿]/g, "").trim();

interface Pair { arab: string; deva: Set<string>; ipa: Set<string> }
function loadPairs(): Map<string, Pair> {
    const m = new Map<string, Pair>();
    const get = (a: string): Pair => {
        let p = m.get(a);
        if (!p) { p = { arab: a, deva: new Set(), ipa: new Set() }; m.set(a, p); }
        return p;
    };
    for (const line of readFileSync(KAIKKI, "utf8").split("\n")) {
        if (!line.trim()) continue;
        const d = JSON.parse(line) as {
            word?: string;
            sounds?: Array<{ ipa?: string }>;
            forms?: Array<{ form?: string; tags?: string[] }>;
        };
        const w = d.word ?? "";
        const ipas = (d.sounds ?? []).map((s) => s.ipa).filter((x): x is string => !!x);
        if (isArab(w)) {
            const p = get(w);
            for (const i of ipas) p.ipa.add(i);
        }
        for (const f of d.forms ?? []) {
            const fw = cleanForm(f.form ?? "");
            if (!fw || /\s/.test(fw)) continue;
            if (isArab(w) && isDeva(fw)) get(w).deva.add(fw);
            else if (isDeva(w) && isArab(fw)) get(fw).deva.add(w);
        }
    }
    return m;
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────────────
const IS_CLI = process.argv[1]?.endsWith("crossscript_sd.ts") ?? false;
const calibrateOnly = process.argv.includes("--calibrate");
if (IS_CLI) {
const pairs = [...loadPairs().values()].filter((p) => p.deva.size > 0 && [...p.arab].length > 1);
console.log(`# kaikki Sindhi: ${pairs.length} Perso-Arabic words with a linked Devanagari form`);

// Step 4 — calibrate the Devanagari reader against the words that carry an attested IPA.
let calN = 0, calHit = 0;
const calMiss: string[] = [];
for (const p of pairs) {
    if (p.ipa.size === 0) continue;
    const refs = [...p.ipa].map(calFold);
    let best: string | null = null;
    for (const dv of p.deva) {
        const ipa = devaToIpa(dv);
        if (!ipa) continue;
        best ??= ipa;
        if (refs.includes(calFold(ipa))) { best = ipa; break; }
    }
    if (!best) continue;
    calN++;
    if (refs.includes(calFold(best))) calHit++;
    else if (calMiss.length < 15) calMiss.push(`${p.arab}\t${[...p.deva][0]}\t${best}\t${[...p.ipa][0]}`);
}
console.log(`# CALIBRATION (Devanagari reading vs attested IPA, folded): ${calHit}/${calN} = ${(calHit / calN * 100).toFixed(1)}%`);
console.log("# sample misses (arabic / devanagari / our reading / attested):");
for (const s of calMiss) console.log("   " + s.split("\t").join("  "));

// Steps 2-3 — mine, gated on the consonant skeleton agreeing with the independent Perso-Arabic rule g2p.
let kept = 0, dropSkel = 0, dropRead = 0;
const rows: string[] = [];
for (const p of pairs) {
    let picked: string | null = null;
    for (const dv of p.deva) {
        const ipa = devaToIpa(dv);
        if (!ipa) continue;
        const arabIpa = phonemizeWordRules(p.arab);
        if (skeleton(ipa) === skeleton(arabIpa)) { picked = ipa; break; }
    }
    if (picked) { rows.push(`${p.arab}\t${picked}`); kept++; }
    else if ([...p.deva].every((d) => !devaToIpa(d))) dropRead++;
    else dropSkel++;
}
console.log(`\n# mined: ${kept} kept   ${dropSkel} dropped (skeleton mismatch)   ${dropRead} dropped (unreadable Devanagari)`);
if (!calibrateOnly) {
    if (!existsSync(HERE)) mkdirSync(HERE, { recursive: true });
    writeFileSync(OUT, rows.sort().join("\n") + "\n", "utf8");
    console.log(`# wrote ${OUT}`);
}
}
