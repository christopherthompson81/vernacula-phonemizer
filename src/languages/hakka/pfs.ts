/**
 * PHA̍K-FA-SṲ → IPA, the front end that makes hak.wikipedia readable at all.
 *
 * ⚠ THE PROBLEM THIS EXISTS FOR, MEASURED. hak.wikipedia is not written in Han. Over the artifact's
 * uniform-stride sample tier — so this is the wiki's real distribution — **93.5% of the characters are
 * Latin**: it is written in Pha̍k-fa-sṳ, the missionary romanization. The shared Han-dict engine reads Han
 * and routes every Latin run to the injected `foreign` reader, which for `hak` is ENGLISH. So the language's
 * own encyclopedia read as English:
 *
 *     Pak-khô-chhiòn-sû he tui Ngìn-lui …  →  pʰˈæk khˈoᶷ kʃˈʌn sˈuː hˈiː t͡ʃˈʌwɪ nd͡ʒˈɪn lˈuːɪ …
 *
 * ⚠ AND WHY IT COULD BE DERIVED RATHER THAN HAND-AUTHORED, which is the only reason it was tractable. The
 * kaikki extract this language's dict already comes from carries, for 6,269 headwords, BOTH a Pha̍k-fa-sṳ
 * spelling and a Meixian Sinological-IPA reading — a parallel corpus of exactly the two things needed.
 * 4,754 align syllable-for-syllable (PFS hyphens against IPA spaces against Han characters, three lengths
 * that must agree). `tools/gen/build-hak-pfs.mts` turns that into `pfs.tsv`; the tone system falls out of it
 * rather than being assumed. See `pfs.PROVENANCE.md` and
 * `docs/investigations/hak/pfs_build_notes_investigation.md`.
 *
 * ⚠ IT IS A DIALECT TRANSLATION, DELIBERATELY. Wiktionary tags the PFS spelling *Sixian* (Taiwan) and this
 * engine is *Meixian*. Pairing them maps the SPELLING onto THIS ENGINE'S dialect instead of importing a
 * second phonology: 西 is `sî`, Sixian /si²⁴/, Meixian /ɕi⁴⁴/, and this emits the Meixian form. One language,
 * one phonology. The alternative would have made `hak` emit two dialects depending on which script the
 * sentence happened to be in — which is the defect, not the fix.
 *
 * ── HOW A RUN IS READ, and the order is the whole design ─────────────────────────────────────────────────
 *
 *   1. WHOLE-WORD KEY (`hak-kâ`). 2,257 of them, and they exist for ONE reason: their readings keep the
 *      `underlying⁻surface` SANDHI ARROW. The Han path gets word-internal sandhi from multi-character dict
 *      entries; without word keys the romanized path would silently lose it and every syllable would come
 *      out in its citation tone.
 *   2. SYLLABLE KEYS, 1,279, with the arrow collapsed to the underlying tone — a syllable read alone is a
 *      citation form.
 *   3. COMPOSITION, for a syllable in neither. Onset + rime + tone, where the rime is taken from an ATTESTED
 *      SIBLING in the table above rather than from a second data file. That is why there is no rime artifact
 *      to drift: the fallback is an index over `pfs.tsv`, built once at load.
 *   4. FAILURE, which is a FEATURE. If any syllable resolves nowhere the whole run is handed back to
 *      `foreign`, because a run that does not parse as PFS is a foreign word — and 7.5% of this corpus's
 *      Latin is exactly that (`Nobel`, `Québec`, `Castilla`, `Zaragoza`, `iPhone`, quoted English).
 *
 * ⚠ THE SIBLING MUST SHARE THE ONSET WHERE ONE EXISTS, because the medial glide is conditioned by it — PFS
 * `o` is /o/ after most onsets and /au/ after others, `ong` is ɔŋ / iɔŋ / uɔŋ. A sibling that shares the
 * onset also settles PALATALIZATION for free (`s` → s or ɕ), which a rule would have had to guess.
 *
 * ⚠ AND THE FALLBACK IS 81.7% EXACT, MEASURED HELD-OUT — `build-hak-pfs.mts --validate` removes each attested
 * syllable from the table, composes it against the remaining 1,278, and compares. That number is worth
 * stating plainly because it is NOT good: roughly one composed syllable in five is wrong. It is shipped
 * anyway, and the arithmetic is why — composition covers 4.8% of the corpus's Latin word tokens, so it
 * leaves ~0.9% of them imperfect, against 100% of them wrong (read as English) without it.
 * ⚠ BEWARE THE FLATTERING VERSION OF THIS MEASUREMENT. Scoring the fallback on the syllables kaikki happens
 * to LACK gives 8.9%, because those are the rare ones where the Han dict most often carries a different
 * sense; an early ad-hoc probe that skipped the reader's own ≤2-letter refusal gave 83.9%. Only the held-out
 * run through the shipped code is the number.
 *
 * ⚠ A LONE UNHYPHENATED WORD OF ≤2 LETTERS WITH NO PFS DIACRITIC IS NOT CLAIMED. Measured: the words that
 * only COMPOSE (rather than being attested) are 1.22% of the corpus's word tokens, and they split three
 * ways — 291 types carry a PFS diacritic and are unmistakable (`kâi`, `chhṳ̂n`, `khiûn`), 132 types are 3+
 * bare letters and are mostly real (`ngim` 任 ×666, `kha`, `vet`, `sut`), and 46 types are ≤2 bare letters
 * and are mostly NOT Hakka: `me`, `a`, `tu`, `g`, `u`, `na`, `en`, and the UNIT `km`. Only the last group is
 * refused. A two-letter fragment is where an orthography with 18 onsets and 72 rimes stops discriminating.
 *
 * ⚠ ⟨ts⟩/⟨tsh⟩ ARE FOLDED TO ⟨ch⟩/⟨chh⟩, and ⟨j⟩ IS NOT. Part of this wiki spells the affricates the other
 * way (`tshai`, `tsú`, `tshièn`, `tsṳ̂` — 5,230 syllable tokens), and folding them gains 1.2 points of
 * coverage. The same test on ⟨j⟩ gained 0.1, and reading the instances says why: `jawa`, `john`, `james`,
 * `azerbaijan`, `punjabi`. ⟨j⟩ is not a variant spelling here, it is foreign names — so folding it would
 * have claimed them. The small number was the signal (playbook trap 2, from the useful direction).
 *
 * ⚠ WHAT THIS DOES NOT DO, stated so it is not mistaken for done:
 *   · NO CROSS-WORD SANDHI. Word-internal sandhi comes from the word keys; a sandhi domain spanning two
 *     orthographic words is not modelled — and is not modelled on the Han path either, so the two agree.
 *   · NO DISAMBIGUATION BY SENSE. A PFS syllable with two readings takes the more attested one; 324 of the
 *     1,279 are ambiguous even after collapsing sandhi, and the majority reading covers 90.6% of
 *     attestations. The Han path has the same property and resolves more of it, because a Han word key is
 *     longer than a PFS syllable.
 */
