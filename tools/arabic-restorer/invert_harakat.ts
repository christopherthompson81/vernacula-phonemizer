/**
 * g2p-inversion silver-labeler — mine harakat (short-vowel) labels for a rider language that has a deterministic
 * g2p but no diacritized corpus. For each wikipron (skeleton, IPA) pair we SEARCH the harakat vocalization of the
 * skeleton whose full phonemizer output reproduces the reference IPA (under the referee-eval fold). That winning
 * vocalization is the silver harakat label — training data the restorer otherwise could not get for the riders.
 *
 * The fold preserves vowel QUALITY (it only strips stress/tone/length + folds ɾ→r ʋ→w degemination final-ə), so a
 * fold-match pins down the correct short vowel; gemination is fold-neutralized, so shadda is not searched.
 * Run: npx tsx invert_harakat.ts <pa|ur|ps|fa|all>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Use the LEXICON-FREE core: the miner searches the vocalization whose g2p reproduces the reference, so it must NOT
// route through the now-lexicon-aware phonemizeWord — that would inject the already-mined vocalization for the bare
// candidate and make re-mining circular (every covered word collapses to an identity row and is dropped on export).
import { phonemizeWordCore as pa } from "../../src/languages/punjabi/punjabi.ts";
import { phonemizeWordCore as ur } from "../../src/languages/urdu/urdu.ts";
import { phonemizeWordCore as ps } from "../../src/languages/pashto/pashto.ts";
import { phonemizeWordCore as fa } from "../../src/languages/persian/persian.ts";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// FULL-DIACRITIZATION fold for Persian (fa): unlike the referee-eval fold (which COLLAPSES short-vowel quality
// a~e~o~i~u → a, so the search accepts a bare default-[a] for any short vowel and mines under-diacritized labels),
// this fold KEEPS a/e/o DISTINCT and DIALECT-NORMALIZES the classical/Dari wikipron references to Iranian: the
// standard historical short-vowel shift classical i→e, u→o (کِتاب kitāb→ketâb, بِله bila→bele) — which the g2p
// reproduces via kasra→e / damma→o — plus the long-vowel merge eː→iː, oː→uː. Result: the inversion is forced to
// pick the harakat that encodes the ACTUAL short vowel, so the mined labels fully encode the pronunciation.
const FA_FULL_FOLD = (s: string): string =>
    s.replace(/[ˈˌ]/g, "").replace(/\s/g, "")
        .replace(/[ɑɒ]ː?/g, "aː").replace(/ɾ/g, "r")
        .replace(/oː/g, "uː").replace(/eː/g, "iː")
        .replace(/i(?!ː)/g, "e").replace(/u(?!ː)/g, "o") // classical short i→e, u→o (Iranian)
        .replace(/(.)\1/g, "$1").normalize("NFC");

// FULL-DIACRITIZATION fold for Pashto (ps): like FA_FULL_FOLD, KEEPS the short-vowel quality a/ə/i/u/o DISTINCT so
// the inversion is forced to pin the actual short vowel (the loose referee-eval fold collapses a/i/u/ɪ/ʊ→ə, so it
// accepts a bare default-ə for ANY short vowel → 78% of ps silver was under-diacritized, the Persian bug). Folds
// only the DIALECT-invariant axes: the multi-dialect ښ (ʂ/ç→ʃ) / ږ (ʐ→ʒ), the retroflex rhotic ɻ→r, the dental
// t̪/d̪, and length/gemination (marked inconsistently by the referee). The lax ɪ/ʊ fold to tense i/u (kasra→i, damma→u).
const PS_FULL_FOLD = (s: string): string =>
    s.replace(/[ˈˌ]/g, "").replace(/\s/g, "").replace(/ː/g, "")
        .replace(/t̪/g, "t").replace(/d̪/g, "d")
        .replace(/[ʂç]/g, "ʃ").replace(/ʐ/g, "ʒ").replace(/ɻ/g, "r")
        .replace(/ɪ/g, "i").replace(/ʊ/g, "u") // lax→tense; a/ə/i/u/o kept DISTINCT (the fix)
        .replace(/(.)\1/g, "$1").normalize("NFC");

// Per-language config: the phonemizer, the wikipron tag in silver.tsv, and the Perso-Arabic letter classes for
// slot-finding. A letter in BOTH cons and vowelLetters (Persian/Pashto list و/ی/ه as consonants but the g2p treats
// them as vowels/glides) is treated as a VOWEL letter — no slot — so the search space doesn't blow up.
interface LangCfg { phon: (w: string) => string; silverCode: string; cons: string; vowelLetters: string }
const LANGS: Record<string, LangCfg> = {
    pa: { phon: pa, silverCode: "pan", cons: "بپتٹثجچحخدڈذرڑزژسشصضطظغفقکگلمنہھءعݨࣇ", vowelLetters: "اآویےئؤ" },
    ur: { phon: ur, silverCode: "urd", cons: "بپتٹثجچحخدڈذرڑزژسشصضطظغفقکگلمنہھءع", vowelLetters: "اآویےئؤﯼﯽ" },
    ps: { phon: ps, silverCode: "pus", cons: "بپتټثجځچڅحخدډذرړزژږسشښصضطظعغفقکكګگلمنڼءھ", vowelLetters: "اآویېۍئےؤهۀ" },
    fa: { phon: fa, silverCode: "fas", cons: "بپتثجچحخدذرزژسشصضطظعغفقکكگلمنء", vowelLetters: "اآویيئؤه" },
};

const FATHA = "َ", KASRA = "ِ", DAMMA = "ُ", SUKUN = "ْ";
// Options per slot. BARE ("") = no diacritic → the g2p's DEFAULT (ə medial / none final), label "0". It is index 0
// so a default schwa harmonizes to "0" (matching the cross-script convention) rather than an explicit fatḥa — the
// fix that lets the silver and cross-script sources agree. FATHA stays available but BARE always wins the tie.
const BARE = "";
const SHORT_OPTS = [BARE, FATHA, KASRA, DAMMA, SUKUN]; // default-ə / ə / ɪ / ʊ / no-vowel
const WAW = "و"; // و — the one AMBIGUOUS long-vowel letter
const YA = "ی"; // ی choti ye — for glide detection (ی before a vowel is a glide, not a long vowel)
// و after a consonant: bare → oː · damma+waw وُ → uː (long vowel). PLUS the GLIDE reading — a short vowel on the
// consonant makes و a glide [w] (fatḥa → a·w, kasra → i·w): the verbal infinitive -ول = /awəl/ (کَول→kawəl). The
// fold-match against the referee disambiguates verb (glide) vs noun (long vowel) per word.
const WAW_OPTS = [BARE, DAMMA, FATHA, KASRA];
const YA_OPTS = [BARE, FATHA]; // bare ی → iː · یَ (ya+fatḥa) → eː (the adapted-word encoding of the iː/eː split)
const MAX_COMBOS = 60000; // product of per-slot option counts; longer words are reported as capped

/** Indices of consonants that take a harakat slot: a consonant (NOT a vowel-letter) NOT immediately followed by a
 *  written vowel letter (word-final, or before another consonant/nasalizer) has an ambiguous short vowel. */
