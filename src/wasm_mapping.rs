//a Imports
use js_sys::Array;

use wasm_bindgen::prelude::*;

use photogram::{
    CameraDatabase, CameraInstance, CameraInstanceDesc, CameraProjection, Color, JsonParsable,
    NamedPoint, NamedPointSet, Point2D, Point3D, PointMapping, PointMappingSet, Rrc,
};

use crate::{err_to_string, ToFromWasmArr, WasmRay};

//a WasmPointMappingSet
//tp WasmPointMappingSet
#[wasm_bindgen]
pub struct WasmPointMappingSet {
    pms: Rrc<PointMappingSet>,
}

//ip WasmPointMappingSet
impl WasmPointMappingSet {
    //ap pms
    pub fn pms(&self) -> &Rrc<PointMappingSet> {
        &self.pms
    }
    //cp of_pms
    pub fn of_pms(pms: Rrc<PointMappingSet>) -> Self {
        Self { pms }
    }
}

//ip WasmPointMappingSet
#[wasm_bindgen]
impl WasmPointMappingSet {
    //fp new
    /// Create a new WasmPointMappingSet from a camera database and a Json file
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmPointMappingSet {
        let pms = PointMappingSet::default().into();
        Self { pms }
    }

    //mp read_json
    /// Read a json file to add to the points
    pub fn read_json(&mut self, wnps: &WasmNamedPointSet, json: &str) -> Result<(), JsValue> {
        let (pms, pms_not_found) = PointMappingSet::load_json(json, &wnps.nps.borrow())
            .map_err(err_to_string)?
            .into();
        // if !nf.is_empty() {
        // eprintln!("Warning: {}", nf);
        // }
        Ok(())
    }

    //cp to_json
    #[wasm_bindgen]
    pub fn to_json(&self) -> Result<String, JsValue> {
        Ok(self.pms.borrow().to_json(false).map_err(err_to_string)?)
    }

    //mp length
    /// Get the number of mappings
    #[wasm_bindgen(getter)]
    pub fn length(&self) -> usize {
        self.pms.borrow().mappings().len()
    }

    //mp get_name
    /// Get the nth point mapping
    pub fn get_name(&self, n: usize) -> Result<String, String> {
        self.pms
            .borrow()
            .mappings()
            .get(n)
            .map(|m| m.name().into())
            .ok_or("Index out of range".into())
    }

    //mp get_xy
    /// Get the XY coords
    pub fn get_xy(&self, n: usize) -> Result<Box<[f64]>, String> {
        self.pms
            .borrow()
            .mappings()
            .get(n)
            .map(|m| [m.screen()[0], m.screen()[1]].into())
            .ok_or("Index out of range".into())
    }

    //mp get_xy_err
    /// Get the XY coords and error
    pub fn get_xy_err(&self, n: usize) -> Result<Box<[f64]>, String> {
        self.pms
            .borrow()
            .mappings()
            .get(n)
            .map(|m| [m.screen()[0], m.screen()[1], m.error()].into())
            .ok_or("Index out of range".into())
    }

    //mp mapping_of_name
    pub fn mapping_of_name(&self, name: &str) -> Option<usize> {
        self.pms
            .borrow()
            .mappings()
            .iter()
            .enumerate()
            .find(|(_, m)| m.name() == name)
            .map(|(n, _)| n)
            .into()
    }

    //mp add_mapping
    pub fn add_mapping(
        &mut self,
        wnps: &WasmNamedPointSet,
        name: &str,
        screen: &[f64],
        error: f64,
    ) -> Result<bool, String> {
        Ok(self.pms.borrow_mut().add_mapping(
            &wnps.nps.borrow(),
            name,
            &Point2D::from_wasm(screen)?,
            error,
        ))
    }

    //mp remove_mapping
    pub fn remove_mapping(&mut self, n: usize) -> Result<(), String> {
        if !self.pms.borrow_mut().remove_mapping(n) {
            Err("Index out of range".into())
        } else {
            Ok(())
        }
    }

    //zz All done
}

