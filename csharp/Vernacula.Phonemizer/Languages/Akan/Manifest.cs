/**
 * Loads the Akan data manifest (akan.jsonc) once and exposes it typed.
 *
 * Akan is a Kwa (Niger-Congo) language of Ghana with a shallow, well-standardised Latin orthography (Bureau
 * of Ghana Languages; Asante/Akuapem Twi and Fante share it), so the letter maps carry almost the whole g2p
 * and the contextual rules in Akan.cs are few. The interesting table is `Digraphs`: a palatal series
 * ⟨ky gy hy ny⟩ and a LABIALISED series ⟨tw dw kw gw hw nw⟩, the signature Akan labial-palatalisation.
 *
 * Ported from src/languages/akan/akan.ts's `AkanDef` — see that file's header for the sources.
 */
using System.Text.Json.Serialization;

using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Akan;

public sealed record AkanNumbers
{
    public string Zero { get; init; } = "";
    public IReadOnlyList<string> Units { get; init; } = [];
    public string Ten { get; init; } = "";
    public IReadOnlyList<string> Tens { get; init; } = [];
    public IReadOnlyList<string> Hundreds { get; init; } = [];
    public string Thousand { get; init; } = "";
    public string Thousands { get; init; } = "";
    public string Million { get; init; } = "";
    public string Millions { get; init; } = "";
    public string Billion { get; init; } = "";
    public string Billions { get; init; } = "";
}

public sealed record AkanDef
{
    /** Consonant digraphs, longest-match first: the palatal and labialised series, plus ⟨ng⟩. */
    public IReadOnlyDictionary<string, string> Digraphs { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    /** The seven written vowels. ⚠ The ATR allophones ɪ/ʊ are UNWRITTEN and are recovered by
     *  `Akan.AtrByIndex`, so they are deliberately absent from this table. */
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public AkanNumbers Numbers { get; init; } = new();
}

public static class Manifest
{
    public static readonly AkanDef MANIFEST = LoadManifest.Load<AkanDef>("languages/akan", "akan.jsonc");
}
