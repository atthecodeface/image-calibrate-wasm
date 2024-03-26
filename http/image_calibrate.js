//a To do
// recolor named point (based on camera, need to get image pixel value - probably by creating a canvas?)
// rename named point
// project in Rust
// error distance in named point
// circular luminance/chrominance for 1mm, 3.161mm, 10mm or 1mm, 2.16mmm, 4.66mm, 10m...
// Download project as a whole
// save whole project

//a Imports
import init, {WasmProject, WasmCip, WasmCameraDatabase, WasmCameraInstance, WasmNamedPoint, WasmNamedPointSet, WasmPointMappingSet, WasmRay} from "../pkg/image_calibrate_wasm.js";
//a Useful functions
//fp is_array
function is_array(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
}

//fp is_string
function is_string(obj) {
    return typeof obj === "string";
}

//fp is_float
function is_float(obj) {
    return typeof obj === "number";
}

//fp parse_json
function parse_json(data) {
    const regex = new RegExp("//[^\n]*", "g");
    data = data.replaceAll(regex, "");
    try {
        const obj = JSON.parse(data);
        return obj;
    } catch (e) {
        return;
    }
}

//mp quaternion_x_vector
function quaternion_x_vector(q, v, add=[0,0,0]) {
    const r = -q[3];
    const i = q[0];
    const j = q[1];
    const k = q[2];
    const x = (r * r + i * i - j * j - k * k) * v[0]
        + 2 * (i * k + r * j) * v[2]
        + 2 * (i * j - r * k) * v[1];
    const y = (r * r - i * i + j * j - k * k) * v[1]
        + 2 * (j * i + r * k) * v[0]
        + 2 * (j * k - r * i) * v[2];
    const z = (r * r - i * i - j * j + k * k) * v[2]
        + 2 * (k * j + r * i) * v[1]
        + 2 * (k * i - r * j) * v[0];
    return [x+add[0], y+add[1], z+add[2]];
}

//mp html_position
function html_position(c, dp=2) {
    if (c.length == 3) {
        c = [c[0].toFixed(dp),
             c[1].toFixed(dp),
             c[2].toFixed(dp),
            ];
        return `${c[0]}, ${c[1]}, ${c[2]}`;
    } else {
        c = [c[0].toFixed(dp),
             c[1].toFixed(dp),
            ];
        return `(${c[0]}, ${c[1]})`;
    }
}

//mp html_clear
function html_clear(id) {
    while (id.firstChild) {
        id.removeChild(id.firstChild);
    }
}

//mp html_add_ele
function html_add_ele(parent, type, classes) {
    const ele = document.createElement(type);
    ele.classes = classes;
    parent.append(ele);
    return ele;
}

