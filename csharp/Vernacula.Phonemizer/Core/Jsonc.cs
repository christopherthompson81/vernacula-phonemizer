/**
 * Minimal but conformant JSONC parser: standard JSON plus `//` line comments, `/* *​/` block comments, and
 * trailing commas. It is STRING-AWARE — comments and commas that occur inside a string value (e.g. a
 * "https://…" URL, or a comma before a brace inside prose) are preserved verbatim — so it is safe on the
 * hand-authored .jsonc manifests where the old line-anchored regex was both under- (missed inline comments and
 * trailing commas) and potentially over-eager. Shared by every manifest/data loader.
 */
using System.Text;
using System.Text.Json;

namespace Vernacula.Phonemizer.Core;

public static class Jsonc
{
    /// <summary>Deserializer options standing in for `JSON.parse` + TS structural typing: camelCase JSON
    /// keys bind to PascalCase C# members. Comments/trailing commas are handled by StripJsonc, not here.</summary>
    internal static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        // ⚠ FIELDS TOO. Some Core data classes (NumbersDef, AbugidaDef's members) are ported with public
        // FIELDS, and System.Text.Json ignores fields by default — the member deserializes to its DEFAULT
        // with no error, the exact silent failure mode the ARPABET keys already demonstrated once. Odia is
        // the first manifest to route through NumbersDef, which is how this surfaced.
        IncludeFields = true,
    };

    /** Strip JSONC comments and trailing commas, returning parseable JSON. String contents are preserved verbatim. */
    public static string StripJsonc(string src)
    {
        var outSb = new StringBuilder(src.Length);
        var n = src.Length;
        var i = 0;
        while (i < n)
        {
            var c = src[i];
            if (c == '"')
            {
                // string literal — copy verbatim, respecting \ escapes
                outSb.Append(c);
                i++;
                while (i < n)
                {
                    var d = src[i];
                    outSb.Append(d);
                    if (d == '\\')
                    {
                        if (i + 1 < n) outSb.Append(src[i + 1]);
                        i += 2;
                        continue;
                    }
                    i++;
                    if (d == '"') break;
                }
                continue;
            }
            if (c == '/' && i + 1 < n && src[i + 1] == '/')
            {
                // line comment → skip to end of line
                i += 2;
                while (i < n && src[i] != '\n') i++;
                continue;
            }
            if (c == '/' && i + 1 < n && src[i + 1] == '*')
            {
                // block comment → skip to */
                i += 2;
                while (i < n && !(src[i] == '*' && i + 1 < n && src[i + 1] == '/')) i++;
                i += 2;
                continue;
            }
            if (c == ',')
            {
                // trailing comma → drop if only ws/comments precede a } or ]
                var j = i + 1;
                for (; ; )
                {
                    while (j < n && " \t\r\n".IndexOf(src[j]) >= 0) j++;
                    if (j + 1 < n && src[j] == '/' && src[j + 1] == '/')
                    {
                        j += 2;
                        while (j < n && src[j] != '\n') j++;
                        continue;
                    }
                    if (j + 1 < n && src[j] == '/' && src[j + 1] == '*')
                    {
                        j += 2;
                        while (j < n && !(src[j] == '*' && j + 1 < n && src[j + 1] == '/')) j++;
                        j += 2;
                        continue;
                    }
                    break;
                }
                if (j < n && (src[j] == '}' || src[j] == ']'))
                {
                    i++;
                    continue;
                }
                outSb.Append(c);
                i++;
                continue;
            }
            outSb.Append(c);
            i++;
        }
        return outSb.ToString();
    }

    /** Parse JSONC (JSON + comments + trailing commas) to a typed value. */
    public static T ParseJsonc<T>(string src) =>
        JsonSerializer.Deserialize<T>(StripJsonc(src), JsonOpts)
        ?? throw new JsonException("JSONC document deserialized to null");
}
