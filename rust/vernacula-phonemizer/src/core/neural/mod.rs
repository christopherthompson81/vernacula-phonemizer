//! The pure-Rust neural runtime (#1463): loads the int8 `.onnx` models under `data/` and runs them with the
//! arithmetic of ONNX Runtime 1.27.0 on CPU, bit for bit on the golden machine (AVX2/FMA3, no VNNI/AVX512).
//! The TypeScript engine reaches the same models through onnxruntime-node (src/core/onnx.ts); there is no TS
//! module to mirror. Evidence: docs/investigations/rust-port/rust_neural_runtime_investigation.md.

mod lstm;
pub mod mlas;
mod model;
mod proto;
pub mod tensor;
#[cfg(test)]
mod tests;

pub use model::OnnxModel;
pub use tensor::{Data, Tensor};

use super::data_source::{DataError, read_data};

#[derive(Debug)]
pub enum NeuralError {
    /// The bytes are not a well-formed ONNX model.
    Parse(String),
    /// A valid model that uses an op, attribute or layout this runtime does not reproduce. Raised at load.
    Unsupported(String),
    /// A bad input at run time (missing, wrong type or shape).
    Run(String),
    Data(DataError),
}

impl std::fmt::Display for NeuralError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NeuralError::Parse(m) => write!(f, "ONNX parse error: {m}"),
            NeuralError::Unsupported(m) => write!(f, "unsupported ONNX model: {m}"),
            NeuralError::Run(m) => write!(f, "ONNX run error: {m}"),
            NeuralError::Data(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for NeuralError {}

/// Load a model through the data seam, e.g. `load_model("languages/english/en-g2p-tagger.int8.onnx")`.
pub fn load_model(key: &str) -> Result<OnnxModel, NeuralError> {
    let bytes = read_data(key).map_err(NeuralError::Data)?;
    OnnxModel::from_bytes(&bytes)
}