//mp html_table
function html_table(table_classes, headings, contents) {
    const table = document.createElement("table");
    table.className = "browser_table "+table_classes;
    var tr;

    if (headings) {
        tr = document.createElement("tr");
        let i = 0;
        for (const h of headings) {
            const th = document.createElement("th");
            th.innerText = h;
            th.className = "th"+i;
            i += 1;
            tr.appendChild(th);
        }
        table.appendChild(tr);
    }

    for (const c of contents) {
        tr = document.createElement("tr");
        for (const d of c) {
            const td = document.createElement("td");
            td.innerHTML = d;
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    return table;
}

//mp html_vtable
function html_vtable(table_classes, contents) {
    const table = document.createElement("table");
    table.className = "browser_table "+table_classes;
    var tr;

    for (const c of contents) {
        tr = document.createElement("tr");
        let td_or_th = "th";
        for (const d of c) {
            const td = document.createElement(td_or_th);
            td.innerHTML = d;
            tr.appendChild(td);
            td_or_th = "td";
        }
        table.appendChild(tr);
    }
    return table;
}

//mp find_data_type
function find_data_type(data) {
    const obj = parse_json(data);
    if (!obj) {
        return;
    }
    if (obj["bodies"]) {
        return "cdb";
    }
    if (obj["body"] && obj["lens"] && obj["position"] && obj["direction"]) {
        return "cam";
    }
    if (obj["cdb"] && obj["nps"] && obj["cips"]) {
        return "proj";
    }
    if (is_array(obj) && obj.length>0) {
        if (is_array(obj[0]))
        {
            if ((obj[0].length == 3) && is_string(obj[0][0]) && is_array(obj[0][1]) && is_float(obj[0][2])) {
                return "pms";
            }
            if ((obj[0].length == 3) && is_string(obj[0][0]) && is_string(obj[0][1]) && is_array(obj[0][2])) {
                return "nps";
            }
        }
    }
    return;
}
    

//mp round_to_multiple
function round_to_multiple(x, m, to=0 ) {
    if (to==0) {
        return m * Math.round(x/m);
    } else if (to<0) {
        return m * Math.floor(x/m);
    } else {
        return m * Math.ceil(x/m);
    }
}

//a Log
class Log {
    //fp constructor
    constructor(div) {
        this.log = [];
        this.div = div;
    }

    //mp set_div
    set_div(div) {
        this.div = div;
    }

    //mp reset_log
    reset_log() {
        this.log = [];
        this.fill_div();
    }
    
    //ap is_empty
    is_empty() {
        return this.log.length==0;
    }
    
    //ap log
    log() {
        return this.log;
    }
    
    //mp add_log
    add_log(severity, src, reason, error) {
        this.log.push({ "severity":severity, "src":src, "reason":reason, "error":error});
        this.fill_div();
    }

    //mp fill_div
    fill_div() {
        if (!this.div) {
            return;
        }
        let html = "";
        for (const e of this.log) {
            html += `${e.severity} : ${e.src} : ${e.reason} : ${e.error} : <br/>`;
        }
        this.div.innerHTML = html;
    }
    
}

//a Directory
class Directory {
    //fp constructor
    constructor() {
        this.files = {};
    }

    //mp contains_file
    contains_file(suffix, root) {
        if (!this.files[suffix]) {
            return false;
        }
        if (!this.files[suffix][root]) {
            return false;
        }
        return true;
    }

    //mp add_file
    add_file(suffix, root) {
        if (!this.files[suffix]) {
            this.files[suffix] = {};
        }
        this.files[suffix][root] = true;
    }

    //mp delete_file
    delete_file(suffix, root) {
        if (!this.files[suffix]) {
            return;
        }
        if (!this.files[suffix][root]) {
            return;
        }
        delete(this.files[suffix][root]);
        if (this.files[suffix].length == 0) {
            delete(this.files[suffix]);
        }
    }

    //mp files_of_type
    files_of_type(suffix) {
        if (!this.files[suffix]) {
            return [];
        }
        return Object.keys(this.files[suffix]);
    }
}

//a FileSet
class FileSet {

    //fp constructor
    constructor(storage, prefix) {
        this.storage = storage;
        this.prefix = prefix;
        this.load_dir();
    }

    //mp split_filename
    split_filename(filename) {
        const suffix = filename.split(".").pop();
        if (suffix) {
            const root = filename.slice(0, -suffix.length-1);
            return [suffix, root];
        } else {
            return null;
        }
    }
    
    //mp load_dir
    load_dir() {
        this.directory = new Directory();
        const n = this.storage.length;
        const pl = this.prefix.length;
        for (let i = 0; i < n; i++) {
            let k = this.storage.key(i);
            if (k.startsWith(this.prefix)) {
                const f = k.slice(pl);
                const s_r = this.split_filename(f);
                if (s_r) {
                    this.directory.add_file(s_r[0], s_r[1]);
                }
            }
        }
    }

    //mp load_file
    load_file(suffix, root) {
        let f = this.prefix + root + "." + suffix;
        return this.storage.getItem(f);
    }

    //mp save_file
    save_file(suffix, root, data) {
        let f = this.prefix + root + "." + suffix;
        this.storage.setItem(f, data);
        this.directory.add_file(suffix, root);
    }

    //mp dir
    dir() {
        return this.directory;
    }

    //zz All done
}

//a CIP
class CIP {

    //fp constructor
    constructor(cam_file, pms_file, img) {
        this.cam_file = cam_file;
        this.pms_file = pms_file;
        this.img = img;
        this.cip = new WasmCip(this.cam_file, this.img, this.pms_file);
    } 

    //ap names
    names() {
        return [this.cam_file, this.img, this.pms_file];
    }

    //mp load_json
    load_json(file_set, project) {
        const cam_json = file_set.load_file("cam", this.cam_file);
        const pms_json = file_set.load_file("pms", this.pms_file);

        if (!cam_json) {
            window.log.add_log(5, "cip", "load", `Failed to read camera JSON file '${this.cam_file}'`);
            return;
        }
        if (!pms_json) {
            window.log.add_log(5, "cip", "load", `Failed to read PMS JSON file '${this.pms_file}`);
            return;
        }

        this.cip.camera = new WasmCameraInstance(project.cdb, cam_json);
        this.cip.pms.read_json(project.nps, pms_json);

        window.log.add_log(0, "cip", "load", `Loaded CIP ${this.cam_file}:${this.pms_file}:${this.img}`);
    }

    //mp save_json
    save_json(file_set) {
        const cam_json = this.cip.camera.to_json();
        const pms_json = this.cip.pms.to_json();
        file_set.save_file("cam", this.cam_file, cam_json);
        file_set.save_file("pms", this.pms_file, pms_json);

        window.log.add_log(0, "cip", "save", `Saved CIP ${this.cam_file}:${this.pms_file}`);
    }        
}

//a Project
class Project {

    //fp constructor
    constructor(file_set, name) {
        this.file_set = file_set;
        this.name = name;
        this.cdb_file = null;
        this.nps_file = null;
        this.cips = [];
        this.project = new WasmProject();
    }

    //mp is_valid
    is_valid() {
        return (this.cdb_file && this.nps_file && (this.cips.length>0));
    }

    //mp as_json
    as_json() {
        const obj = {
            "name": this.name,
            "nps": this.nps_file,
            "cdb": this.cdb_file,
            "cips": this.cips.names(),
        };
        return JSON.stringify(obj);
    }

    //mp from_json
    from_json(name, json) {
        const obj = parse_json(json);
        if (!obj) {
            window.log.add_log(5, "project", "json", `Failed to parse json for project ${name}`);
            return;
        }
        this.project = new WasmProject();
        this.name = name;
        this.nps_file = null;
        this.cdb_file = null;
        this.cips = [];

        if (is_string(obj.nps)) {
            this.nps_file = obj.nps;
        }
        if (is_string(obj.cdb)) {
            this.cdb_file = obj.cdb;
        }
        if (!is_array(obj.cips)) {
            return;
        }
        for (const cp of obj.cips) {
            if (is_string(cp[0]) && is_string(cp[1]) && is_string(cp[2])) {
                this.cips.push(new CIP(cp[0], cp[2], cp[1]));
            }
        }
    }

    //mp save_json
    save_json() {
        this.file_set.save_file("proj", this.name, this.as_json());
    }

    //mp load_json
    load_json() {
        let json = this.file_set.load_file("proj",this.name);
        if (json) {
            this.from_json(this.name, json);
        } else {
            window.log.add_log(5, "project", "load", `Failed to load json for project ${this.name}`);
        }
    }

    //mp load_contents
    load_contents() {
        const cdb_json = this.file_set.load_file("cdb", this.cdb_file);
        const nps_json = this.file_set.load_file("nps", this.nps_file);
        if (!cdb_json) {
            window.log.add_log(5, "project", "load", `Failed to read cdb ${this.cdb_file} for project ${name}`);
            return;
        }
        if (!nps_json) {
            window.log.add_log(5, "project", "load", `Failed to read nps ${this.nps_file} for project ${name}`);
            return;
        }

        this.project.cdb = new WasmCameraDatabase(cdb_json);
        this.project.nps = new WasmNamedPointSet();
        this.project.nps.read_json(nps_json);

        if (this.project.cdb && this.project.nps) {
            for (const cip of this.cips) {
                cip.load_json(this.file_set, this.project);
            }
        }
        window.log.add_log(0, "project", "load", `Read project contents ${this.name}`);
    }        

    //mp save_nps
    save_nps() {
        this.file_set.save_file("nps", this.nps_file, this.project.nps.to_json());
    }

    //zz All done
}

//a Ic
class Ic {

    //fp constructor
    constructor(file_set) {
        this.file_set = file_set;
        this.project = new Project(this.file_set, "None");
        this.cip_of_project = 0;
        this.trace_ray_name = null;
    }

    //mp load_proj
    load_proj(name) {
        const data = this.file_set.load_file("proj", name);
        if (!data) {
            window.log.add_log(5, "project", "load", `Failed to read project ${name}`);
            return;
        }
        this.project.from_json(name, data);
        if (!this.project.is_valid()) {
            window.log.add_log(5, "project", "load", `Failed to parse project data for ${name}`);
            return;
        }
        this.project.load_contents();
        this.select_cip_of_project(0);
        window.log.add_log(0, "project", "load", `Read project ${name}`);
    }

    //mp select_cip_of_project
    select_cip_of_project(n) {
        this.cip_of_project = n;
        const cip = this.project.cips[this.cip_of_project];
        this.cam = cip.cip.camera;
        this.pms = cip.cip.pms;
        this.img_src = cip.img;
    }

    //mp save_cip
    save_cip(n) {
        if (n === undefined) {
            n = this.cip_of_project;
        }
        const cip = this.project.cips[n];
        cip.save_json(this.file_set);
    }

    //mp save_nps
    save_nps() {
        this.project.save_nps();
    }

    //mp redraw_nps
    redraw_nps(ctx, zw) {
        const nps = this.project.project.nps;
        if (!nps) {
            return;
        }
        const cl = 6;
        const cw = 2;

        for (const name of nps.pts()) {
            const p = nps.get_pt(name);
            const xyz = p.model();
            const pxy = zw.scr_xy_of_img_xy(this.cam.map_model(xyz));
            ctx.fillStyle = p.color();
            ctx.fillRect(pxy[0]-cl, pxy[1]-cw, cl*2, cw*2);
            ctx.fillRect(pxy[0]-cw, pxy[1]-cl, cw*2, cl*2);
        }
    }
    
    //mp redraw_pms
    redraw_pms(ctx, zw) {
        if (!this.pms) {
            return;
        }
        const cl = 6;
        const cw = 2;
        const nps = this.project.project.nps;
        
        let num_mappings = this.pms.len();
        for (let i = 0; i < num_mappings; i++) { 
            const n = this.pms.get_name(i);
            const p = nps.get_pt(n);
            const xye = this.pms.get_xy_err(i);
            const sxy = zw.scr_xy_of_img_xy([xye[0], xye[1]]);
            ctx.strokeStyle = p.color();
            ctx.beginPath();
            ctx.arc(sxy[0], sxy[1], cl, 0, Math.PI * 2, true);
            ctx.stroke();
        }
    }

    //mp redraw_rays
    redraw_rays(ctx, name, zw) {
        if (!this.project.project.nps || !name) {
            return;
        }
        const p = this.project.project.nps.get_pt(name);
        if (!p) {
            return;
        }
        ctx.strokeStyle = p.color();
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const i in this.project.cips) {
            if (i == this.cip_of_project) {
                continue;
            }
            const cip = this.project.cips[i];
            const mapping = cip.cip.pms.mapping_of_name(name);
            if (!mapping) {
                continue;
            }
            const ray = cip.cip.camera.get_pm_as_ray(cip.cip.pms, mapping, true);
            const focus_distance = cip.cip.camera.focus_distance;
            for (let k=0; k<100; k++) {
                const xyz = ray.model_at_distance((k+50)*focus_distance/100);
                const pxy = zw.scr_xy_of_img_xy(this.cam.map_model(xyz));
                if (k==0) {
                    ctx.moveTo(pxy[0], pxy[1]);
                } else {
                    ctx.lineTo(pxy[0], pxy[1]);
                }
            }
        }                    
        ctx.stroke();
    }

    //mp redraw_canvas
    redraw_canvas(canvas, zw) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.redraw_nps(ctx, zw);
        this.redraw_pms(ctx, zw);
        this.redraw_rays(ctx, this.trace_ray_name, zw);
    }

    //zz All done
}

