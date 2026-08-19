/**
 * ASYNC (neural best-path) registry: code → the language's best available async phonemizer.
 * The sync sibling is registry.ts; index.ts routes phonemizeAsync through here. Each entry
 * self-falls-back to the sync engine when `onnxruntime-node` or its model is absent, so routing
 * here is always safe. Every language entry lives beside its engine in src/languages/<lang>/.
 */
import { prePass } from "./registry.ts";
import { phonemizeArabic } from "./languages/arabic/arabic.ts";
import { phonemizeEnNeural } from "./languages/english/englishNeural.ts";
import { phonemizeBnNeural } from "./languages/bengali/bengaliNeural.ts";
import { phonemizeDaNeural } from "./languages/danish/danishNeural.ts";
import { phonemizeNbNeural } from "./languages/norwegian/norwegianNeural.ts";
import { phonemizeFrNeural } from "./languages/french/frenchNeural.ts";
import { phonemizeFaNeural } from "./languages/persian/persianNeural.ts";
import { phonemizeHebrewNeural } from "./languages/hebrew/hebrewNeural.ts";
import { phonemizeKmNeural } from "./languages/khmer/khmerNeural.ts";
import { phonemizeRiderNeural } from "./languages/perso-arabic/riderNeural.ts";
import { phonemizeSdNeural } from "./languages/sindhi/sindhiNeural.ts";
import { phonemizeAfNeural } from "./languages/afrikaans/afrikaansNeural.ts";
import { phonemizeCkbNeural } from "./languages/central-kurdish/centralKurdishNeural.ts";

// Arabic ISO code → engine variety (mirrors the sync registry); every key routes bare text
// through the async diacritizer.
const ARABIC_VARIETY: Record<string, string | undefined> = {
    ar: undefined, arz: "egyptian", apc: "levantine", ajp: "southlevantine", apd: "sudanese",
    acm: "iraqi", afb: "gulf", acw: "hijazi", ary: "moroccan", ayl: "libyan",
};

