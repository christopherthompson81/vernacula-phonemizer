// The interface registry.ts actually requires of a language module — its exported `Phonemizer`
// interface, kept minimal and faithful: the registry calls exactly one thing on every engine.
//
// English is the one engine the registry reaches BEYOND the interface (via TS casts to
// `EnglishPhonemizer`): `textWithOov` for the foreign-run reader and `knownWord` for Naija/Zulu/Xhosa.
// Those two members are therefore a second, English-only interface here, so the C# registry can make
// the same casts the TS registry makes.

namespace Vernacula.Phonemizer;

public interface ILanguage
{
    /** Full text → canonical IPA. */
    string Text(string input);
}

/// <summary>The extra surface of the English engine that registry.ts reaches via
/// `as EnglishPhonemizer` casts. The English language port must implement this.</summary>
public interface IEnglishPhonemizer : ILanguage
{
    /// <summary>`textWithOov(text, oovLookup)` — render with per-word neural OOV readings injected
    /// between the lexicon and the rule engine.</summary>
    string TextWithOov(string text, Func<string, string?> oovLookup);

    /// <summary>`knownWord(latin)` — the English dictionary IPA for a word, or null.</summary>
    string? KnownWord(string latin);
}
