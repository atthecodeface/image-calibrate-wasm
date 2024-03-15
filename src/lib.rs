//a To do
//
mod wasm_import;
pub use wasm_import::log as wasm_log;

mod wasm_export;
pub use wasm_export::WasmNamedPointSet;

//a Useful macros
#[macro_export]
macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    // ($($t:tt)*) => ( unsafe { crate::log(&format_args!($($t)*).to_string())} )
    ($($t:tt)*) => ( { $crate :: wasm_log(&format_args!($($t)*).to_string())} )
}