import { loadTsvMap } from "../../core/loadTsv.ts";

export interface PfsDef {
    /** PFS onset → its Meixian IPA; a second entry is the PALATAL alternant before a front-high nucleus. */
    pfsOnsets: Record<string, readonly string[]>;
    /** PFS tone diacritic (plus the pseudo-key `checked`) → Meixian pitch digits. */
    pfsTones: Record<string, string>;
}

/** The PFS tone marks as combining characters. ⚠ U+0324 (⟨ṳ⟩) is a VOWEL letter and is deliberately absent. */
const TONE_MARKS = "̂̀́̍"; // ̂ ̀ ́ ̍
const TONE_RE = new RegExp(`[${TONE_MARKS}]`, "gu");
/** The diacritics that mark a string as PFS rather than possibly-English — the two vowel letters included. */
const PFS_DIACRITIC = new RegExp(`[${TONE_MARKS}̤͘]`, "u");

/** A syllable stripped to its bare letters, plus whichever tone mark it carried. */
function stripTone(syl: string): { base: string; mark: string } {
    const d = syl.normalize("NFD");
    const mark = [...d].find((c) => TONE_MARKS.includes(c)) ?? "";
    return { base: d.replace(TONE_RE, ""), mark };
}

/** ⟨ts⟩/⟨tsh⟩ → ⟨ch⟩/⟨chh⟩ — the other affricate spelling this wiki uses. ⚠ Order: the digraph first. */
const foldVariants = (s: string): string => s.replace(/tsh/gu, "chh").replace(/ts/gu, "ch");

