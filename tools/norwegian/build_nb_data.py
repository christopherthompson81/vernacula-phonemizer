#!/usr/bin/env python3
"""Build the Norwegian Bokmål data artifacts from the NST pronunciation lexicon (CC0).

Inputs (both public):
  - NST — Nasjonalbibliotekets uttaleleksikon, CC0 / public domain (National Library of Norway / Språkbanken).
      https://www.nb.no/sbfil/leksikalske_databaser/leksikon/no.leksikon.tar.gz
      → nor030224NST.pron  (ISO-8859-1, CRLF, ';'-separated; word = field 0, NST-SAMPA transcription = field 11)
  - a frequency wordlist — OpenSubtitles Norwegian (hermitdave FrequencyWords, CC BY-SA), one "word count" per line.
      The shipped src/languages/norwegian/nb-lexicon.tsv is the NST ∩ (top ~50k of this list).

Outputs:
  - src/languages/norwegian/nb-lexicon.tsv — tier-1 shipping lexicon: the freq-list words that NST covers, each mapped
    to its SHORTEST NST variant → canonical IPA (with stress). ~38k forms, ~98% of real-text tokens.
  - <train-out> (default /tmp/nb_train_stress.tsv) — the FULL NST (every alphabetic word → shortest IPA-with-stress),
    the OOV BiLSTM tagger's training set (train_nb_bilstm.py).

    python3 tools/norwegian/build_nb_data.py --pron <nor030224NST.pron> --freq <no_50k.txt>

NST-SAMPA → our canonical IPA. Multi-char symbols first (longest match), retroflex = letter + backtick. Primary stress
`"` → ˈ, tone-2 `""` → ˈ with the LEXICAL TONE DROPPED (tonelag unwritten → deferred); secondary `%` → ˌ; syllable /
compound boundary markers dropped.
"""
import argparse, io, os

DIPH = {  # NST diphthongs + the u0/o0/… short-vowel digraphs
    '{I': 'æɪ̯', 'A}': 'ɑʉ̯', '9Y': 'øy̯', '{U': 'æʉ̯', 'OY': 'ɔy̯', 'oY': 'ɔy̯', '}Y': 'ʉy̯',
    'A0': 'ɑ', 'E0': 'æ', 'e0': 'e', 'u0': 'ʊ', 'o0': 'ʊ', 'O0': 'ɔ',
}
LONG = {'A:': 'ɑː', '{:': 'æː', 'e:': 'eː', 'i:': 'iː', 'o:': 'oː', 'u:': 'uː', '}:': 'ʉː', 'y:': 'yː',
        '2:': 'øː', '3:': 'øː', 'E:': 'æː', '9:': 'œː', 'U:': 'uː', 'O:': 'ɔː'}
SHORT = {'A': 'ɑ', '{': 'æ', 'e': 'e', 'i': 'i', 'o': 'u', 'u': 'ʉ', '}': 'ʉ', 'y': 'y', '2': 'ø', '3': 'ø',
         'E': 'ɛ', '9': 'œ', 'U': 'ʊ', 'O': 'ɔ', 'I': 'ɪ', 'Y': 'ʏ', '@': 'ə', 'V': 'ɑ'}
RETRO = {'n`': 'ɳ', 't`': 'ʈ', 'd`': 'ɖ', 'l`': 'ɭ', 's`': 'ʂ'}  # letter + backtick
CONS = {'b': 'b', 'd': 'd', 'g': 'ɡ', 'p': 'p', 't': 't', 'k': 'k', 'm': 'm', 'n': 'n', 'l': 'l', 'r': 'ɾ',
        's': 's', 'f': 'f', 'h': 'h', 'v': 'ʋ', 'j': 'j', 'N': 'ŋ', 'S': 'ʃ', 'C': 'ç', 'w': 'ʋ', 'x': 'x', 'G': 'ɡ'}


def convert(s):
    out = []
    i = 0
    while i < len(s):
        if s[i:i + 2] == '""':  # tone-2 primary stress (tone deferred → just ˈ)
            out.append('ˈ'); i += 2; continue
        c2 = s[i:i + 2]
        if c2 in RETRO: out.append(RETRO[c2]); i += 2; continue
        if c2 in DIPH: out.append(DIPH[c2]); i += 2; continue
        if c2 in LONG: out.append(LONG[c2]); i += 2; continue
        ch = s[i]
        if ch == '"': out.append('ˈ'); i += 1; continue
        if ch == '%': out.append('ˌ'); i += 1; continue
        if ch in ('$', '_', '*', '¤', '=', '~', '\\', '|', ' ', "'"): i += 1; continue  # boundaries/markers dropped
        if ch in SHORT: out.append(SHORT[ch]); i += 1; continue
        if ch in CONS: out.append(CONS[ch]); i += 1; continue
        i += 1  # unknown → skip
    return ''.join(out)


def read_nst(pron):
    """word(lower) → list of distinct IPA variants (order preserved), alphabetic single words only."""
    var = {}
    for line in io.open(pron, encoding='latin-1'):
        f = line.rstrip('\r\n').split(';')
        if len(f) <= 11 or not f[0] or not f[11]:
            continue
        w = f[0].lower()
        if ' ' in w or f[0][:1] == '-' or not w.isalpha():  # skip multiword + affix (-abel) + digit/punct forms
            continue
        ipa = convert(f[11])
        if ipa:
            var.setdefault(w, []).append(ipa)
    return {w: list(dict.fromkeys(vs)) for w, vs in var.items()}


def shortest(vs):
    """The shortest IPA variant (NST's FIRST variant is often a spelling-letter reading for function words:
    er→eːər; the shortest is the true reading er→æːɾ). Ties broken by NST order."""
    return min(vs, key=lambda s: (len(s), vs.index(s)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pron', required=True, help='nor030224NST.pron')
    ap.add_argument('--freq', required=True, help='frequency wordlist (OpenSubtitles no, "word count" per line)')
    ap.add_argument('--top', type=int, default=50000, help='keep the top-N freq words in the shipping lexicon')
    ap.add_argument('--train-out', default='/tmp/nb_train_stress.tsv')
    args = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    lex_out = os.path.join(here, '..', '..', 'src', 'languages', 'norwegian', 'nb-lexicon.tsv')

    var = read_nst(args.pron)
    print(f'NST: {len(var)} alphabetic word forms')

    # FULL training set (every NST word → shortest IPA-with-stress) for the OOV tagger.
    with io.open(args.train_out, 'w', encoding='utf-8', newline='\n') as fo:
        for w in sorted(var):
            fo.write(f'{w}\t{shortest(var[w])}\n')
    print(f'train set: {len(var)} words → {args.train_out}')

    # SHIPPING lexicon: the top-N frequency words that NST covers, shortest variant.
    freq = []
    for line in io.open(args.freq, encoding='utf-8'):
        p = line.split()
        if p and not line.startswith('#'):
            freq.append(p[0].lower())
    keep = [w for w in freq[:args.top] if w in var]
    with io.open(lex_out, 'w', encoding='utf-8', newline='\n') as fo:
        for w in keep:  # frequency order (most common first)
            fo.write(f'{w}\t{shortest(var[w])}\n')
    print(f'lexicon: {len(keep)}/{min(args.top, len(freq))} freq words covered by NST → {lex_out}')


if __name__ == '__main__':
    main()
