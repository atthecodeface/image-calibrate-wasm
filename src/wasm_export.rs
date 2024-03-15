//a Imports
use std::rc::Rc;

use js_sys::Array;
use js_sys::Function as JsFunction;
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

use image_calibrate::{
    CameraDatabase, CameraInstance, CameraMapping, Color, NamedPointSet, PointMappingSet,
};

//a WasmCameraDatabase
//tp WasmCameraDatabase
#[wasm_bindgen]
pub struct WasmCameraDatabase {
    cdb: CameraDatabase,
}

//ip WasmCameraDatabase
#[wasm_bindgen]
impl WasmCameraDatabase {
    //fp new
    /// Create a new WasmCameraDatabase from a Json file
    #[wasm_bindgen(constructor)]
    pub fn new(json: &str) -> Result<WasmCameraDatabase, JsValue> {
        let json = image_calibrate::json::remove_comments(json);
        let cdb = CameraDatabase::from_json(&json).map_err(|e| e.to_string())?;
        Ok(Self { cdb })
    }
}

//a WasmCameraInstance
//tp WasmCameraInstance
#[wasm_bindgen]
pub struct WasmCameraInstance {
    camera: CameraInstance,
}

//ip WasmCameraInstance
#[wasm_bindgen]
impl WasmCameraInstance {
    //fp new
    /// Create a new WasmCameraInstance from a camera database and a Json file
    #[wasm_bindgen(constructor)]
    pub fn new(cdb: &WasmCameraDatabase, json: &str) -> Result<WasmCameraInstance, JsValue> {
        let json = image_calibrate::json::remove_comments(json);
        let camera = CameraInstance::from_json(&cdb.cdb, &json)?;
        Ok(Self { camera })
    }

    //mp map_model
    pub fn map_model(&self, pt: &[f64]) -> Result<Box<[f64]>, String> {
        if pt.len() != 3 {
            Err("Expected model point (x,y,z)".into())
        } else {
            let model = [pt[0], pt[1], pt[2]].into();
            let camera_mapping = CameraMapping::of_camera(self.camera.clone());
            let pxy: [f64; 2] = camera_mapping.map_model(model).into();
            Ok(Box::new(pxy))
        }
    }
}

//a WasmPointMappingSet
//tp WasmPointMappingSet
#[wasm_bindgen]
pub struct WasmPointMappingSet {
    pms: PointMappingSet,
}

//ip WasmPointMappingSet
#[wasm_bindgen]
impl WasmPointMappingSet {
    //fp new
    /// Create a new WasmPointMappingSet from a camera database and a Json file
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmPointMappingSet {
        let pms = PointMappingSet::default();
        Self { pms }
    }

    //mp read_json
    /// Read a json file to add to the points
    pub fn read_json(&mut self, wnps: &WasmNamedPointSet, json: &str) -> Result<(), JsValue> {
        let json = image_calibrate::json::remove_comments(json);
        let nf = self.pms.read_json(&wnps.nps, &json, true)?;
        // if !nf.is_empty() {
        // eprintln!("Warning: {}", nf);
        // }
        Ok(())
    }

    //mp len
    /// Get the number of mappings
    pub fn len(&self) -> usize {
        self.pms.mappings().len()
    }

    //mp get_name
    /// Get the nth point mapping
    pub fn get_name(&self, n: usize) -> Result<String, String> {
        self.pms
            .mappings()
            .get(n)
            .map(|m| m.model.name().into())
            .ok_or("Index out of range".into())
    }

    //mp get_xy_err
    /// Get the XY coords and error
    pub fn get_xy_err(&self, n: usize) -> Result<Box<[f64]>, String> {
        self.pms
            .mappings()
            .get(n)
            .map(|m| [m.screen()[0], m.screen()[1], m.error()].into())
            .ok_or("Index out of range".into())
    }
}

//a WasmNamedPoint
//tp WasmNamedPoint
#[wasm_bindgen]
pub struct WasmNamedPoint {
    name: String,
    color: String,
    model: [f64; 3],
}

//ip WasmNamedPoint
#[wasm_bindgen]
impl WasmNamedPoint {
    //fp new
    /// Create a new WasmNamedPoint
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str, color: &str) -> Result<WasmNamedPoint, JsValue> {
        let name = name.into();
        let _color: Color = color.try_into()?;
        let color = color.into();
        let model = [0.; 3];
        Ok(Self { name, color, model })
    }

    //mp name
    pub fn name(&self) -> JsValue {
        (&self.name).into()
    }

    //mp color
    pub fn color(&self) -> JsValue {
        (&self.color).into()
    }

    //mp model
    pub fn model(&self) -> Box<[f64]> {
        Box::new(self.model)
    }
}

//a WasmNamedPointSet
//tp WasmNamedPointSet
/// A set of named points
#[wasm_bindgen]
pub struct WasmNamedPointSet {
    nps: NamedPointSet,
}

//ip WasmNamedPointSet
#[wasm_bindgen]
impl WasmNamedPointSet {
    //cp new
    /// Create a new WasmGraphCanvas attached to a Canvas HTML element,
    /// adding events to the canvas that provide the paint program
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<WasmNamedPointSet, JsValue> {
        let nps = NamedPointSet::default();
        Ok(Self { nps })
    }

    //cp read_json
    #[wasm_bindgen]
    pub fn read_json(&mut self, json: &str) -> Result<(), JsValue> {
        let json = image_calibrate::json::remove_comments(json);
        let nps = NamedPointSet::from_json(&json)?;
        self.nps.merge(&nps);
        Ok(())
    }

    //cp to_json
    #[wasm_bindgen]
    pub fn to_json(&self) -> Result<String, JsValue> {
        Ok(self.nps.to_json()?)
    }

    //mp add_pt
    #[wasm_bindgen]
    pub fn add_pt(&mut self, wnp: WasmNamedPoint) -> Result<(), JsValue> {
        let color: Color = wnp.color.as_str().try_into()?;
        self.nps.add_pt(&wnp.name, color, wnp.model.into());
        Ok(())
    }

    //mp get_pt
    #[wasm_bindgen]
    pub fn get_pt(&mut self, name: &str) -> Result<WasmNamedPoint, JsValue> {
        if let Some(np) = self.nps.get_pt(name) {
            let wnp = WasmNamedPoint {
                name: name.into(),
                color: np.color().as_string(),
                model: np.model().into(),
            };
            Ok(wnp)
        } else {
            return Err("Unknown point")?;
        }
    }

    //mp pts
    #[wasm_bindgen]
    pub fn pts(&mut self) -> Result<Array, JsValue> {
        let names = js_sys::Array::new();
        for (name, _) in self.nps.iter() {
            let name: JsValue = name.into();
            names.push(&name);
        }
        Ok(names)
    }

    //zz All done
}