const NEURAL: Record<string, (text: string) => Promise<string>> = {
    en: phonemizeEnNeural, // BiLSTM OOV reader (else the sync n-gram OOV G2P)
    sd: phonemizeSdNeural, // per-letter BiLSTM restoring the abjad's unwritten short vowels on OOV words
    // per-grapheme BiLSTM reading the words BOTH af lexicons miss: 91.4% vs the rules' 63.5% word-exact
    // on a dictionary-gold held-out split, because af's residual is stress-conditioned vowel quality — contextual, not tabulable
    af: phonemizeAfNeural,
    bn: phonemizeBnNeural,
    // BiLSTM placing the BIZROKE — Sorani's one unwritten vowel — on the words the AsoSoft-derived lexicon
    // misses. 96.6% word-exact against a 73.8% never-insert baseline on a stem-blind held-out split; the
    // AsoSoft source is 10,041 words and exhausted, leaving ~2,000 corpus types the lexicon cannot reach.
    // ⚠ The audio cannot score this (the ASR under-transcribes Sorani — 0.929 of our folded phone count,
    // against 0.987 de / 0.998 fr) and the referee could not either until ckb.jsonc stopped folding [əɪ] to
    // NOTHING, which scored the vowel's presence as free. Normalising it to ə instead — the referees agree on
    // presence and position, only quality differs — makes the tier visible: 85.2%/85.0% (wikipron/kaikki)
    // against the lexicon-only 74.8%/73.6% and rules-only 72.3%/71.2%.
    ckb: phonemizeCkbNeural,
    da: phonemizeDaNeural,
    nb: phonemizeNbNeural,
    fr: phonemizeFrNeural,
    fa: phonemizeFaNeural,
    he: phonemizeHebrewNeural, // the NAKDAN — restores niqqud on bare Hebrew
    // per-character BiLSTM restoring the WORD BOUNDARIES Khmer does not write: joining two words
    // corrupts the reading 54.6% of the time, measured on writer-typed U+200B junctions
    km: phonemizeKmNeural,
    // ur: the rider EARNS its place here — 66.3% against sync's 64.2% on ur.cle-speech (n=5,667), with
    // async-only-right 178 against sync-only 62. Measured, not assumed.
    ur: (t) => phonemizeRiderNeural(t, "ur"),
    // ⚠ `ps` IS DELIBERATELY ABSENT, so `phonemizeAsync` falls through to the sync engine. The same rider
    // that helps Urdu is NET-NEGATIVE for Pashto, and it always was: `ps_neural_restoration_investigation.md`
    // Run 11 measured it in 2026-07 (sync 45.3% / neural 44.0%) and its DECISION was "do NOT retrain/wire
    // the neural" — but the entry stayed here, so the async path shipped the losing side. Re-measured
    // 2026-08-19 across all NINE ps referees, sync is >= async on every one and worse on none:
    //
    //     pbt (Kandahari, the variety this engine targets)  79.4% / 79.4%   sync-only 0   async-only 0
    //     kaikki-pus                                        72.3% / 71.7%   sync-only 10  async-only 3
    //     kaikki-untagged                                   74.3% / 73.5%   sync-only 12  async-only 4
    //     wikipron pbt / pbu / pst / pus                    ~0.5pp apart    sync-only 8   async-only 1
    //
    // ⚠ AND IT MATTERS MORE THAN THE HALF-POINT SUGGESTS, because the ASR corpus is built with
    // `phonemizeAsync`: the rider was corrupting words the rules get right — تر t̪ˈər→t̪r, شک ʃˈək→ʃk,
    // رنځ rənˈəd͡z→ksdɹ, کې kˈe→d̪ — i.e. deleting the zwarakay and, in places, the word. 381 of the
    // corpus's 7,310 vowel-less Pashto tokens are this. The remaining 6,929 are a rules gap, tracked
    // separately.
    // Western Punjabi (Shahmukhi) is registry code `pnb`, but the rider keys its Perso-Arabic
    // Punjabi as `pa` (the Gurmukhi `pa` is fully voweled → not a rider; it passes through sync).
    pnb: (t) => phonemizeRiderNeural(t, "pa"),
};

/**
 * The language's best ASYNC path, or undefined when its best path is the sync engine.
 *
 * ⚠ THE SHARED PRE-PASSES ARE APPLIED HERE, not in the entries. `phonemize` reaches them because it goes
 * through `getPhonemizer`, which wraps every engine's `text`; the entries below build their engine directly —
 * they have to, since they need constructor arguments and extra `text` arguments the registry's instance does
 * not carry — so they used to reach NONE of them. Measured cost, before this: `phonemizeAsync("سال ۲۰۲۴ ۾",
 * "sd")` was *sˈaːlʊ mˈẽ*, the language's own digits gone; `<i>` was read aloud in every language; `XIV` was
 * read as a word; a vulgar fraction vanished. 153 sync/async disagreements over 23 codes × 8 probes, and 0 of
 * them in `ur`/`ps`/`pnb` — the three that ride `riderNeural`, the one entry that already routed through the
 * registry. See tools/eval/async-sync-differential.ts.
 *
 * Applied to the INPUT, before the entry runs, because that is where the sync path applies it: ahead of the
 * tokenizer. The async analogue is ahead of the TAGGER — a tagger handed un-stripped `<i>` tags them as words.
 *
 * The FOREIGN-RUN HOST is the other half and cannot live here: `core/foreign.ts`'s stack is only correct
 * within one synchronous turn, so holding a host across the `await` below would let concurrent callers
 * interleave. Each entry wraps its own synchronous render in `withHost` instead.
 */
export function getNeuralPhonemizer(lang: string): ((text: string) => Promise<string>) | undefined {
    if (lang in ARABIC_VARIETY) return (t) => phonemizeArabic(prePass(lang, t), ARABIC_VARIETY[lang], { host: lang });
    const neural = NEURAL[lang];
    return neural && ((t) => neural(prePass(lang, t)));
}
