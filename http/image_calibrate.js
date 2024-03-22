//a Imports
import init, {WasmCameraDatabase, WasmCameraInstance, WasmNamedPoint, WasmNamedPointSet, WasmPointMappingSet} from "../pkg/image_calibrate_wasm.js";
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
function quaternion_x_vector(q, v) {
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
    return [x, y, z];
}

//mp quaternion_x_X
function quaternion_x_X(q, v) {
    return quaternion_x_vector(q, [1,0,0]);
}

//mp quaternion_x_Y
function quaternion_x_Y(q, v) {
    return quaternion_x_vector(q, [0,1,0]);
}

//mp quaternion_x_Z
function quaternion_x_Z(q, v) {
    return quaternion_x_vector(q, [0,0,1]);
}

//mp html_position
function html_position(c) {
    c = [c[0].toFixed(2),
         c[1].toFixed(2),
         c[2].toFixed(2),
        ];
    return `${c[0]}, ${c[1]}, ${c[2]}`;
}

//mp html_clear
function html_clear(id) {
    while (id.firstChild) {
        id.removeChild(id.firstChild);
    }
}

//mp html_table
function html_table(table_classes, headings, contents) {
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
        var     html = "";
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

//a Constants
const camera_db_json = `
{
    "bodies": [
        {
            "name": "Canon EOS 5D mark IV",
            "aliases": ["5D"],
            "px_centre":[3360.0,2240.0],
            "px_width":6720.0,
            "px_height":4480.0,
            "flip_y":true,
            "mm_sensor_width":36.0,
            "mm_sensor_height":24.0
        },
        {
            "name": "Logitech C270 640x480",
            "aliases": ["C270"],
            "px_centre":[320.0, 240.0],
            "px_width":640.0,
            "px_height":480.0,
            "flip_y":true,
            "mm_sensor_width":1.792,
            "mm_sensor_height":1.344
        }    ],
    "lenses":[
        {
            "name":"EF50mm f1.8",
            "aliases": ["50mm"],
            "mm_focal_length":50.0,
            "stw_poly":[0.0, 1.0],
            "wts_poly":[0.0, 1.0]
        },
        {
            "name": "Logitech C270",
            "aliases": ["C270"],
            "mm_focal_length":2.1515,
            "stw_poly":[0.0, 1.0],
            "wts_poly":[0.0, 1.0]
        }       
    ]
}
`;
const camera_inst_json = `
{
    "body": "Canon EOS 5D mark IV",
    "lens": "EF50mm f1.8",
    "mm_focus_distance": 453.0,
    "position": [ 0.0, 0.0, 0.0 ],
    "direction": [ 0.0, 0.0, 0.0, 1.0 ]
}

`;

//a Project
class Project {

    //fp constructor
    constructor(fs, name) {
        this.fs = fs;
        this.name = name;
        this.cdb = null;
        this.nps = null;
        this.cips = [];
    }

    //mp is_valid
    is_valid() {
        return (this.cdb && this.nps && (this.cips.length>0));
    }

    //mp as_json
    as_json() {
        const obj = {
            "name": this.name,
            "nps": this.nps,
            "cdb": this.cdb,
            "cips": this.cips,
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
        this.name = name;
        this.nps = null;
        this.cdb = null;
        this.cips = [];
        if (is_string(obj.nps)) {
            this.nps = obj.nps;
        }
        if (is_string(obj.cdb)) {
            this.cdb = obj.cdb;
        }
        if (!is_array(obj.cips)) {
            return;
        }
        for (const cp of obj.cips) {
            if (is_string(cp[0]) &&  is_string(cp[1]) && is_string(cp[2])) {
                this.cips.push(cp);
            }
        }
    }

    //mp save
    save() {
        this.fs.save_file("proj",this.name,this.as_json());
    }

    //mp load
    load() {
        let json = this.fs.load_file("proj",this.name);
        if (json) {
            this.from_json(this.name, json);
        } else {
            window.log.add_log(5, "project", "load", `Failed to load json for project ${this.name}`);
        }
    }
}

//a Ic
class Ic {

    //fp constructor
    constructor(file_set) {
        this.file_set = file_set;
        this.project = new Project(this.file_set, "None");
        this.cip_of_project = 0;
        this.cdb = new WasmCameraDatabase(camera_db_json);
        this.nps = new WasmNamedPointSet();
        this.cam = new WasmCameraInstance(this.cdb, camera_inst_json);
        this.pms = new WasmPointMappingSet();
        this.img_src = "";
        this.other_cams = [];
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

        const cdb_json = this.file_set.load_file("cdb", this.project.cdb);
        const nps_json = this.file_set.load_file("nps", this.project.nps);
        if (!cdb_json) {
            window.log.add_log(5, "project", "load", `Failed to read cdb ${this.project.cdb} for project ${name}`);
            return;
        }
        if (!nps_json) {
            window.log.add_log(5, "project", "load", `Failed to read nps ${this.project.nps} for project ${name}`);
            return;
        }

        this.cdb = new WasmCameraDatabase(cdb_json);

        this.nps = new WasmNamedPointSet();
        this.nps.read_json(nps_json);

        this.select_cip_of_project(0);
        window.log.add_log(0, "project", "load", `Read project ${name}`);
    }

    //mp select_cip_of_project
    select_cip_of_project(n) {

        this.cip_of_project = n;
        const cip = this.project.cips[this.cip_of_project];
        const cam_json = this.file_set.load_file("cam", cip[0]);
        const pms_json = this.file_set.load_file("pms", cip[2]);

        if (!cam_json) {
            window.log.add_log(5, "project", "cip", `Failed to read camera JSON file '${cip[0]}' ${this.project.cam} for project  ${this.project.name} CIP ${n}`);
            return;
        }
        if (!pms_json) {
            window.log.add_log(5, "project", "cip", `Failed to read PMS JSON file '${cip[2]}' ${this.project.pms} for project  ${this.project.name} CIP ${n}`);
            return;
        }

        if (this.cdb) {
            this.cam = new WasmCameraInstance(this.cdb, cam_json);
        }

        this.pms = new WasmPointMappingSet();
        if (this.nps) {
            this.pms.read_json(this.nps, pms_json);
        }

        const img = cip[1];
        this.img_src = img;
        window.log.add_log(0, "project", "load", `Selected CIP ${this.cip_of_project} of ${this.project.name} img ${img}`);
    }

    //mp save_all
    save_all(root) {
        const nps_json = this.nps.to_json();
        window.localStorage.setItem(`${root}.nps`, nps_json);
        const data = window.localStorage.getItem(`{$root}.nps`);
        if (typeof data !== "string") {
            return;
        }
        this.dir(window.localStorage);
    }

    //mp json_to_element
    json_to_element( id ) {
        var ele = document.getElementById(id);
        ele.innerText = this.nps.to_json();
    }

    //mp nps_set
    nps_set(wnps) {
        this.nps = wnps;
        this.pms = new WasmPointMappingSet();
        this.save_all("root");
    }

    //mp pms_set
    pms_set(wpms) {
        this.pms = wpms;
    }

    //mp camera_set
    camera_set(camera) {
        this.cam = camera;
    }

    //mp other_cameras_reset
    other_cameras_reset() {
        this.other_cams = [];
    }

    //mp other_cameras_add
    other_cameras_add(camera) {
        this.other_cams.push(camera);
    }

    //mp redraw_nps
    redraw_nps(ctx, scale, left, top) {
        const cl = 6;
        const cw = 2;
        let names = this.nps.pts();

        for (name of names) {
            const p = this.nps.get_pt(name);
            let xyz = p.model();
            let pxy = this.cam.map_model(xyz);
            const x = pxy[0];
            const y = pxy[1];
            const sx = x*scale-left;
            const sy = y*scale-top;
            ctx.fillStyle = p.color();
            ctx.fillRect(sx-cl, sy-cw, cl*2, cw*2);
            ctx.fillRect(sx-cw, sy-cl, cw*2, cl*2);
        }
    }
    
    //mp redraw_pms
    redraw_pms(ctx, scale, left, top) {
        const cl = 6;
        const cw = 2;
        let names = this.nps.pts();
        let num_mappings = this.pms.len();
        for (let i = 0; i < num_mappings; i++) { 
            const n = this.pms.get_name(i);
            const p = this.nps.get_pt(n);
            const xye = this.pms.get_xy_err(i);
            // const m = p.model();
            const x = xye[0];
            const y = xye[1];
            const sx = x*scale-left;
            const sy = y*scale-top;
            ctx.strokeStyle = p.color();
            ctx.beginPath();
            ctx.arc(sx, sy, cl, 0, Math.PI * 2, true);
            ctx.stroke();
        }
    }

    //mp redraw_canvas
    redraw_canvas(canvas, scale, left, top) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.redraw_nps(ctx, scale, left, top);
        this.redraw_pms(ctx, scale, left, top);
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
        this.width = width;
        this.height = height;

        this.img_width = width;
        this.canvas.width = width;
        this.canvas.height = height;
        this.image.width = width;
        this.image_div.style.width = width+"px";
        this.image_div.style.height = height+"px";

        this.drag = null;

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
        console.log("Location", this.ic.cam.location());
        console.log("Orientation", this.ic.cam.orientation());
    }

    //mp redraw_canvas
    redraw_canvas() {
        const src_width = this.image.naturalWidth;
        var scale = 0.0;
        if (src_width > 0) {
            scale = this.img_width/src_width;
        }
        this.update_info();
        this.ic.redraw_canvas(this.canvas, scale, this.image_div.scrollLeft, this.image_div.scrollTop);
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
        this.refill_nps();
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
        e.preventDefault();
    }

    //mi mouse_move
    mouse_move(e) {
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
        e.preventDefault();
    }

    //mi zoom_image_canvas
    zoom_image_canvas(scale, fx, fy) {
        const orig_width = this.img_width;
        const ex = fx + this.image_div.scrollLeft;
        const ey = fy + this.image_div.scrollTop;

        var new_width = this.img_width * scale;
        if (new_width > 24000) {
            new_width = 24000;
        }
        if (new_width < 1200) {
            new_width = 1200;
        }
        var actual_scale = new_width / orig_width;

        this.img_width = new_width;
        this.image_div.scrollLeft = ex * actual_scale - fx;
        this.image_div.scrollTop = ey * actual_scale - fy;
        
        this.image.width = new_width;
        this.redraw_canvas();
    }

    //mi scroll_by
    scroll_by(dx, dy) {
        this.image_div.scrollLeft -= dx;
        this.image_div.scrollTop -= dy;
        this.redraw_canvas();
    }

    //mp reorient
    reorient() {
        console.log(this.ic.cam.to_json());
        console.log(this.ic.cam.reorient_using_rays_from_model(this.ic.pms));
        this.redraw_canvas();
    }

    //mp locate
    locate(f) {
        console.log("Located with error", this.ic.cam.locate_using_model_lines(this.ic.pms));
        console.log("Oriented error", this.ic.cam.orient_using_rays_from_model(this.ic.pms));
        this.refill_camera_info();
        this.redraw_canvas();
    }

    //mp set_focus_distance
    set_focus_distance(f) {
        this.ic.cam.set_focus_distance(f);
        console.log("Located with error", this.ic.cam.locate_using_model_lines(this.ic.pms));
        console.log("Oriented error", this.ic.cam.orient_using_rays_from_model(this.ic.pms));
        this.refill_camera_info();
        this.redraw_canvas();
    }

    //mp refill_nps
    refill_nps() {
        const nps = document.getElementById("nps_contents");
        if (nps) {
            html_clear(nps);

            const table_classes = "";
            const headings = ["Name", "Color", "Location"];
            const contents = [];

            for (const np_name of this.ic.nps.pts()) {
                const np = this.ic.nps.get_pt(np_name);
                contents.push([np.name(), np.color(), html_position(np.model())]);
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

            const location = html_position(this.ic.cam.location());

            var orientation = this.ic.cam.orientation();
            orientation = [-orientation[0].toFixed(2),
                           -orientation[1].toFixed(2),
                           -orientation[2].toFixed(2),
                           -orientation[3].toFixed(2),
                          ];
            orientation = `${orientation[0]}, ${orientation[1]}, ${orientation[2]}, ${orientation[3]}`;
            const direction = html_position(quaternion_x_Z(this.ic.cam.orientation()));
            const up = html_position(quaternion_x_Y(this.ic.cam.orientation()));
            
            const table_classes = "";
            const headings = ["Parameter", "Value"];
            const contents = [
                ["Body", this.ic.cam.body()],
                ["Lens", this.ic.cam.lens()],
                ["Focus at", `${this.ic.cam.focus_distance()} mm`],
                ["Location", location],
                ["Orientation", orientation],
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
            const cam_html = obj.camera.body + "<br>" + obj.camera.lens + "<br>Focus distance " + obj.camera.mm_focus_distance + "mm";
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