/** The lookup key for a PFS string: lower-cased, variant-folded, and NFD so the marks compare. */
const key = (s: string): string => foldVariants(s.toLowerCase()).normalize("NFD");

interface Index {
    table: Map<string, string>;
    /** onset+"\u0000"+rime → the attested IPA of a sibling syllable, tone stripped. */
    pair: Map<string, string>;
    /** rime → the attested IPA RIME of any sibling, tone stripped. */
    rime: Map<string, string>;
    onsets: string[];
}

/**
 * ⚠ CACHED ON THE TABLE, NOT THE MANIFEST. The index is derived from `pfs.tsv`, so the table is what
 * identifies it — and keying on the def would have handed a caller that passes a DIFFERENT table the index
 * built from the first one. That is not hypothetical: `build-hak-pfs.mts --validate` measures the
 * composition by passing 1,279 held-out tables through this same code, and with a def-keyed cache every one
 * of them would have been scored against the full index and reported a perfect result.
 */
const INDEX = new WeakMap<Map<string, string>, Index>();

/** Split a bare (toneless) PFS syllable into onset + rime. Longest-first, and never the whole syllable. */
function split(base: string, onsets: readonly string[]): [string, string] {
    for (const o of onsets) if (base.startsWith(o) && base.length > o.length) return [o, base.slice(o.length)];
    return ["", base];
}

/**
 * Build the composition index FROM `pfs.tsv` — which is what keeps this to one artifact. Every attested
 * syllable donates its rime to any unattested syllable that shares the rime, preferring one that also
 * shares the onset.
 */
function index(def: PfsDef, raw: Map<string, string>): Index {
    const cached = INDEX.get(raw);
    if (cached) return cached;
    const onsets = Object.keys(def.pfsOnsets).sort((a, b) => b.length - a.length);
    // ⚠ THE TABLE IS RE-KEYED TO NFD, AND OMITTING THAT BROKE EVERY DIACRITIC-BEARING KEY. `pfs.tsv` is
    // written NFC (it is meant to be readable); a lookup key must be NFD for the tone mark to be a separate
    // character the splitter can see. Composed silently instead of matching, so `ngìn` — the 4th commonest
    // syllable in the language — took the fallback path while `tshai`, which has no diacritic at all,
    // matched. A normalization mismatch fails toward the branch that still produces output, which is why it
    // looked like it was working. (Playbook trap 11, in a Latin script.)
    const table = new Map<string, string>();
    for (const [k, v] of raw) table.set(k.normalize("NFD"), v);
    const pair = new Map<string, string>();
    const rime = new Map<string, string>();
    for (const [k, reading] of table) {
        if (k.includes("-") || reading.includes(" ")) continue; // word keys donate nothing to composition
        const { base } = stripTone(k);
        const [o, r] = split(base, onsets);
        const seg = reading.replace(/[⁰-₟¹²³]+$/u, "");
        if (!r) continue;
        if (!pair.has(`${o}\u0000${r}`)) pair.set(`${o}\u0000${r}`, seg);
        // The rime alone, with this onset's IPA removed — used when no sibling shares the onset.
        const alts = def.pfsOnsets[o] ?? [""];
        const hit = alts.filter((a) => a !== "" && seg.startsWith(a)).sort((a, b) => b.length - a.length)[0];
        const bare = hit === undefined ? seg : seg.slice(hit.length);
        if (!rime.has(r)) rime.set(r, bare);
    }
    const built = { table, pair, rime, onsets };
    INDEX.set(raw, built);
    return built;
}

/** The pitch digits a PFS syllable's diacritic and coda call for. */
function tone(def: PfsDef, base: string, mark: string): string {
    const checked = /[ptk]$/u.test(base);
    if (checked && mark === "") return def.pfsTones["checked"] ?? "";
    return def.pfsTones[mark] ?? "";
}

