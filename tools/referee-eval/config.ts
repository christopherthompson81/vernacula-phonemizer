/**
 * Per-language referee-eval configuration. Each language lists its INDEPENDENT referees (epitran / wikipron /
 * Wiktionary) and the fold classes that neutralise NOTATION or documented ALLOPHONIC
 * differences so the SEGMENTAL BACKBONE can be compared. Every fold must be justified: it either (a) folds a
 * layer we render richer than the referee (tone, length, depressor, ejective) or (b) folds a genuinely
 * allophonic / conventional difference. Whatever remains after folding is the real linguistic signal — a
 * candidate to adjudicate against published phonology, NOT an automatic bug. Referees are FALLIBLE; corroborate
 * across ≥2 before trusting a divergence (see the multi-referee method).
 */

/** One independent referee (word<TAB>ipa TSV), tagged by corroboration role. A language should have a PRIMARY
 *  and, ideally, an independent SECONDARY (≥2 sources before trusting a divergence). No secondary → `secondaryGap`. */
export interface Referee {
    file: string;
    source: string;
    role: "primary" | "secondary";
    /** Folds applied to THIS referee only (after the shared language folds) — for a dual-script language where a
     *  fold is valid for one script but not another (e.g. the majhūl و/ی quality is unrecoverable in the Shahmukhi
     *  abjad but written in Gurmukhi, so pa folds it only for the pan_arab referee). Compiled from the jsonc. */
    folds?: [RegExp, string, string][];
    /**
     * Rows to DROP from this referee before scoring — `[pattern, justification]`, matched against the
     * referee's own IPA (or, with the `spelling:` prefix, against the headword).
     *
     * ⚠ THIS IS NOT A FOLD AND MUST NOT BE USED AS ONE. A fold neutralises a NOTATION difference on both
     * sides; this DELETES evidence, so it is only ever correct when a row does not belong to the variety the
     * file claims to cover. The one case it was built for: `en.wikipron-eng-latn-us-broad.tsv` is labelled
     * GenAm and 10.7% of it is RP — `Amazonia` as `æməzəʊniə`, `Dunkirk` as `dʌŋkɜːk`. Those rows are not
     * noisy US transcriptions, they are UK transcriptions in the wrong file: 92% of the RP-vowel rows and
     * 98% of the non-rhotic ones appear in `en-gb.wikipron-uk.tsv` with a byte-identical reading.
     *
     * ⚠ AND THE FILE IS LEFT INTACT. The referees are provenance-tracked imports (CC-BY-SA, see
     * data/LICENSES/PROVENANCE.md); editing one in place would make it unreproducible from its source. The
     * exclusion lives here, where it is reviewable, and the count is REPORTED so a dropped row is never silent.
     */
    excludeRows?: RowExclusion[];
}

export interface RefLang {
    /** Independent referees, primary first. */
    referees: Referee[];
    /** When no independent SECONDARY source is wired — an explicit, recorded gap, not a silent omission. */
    secondaryGap?: string;
    /** Referee IPA is space-separated phoneme segments (wikipron style) → join before comparing. */
    segmentJoin?: boolean;
    /**
     * This referee writes an OPTIONAL SEGMENT in parentheses (af: ˈɑr(ə)m, ˈan(d)ər) → expand each row to
     * both variants and credit either, exactly like a multi-pronunciation row.
     *
     * ⚠ OPT-IN PER LANGUAGE, because a parenthesis does not mean the same thing in every file: 160 referee
     * files contain one, and in some it is DATA (Amharic's `(ʔ)itjopʼja`) while elsewhere it is a gloss or
     * a variant label. Expanding fleet-wide would move `raw`, `folded` and `symbolAcc` for languages nobody
     * re-measured, silently staling their floor comments and catalogue rows.
     */
    parenOptional?: boolean;
    /** [pattern, replacement, justification] applied BEFORE the backbone strip, to both sides — for folds that
     *  need combining diacritics the backbone would remove (e.g. German syllabic n̩→ən before ̩ is stripped). */
    preFolds?: [RegExp, string, string][];
    /** [pattern, replacement, justification] applied AFTER the shared backbone strip, to both sides. */
    folds: [RegExp, string, string][];
}

