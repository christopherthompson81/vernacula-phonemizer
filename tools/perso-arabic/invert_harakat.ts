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
// FULL-DIACRITIZATION fold for Urdu (ur): the loose referee-eval fold collapses BOTH axes the harakat can
// encode — the three shorts ([ɪʊ]→ə, so zer/pesh were accepted as bare-schwa: the Persian bug doubled) AND
// the majhūl ([eɛ]→i, [oɔ]→u, so bare-ی passed for eː where YA_OPTS can write یَ). This fold KEEPS ə/ɪ/ʊ and
// e/o distinct so the inversion must pin them; only the unencodable openings fold (ɛ→e, ɔ→o). Notation-only
// axes stay folded (degemination, ɾ→r, ʋ→v, stress).
const UR_FULL_FOLD = (s: string): string =>
    s.replace(/[ˈˌ]/g, "").replace(/\s/g, "")
        .replace(/ɛ(?!ː)/g, "e").replace(/ɔ(?!ː)/g, "o")
        .replace(/ɛː/g, "eː").replace(/ɔː/g, "oː")
        .replace(/ɾ/g, "r").replace(/ʋ/g, "v")
        .replace(/(.)\1/g, "$1").normalize("NFC");
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
const WAW_OPTS = [BARE, DAMMA]; // bare و → oː · damma+waw وُ → uː (the long-vowel search)
// ps ONLY (validated for Pashto; a follow-up for the others): the و GLIDE reading — a short vowel on the preceding
// consonant makes و a glide [w] (fatḥa → a·w, kasra → i·w), the verbal infinitive -ول = /awəl/ (کَول→kawəl). The
// referee fold-match disambiguates verb (glide) vs noun (long vowel) per word.
// ⚠ THE OPTION SET IS UNCHANGED BUT DAMMA NOW MEANS SOMETHING ELSE, AND THAT IS WHY ps MUST BE RE-MINED. While
// the g2p gated its mater-lectionis rule to word-final position, a medial ⟨ـُو⟩ emitted u·w·ə, so DAMMA was a
// second way to spell the GLIDE and the search used it that way — بندول was mined as بندُول for /bandawəl/.
// DAMMA now means the long /uː/ that WAW_OPTS above always claimed it did, and FATHA is the only glide spelling.
// The search re-derives both from the same options; the stale rows are what would break.
const WAW_GLIDE_OPTS = [BARE, DAMMA, FATHA, KASRA];
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
        // ps: a MEDIAL و between two consonants is long-vowel (bare, الوتل→alot̪əl) vs GLIDE (وْ sukun, الوْتل→alwətəl).
        const cons = (x: string | undefined) => x !== undefined && cfg.cons.includes(x) && !cfg.vowelLetters.includes(x);
        if (cfg.silverCode === "pus" && c === "و" && cons(chars[i - 1]) && cons(chars[i + 1])) {
            out.push({ pos: i, options: [BARE, SUKUN] });
            continue;
        }
        if (!cfg.cons.includes(c) || cfg.vowelLetters.includes(c)) continue;
        const next = chars[i + 1];
        // A ی/و that is itself followed by a vowel letter is a GLIDE (‑iyā, ‑uwā); the consonant before it still
        // takes a short vowel (آبادیات → ɑbɑd·ə·jɑt), so treat it as a short slot rather than skipping it.
        const glideNext = (next === YA || next === WAW) && chars[i + 2] !== undefined &&
            cfg.vowelLetters.includes(chars[i + 2]!);
        if (glideNext) out.push({ pos: i, options: SHORT_OPTS });
        // ⚠ word-final ی — RE-KEYED when the g2p learned that ⟨ی⟩ and ⟨ي⟩ differ word-finally. It used to read
        // "bare → iː (long) vs fatḥa → the -ay diphthong", but ⟨ی⟩ finally is the diphthong in 108/125 (86%) of
        // the pbt reference, so BARE is now the diphthong and the long /iː/ needed somewhere else to live.
        // KASRA is that place, and only because the mater-lectionis rule stopped being gated to word-final:
        // ⟨ـِی⟩ is homorganic → /iː/ (ناڅاپِی→nɑt͡sɑpiː). Without the kasra option the 8 genuinely-/i/ words in
        // the reference would have become UNREACHABLE for the miner — a silent loss of expressiveness.
        else if (cfg.silverCode === "pus" && next === YA && i + 2 === chars.length)
            out.push({ pos: i, options: [BARE, FATHA, KASRA] }); // bare → əi · fatḥa → aɪ · kasra → the long iː
        else if (next === WAW) // و long vowel oː/uː; ps also searches the glide reading (‑ول → /awəl/)
            out.push({ pos: i, options: cfg.silverCode === "pus" ? WAW_GLIDE_OPTS : WAW_OPTS });
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
        : lang === "ur" ? [UR_FULL_FOLD, looseFold]
        : [looseFold];

    // Two outputs from the SAME inverter:
    //  • NEURAL training (default) — wikipron + convention-harmonized kaikki only. NOT Hindi→Urdu: it's a different
    //    vocabulary distribution, so it can't improve wikipron-distribution GENERALIZATION (measured flat).
    //  • LEXICON (--lexicon) — ALL sources incl. Hindi→Urdu (real Urdu spellings + gold IPA). This is the COVERAGE
    //    layer (exact-match at inference); Hindi adds +12 pts of production token-coverage for Urdu (coverage_eval).
    // ⚠ `--no-referee-silver` EXISTS TO MAKE THE ps REFEREE NUMBER HONEST, and it is a measurement flag, not a
    // build flag — never use it to produce a shipped lexicon. `silver.tsv` and `silver.kaikki.tsv` ARE wikipron
    // and kaikki, which are also ps's referees, so a lexicon row mined from them and then scored against them is
    // circular. Dropping them leaves the espeak tranche, which no referee has ever seen, and the resulting score
    // is the one to quote. See docs/investigations/ps_neural_restoration_investigation.md Run 11.
    const NO_REF_SILVER = process.argv.includes("--no-referee-silver");
    const sources = NO_REF_SILVER
        ? []
        : LEXICON
        ? ["silver.tsv", "silver.kaikki.tsv", "silver.hindiurdu.tsv"]
        : ["silver.tsv", "silver.kaikki.tsv"];
    let rows = sources
        .flatMap((f) => existsSync(join(HERE, f)) ? readFileSync(join(HERE, f), "utf8").split("\n") : [])
        .map((l) => l.split("\t"))
        .filter((a) => a.length >= 3 && a[1] === cfg.silverCode);
    // pa ONLY: the CROSS-SCRIPT pairs (real Shahmukhi spelling → gold IPA from the voweled Gurmukhi sister,
    // 11,166 rows after #788 — both kaikki directions + the skeleton-gated Wikipedia-title tranche) are
    // exactly this miner's input shape and 4x the wikipron/kaikki silver. Same inversion, same round-trip
    // verification — the harakat label exists only where a vocalization REPRODUCES the cross-script gold.
    if (lang === "pa") {
        const cs = join(HERE, "../../data/languages/punjabi/crossscript.tsv");
        // ⚠ DICTIONARY TRANCHE ONLY (the kaikki dual-script pairs), NOT the Wikipedia-title tranche. The
        // titles are 65% foreign proper nouns, and training on them regressed EVERY rider on the fixed
        // wikipron eval set (pa 58.5→54.5, ps −4.4, ur −1.8 — the same register confound the pa BiLSTM
        // restorer measured, investigation Run 9/10: titles are LEXICON material, not training material).
        const keysFile = join(HERE, "pa_kaikki_keys.txt");
        if (existsSync(cs) && existsSync(keysFile)) {
            const kaikkiKeys = new Set(readFileSync(keysFile, "utf8").split("\n"));
            const extra = readFileSync(cs, "utf8").split("\n")
                .filter((l) => l.includes("\t") && !l.startsWith("#"))
                .map((l) => { const [w, ipa] = l.split("\t"); return [w!, cfg.silverCode, ipa!] as string[]; })
                .filter((r) => kaikkiKeys.has(r[0]!));
            const seen = new Set(rows.map((r) => r[0]));
            rows = rows.concat(extra.filter((r) => !seen.has(r[0])));
        }
    }

    // ps ONLY: espeak-ng's `dictsource/ps_list` (81,259 mappable entries after tools/pashto/build_espeak_silver.py),
    // which is ~33× the wikipron+kaikki silver this miner otherwise has for Pashto. The investigation doc had
    // recorded "there is NO larger machine-readable Pashto IPA corpus"; that was a false negative from
    // `sources.ts` gating its espeak tier on an unset $ESPEAK_NG, not a fact about espeak.
    // ⚠ IT IS SILVER AND THE INVERTER IS WHAT MAKES IT SAFE. espeak under-vocalizes ~26% of the words it shares
    // with the referee (it drops the epenthetic schwa our g2p models: اتل `a:tl` against the referee's `a t ə l`)
    // and it disagrees with our dialect on ږ (`موږ` → ʁ where we read ʐ). Neither is trusted: a row yields a label
    // only where some vocalization REPRODUCES that IPA under PS_FULL_FOLD, so espeak's errors and its dialect
    // disagreements self-filter rather than being imported. The yield rate IS the accuracy measurement.
    // ps: ps.wiktionary's romanizations (tools/pashto/build_pswiktionary_silver.py). SMALL — ~550 rows against
    // espeak's 81k — but the only tranche here that is BOTH pbt-majority (ښ→ṣ̌/x̌ 99%, ږ→ẓ̌/ǧ 100%, where wikipron
    // leans ~3:1 Northern) and independent of every referee, so its rows add coverage without adding
    // circularity. ⚠ ORDERED BEFORE espeak DELIBERATELY: `seenSkel` keeps the FIRST vocalization per skeleton,
    // so for a word both sources cover, the Southern reading wins the tie. See investigation Run 13.
    if (lang === "ps") {
        const pw = join(HERE, "silver.pswikt-ps.tsv");
        if (existsSync(pw)) {
            const seen = new Set(rows.map((r) => r[0]));
            rows = rows.concat(
                readFileSync(pw, "utf8").split("\n")
                    .filter((l) => l.includes("\t") && !l.startsWith("#"))
                    .map((l) => l.split("\t"))
                    .filter((a) => a.length >= 3 && !seen.has(a[0])),
            );
        }
    }
    if (lang === "ps") {
        const esp = join(HERE, "silver.espeak-ps.tsv");
        // ⚠ SAY SO WHEN THE TRANCHE IS ABSENT. It is deliberately NOT committed — 2.5 MB of GPL-derived
        // intermediate, one command to rebuild — so the common case is that a fresh checkout does not have
        // it. Silently skipping would take the shipped lexicon from 10,723 rows to ~351 with a clean exit
        // and no diff to explain it, which is the worst kind of regression: a re-mine that looks like it
        // worked. Loud, and with the exact command.
        if (!existsSync(esp)) {
            console.warn(
                `⚠ ps: ${esp} is MISSING — the espeak tranche (81,259 rows) will be SKIPPED and the mined\n` +
                "  lexicon will collapse from ~10,723 rows to ~351. Rebuild it first:\n" +
                "    ESPEAK_NG=<espeak-ng checkout> python3 tools/pashto/build_espeak_silver.py \\\n" +
                "        --out tools/perso-arabic/silver.espeak-ps.tsv",
            );
        }
        if (existsSync(esp)) {
            const seen = new Set(rows.map((r) => r[0]));
            const extra = readFileSync(esp, "utf8").split("\n")
                .filter((l) => l.includes("\t") && !l.startsWith("#"))
                .map((l) => l.split("\t"))
                .filter((a) => a.length >= 3 && !seen.has(a[0]));
            rows = rows.concat(extra);
        }
    }

    // ⚠ SHARDING, because this search is the pipeline's wall-clock. It is a per-word brute force over up to
    // MAX_COMBOS vocalizations, each one a full g2p call, and it is EMBARRASSINGLY PARALLEL — every word is
    // independent. Single-threaded it pins one core and leaves the other fifteen idle; the espeak tranche took
    // it from ~2.5k words to ~84k, at which point that stopped being acceptable. `--shard k/N` takes every Nth
    // row and writes `<name>.partK`; the driver concatenates. Row order within a shard is preserved, and the
    // shard set is a partition, so the merged output is the same LABEL SET as a serial run (line order differs,
    // and every consumer of these files either sorts or builds a map).
    const shardArg = process.argv.find((a) => a.startsWith("--shard="))?.slice(8);
    const [shardK, shardN] = shardArg ? shardArg.split("/").map(Number) : [0, 1];
    if (shardN === undefined || shardN < 1 || shardK === undefined || shardK < 0 || shardK >= shardN) {
        throw new Error(`--shard=k/N needs 0 <= k < N (got ${shardArg})`);
    }

    const labeled: string[] = [];
    const seenSkel = new Set<string>(); // lexicon: one vocalization per skeleton (the lookup key)
    let ok = 0, capped = 0, miss = 0;
    let rowIndex = -1;
    for (const [skel, , ipa] of rows) {
        rowIndex++;
        if (shardN > 1 && rowIndex % shardN !== shardK) continue;
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

    // ⚠ The measurement build gets its OWN filename so it can never be mistaken for, or overwrite, the shipped one.
    const base = LEXICON
        ? `lexicon.${lang}${NO_REF_SILVER ? ".noref" : ""}.tsv`
        : `harakat.${lang}.silver.tsv`;
    const fname = shardN > 1 ? `${base}.part${shardK}` : base;
    writeFileSync(join(HERE, fname), labeled.join("\n") + (labeled.length ? "\n" : ""));
    const tot = (shardN > 1 ? ok + miss + capped : rows.length) || 1;
    console.log(
        `${lang}: ${tot} words · labeled ${ok} (${(100 * ok / tot).toFixed(1)}%) · ` +
        `miss ${miss} · capped(>${MAX_COMBOS} combos) ${capped} → ${fname}`,
    );
}

const arg = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "pa";
for (const l of arg === "all" ? ["pa", "ur", "ps", "fa"] : [arg]) label(l);
