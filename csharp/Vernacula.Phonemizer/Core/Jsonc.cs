/**
 * Minimal but conformant JSONC parser: standard JSON plus `//` line comments, `/* *​/` block comments, and
 * trailing commas.
 * Ported from src/core/jsonc.ts — see that file for the corpus evidence.
 */
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Vernacula.Phonemizer.Core;

public static class Jsonc
{
    /// <summary>Deserializer options standing in for `JSON.parse` + TS structural typing: camelCase JSON
    /// keys bind to PascalCase C# members. Comments/trailing commas are handled by StripJsonc, not here.</summary>
    internal static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        // ⚠ FIELDS TOO. Some Core data classes (NumbersDef, AbugidaDef's members) are ported with public
        // FIELDS, and System.Text.Json ignores fields by default — the member would deserialize to its
        // DEFAULT with no error, the silent failure mode PORTING.md records for a mangled manifest key.
        IncludeFields = true,
        // ⚠ THE TWO TS UNIONS A MANIFEST CAN CARRY. `exponentWords.position` and `unitPer` are
        // `string | Record<string, string>` in the TS, and are ported as classes with an implicit
        // conversion from string — which the serializer does not know about. Without these a manifest
        // declaring the STRING form (the common one) fails to deserialize outright; the object form
        // deserializes by the default object path. Registered here rather than per-language because
        // every engine migrating its symbol tier into its manifest meets the same shape.
        Converters = { new StringUnionConverter<ExponentPositionSpec>(s => s), new StringUnionConverter<UnitPerSpec>(s => s) },
    };

    /**
     * Reads a JSON STRING into a union type by its implicit conversion, and delegates every other token to
     * the default object converter. `fromString` is the conversion, passed in because a generic constraint
     * cannot name an implicit operator.
     */
    private sealed class StringUnionConverter<T>(Func<string, T> fromString) : JsonConverter<T> where T : class
    {
        public override T? Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o)
        {
            if (reader.TokenType == JsonTokenType.String)
                return fromString(reader.GetString() ?? throw new JsonException($"{t.Name}: null string"));
            // The object form — deserialize with the converter removed, or it would recurse into itself.
            var bare = new JsonSerializerOptions(o);
            for (var i = bare.Converters.Count - 1; i >= 0; i--)
                if (bare.Converters[i] is StringUnionConverter<T>) bare.Converters.RemoveAt(i);
            return JsonSerializer.Deserialize<T>(ref reader, bare);
        }

        public override void Write(Utf8JsonWriter w, T value, JsonSerializerOptions o) =>
            JsonSerializer.Serialize(w, value, value.GetType(), o);
    }

    /**
     * Strip JSONC comments and trailing commas, returning parseable JSON. String contents are preserved
     * verbatim.
     */
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
                i += 2;
                while (i < n && src[i] != '\n') i++;
                continue;
            }
            if (c == '/' && i + 1 < n && src[i + 1] == '*')
            {
                i += 2;
                while (i < n && !(src[i] == '*' && i + 1 < n && src[i + 1] == '/')) i++;
                i += 2;
                continue;
            }
            if (c == ',')
            {
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
