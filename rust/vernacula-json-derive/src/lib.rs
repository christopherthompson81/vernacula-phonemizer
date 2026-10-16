//! `#[derive(FromJson)]`: decodes a data struct or enum from a parsed `serde_json::Value`.
//!
//! Why not serde's `Deserialize`: its derive writes a full decoder per struct, about 9 KB of `.text` each,
//! whichever deserializer feeds it. Over the crate's ~440 data structs that was 4.2 MiB, a quarter of the
//! compiled code. This derive writes one call per field into shared helpers in `core::from_json`, which are
//! generic only over the field's type, so the decoding code is shared between structs.
//!
//! Attributes, under `#[json(...)]`, mean what serde's do:
//! - container: `rename_all = "camelCase" | "lowercase"`, `default`, `deny_unknown_fields`, `untagged`;
//! - field: `rename = "…"`, `default`, `default = "path"`, `skip`, `flatten`;
//! - variant: `rename = "…"`.
//!
//! A missing `Option` field is `None`, as in serde. Unlike serde, a struct is read only from an object (never
//! from an array), and a repeated key keeps its last value instead of failing.

use proc_macro::TokenStream;
use proc_macro2::TokenStream as Tokens;
use quote::quote;
use syn::{Attribute, Data, DeriveInput, Fields, LitStr, Path, parse_macro_input};

#[proc_macro_derive(FromJson, attributes(json))]
pub fn derive_from_json(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    expand(&input)
        .unwrap_or_else(syn::Error::into_compile_error)
        .into()
}

#[derive(Default)]
struct Container {
    rename_all: Option<String>,
    default: bool,
    deny_unknown_fields: bool,
    untagged: bool,
}

#[derive(Default)]
struct Member {
    rename: Option<String>,
    /// `Some(None)`: `Default::default()`; `Some(Some(path))`: `path()`.
    default: Option<Option<Path>>,
    skip: bool,
    flatten: bool,
}

fn container_attrs(attrs: &[Attribute]) -> syn::Result<Container> {
    let mut c = Container::default();
    for a in attrs.iter().filter(|a| a.path().is_ident("json")) {
        a.parse_nested_meta(|m| {
            if m.path.is_ident("rename_all") {
                c.rename_all = Some(m.value()?.parse::<LitStr>()?.value());
            } else if m.path.is_ident("default") {
                c.default = true;
            } else if m.path.is_ident("deny_unknown_fields") {
                c.deny_unknown_fields = true;
            } else if m.path.is_ident("untagged") {
                c.untagged = true;
            } else {
                return Err(m.error("unsupported #[json] container attribute"));
            }
            Ok(())
        })?;
    }
    Ok(c)
}

fn member_attrs(attrs: &[Attribute]) -> syn::Result<Member> {
    let mut f = Member::default();
    for a in attrs.iter().filter(|a| a.path().is_ident("json")) {
        a.parse_nested_meta(|m| {
            if m.path.is_ident("rename") {
                f.rename = Some(m.value()?.parse::<LitStr>()?.value());
            } else if m.path.is_ident("default") {
                f.default = Some(if m.input.peek(syn::Token![=]) {
                    Some(m.value()?.parse::<LitStr>()?.parse::<Path>()?)
                } else {
                    None
                });
            } else if m.path.is_ident("skip") {
                f.skip = true;
            } else if m.path.is_ident("flatten") {
                f.flatten = true;
            } else {
                return Err(m.error("unsupported #[json] field attribute"));
            }
            Ok(())
        })?;
    }
    Ok(f)
}

/// serde's `rename_all` rules for the two cases this crate uses.
fn renamed(name: &str, rule: Option<&str>) -> Result<String, String> {
    match rule {
        None => Ok(name.to_owned()),
        Some("lowercase") => Ok(name.to_ascii_lowercase()),
        Some("camelCase") => {
            let mut out = String::new();
            let mut upper = false;
            for (i, ch) in name.chars().enumerate() {
                if ch == '_' {
                    upper = i > 0;
                } else if upper {
                    out.push(ch.to_ascii_uppercase());
                    upper = false;
                } else {
                    out.push(ch);
                }
            }
            Ok(out)
        }
        Some(other) => Err(format!("unsupported rename_all = \"{other}\"")),
    }
}