//a ZoomedWindow
// This has an image that is WxH, and that is zoomed and panned to make
// it visible on the screen
//
// The zoomed image has size Z.w x Z.h
//
// The screen is a window into the zoomed image of size w x h
// (so one zoom pixel is the same size as one screen pixel) at a
// top-left offset of zoom_scr_ofs
//
// The zoom can scale from 1 (as the zoomed image is always at least
// the same width as the screen) up to 10 screen/zoomed pixels per
// image pixel (if max_zoom_px_per_img_px is 10)
//
//
class ZoomedWindow {

    //fp constructor
    constructor(scr_wh) {
        this.min_zoom = 1.0;
        this.max_zoom = 1.0;
        this.zoom = 1.0;
        this.img_wh = [0, 0];
        this.scr_wh = [scr_wh[0], scr_wh[1]];
        this.zoom_wh = [scr_wh[0], scr_wh[1]];
        this.zoom_scr_ofs = [0,0];
        this.max_zoom_px_per_img_px = 10;
        this.zoom_px_of_img_px = 1.0;
    }

    //ap get_zoom
    get_zoom() {
        return this.zoom;
    }

    //ap get_scr_wh
    get_scr_wh() {
        return this.scr_wh;
    }

    //ap get_img_cxy
    get_img_cxy() {
        return [this.img_wh[0]/2, this.img_wh[1]/2];
    }
    //mp set_img
    set_img(w, h) {
        this.img_wh = [w,h];
        this.recalculate_zoom();
    }

