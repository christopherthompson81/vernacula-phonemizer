/**
 * Shared West-Germanic morphological decomposition — the layer that makes boundary-sensitive phonology possible for
 * the compounding Germanic languages (German, Dutch, Afrikaans, …). A word is split into
 * PREFIX* · STEM (+link · STEM)* · SUFFIX*, and the boundaries let each engine's g2p apply element-initial rules,
 * morpheme-final devoicing, blocked cross-boundary assimilation, and the stress domain (primary stress on a
 * separable prefix or the first stem).
 *
 * The ALGORITHM lives here; every language-specific fact is CONFIG: the affix lists, the linking elements
 * (Fugen-s), the stem lexicon (isWord/isConstituent/takesLink), the vowel set + valid onsets, and a few optional
 * per-language quirks (a negation prefix, real-word-only stressed prefixes, a suffix digraph guard, the
 * element-initial seam pattern, and a keep-whole verb suffix). German supplies all of them (→ byte-identical to its
 * former private module); Dutch/Afrikaans supply the subset they need.
 */

export const BOUNDARY = "·"; // inserted between morphemes; the g2p treats the next letter as element-initial

export type Kind = "prefix" | "stem" | "suffix";
export interface Decomp {
    parts: string[]; // morphemes in order (prefixes, stems, suffixes)
    kinds: Kind[]; // kind of each part
    stressPart: number; // index of the part carrying primary stress
}

export interface MorphologyConfig {
    vowels: string; // the language's vowel LETTERS (for the isStemish onset gate)
    prefixUnstressed: readonly string[]; // longest-first; reduce their vowel, stem is element-initial
    prefixStressed: readonly string[]; // separable prefixes — carry primary stress
    ambiguousPrefixes: ReadonlySet<string>; // prefixes that also start roots → strip only if the remainder is a word
    suffixes: readonly string[]; // longest-first derivational/inflectional suffixes
    vowelInitialSuffixes: ReadonlySet<string>; // resyllabify onto the stem (no boundary) → loose to strip
    reliableConsSuffixes: ReadonlySet<string>; // consonant-initial but reliable, loose-stripped when the stem ends voiced
    linksFor: (head: string) => readonly string[]; // Fugen-elemente to try for this head, in order (promote -s- if flagged)
    validOnsets: ReadonlySet<string>; // valid 2-/3-letter onsets for the isStemish gate
    stKeep: ReadonlySet<string>; // monomorphemic words to keep whole (no false prefix boundary)
    isWord: (w: string) => boolean; // a known content word (lexicon)
    isConstituent: (w: string) => boolean; // a valid compound part (lexicon; caller enforces any min length/flag)
    // ── optional per-language quirks (default off → af/nl) ─────────────────────────────────────────────────
    negationPrefix?: string; // a negation prefix strippable ONLY before another prefix (German un-)
    negationFollows?: RegExp; // …which prefixes may follow it
    realWordStressedPrefixes?: ReadonlySet<string>; // stressed prefixes needing a REAL-word stem (German mit-)
    suffixDigraphGuard?: (suffix: string, stem: string) => boolean; // reject a suffix strip that shatters a digraph
    seamElementInitial?: RegExp; // a non-first constituent starting like this resets element-initial (German st/sp/sch)
    wholeVerbSuffix?: string; // keep a whole known verb lexeme ending in this suffix un-split (German -en)
    minTrailingConstituent?: number; // min letters for a compound's trailing part (default 3; nl/af use 4 to reject
    // 3-letter inflectional-lookalike tails — ten/ken/den/end — that are real words but not compound heads)
    dontSplitKnownWords?: boolean; // never split a word that is itself a lexicon entry (nl/af; German splits known
    // compounds so it stays off — its lexicon flags constituents, not whole compounds)
}