interface Slot { pos: number; options: string[] }
function slots(chars: string[], cfg: LangCfg): Slot[] {
    const out: Slot[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        // Long-vowel ی → iː (bare) vs eː (یَ): a slot only when it's a real long vowel — preceded by a consonant
        // onset and NOT followed by another vowel letter (which would make it a glide).
        const prev = chars[i - 1];
        if (c === YA && prev !== undefined && cfg.cons.includes(prev) && !cfg.vowelLetters.includes(prev) &&
            !(chars[i + 1] !== undefined && cfg.vowelLetters.includes(chars[i + 1]!))) {
            out.push({ pos: i, options: YA_OPTS });
            continue;
        }
        if (!cfg.cons.includes(c) || cfg.vowelLetters.includes(c)) continue;
        const next = chars[i + 1];
        // A ی/و that is itself followed by a vowel letter is a GLIDE (‑iyā, ‑uwā); the consonant before it still
        // takes a short vowel (آبادیات → ɑbɑd·ə·jɑt), so treat it as a short slot rather than skipping it.
        const glideNext = (next === YA || next === WAW) && chars[i + 2] !== undefined &&
            cfg.vowelLetters.includes(chars[i + 2]!);
        if (glideNext) out.push({ pos: i, options: SHORT_OPTS });
        else if (next === WAW) out.push({ pos: i, options: WAW_OPTS }); // و long vowel: oː (bare) vs uː (damma)
        else if (next === undefined || !cfg.vowelLetters.includes(next))
            out.push({ pos: i, options: SHORT_OPTS }); // short vowel: default-ə / ɪ / ʊ / none
    }
    return out;
}