    //mp set_zoom_scr
    set_zoom_scr(lx,ty) {
        this.zoom_scr_ofs[0] = lx;
        this.zoom_scr_ofs[1] = ty;
    }

    //mp recalculate_zoom
    // Set the zoom to a specific factor
    //
    // Returns the scale factor from the current zoom to the actual new zoom
    recalculate_zoom() {
        this.min_zoom = 1.0;
        this.max_zoom = 1.0;
        if (this.img_wh[0] > 0) {
            this.max_zoom = this.img_wh[0]*this.max_zoom_px_per_img_px / this.scr_wh[0];
        }
        this.zoom_set(this.zoom);
    }
            
    //mp zoom_set
    // Set the zoom to a specific factor
    //
    // Returns the scale factor from the current zoom to the actual new zoom
    //
    // If focus_xy is provided it is in screen coordinates
    // (i.e. zoomed pixels relative to the top-left); if not it is
    // deemed to be the centre of the current window (i.e. scr_wh[]/2)
    zoom_set(zoom, focus_xy) {
        if (zoom > this.max_zoom) { zoom = this.max_zoom; }
        if (zoom < this.min_zoom) { zoom = this.min_zoom; }

        const rescale_factor = zoom / this.zoom;
        this.zoom = zoom;
        this.zoom_wh[0] = this.zoom * this.scr_wh[0];
        this.zoom_wh[1] = this.zoom * this.scr_wh[1];
        this.zoom_px_of_img_px = 1.0;
        if (this.img_wh[0] > 0) {
            this.zoom_px_of_img_px = this.zoom_wh[0] / this.img_wh[0];
        }

        if (!focus_xy) {
            focus_xy = [ this.scr_wh[0]/2,
                         this.scr_wh[1]/2
                       ];
        }
        this.zoom_scr_ofs[0] = this.zoom_scr_ofs[0]*rescale_factor + (rescale_factor-1)*focus_xy[0];
        this.zoom_scr_ofs[1] = this.zoom_scr_ofs[1]*rescale_factor + (rescale_factor-1)*focus_xy[1];
        return rescale_factor;
    }

    //mp img_cxy
    img_cxy() {
        return [this.img_wh[0]/2, this.img_wh[1]/2];
    }

    //mp scr_xy_of_img_xy
    // Get a screen XY of an image XY
    //
    // Map to the zoom space and account for the top-left of the screen window on the zoom area
    scr_xy_of_img_xy(img_xy) {
        return [img_xy[0] * this.zoom_px_of_img_px - this.zoom_scr_ofs[0],
                img_xy[1] * this.zoom_px_of_img_px - this.zoom_scr_ofs[1]
               ];
    }

    //mp img_xy_of_scr_xy
    // Get an image XY of a screen XY
    //
    // Map from the zoom space and account for the top-left of the screen window on the zoom area
    img_xy_of_scr_xy(scr_xy) {
        return [(scr_xy[0] + this.zoom_scr_ofs[0]) / this.zoom_px_of_img_px,
                (scr_xy[1] + this.zoom_scr_ofs[1]) / this.zoom_px_of_img_px
               ];
    }

    //mp img_bounds
    img_bounds() {
        const img_cxy = this.img_cxy();
        const img_lx = this.zoom_scr_ofs[0] / this.zoom_px_of_img_px - img_cxy[0];
        const img_ty = this.zoom_scr_ofs[1] / this.zoom_px_of_img_px - img_cxy[1];
        const img_rx = (this.zoom_scr_ofs[0] + this.zoom_wh[0]) / this.zoom_px_of_img_px - img_cxy[0];
        const img_by = (this.zoom_scr_ofs[1] + this.zoom_wh[1]) / this.zoom_px_of_img_px - img_cxy[1];
        return [ img_lx, img_ty, img_rx, img_by];
    }

    //mp scr_focus_on_img_xy For a given image XY, set the scr offset
    // so that the image XY is in the center of the screen (if
    // possible)
    scr_focus_on_xy(img_xy) {
        const scr_lx = img_xy[0] * this.zoom_px_of_img_px - this.scr_wh[0]/2;
        const scr_ty = img_xy[1] * this.zoom_px_of_img_px - this.scr_wh[1]/2;
        this.zoom_scr_ofs = [scr_lx, scr_ty];
    }

    //zz All done
}


//a ImageCanvas
class ImageCanvas {
    //fp constructor
    constructor(file_set, image_div_id) {
        this.div = document.getElementById(image_div_id);
        this.image_div = document.createElement("div");
        this.image_div.className = "bg pos_abs image_div";
        this.canvas = document.createElement("canvas");
        this.canvas.className = "fg pos_abs";
        this.div.appendChild(this.image_div);
        this.div.appendChild(this.canvas);
        this.image = document.createElement("img");
        this.image.className = "image";
        this.image_div.appendChild(this.image);

        this.file_set = file_set;
        this.ic = new Ic(this.file_set);
        
        const width = this.div.offsetWidth;
        const height = this.div.offsetHeight;

        this.canvas.width = width;
        this.canvas.height = height;
        this.image.width = width; // set the 'img' to be the zoomed size
        this.image_div.style.width = width+"px";
        this.image_div.style.height = height+"px";

        this.drag = null;
        this.cursor = null;
        this.animating = false;
        this.min_grid_spacing = 30;
        this.zw = new ZoomedWindow([width, height]);

        const me = this;
        this.canvas.addEventListener('wheel', function(e) {me.wheel(e);});
        this.canvas.addEventListener('mousedown', function(e) {me.mouse_down(e);});
        this.canvas.addEventListener('mouseup', function(e) {me.mouse_up(e);});
        this.canvas.addEventListener('mouseout', function(e) {me.mouse_up(e);});
        this.canvas.addEventListener('mousemove', function(e) {me.mouse_move(e);});

        this.redraw_canvas();
        this.image_div.width = width;
        this.image_div.height = height;

        this.image.addEventListener('load', function(e) { me.redraw_canvas(); } );
        this.load_proj("nac_proj.json");
        }

