# vernacula-phonemizer (Rust)

A port of the TypeScript engine (`src/`) to Rust, tracked in #1463. It reads the same repo-root `data/`
tree and is checked against the same goldens as `csharp/`. The porting rules are in `PORTING.md`.

```sh
cargo test                                  # unit tests
cargo run --release -p regex-diff           # JsRegex against Node over csharp/regex-corpus.jsonl
cargo run --release -p parity               # the golden gate, every ported language
```

Status: 67 languages ported (`registry::LANGUAGES`), each byte-identical to its golden. The exceptions are one
mag row and one tt row, which need the unported `ar` engine. A foreign run routed to an unported engine is reported by
`registry::port_pending()`. Per-language logs are in `docs/investigations/rust-port/`.