fn expand(input: &DeriveInput) -> syn::Result<Tokens> {
    let c = container_attrs(&input.attrs)?;
    let name = &input.ident;
    let label = name.to_string();
    let rule = c.rename_all.as_deref();
    let err = |msg: String| syn::Error::new_spanned(name, msg);
    let body = match &input.data {
        Data::Struct(s) => {
            let Fields::Named(named) = &s.fields else {
                return Err(err("FromJson: only structs with named fields".into()));
            };
            if c.untagged {
                return Err(err("FromJson: `untagged` is for enums".into()));
            }
            let mut keys = Vec::new();
            let mut inits = Vec::new();
            for f in &named.named {
                let a = member_attrs(&f.attrs)?;
                let ident = f.ident.as_ref().unwrap();
                let key = match &a.rename {
                    Some(r) => r.clone(),
                    None => renamed(&ident.to_string(), rule).map_err(err)?,
                };
                let init = if a.skip {
                    match &a.default {
                        Some(Some(p)) => quote!(#p()),
                        _ => quote!(::core::default::Default::default()),
                    }
                } else if a.flatten {
                    if c.deny_unknown_fields {
                        return Err(err("FromJson: `flatten` with `deny_unknown_fields`".into()));
                    }
                    quote!(crate::core::from_json::FromJson::from_json(v)?)
                } else {
                    keys.push(key.clone());
                    match (&a.default, c.default) {
                        (Some(Some(p)), _) => {
                            quote!(crate::core::from_json::field_or(o, #key, #p())?)
                        }
                        (Some(None), _) => quote!(
                            crate::core::from_json::field_or(o, #key, ::core::default::Default::default())?
                        ),
                        (None, true) => {
                            quote!(crate::core::from_json::field_or(o, #key, d.#ident)?)
                        }
                        (None, false) => quote!(crate::core::from_json::field(o, #key)?),
                    }
                };
                inits.push(quote!(#ident: #init));
            }
            let deny = c
                .deny_unknown_fields
                .then(|| quote!(crate::core::from_json::deny_unknown(o, &[#(#keys),*])?;));
            let defaults = c
                .default
                .then(|| quote!(let d = <Self as ::core::default::Default>::default();));
            quote! {
                let o = crate::core::from_json::object(v, #label)?;
                #deny
                #defaults
                ::core::result::Result::Ok(Self { #(#inits),* })
            }
        }
        Data::Enum(e) => {
            if c.untagged {
                let mut tries = Vec::new();
                for var in &e.variants {
                    let vi = &var.ident;
                    match &var.fields {
                        Fields::Unnamed(u) if u.unnamed.len() == 1 => tries.push(quote! {
                            if let ::core::result::Result::Ok(x) = crate::core::from_json::FromJson::from_json(v) {
                                return ::core::result::Result::Ok(Self::#vi(x));
                            }
                        }),
                        _ => return Err(err("FromJson: untagged variants must be 1-tuples".into())),
                    }
                }
                quote! {
                    #(#tries)*
                    ::core::result::Result::Err(crate::core::from_json::JsonError::untagged(#label))
                }
            } else {
                let mut arms = Vec::new();
                for var in &e.variants {
                    if !matches!(var.fields, Fields::Unit) {
                        return Err(err("FromJson: tagged enums must have unit variants".into()));
                    }
                    let a = member_attrs(&var.attrs)?;
                    let vi = &var.ident;
                    let key = match &a.rename {
                        Some(r) => r.clone(),
                        None => renamed(&vi.to_string(), rule).map_err(err)?,
                    };
                    arms.push(quote!(#key => ::core::result::Result::Ok(Self::#vi)));
                }
                quote! {
                    match crate::core::from_json::variant(v, #label)? {
                        #(#arms,)*
                        other => ::core::result::Result::Err(
                            crate::core::from_json::JsonError::unknown_variant(other, #label)
                        ),
                    }
                }
            }
        }
        Data::Union(_) => return Err(err("FromJson: unions are not supported".into())),
    };
    Ok(quote! {
        impl crate::core::from_json::FromJson for #name {
            fn from_json(v: &::serde_json::Value)
                -> ::core::result::Result<Self, crate::core::from_json::JsonError> {
                #body
            }
        }
    })
}