    //mp update_info
    update_info() {
        // console.log("Location", this.ic.cam.location);
        // console.log("Orientation", this.ic.cam.orientation);
    }

    //mp redraw_grid
    redraw_grid(canvas) {
        if (this.zw.zoom_px_of_img_px < 0.0001) {
            return;
        }

        let allowed_img_px = [[1,5], [5,2], [10,5], [50,2], [100,5], [500,2], [1000,5], [5000,2]];
        // let allowed_img_px = [1,2,5,10,20,50,100,200,500,1000,2000,5000];
        let img_px_grid = 1;
        let img_px_thicker = 5;
        for (const aip of allowed_img_px) {
            let scr_px = aip[0] * this.zw.zoom_px_of_img_px;
            if (scr_px > this.min_grid_spacing) {
                img_px_grid = aip[0];
                img_px_thicker = aip[1];
                break;
            }
        }

        const img_cxy = this.zw.get_img_cxy();
        const img_bounds = this.zw.img_bounds();
        const img_lx_grid = round_to_multiple(img_bounds[0], img_px_grid, 1);
        const img_ty_grid = round_to_multiple(img_bounds[1], img_px_grid, 1);
        const img_lx_grid_t_ofs = (img_lx_grid / img_px_grid) % img_px_thicker;
        const img_ty_grid_t_ofs = (img_ty_grid / img_px_grid) % img_px_thicker;

        const scr_grid_ltxy = this.zw.scr_xy_of_img_xy([ img_cxy[0]+img_lx_grid,
                                                         img_cxy[1]+img_ty_grid ]);
        const scr_cxy = this.zw.scr_xy_of_img_xy(img_cxy);
        const scr_px_grid = img_px_grid * this.zw.zoom_px_of_img_px;

        const scr_wh = this.zw.get_scr_wh();
        const ctx = canvas.getContext("2d");

        ctx.strokeStyle = "#666";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x=scr_grid_ltxy[0]; x<scr_wh[0]; x+=scr_px_grid) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, scr_wh[1]);
        }
        for (let y=scr_grid_ltxy[1]; y<scr_wh[1]; y+=scr_px_grid) {
            ctx.moveTo(0, y);
            ctx.lineTo(scr_wh[0], y);
        }
        ctx.stroke();

        ctx.strokeStyle = "#eee";
        ctx.lineWidth = 1;
        ctx.beginPath();
        let i = img_lx_grid_t_ofs;
        for (let x=scr_grid_ltxy[0]; x<scr_wh[0]; x+=scr_px_grid) {
            if (i==0) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, scr_wh[1]);
            }
            i = (i+1)%img_px_thicker;
        }
        i = img_ty_grid_t_ofs;
        for (let y=scr_grid_ltxy[1]; y<scr_wh[1]; y+=scr_px_grid) {
            if (i==0) {
                ctx.moveTo(0, y);
                ctx.lineTo(scr_wh[0], y);
            }
            i = (i+1)%img_px_thicker;
        }
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(scr_cxy[0], 0);
        ctx.lineTo(scr_cxy[0], scr_wh[1]);
        ctx.moveTo(0, scr_cxy[1]);
        ctx.lineTo(scr_wh[0], scr_cxy[1]);
        ctx.stroke();
    }
    
    //mp redraw_canvas
    redraw_canvas() {
        this.src_width = this.image.naturalWidth;
        this.src_height = this.image.naturalHeight;
        this.zw.set_img(this.src_width, this.src_height);
            
        this.zw.set_zoom_scr(this.image_div.scrollLeft, this.image_div.scrollTop);
        this.update_info();
        this.just_redraw_canvas();
    }

    //mp just_redraw_canvas
    just_redraw_canvas() {
        this.ic.redraw_canvas(this.canvas, this.zw);
        this.redraw_grid(this.canvas);
        this.redraw_cursor(this.canvas);
    }


    //mp redraw_cursor
    redraw_cursor(canvas) {
        if (this.cursor) {
            const ctx = canvas.getContext("2d");
            const cxy = this.zw.scr_xy_of_img_xy([this.cursor[0], this.cursor[1]]);
            const r = this.cursor[2];
            const angle = this.cursor[3];

            const rs = r*Math.sin(angle);
            const rc = r*Math.cos(angle);

            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cxy[0]-rs,cxy[1]-rc);
            ctx.lineTo(cxy[0]+rs,cxy[1]+rc);
            ctx.moveTo(cxy[0]-rc,cxy[1]+rs);
            ctx.lineTo(cxy[0]+rc,cxy[1]-rs);
            ctx.stroke();
        }
    }

    //mp cursor_add
    cursor_add(cxy, r) {
        const cursor_info = document.getElementById("cursor_info");
        if (cxy) {
            this.cursor = [cxy[0], cxy[1], r, 0, null];
            this.set_animating(true);
            if (cursor_info) {
                html_clear(cursor_info);
                const input = html_add_ele(cursor_info, "input");
                input.type = "button";
                input.value = `Cursor at ${html_position(cxy,0)}`;
                const me = this;
                input.addEventListener('click', function(value) {me.focus_on_src(cxy);} );
            }
        } else {
            this.cursor = null;
            cursor_info.innerText = `No cursor`;
        }
    }

    //mp animation_step
    animation_step(ms) {
        if (this.cursor) {
            if (this.cursor[4] === null) {
                this.cursor[4] = ms;
            }
            ms = (ms - this.cursor[4] + 100000) % 2500;
            if (ms < 500) {
                this.cursor[3] = ms*0.1;
                this.just_redraw_canvas();
            }
            return true;
        }
        return false;
    }

    //mp set_animating
    set_animating(a) {
        if (a) {
            if (this.run_step_pending) {return;}
            this.animating = true;
            // Single threaded so these two lines are atomic
            requestAnimationFrame((x)=>this.animation_callback(x));
            this.run_step_pending = true;
        } else {
            this.animating = false;
        }
    }

    //mp animation_callback
    animation_callback(time_now) {
        this.run_step_pending = false;
        if (this.animating) {
            var ms = Math.floor(time_now) % 100000;
            if (this.animation_step(ms)) {
                requestAnimationFrame((x) => this.animation_callback(x));
                this.run_step_pending = true;
            }
        }
    }

    //mp refill_cip_list
    refill_cip_list() {
        const cip_list = document.getElementById("cip_list");
        if (cip_list) {
            const me = cip_list;
            cip_list.addEventListener('click', function(value) {window.image_canvas.select_cip_of_project(me.selectedOptions[0].value);} );
            while (cip_list.firstChild) {
                cip_list.removeChild(cip_list.firstChild);
            }
            for (const p in this.ic.project.cips) {
                const opt = document.createElement("option");
                opt.setAttribute("value", p);
                opt.innerText = p;
                cip_list.appendChild(opt);
            }
        }
    }
    
    //mp load_proj
    load_proj(proj) {
        this.ic.load_proj(proj);
        this.image.src = this.ic.img_src;
        this.refill_cip_list();
        this.select_cip_of_project(0);
    }

    //mi wheel
    wheel(e) {
        if (e.ctrlKey) {
            this.zoom_image_canvas((200-e.deltaY)/200, e.offsetX, e.offsetY);
        } else {
            this.scroll_by(-e.deltaX, -e.deltaY);
        }
        e.preventDefault();
    }

    //mi mouse_down
    mouse_down(e) {
        this.drag = [e.layerX, e.layerY];
        this.click = [e.layerX, e.layerY];
        e.preventDefault();
    }

    //mi mouse_move
    mouse_move(e) {
        this.click = null;
        if (this.drag) {
            if (e.altKey) {
                this.zoom_image_canvas((200+e.movementY)/200, this.drag[0], this.drag[1]);
            } else {
                this.scroll_by(e.movementX, e.movementY);
            }
        }
        e.preventDefault();
    }

    //mi mouse_up
    mouse_up(e) {
        this.drag = null;
        if (this.click) {
            const cxy = this.zw.img_xy_of_scr_xy(this.click);
            this.cursor_add(cxy, 40);
        }
        e.preventDefault();
    }

    //mi zoom_set
    zoom_set(zoom, fxy) {
        this.zw.set_zoom_scr(this.image_div.scrollLeft, this.image_div.scrollTop);
        this.zw.zoom_set(zoom, fxy);

        this.image.width = this.zw.zoom_wh[0]; // set the 'img' to be the zoomed size

        const zoom_scr = this.zw.zoom_scr_ofs;
        this.image_div.scrollLeft = zoom_scr[0];
        this.image_div.scrollTop = zoom_scr[1];
       
        const zoom_e = document.getElementById("zoom");
        if (zoom_e) {
            zoom_e.min = Math.log(this.zw.min_zoom);
            zoom_e.max = Math.log(this.zw.max_zoom);
            zoom_e.value = Math.log(this.zw.get_zoom());
        }
    }

    //mi zoom_image_canvas
    zoom_image_canvas(scale, fx, fy) {
        this.zoom_set(scale * this.zw.get_zoom(), [fx, fy]);
        this.redraw_canvas();
    }

    //mi zoom_by
    zoom_by(delta) {
        const zoom_e = document.getElementById("zoom");
        if (zoom_e) {
            let zoom = Math.exp(zoom_e.value);
            if (delta) {
                zoom = this.zw.get_zoom() * delta;
            }
            this.zoom_set(zoom);
            this.redraw_canvas();
        }
    }

    //mi scroll_by
    scroll_by(dx, dy) {
        this.image_div.scrollLeft -= dx;
        this.image_div.scrollTop -= dy;
        this.redraw_canvas();
    }

    //mi focus_on_src
    focus_on_src(xy) {
        this.zw.scr_focus_on_xy(xy);
        this.image_div.scrollLeft = this.zw.zoom_scr_ofs[0];
        this.image_div.scrollTop = this.zw.zoom_scr_ofs[1];
        this.redraw_canvas();
    }

    //mp reorient
    reorient() {
        console.log(this.ic.cam.to_json());
        console.log(this.ic.cam.reorient_using_rays_from_model(this.ic.pms));
        this.redraw_canvas();
    }

    //mp locate
    locate() {
        console.log("Located with error", this.ic.cam.locate_using_model_lines(this.ic.pms));
        console.log("Oriented error", this.ic.cam.orient_using_rays_from_model(this.ic.pms));
        this.refill_camera_info();
        this.redraw_canvas();
    }

    //mp set_focus_distance
    set_focus_distance(f, delta=null) {
        if (f === null) {
            f = this.ic.cam.focus_distance + delta;
        }
        this.ic.cam.focus_distance = f;
        console.log("Located with error", this.ic.cam.locate_using_model_lines(this.ic.pms));
        console.log("Oriented error", this.ic.cam.orient_using_rays_from_model(this.ic.pms));
        this.refill_camera_info();
        this.redraw_canvas();
    }

    //mp refill_nps_pms
    refill_nps_pms() {
        const nps = document.getElementById("nps_contents");
        if (nps) {
            html_clear(nps);

            const table_classes = "";
            const headings = ["Rays", "Name", "Color", "Location", "Expected at", "Focus", "Mapped to", "Focus", "Delete"];
            const contents = [];
            const pms = this.ic.pms;
            const cam = this.ic.cam;

            for (const np_name of this.ic.project.project.nps.pts().sort()) {
                const np = this.ic.project.project.nps.get_pt(np_name);
                const np_style = `style='color: ${np.color()};'}`;
                const np_img = cam.map_model(np.model());
                const np_x = np_img[0];
                const np_y = np_img[1];
                const rays = `<input type='radio' name='nps' id='np__${np_name}' oninput='window.image_canvas.rays_of_nps("${np_name}")'/><label for='np__${np_name}'  ${np_style}>&#x263C;</label> `;
                const expected_at = `${html_position([np_x-3360, np_y-2240],0)}`;
                const focus_np = `<input type='button' value='&#x271A;' ${np_style} onclick='window.image_canvas.focus_on_src([${np_x},${np_y}])'>`;
                let mapped_to = `<input type='button' value="Set to cursor" onclick='window.image_canvas.set_pms_to_cursor("${np_name}")'>`;
                let focus_pm = "";
                let delete_pms = "";
                const pms_n = pms.mapping_of_name(np_name);
                if (pms_n !== undefined) {
                    mapped_to = pms.get_xy_err(pms_n);
                    let x = mapped_to[0];
                    let y = mapped_to[1];
                    let e = mapped_to[2];
                    focus_pm = `<input type='button' value='&xcirc;' ${np_style} onclick='window.image_canvas.focus_on_src([${x},${y}])'>`;
                    mapped_to = `(${html_position([x-3360,y-2240])}  (err ${e})`;
                    delete_pms =`<input type='button' value='&#x1F5D1;' onclick='window.image_canvas.delete_pms("${np_name}")'>`;
                        
                }
                let location = `<input type='button' value='&#x1F5D1;' onclick='window.image_canvas.derive_nps_location("${np_name}")'>&nbsp;${html_position(np.model())}`;
                contents.push([rays, np.name(), np.color(), location, expected_at, focus_np, mapped_to, focus_pm, delete_pms]);
            }
            const table = html_table(table_classes, headings, contents);
            nps.append(table);
        }
    }    

    //mp refill_camera_info
    refill_camera_info() {
        const camera_info = document.getElementById("camera_info");
        if (camera_info) {
            html_clear(camera_info);

            const cip = this.ic.project.cips[this.ic.cip_of_project];
            const n_cip = this.ic.project.cips.length;
            const cip_num = `${this.ic.cip_of_project} of ${n_cip}`;
            const itable = html_vtable("", 
                                       [ ["CIP", cip_num],
                                        ["Camera", cip.cam_file],
                                        ["Image", cip.img],
                                        ["PMS", cip.pms_file],
                                      ] );
            camera_info.append(itable);

            const location = html_position(this.ic.cam.location);

            var orientation = this.ic.cam.orientation;
            orientation = [-orientation[0].toFixed(2),
                           -orientation[1].toFixed(2),
                           -orientation[2].toFixed(2),
                           -orientation[3].toFixed(2),
                          ];
            orientation = `${orientation[0]}, ${orientation[1]}, ${orientation[2]}, ${orientation[3]}`;
            const focus_distance = this.ic.cam.focus_distance;
            const focused_on = html_position(quaternion_x_vector(this.ic.cam.orientation, [0,0,-focus_distance], this.ic.cam.location));
            const direction = html_position(quaternion_x_vector(this.ic.cam.orientation, [0,0,-focus_distance]));
            const up = html_position(quaternion_x_vector(this.ic.cam.orientation, [0,-10,0]));
            
            const table_classes = "";
            const headings = ["Parameter", "Value"];
            let focus_at = `<input class="widget_button" type="button" value="-" onclick="window.image_canvas.set_focus_distance(null,-1);"/>`
            focus_at += `&nbsp;${focus_distance} mm&nbsp;`;
            focus_at += `<input class="widget_button" type="button" value="+" onclick="window.image_canvas.set_focus_distance(null,1);"/>`;
            const contents = [
                ["Body", this.ic.cam.body],
                ["Lens", this.ic.cam.lens],
                ["Focus at", focus_at],
                ["Location", location],
                ["Orientation", orientation],
                ["Focused on", focused_on],
                ["Direction", direction],
                ["Up", up],
            ];
            const table = html_table(table_classes, headings, contents);
            camera_info.append(table);
        }
    }    

    //mp select_cip_of_project
    select_cip_of_project(n) {
        this.ic.select_cip_of_project(n);
        this.image.src = this.ic.img_src;

        this.refill_camera_info();
        this.refill_nps_pms();
        this.redraw_canvas();
    }

    //mp save_cip
    save_cip() {
        this.ic.save_cip();
    }

    //mp save_nps
    save_nps() {
        this.ic.save_nps();
    }

    //mp save_all
    save_all() {
        this.ic.save_nps();
        for (const i in this.ic.project.cips) {
            this.ic.save_cip(i);
        }
    }

    //mp delete_pms
    delete_pms(name) {
        const pms_n = this.ic.pms.mapping_of_name(name);
        if (pms_n) {
            this.ic.pms.remove_mapping(pms_n);
        }
        this.refill_nps_pms();
        this.redraw_canvas();
    }

    //mp set_pms_to_cursor
    set_pms_to_cursor(name) {
        const pms_n = this.ic.pms.mapping_of_name(name);
        if (this.cursor) {
            const cx = this.cursor[0];
            const cy = this.cursor[1];
            this.ic.pms.add_mapping(this.ic.project.project.nps, name, [cx, cy], 2);
        }
        this.refill_nps_pms();
        this.redraw_canvas();
    }

    //mp add_np_at_cursor_fd
    add_np_at_cursor_fd(name) {
        if (!this.cursor) {
            return;
        }
        if (!name) {
            for (let uid = 10*1000; true; uid=uid+1) {
                name = `${uid}`;
                if (!this.ic.project.project.nps.get_pt(name)) {
                    break;
                }
            }
        }
        const cx = this.cursor[0];
        const cy = this.cursor[1];
        const distance = this.ic.cam.focus_distance;
        const xyz = this.ic.cam.model_at_distance([cx,cy], distance);
        const color = "#0ff";
        const wnp = new WasmNamedPoint(name, color);
        this.ic.project.project.nps.add_pt(wnp);
        this.ic.project.project.nps.set_model(name, xyz);
        this.set_pms_to_cursor(name);
        this.refill_nps_pms();
        this.redraw_canvas();
    }

    //mp rays_of_nps
    rays_of_nps(name) {
        this.ic.trace_ray_name = name;
        this.redraw_canvas();
    }

    //mp derive_nps_location
    derive_nps_location(name) {
        let rays = []
        for (const cip of this.ic.project.cips) {
            const mapping = cip.cip.pms.mapping_of_name(name);
            if (!mapping) {
                continue;
            }
            rays.push(cip.cip.camera.get_pm_as_ray(cip.cip.pms, mapping, true));
        }
        if (rays.length > 1) {
            const xyz = WasmRay.closest_model_to_intersection(rays);
            if (xyz) {
                this.ic.project.project.nps.set_model(name, xyz);
                this.refill_nps_pms();
                this.redraw_canvas();
            }
        }
    }

    //mp derive_all_nps_location
    derive_all_nps_location(name) {
        for (const name in this.ic.project.project.nps.pts()) {
            this.derive_nps_location(name);
        }
    }
    //mp locate_all
    locate_all() {
        for (const cip of this.ic.project.cips) {
            cip.cip.camera.locate_using_model_lines(cip.cip.pms);
            cip.cip.camera.reorient_using_rays_from_model(cip.cip.pms);
        }
        this.refill_camera_info();
        this.redraw_canvas();
    }


    //zz All done
}

