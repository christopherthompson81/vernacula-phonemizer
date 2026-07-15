/**
 * Per-language referee-eval configuration. Each language lists its INDEPENDENT referees (epitran / wikipron /
 * Wiktionary — none derived from espeak) and the fold classes that neutralise NOTATION or documented ALLOPHONIC
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
}

export interface RefLang {
    /** Independent (non-espeak) referees, primary first. */
    referees: Referee[];
    /** When no independent SECONDARY source is wired — an explicit, recorded gap, not a silent omission. */
    secondaryGap?: string;
    /** Referee IPA is space-separated phoneme segments (wikipron style) → join before comparing. */
    segmentJoin?: boolean;
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

/** A fold as authored in the jsonc: a self-documenting object. `pattern` compiles with the `gu` flags. */
interface RawFold {
    pattern: string;
    replace: string;
    note: string;
}
interface RawLang {
    referees: Referee[];
    secondaryGap?: string;
    segmentJoin?: boolean;
    preFolds?: RawFold[];
    folds?: RawFold[];
}

const LANGS_DIR = join(dirname(fileURLToPath(import.meta.url)), "langs");

const compile = (
    folds: RawFold[] | undefined,
): [RegExp, string, string][] =>
    (folds ?? []).map((f) => [new RegExp(f.pattern, "gu"), f.replace, f.note]);

/** Load `langs/<code>.jsonc` → the compiled per-language RefLang config. */
function loadLang(code: string): RefLang {
    const raw = JSON.parse(
        stripJsonc(readFileSync(join(LANGS_DIR, `${code}.jsonc`), "utf8")),
    ) as RawLang;
    return {
        referees: raw.referees,
        ...(raw.secondaryGap ? { secondaryGap: raw.secondaryGap } : {}),
        ...(raw.segmentJoin ? { segmentJoin: true } : {}),
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