/** One PFS syllable → its Meixian reading in dict.tsv's format, or undefined if it resolves nowhere. */
function syllable(def: PfsDef, ix: Index, raw: string): string | undefined {
    const k = key(raw);
    const direct = ix.table.get(k);
    if (direct !== undefined) return direct;
    const { base, mark } = stripTone(k);
    const [o, r] = split(base, ix.onsets);
    const t = tone(def, base, mark);
    if (t === "") return undefined;
    // ⚠ THE SIBLING SHARING THE ONSET IS TRIED FIRST — it settles the medial glide AND palatalization, which
    // is the difference between 87.9% and 97.2% agreement with the attested table.
    const samePair = ix.pair.get(`${o}\u0000${r}`);
    if (samePair !== undefined) return samePair + t;
    const bare = ix.rime.get(r);
    if (bare === undefined) return undefined;
    // ⚠ THE ZERO ONSET IS `[""]`, NOT `undefined`. It is not a row in the manifest table — there is no
    // letter to key it on — and treating a missing row as "unreadable" silently condemned every vowel-initial
    // syllable that had no onset-sharing sibling. `tûng-ông` (東王) ×127 went to the English reader for that
    // reason, with the ⟨tûng⟩ half dragged along by the all-or-nothing rule below.
    const alts = def.pfsOnsets[o] ?? [""];
    // No sibling shares the onset, so the palatal alternant is chosen by the rime's own nucleus.
    const palatal = alts.length > 1 && /^[iy]/u.test(r);
    return (palatal ? alts[1]! : alts[0]!) + bare + t;
}

/** One piece of a Latin run: either a Hakka reading (dict.tsv format) or text for the foreign reader. */
export type PfsSegment = { reading: string } | { foreign: string };

/**
 * Read one Latin run as Pha̍k-fa-sṳ. Returns the run split into Hakka readings (in `dict.tsv`'s format —
 * segmental IPA + superscript pitch digits, sandhi arrows intact — for the shared tone machinery to render)
 * and any fragments that are not Hakka; or `undefined`, meaning "none of this is Hakka, give the whole run
 * to the foreign reader".
 */
export function readPfs(def: PfsDef, table: Map<string, string>, run: string): PfsSegment[] | undefined {
    const ix = index(def, table);
    const trimmed = run.replace(/^-+|-+$/gu, "");
    if (trimmed === "") return undefined;
    const whole = ix.table.get(key(trimmed));
    if (whole !== undefined) return [{ reading: whole }];
    const parts = trimmed.split("-").filter(Boolean);
    // ⚠ THE ≤2-LETTER REFUSAL (see the header): a lone bare pair of letters is where PFS stops
    // discriminating, and the class is `me a tu g u na en km` — including the UNIT `km`.
    if (parts.length === 1) {
        const k = key(trimmed);
        if (!ix.table.has(k) && !PFS_DIACRITIC.test(k) && stripTone(k).base.length <= 2) return undefined;
    }
    // ⚠ A HYPHENATED RUN IS RESOLVED SYLLABLE BY SYLLABLE, AND A SINGLE ONE IS ALL-OR-NOTHING. The
    // difference is what a hyphen means: inside a PFS word it joins syllables, so a run that mixes a foreign
    // name with a Hakka morpheme is a REAL and frequent shape — `Soria-sén`, `Québec-sén`, `Zaragoza-sén`,
    // `Huesca-sén` (省, "province") are 519 tokens between them. All-or-nothing sent the ⟨sén⟩ to the English
    // reader along with the name. Resolving per syllable keeps the Hakka half and hands back only the part
    // that is not Hakka.
    // ⚠ AND THE DISCRIMINATOR SURVIVES INTACT, which is why this is safe: an unhyphenated foreign word is
    // ONE syllable, so `Nobel`, `Québec`, `Castilla`, `iPhone` still fail as a whole and still route to
    // `foreign`. Nothing that was refused before is claimed now; only the Hakka fragments are recovered.
    const out = parts.map((p) => syllable(def, ix, p));
    if (out.every((r) => r === undefined)) return undefined; // nothing here is Hakka — it is a foreign word
    const segs: PfsSegment[] = [];
    for (let i = 0; i < parts.length; i++) {
        const r = out[i];
        if (r !== undefined) segs.push({ reading: r });
        else if (segs.length && "foreign" in segs[segs.length - 1]!) (segs[segs.length - 1] as { foreign: string }).foreign += `-${parts[i]!}`;
        else segs.push({ foreign: parts[i]! });
    }
    return segs;
}

let TABLE: Map<string, string> | undefined;
/** The shipped table, loaded once. */
export function pfsTable(url: string): Map<string, string> {
    return (TABLE ??= loadTsvMap(url, "pfs.tsv"));
}