//a Browser
class Browser {
    //fp constructor
    constructor(file_set, browser) {
        this.file_set = file_set;
        this.browser = browser;
        this.repopulate();
    }

    //mp repopulate
    repopulate() {
        while (this.browser.firstChild) {
            this.browser.removeChild(this.browser.firstChild);
        }

        const cdb_contents = [];
        for (const f of window.file_set.dir().files_of_type("cdb")) {
            let t = this.file_set.load_file("cdb", f);
            const obj = parse_json(t);
            var bodies_html = "";
            for (const b of obj.bodies) {
                bodies_html += `${b.name}<br>`;
            }
            var lenses_html = "";
            for (const l of obj.lenses) {
                lenses_html += `${l.name}<br>`;
            }
            cdb_contents.push( [f, bodies_html, lenses_html] );
        }
        this.create_file_table("cdb", "Camera Database", ["Filename", "Bodies", "Lenses"], cdb_contents);

        const proj_contents = [];
        for (const f of window.file_set.dir().files_of_type("proj")) {
            let t = this.file_set.load_file("proj", f);
            const obj = parse_json(t);
            proj_contents.push( [f, obj.cdb, obj.nps, obj.cips.length] );
        }
        this.create_file_table("proj", "Projects", ["Filename", "Cdb", "Nps", "Number CIP"], proj_contents);

        const nps_contents = [];
        for (const f of window.file_set.dir().files_of_type("nps")) {
            let t = this.file_set.load_file("nps", f);
            const obj = parse_json(t);
            const num_pts = obj.length;
            nps_contents.push( [f, `${num_pts}`] );
        }
        this.create_file_table("nps", "Named PointSets", ["Filename", "Number of points"], nps_contents);

        const pms_contents = [];
        for (const f of window.file_set.dir().files_of_type("pms")) {
            let t = this.file_set.load_file("pms", f);
            const obj = parse_json(t);
            const num_pts = obj.length;
            pms_contents.push( [f, `${num_pts}`] );
        }
        this.create_file_table("pms", "Point-mapping Sets", ["Filename", "Number of points"], pms_contents);

        const cam_contents = [];
        for (const f of window.file_set.dir().files_of_type("cam")) {
            let t = this.file_set.load_file("cam", f);
            const obj = parse_json(t);
            const cam_html = obj.body + "<br>" + obj.lens + "<br>Focus distance " + obj.mm_focus_distance + "mm";
            const posn_html = obj.position[0].toFixed(2) + ", " + obj.position[1].toFixed(2) + ", " + obj.position[2].toFixed(2);
            cam_contents.push( [f, cam_html, posn_html] );
        }
        this.create_file_table("cam", "Camera Placements", ["Filename", "Camera", "Position"], cam_contents);
    }