/** Build the vocalized skeleton for one assignment of harakat to the slots. */
function vocalize(chars: string[], sl: Slot[], choice: number[]): string {
    const ins = new Map<number, string>();
    sl.forEach((s, k) => { const h = s.options[choice[k]!]!; if (h) ins.set(s.pos, h); });
    let out = "";
    for (let i = 0; i < chars.length; i++) {
        out += chars[i];
        const h = ins.get(i);
        if (h) out += h;
    }
    return out;
}

const LEXICON = process.argv.includes("--lexicon");

function label(lang: string): void {
    const cfg = LANGS[lang];
    if (!cfg) throw new Error(`no inversion config for "${lang}"`);
    const looseFold = makeFold(CONFIG[lang]!);
    // fa mines TWO-PASS: first the FULL-DIACRITIZATION fold (keeps short-vowel quality, dialect-normalizes
    // classical→Iranian i→e/u→o) so the label encodes the real pronunciation; on a miss, fall back to the loose
    // referee-eval fold (short-vowels collapsed → a bare skeleton label) so we never LOSE the coverage the loose
    // fold had. Other riders use the loose fold only (their dialect maps are a follow-up). See FA_FULL_FOLD.
    const passes =
        lang === "fa" ? [FA_FULL_FOLD, looseFold]
        : lang === "ps" ? [PS_FULL_FOLD, looseFold]
        : [looseFold];

    // Two outputs from the SAME inverter:
    //  • NEURAL training (default) — wikipron + convention-harmonized kaikki only. NOT Hindi→Urdu: it's a different
    //    vocabulary distribution, so it can't improve wikipron-distribution GENERALIZATION (measured flat, Run 20).
    //  • LEXICON (--lexicon) — ALL sources incl. Hindi→Urdu (real Urdu spellings + gold IPA). This is the COVERAGE
    //    layer (exact-match at inference); Hindi adds +12 pts of production token-coverage for Urdu (coverage_eval).
    const sources = LEXICON
        ? ["silver.tsv", "silver.kaikki.tsv", "silver.hindiurdu.tsv"]
        : ["silver.tsv", "silver.kaikki.tsv"];
    const rows = sources
        .flatMap((f) => existsSync(join(HERE, f)) ? readFileSync(join(HERE, f), "utf8").split("\n") : [])
        .map((l) => l.split("\t"))
        .filter((a) => a.length >= 3 && a[1] === cfg.silverCode);

    const labeled: string[] = [];
    const seenSkel = new Set<string>(); // lexicon: one vocalization per skeleton (the lookup key)
    let ok = 0, capped = 0, miss = 0;
    for (const [skel, , ipa] of rows) {
        if (LEXICON && seenSkel.has(skel!)) continue;
        const chars = [...skel!.normalize("NFC")];
        const sl = slots(chars, cfg);
        let total = 1;
        for (const s of sl) total *= s.options.length;
        if (total > MAX_COMBOS) { capped++; continue; }
        const heFinal = lang === "fa" && /[هة]$/.test(skel!.normalize("NFC"));
        let found: string | null = null;
        for (const fold of passes) {
            let target = fold(ipa!);
            // fa: word-final ه is our Iranian [e] but the classical reference writes final [a] (خانه xaːna) — a
            // non-slot position no harakat can fix, so normalize the reference's final [a] to [e] for ه-final words.
            if (heFinal) target = target.replace(/a$/, "e");
            for (let n = 0; n < total && !found; n++) {
                const choice: number[] = [];
                let x = n;
                for (const s of sl) { choice.push(x % s.options.length); x = Math.floor(x / s.options.length); }
                const voc = vocalize(chars, sl, choice);
                if (fold(cfg.phon(voc)) === target) found = voc;
            }
            if (found) break; // full-diacritization pass won; don't fall back to the loose skeleton
        }
        if (found) { ok++; labeled.push(`${skel}\t${lang}\t${found}`); if (LEXICON) seenSkel.add(skel!); }
        else miss++;
    }

    const fname = LEXICON ? `lexicon.${lang}.tsv` : `harakat.${lang}.silver.tsv`;
    writeFileSync(join(HERE, fname), labeled.join("\n") + (labeled.length ? "\n" : ""));
    const tot = rows.length || 1;
    console.log(
        `${lang}: ${rows.length} words · labeled ${ok} (${(100 * ok / tot).toFixed(1)}%) · ` +
        `miss ${miss} · capped(>${MAX_COMBOS} combos) ${capped} → ${fname}`,
    );
}

const arg = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "pa";
for (const l of arg === "all" ? ["pa", "ur", "ps", "fa"] : [arg]) label(l);