//a WasmNamedPoint
//tp WasmNamedPoint
#[wasm_bindgen]
pub struct WasmNamedPoint {
    name: String,
    color: String,
    model: [f64; 3],
    error: f64,
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
        let error = 0.0;
        Ok(Self {
            name,
            color,
            model,
            error,
        })
    }

    //mp name
    #[wasm_bindgen(getter)]
    pub fn name(&self) -> JsValue {
        (&self.name).into()
    }

    //mp color
    #[wasm_bindgen(getter)]
    pub fn color(&self) -> JsValue {
        (&self.color).into()
    }

    //mp model
    #[wasm_bindgen(getter)]
    pub fn model(&self) -> Box<[f64]> {
        Box::new(self.model)
    }

    //mp error
    #[wasm_bindgen(getter)]
    pub fn error(&self) -> f64 {
        self.error
    }
}

//a WasmNamedPointSet
//tp WasmNamedPointSet
/// A set of named points
#[wasm_bindgen]
pub struct WasmNamedPointSet {
    nps: Rrc<NamedPointSet>,
}

//ip WasmNamedPointSet
impl WasmNamedPointSet {
    //cp of_nps
    pub fn of_nps(nps: Rrc<NamedPointSet>) -> Self {
        Self { nps }
    }
    //cp nps
    pub fn nps(&self) -> &Rrc<NamedPointSet> {
        &self.nps
    }
}

//ip WasmNamedPointSet
#[wasm_bindgen]
impl WasmNamedPointSet {
    //cp new
    /// Create a new WasmGraphCanvas attached to a Canvas HTML element,
    /// adding events to the canvas that provide the paint program
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<WasmNamedPointSet, JsValue> {
        let nps = Rrc::<NamedPointSet>::default();
        Ok(Self { nps })
    }

    //cp read_json
    #[wasm_bindgen]
    pub fn read_json(&mut self, json: &str) -> Result<(), JsValue> {
        let nps = NamedPointSet::load_json(json, &())
            .map_err(err_to_string)?
            .into();

        self.nps.borrow_mut().merge(nps);
        Ok(())
    }

    //cp to_json
    #[wasm_bindgen]
    pub fn to_json(&self) -> Result<String, JsValue> {
        Ok(self.nps.borrow().to_json(false).map_err(err_to_string)?)
    }

    //mp add_pt
    #[wasm_bindgen]
    pub fn add_pt(&mut self, wnp: WasmNamedPoint) -> Result<(), JsValue> {
        let color: Color = wnp.color.as_str().try_into()?;
        self.nps
            .borrow_mut()
            .add_pt(&wnp.name, color, Some(wnp.model.into()), wnp.error);
        Ok(())
    }

    //mp get_pt
    #[wasm_bindgen]
    pub fn get_pt(&mut self, name: &str) -> Option<WasmNamedPoint> {
        if let Some(np) = self.nps.borrow().get_pt(name) {
            let (model, error) = np.model();
            let wnp = WasmNamedPoint {
                name: name.into(),
                color: np.color().as_string(),
                model: model.into(),
                error,
            };
            Some(wnp)
        } else {
            None
        }
    }

    //mp pts
    #[wasm_bindgen]
    pub fn pts(&mut self) -> Result<Array, JsValue> {
        let names = js_sys::Array::new();
        for np in self.nps.borrow().iter() {
            let name: JsValue = np.name().to_string().into();
            names.push(&name);
        }
        Ok(names)
    }

    //mp set_model
    pub fn set_model(&self, name: &str, model: &[f64], error: f64) -> Result<(), String> {
        if let Some(np) = self.nps.borrow().get_pt(name) {
            np.set_model(Some((Point3D::from_wasm(model)?, error)));
            Ok(())
        } else {
            Err("Could not find named point".into())
        }
    }

    //mp unset_model
    pub fn unset_model(&self, name: &str) -> Result<(), String> {
        if let Some(np) = self.nps.borrow().get_pt(name) {
            np.set_model(None);
            Ok(())
        } else {
            Err("Could not find named point".into())
        }
    }

    //zz All done
}