    //mp create_file_table
    create_file_table( table_classes, title, headings, contents) {
        const heading = document.createElement("h1");
        heading.className = "browser_ft_heading"
        heading.innerText = title;
        
        const table = document.createElement("table");
        table.className = "browser_table "+table_classes;
        var tr;

        tr = document.createElement("tr");
        var i = 0;
        for (const h of headings) {
            const th = document.createElement("th");
            th.innerText = h;
            th.className = "th"+i;
            i += 1;
            tr.appendChild(th);
        }
        table.appendChild(tr);

        for (const c of contents) {
            tr = document.createElement("tr");
            for (const d of c) {
                const td = document.createElement("td");
                td.innerHTML = d;
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        this.browser.appendChild(heading);
        this.browser.appendChild(table);
    }

    //mp upload_files
    upload_files(files) {
        for (const file of files) {
            file.text().then(
                (value) => {
                    const dt = find_data_type(value);
                    if (dt) {
                        window.log.add_log(0, "browser", "upload", `Uploaded ${file.name} of type ${dt}`);
                        this.file_set.save_file(dt, file.name, value);
                        this.repopulate();
                    } else {
                        window.log.add_log(5, "browser", "upload", `Could not determine type of ${file.name}`);
                    }
                }
            );
        }
    }

}

//a Top level init() =>
init().then(() => {
    window.log = new Log(document.getElementById("Log"));
    window.file_set = new FileSet(window.localStorage, "nac/");
    const browser = document.getElementById("FileBrowser");
    if (browser) {
        window.browser = new Browser(file_set, browser);
    }
    const image_canvas = document.getElementById("image_canvas");
    if (image_canvas) {
        window.image_canvas = new ImageCanvas(file_set, 'image_canvas');
    }
    const project_list = document.getElementById("project_list");
    if (project_list) {
        const me = project_list;
        project_list.addEventListener('click', function(value) {window.image_canvas.load_proj(me.selectedOptions[0].value);} );
        while (project_list.firstChild) {
            project_list.removeChild(project_list.firstChild);
        }
        for (const p of window.file_set.dir().files_of_type("proj")) {
            const opt = document.createElement("option");
            opt.setAttribute("value", p);
            opt.innerText = p;
            project_list.appendChild(opt);
        }
    }
});