// Shared backbone: strip supra-segmental notation no broad referee reliably carries.
export const BACKBONE: [RegExp, string][] = [
    [/[ˈˌ]/gu, ""], // stress
    [/[ː]/gu, ""], // length
    [/[˥˦˧˨˩]/gu, ""], // Chao tone letters (ours) — segmental comparison only
    [/[̀-̵̳-ͯ]/gu, ""], // combining diacritics: tone accents, depressor ̤, voiceless ring (keep tie U+0361 handled below)
    [/[͜͡]/gu, ""], // tie bars
    [/[\s​]+/gu, ""], // whitespace / ZWSP
];

// The per-language config lives in `langs/<code>.jsonc` (one file each) — this module loads them all and
// compiles the [pattern, replacement, justification] fold triples into RegExps. To add/edit a language's
// referees or folds, edit its jsonc file; nothing here changes. Fold patterns use the `gu` flags.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stripJsonc } from "../../src/core/jsonc.ts";

/**
 * One exclusion rule: a CONJUNCTION of up to three conditions, all of which must hold for the row to drop.
 * Two fields are needed because non-rhoticity is not visible in either half alone — it is a word SPELLED with
 * a post-vocalic r whose transcription has NO rhotic, and a regex over one field cannot say that.
 */
export interface RowExclusion {
    /** must match the referee's IPA */
    ipa?: RegExp;
    /** must match the headword */
    spelling?: RegExp;
    /** must NOT match the referee's IPA */
    ipaLacks?: RegExp;
    note: string;
}

/** A fold as authored in the jsonc: a self-documenting object. `pattern` compiles with the `gu` flags. */
interface RawFold {
    pattern: string;
    replace: string;
    note: string;
}
/** An exclusion as authored in the jsonc — no `replace`, because it drops the row rather than rewriting it. */
interface RawExclude {
    ipa?: string;
    spelling?: string;
    ipaLacks?: string;
    note: string;
}
interface RawLang {
    referees: Referee[];
    secondaryGap?: string;
    segmentJoin?: boolean;
    parenOptional?: boolean;
    preFolds?: RawFold[];
    folds?: RawFold[];
}

const LANGS_DIR = join(dirname(fileURLToPath(import.meta.url)), "langs");

const compile = (
    folds: RawFold[] | undefined,
): [RegExp, string, string][] =>
    (folds ?? []).map((f) => [new RegExp(f.pattern, "gu"), f.replace, f.note]);

/** ⚠ NOT `gu`. These are membership TESTS reused across thousands of rows, and a `g` regex carries
 *  `lastIndex` between `.test()` calls — every other row would silently pass. */
const compileExcludes = (ex: RawExclude[] | undefined): RowExclusion[] =>
    (ex ?? []).map((e) => ({
        ...(e.ipa ? { ipa: new RegExp(e.ipa, "u") } : {}),
        ...(e.spelling ? { spelling: new RegExp(e.spelling, "u") } : {}),
        ...(e.ipaLacks ? { ipaLacks: new RegExp(e.ipaLacks, "u") } : {}),
        note: e.note,
    }));

/** Load `langs/<code>.jsonc` → the compiled per-language RefLang config. */
function loadLang(code: string): RefLang {
    const raw = JSON.parse(
        stripJsonc(readFileSync(join(LANGS_DIR, `${code}.jsonc`), "utf8")),
    ) as RawLang;
    return {
        referees: raw.referees.map((r) => {
            const rr = r as Referee & {
                folds?: RawFold[];
                excludeRows?: RawExclude[];
            };
            return {
                ...r,
                ...(rr.folds ? { folds: compile(rr.folds) } : {}),
                ...(rr.excludeRows
                    ? { excludeRows: compileExcludes(rr.excludeRows) }
                    : {}),
            };
        }),
        ...(raw.secondaryGap ? { secondaryGap: raw.secondaryGap } : {}),
        ...(raw.segmentJoin ? { segmentJoin: true } : {}),
        ...(raw.parenOptional ? { parenOptional: true } : {}),
        ...(raw.preFolds ? { preFolds: compile(raw.preFolds) } : {}),
        folds: compile(raw.folds),
    };
}

export const CONFIG: Record<string, RefLang> = Object.fromEntries(
    readdirSync(LANGS_DIR)
        .filter((f) => f.endsWith(".jsonc"))
        .map((f) => f.replace(/\.jsonc$/u, ""))
        .sort()
        .map((code) => [code, loadLang(code)]),
);