/** Build a `decompose(word)` for a language from its morphology config. */
export function makeDecompose(cfg: MorphologyConfig): (word: string) => Decomp {
    const VOWELS = cfg.vowels;
    const isVowelStart = (w: string): boolean => VOWELS.includes(w[0] ?? "");

    /** Loose gate: a stripped stem must have a vowel and start with a valid onset (so a prefix isn't peeled off a
     *  non-word — be+rlin, where "rl" is not an onset). */
    function isStemish(w: string): boolean {
        if (![...w].some((c) => VOWELS.includes(c))) return false;
        const a = w[0] ?? "", b = w[1] ?? "";
        if (VOWELS.includes(a)) return true; // vowel-initial
        if (VOWELS.includes(b) || b === "") return true; // single consonant onset
        return cfg.validOnsets.has(a + b) || cfg.validOnsets.has(w.slice(0, 3)); // valid cluster
    }

    const resolves = (w: string): boolean =>
        cfg.isWord(w) || cfg.isConstituent(w) || splitCompound(w) !== null;

    /** Split a run into compound constituents (longest-leading, ≤3 parts). null = not a compound. */
    function splitCompound(w: string, depth = 0): string[] | null {
        if (depth > 2) return null;
        // A lexicalised word must not be torn into two coincidental sub-words (nl schakelen ✗ scha·kelen, af
        // amandel ✗). German (flag off) keeps splitting known compounds — its lexicon flags constituents, not whole
        // compounds. nl/af have no such flags, so a whole dictionary entry is the signal that it's ONE morpheme.
        if (cfg.dontSplitKnownWords && cfg.isWord(w)) return null;
        const minTail = cfg.minTrailingConstituent ?? 3;
        for (let i = w.length - minTail; i >= 4; i--) {
            const head = w.slice(0, i);
            if (!cfg.isConstituent(head)) continue;
            for (const lk of cfg.linksFor(head)) {
                if (!w.slice(i).startsWith(lk)) continue;
                const rest = w.slice(i + lk.length);
                if (rest.length < minTail) continue;
                if (cfg.isConstituent(rest)) {
                    const deeper = splitCompound(rest, depth + 1) ?? splitPrefixedStem(rest, depth + 1);
                    return deeper ? [head + lk, ...deeper] : [head + lk, rest];
                }
                const tail = splitCompound(rest, depth + 1);
                if (tail) return [head + lk, ...tail];
            }
        }
        return null;
    }

    /** A constituent may itself be a stressed-prefix + stem (vorstellung → vor·stellung): strip so the stem is
     *  g2p'd element-initially. */
    function splitPrefixedStem(w: string, depth: number): string[] | null {
        if (depth > 2) return null;
        for (const p of cfg.prefixStressed) {
            if (!w.startsWith(p) || w.length - p.length < 4) continue;
            const r = w.slice(p.length);
            if (cfg.isConstituent(r)) return [p, r];
            const sub = splitCompound(r, depth + 1);
            if (sub) return [p, ...sub];
            if (isStemish(r)) return [p, r];
        }
        return null;
    }

    return function decompose(word: string): Decomp {
        const w = word.toLowerCase();
        if (cfg.stKeep.has(w)) return { parts: [w], kinds: ["stem"], stressPart: 0 };
        const prefixes: string[] = [];
        let rest = w;
        for (let round = 0; round < 3; round++) {
            let stripped = false;
            for (const p of cfg.prefixUnstressed) {
                if (!rest.startsWith(p) || rest.length - p.length < 4) continue;
                const r = rest.slice(p.length);
                const ok =
                    p === cfg.negationPrefix
                        ? !!cfg.negationFollows?.test(r)
                        : cfg.ambiguousPrefixes.has(p)
                          ? cfg.isWord(r) || splitCompound(r) !== null
                          : isStemish(r);
                if (ok) { prefixes.push(p); rest = r; stripped = true; break; }
            }
            if (!stripped) break;
        }
        let sepPrefix = "";
        for (const p of cfg.prefixStressed) {
            if (!rest.startsWith(p) || rest.length - p.length < 4) continue;
            const r = rest.slice(p.length);
            const ok = cfg.realWordStressedPrefixes?.has(p) ? cfg.isWord(r) || splitCompound(r) !== null : isStemish(r);
            if (ok) { sepPrefix = p; rest = r; break; }
        }
        const suffixes: string[] = [];
        for (let round = 0; round < 2; round++) {
            let stripped = false;
            for (const s of cfg.suffixes) {
                if (!rest.endsWith(s) || rest.length - s.length < 3) continue;
                const stem = rest.slice(0, rest.length - s.length);
                if (cfg.suffixDigraphGuard?.(s, stem)) continue;
                const reliableLoose = cfg.reliableConsSuffixes.has(s) && /[bdg]$/.test(stem);
                const ok = cfg.vowelInitialSuffixes.has(s) || reliableLoose ? isStemish(stem) : resolves(stem);
                if (ok) { suffixes.unshift(s); rest = stem; stripped = true; break; }
            }
            if (!stripped) break;
        }
        let stemParts = splitCompound(rest) ?? [rest];
        if (stemParts.length === 1 && suffixes.length) {
            const whole = rest + suffixes.join("");
            const split = splitCompound(whole);
            const seamSplit = !!split && split.length >= 2 && !!cfg.seamElementInitial
                && split.slice(1).some((p) => cfg.seamElementInitial!.test(p));
            const cs = cfg.wholeVerbSuffix && cfg.isWord(whole) && whole.endsWith(cfg.wholeVerbSuffix) && !seamSplit
                ? null : split;
            if (cs && cs.length >= 2) { stemParts = cs; suffixes.length = 0; }
        }

        const parts = [...prefixes, ...(sepPrefix ? [sepPrefix] : []), ...stemParts, ...suffixes];
        const kinds: Kind[] = [
            ...prefixes.map(() => "prefix" as Kind),
            ...(sepPrefix ? ["prefix" as Kind] : []),
            ...stemParts.map(() => "stem" as Kind),
            ...suffixes.map(() => "suffix" as Kind),
        ];
        return { parts, kinds, stressPart: prefixes.length };
    };
}
