/**
 * Loads the Yoruba data manifest (yoruba.jsonc) once at module init and exposes it typed.
 * Ported from src/languages/yoruba/manifest.ts — see that file for the corpus evidence.
 */
using Vernacula.Phonemizer.Core;

namespace Vernacula.Phonemizer.Languages.Yoruba;

public sealed class YorubaTones
{
    public string High { get; init; } = "";
    public string Mid { get; init; } = "";
    public string Low { get; init; } = "";
}

/** A ten's two shapes: the free word, and the fused base that follows lé-/dín-. */
public sealed class TenForms
{
    public string Free { get; init; } = "";
    public string Fused { get; init; } = "";
}

/** Symbol readings for normalize.ts. See yoruba.jsonc for the corpus count behind each. */
public sealed class YorubaSymbols
{
    /** `sí` — a digit-flanked dash is a RANGE in Yoruba, never a minus. */
    public string Range { get; init; } = "";
    /** ⚠ The percent is a CIRCUMFIX: `ìdá` NUMBER `nínú ọgọ́rùn-ún`. */
    public string PercentBefore { get; init; } = "";
    public string PercentAfter { get; init; } = "";
    /** `àti dásímà` — "and decimal"; the fraction that follows is read digit by digit. */
    public string DecimalWord { get; init; } = "";
    public string And { get; init; } = "";
    /** The NEGATIVE marker — see the jsonc: yo.wikipedia glosses it against `-1.44, -1`. */
    public string Negative { get; init; } = "";
    /** The squared measure word, emitted AFTER the unit noun: `kìlómítà onígun mẹ́rin`. */
    public string Squared { get; init; } = "";
    /** ⚠ Temperature is a CIRCUMFIX: `ìwọ̀n` before the number, the scale name after. */
    public string Degree { get; init; } = "";
    /** Scale letter → its name, borrowed unchanged from English by this corpus. */
    public IReadOnlyDictionary<string, string> Scales { get; init; } = new Dictionary<string, string>();
    /** `lọ́nà` — the same multiplicative particle numbers.ts uses (`ẹgbẹ̀rún lọ́nà ogún` = 1000×20). */
    public string Times { get; init; } = "";
}

/** Cardinal numbers — VIGESIMAL, with addition and subtraction. See yoruba.jsonc for the sourcing of each. */
public sealed class YorubaNumbersDef
{
    public string Zero { get; init; } = "";
    /** Free forms 1..10, for a numeral standing alone. Slot 0 is unused. */
    public string[] Units { get; init; } = [];
    /** Fusing forms 1..9, used at the front of a compound (mọ́kàn-, méjì-). Slot 0 unused. */
    public string[] Front { get; init; } = [];
    /** Tens 20..100: the free word, and the fused base that follows lé-/dín-. Keyed by the value. */
    public IReadOnlyDictionary<string, TenForms> Tens { get; init; } = new Dictionary<string, TenForms>();
    /** The 11-14 suffix: unit + `lá`. */
    public string Teen { get; init; } = "";
    /** 15 and 25 are irregular, and the irregular form is the commoner one. */
    public string Fifteen { get; init; } = "";
    public string TwentyFive { get; init; } = "";
    /** The additive infix (1-4 past a ten) and the subtractive one (5-9 toward the ten above). */
    public string Add { get; init; } = "";
    public string Subtract { get; init; } = "";
    /** Hundreds 100..900 — irregular words, not multiples. Slot 0 unused. */
    public string[] Hundreds { get; init; } = [];
    public string Thousand { get; init; } = "";
    public string Million { get; init; } = "";
    public string Billion { get; init; } = "";
    /** ×1 after a thousand or above: `ẹgbẹ̀rún kan`. Hundreds take no such word. */
    public string MultiplierOne { get; init; } = "";
    /** Multiplies a magnitude when the multiplier is above ten: `ẹgbẹ̀rún lọ́nà méjìlélọ́gbọ̀n`. */
    public string Times { get; init; } = "";
    /** Joins a magnitude to its remainder: `irinwó ó lé ọgọ́rin` (480). */
    public string Join { get; init; } = "";
}

public sealed class YorubaManifest
{
    public IReadOnlyDictionary<string, string> Consonants { get; init; } = new Dictionary<string, string>();
    public IReadOnlyDictionary<string, string> Vowels { get; init; } = new Dictionary<string, string>();
    public YorubaTones Tones { get; init; } = new();
    public IReadOnlyDictionary<string, string> ClausePunctuation { get; init; } = new Dictionary<string, string>();
    public YorubaSymbols Symbols { get; init; } = new();
    public YorubaNumbersDef Numbers { get; init; } = new();
    /** The shared symbol tier's data — see the jsonc, where the evidence lives. */
    public YorubaSymbolTier SymbolTier { get; init; } = new();
}

public static class Manifest
{
    /** The consolidated hand-authored Yoruba data tables (see yoruba.jsonc). */
    public static readonly YorubaManifest MANIFEST = LoadManifest.Load<YorubaManifest>("languages/yoruba", "yoruba.jsonc");
}

public sealed class YorubaSymbolTier
{
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Currency { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, IReadOnlyList<string>> Units { get; init; } = new Dictionary<string, IReadOnlyList<string>>();
    public IReadOnlyDictionary<string, string> RateDenominators { get; init; } = new Dictionary<string, string>();
    public UnitPerSpec UnitPer { get; init; } = null!;
}
