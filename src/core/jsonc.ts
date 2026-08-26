/**
 * Minimal but conformant JSONC parser: standard JSON plus `//` line comments, `/* *​/` block comments, and
 * trailing commas. It is STRING-AWARE — comments and commas that occur inside a string value (e.g. a
 * "https://…" URL, or a comma before a brace inside prose) are preserved verbatim — so it is safe on the
 * hand-authored .jsonc manifests where the old line-anchored regex was both under- (missed inline comments and
 * trailing commas) and potentially over-eager. Shared by every manifest/data loader.
 */

/** Strip JSONC comments and trailing commas, returning parseable JSON. String contents are preserved verbatim. */
export function stripJsonc(src: string): string {
    let out = "";
    const n = src.length;
    let i = 0;
    while (i < n) {
        const c = src[i]!;
        if (c === '"') {
            // string literal — copy verbatim, respecting \ escapes
            out += c;
            i++;
            while (i < n) {
                const d = src[i]!;
                out += d;
                if (d === "\\") {
                    out += src[i + 1] ?? "";
                    i += 2;
                    continue;
                }
                i++;
                if (d === '"') break;
            }
            continue;
        }
        if (c === "/" && src[i + 1] === "/") {
            // line comment → skip to end of line
            i += 2;
            while (i < n && src[i] !== "\n") i++;
            continue;
        }
        if (c === "/" && src[i + 1] === "*") {
            // block comment → skip to */
            i += 2;
            while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
            i += 2;
            continue;
        }
        if (c === ",") {
            // trailing comma → drop if only ws/comments precede a } or ]
            let j = i + 1;
            for (;;) {
                while (j < n && " \t\r\n".includes(src[j]!)) j++;
                if (src[j] === "/" && src[j + 1] === "/") {
                    j += 2;
                    while (j < n && src[j] !== "\n") j++;
                    continue;
                }
                if (src[j] === "/" && src[j + 1] === "*") {
                    j += 2;
                    while (j < n && !(src[j] === "*" && src[j + 1] === "/"))
                        j++;
                    j += 2;
                    continue;
                }
                break;
            }
            if (src[j] === "}" || src[j] === "]") {
                i++;
                continue;
            }
            out += c;
            i++;
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

/**
 * Parse JSONC (JSON + comments + trailing commas) to a typed value.
 *
 * ⚠ NULL-PROTOTYPE OBJECTS, and the reason is a CRASH rather than tidiness. A manifest record is indexed BY
 * TEXT — `specialWords[word]`, `digraphs[pair]`, `finals[seg]` — and `JSON.parse` returns objects that
 * inherit `Object.prototype`, so the ordinary English word ⟨constructor⟩ in a code-switched sentence
 * resolves to a FUNCTION and the lookup's `!== undefined` / truthiness test passes. Seven engines threw on
 * that one word — `tl`, `ceb`, `hil` ("w is not iterable"), `fr`, `fr-CA` ("entry.cases is not iterable"),
 * `cdo` ("seg.endsWith is not a function"), `nan` ("fin.replace is not a function") — and the C# port,
 * whose `Dictionary` inherits nothing, read them all normally, so this was a TS/C# divergence as well as a
 * defect. Stripping the prototype at the parse boundary closes the whole class in one place instead of
 * asking every lookup site to remember `Object.hasOwn`.
 */
export function parseJsonc<T = unknown>(src: string): T {
    return JSON.parse(stripJsonc(src), (_k, v: unknown) =>
        typeof v === "object" && v !== null && !Array.isArray(v)
            ? Object.setPrototypeOf(v, null)
            : v) as T;
}
