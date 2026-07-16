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
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phonemizeWord as pa } from "../../src/languages/punjabi/punjabi.ts";
import { phonemizeWord as ur } from "../../src/languages/urdu/urdu.ts";
import { phonemizeWord as ps } from "../../src/languages/pashto/pashto.ts";
import { phonemizeWord as fa } from "../../src/languages/persian/persian.ts";
import { makeFold } from "../referee-eval/eval.ts";
import { CONFIG } from "../referee-eval/config.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

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
const WAW_OPTS = [BARE, DAMMA]; // bare و → oː · damma+waw وُ → uː (the long-vowel search)
const MAX_COMBOS = 60000; // product of per-slot option counts; longer words are reported as capped

/** Indices of consonants that take a harakat slot: a consonant (NOT a vowel-letter) NOT immediately followed by a
 *  written vowel letter (word-final, or before another consonant/nasalizer) has an ambiguous short vowel. */
interface Slot { pos: number; options: string[] }
function slots(chars: string[], cfg: LangCfg): Slot[] {
    const out: Slot[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
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

function label(lang: string): void {
    const cfg = LANGS[lang];
    if (!cfg) throw new Error(`no inversion config for "${lang}"`);
    const fold = makeFold(CONFIG[lang]!);

    const rows = readFileSync(join(HERE, "silver.tsv"), "utf8")
        .split("\n")
        .map((l) => l.split("\t"))
        .filter((a) => a.length >= 3 && a[1] === cfg.silverCode);

    const labeled: string[] = [];
    let ok = 0, capped = 0, miss = 0;
    for (const [skel, , ipa] of rows) {
        const chars = [...skel!.normalize("NFC")];
        const sl = slots(chars, cfg);
        let total = 1;
        for (const s of sl) total *= s.options.length;
        if (total > MAX_COMBOS) { capped++; continue; }
        const target = fold(ipa!);
        let found: string | null = null;
        for (let n = 0; n < total && !found; n++) {
            const choice: number[] = [];
            let x = n;
            for (const s of sl) { choice.push(x % s.options.length); x = Math.floor(x / s.options.length); }
            const voc = vocalize(chars, sl, choice);
            if (fold(cfg.phon(voc)) === target) found = voc;
        }
        if (found) { ok++; labeled.push(`${skel}\t${lang}\t${found}`); }
        else miss++;
    }

    const out = join(HERE, `harakat.${lang}.silver.tsv`);
    writeFileSync(out, labeled.join("\n") + (labeled.length ? "\n" : ""));
    const tot = rows.length || 1;
    console.log(
        `${lang}: ${rows.length} words · labeled ${ok} (${(100 * ok / tot).toFixed(1)}%) · ` +
        `miss ${miss} · capped(>${MAX_COMBOS} combos) ${capped} → harakat.${lang}.silver.tsv`,
    );
}

const arg = process.argv[2] ?? "pa";
for (const l of arg === "all" ? ["pa", "ur", "ps", "fa"] : [arg]) label(l);
