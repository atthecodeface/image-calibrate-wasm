//a To do
// recolor named point (based on camera, need to get image pixel value - probably by creating a canvas?)
// rename named point
// add normal to named point
// circular luminance/chrominance for 1mm, 3.161mm, 10mm or 1mm, 2.16mmm, 4.66mm, 10m...

//a Imports
import init, {WasmProject, WasmCip, WasmCameraDatabase, WasmCameraInstance, WasmNamedPoint, WasmNamedPointSet, WasmPointMappingSet, WasmRay} from "../pkg/image_calibrate_wasm.js";
import {Directory, FileSet} from "./files.js";
import {Log} from "./log.js";
import * as html from "./html.js";
import * as utils from "./utils.js";
import {ZoomedWindow} from "./zoomed_window.js";

//a Useful functions
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

//mp find_data_type
function find_data_type(data) {
    const obj = utils.parse_json(data);
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
    
//a Ic
class Ic {

    //fp constructor
    constructor(file_set) {
        this.file_set = file_set;
        this.project = new WasmProject();
        this.project_name = null;
        this.nps = null;
        this.cip_of_project = 0;
        this.trace_ray_name = null;
    }

    //mp load_project
    load_project(name) {
        const data = this.file_set.load_file("proj", name);
        if (!data) {
            window.log.add_log(5, "project", "load", `Failed to read project ${name}`);
            return;
        }
        this.project_name = name;
        this.project = new WasmProject();

        this.project.read_json(data);
        this.nps = this.project.nps;
        this.select_cip_of_project(0);
        window.log.add_log(0, "project", "load", `Read project ${name}`);
    }

    //mp select_cip_of_project
    select_cip_of_project(n) {
        if (n > this.ncips()) {
            n = 0;
        }
        this.cip_of_project = n;
        const cip = this.cip(this.cip_of_project);
        this.cam = cip.camera;
        this.pms = cip.pms;
        this.img_src = cip.img;
    }

    //mp ncips
    ncips() {
        return this.project.ncips();
    }

    //mp cip
    cip(n) {
        return this.project.cip(n);
    }

    //mp save_project
    save_project() {
        this.file_set.save_file("proj",
                                this.project_name,
                                this.project.to_json(true)
                               );
    }

    //mp locate_all
    locate_all() {
        this.project.locate_all();
    }

    //mp derive_nps_location
    /// Returns the point and the worst distance
    derive_nps_location(name) {
        return this.project.derive_nps_location(name);
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
        const proj = this.file_set.dir().files_of_type("proj")[0];
        console.log(this.file_set.dir().files_of_type("proj"));
        this.load_project(proj);
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
        const img_lx_grid = utils.round_to_multiple(img_bounds[0], img_px_grid, 1);
        const img_ty_grid = utils.round_to_multiple(img_bounds[1], img_px_grid, 1);
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

    //mp redraw_nps
    redraw_nps(ctx) {
        if (!this.ic.nps) {
            return;
        }
        const cl = 6;
        const cw = 2;

        for (const name of this.ic.nps.pts()) {
            const np = this.ic.nps.get_pt(name);
            const xyz = np.model;
            const pxy = this.zw.scr_xy_of_img_xy(this.ic.cam.map_model(xyz));
            ctx.fillStyle = np.color;
            ctx.fillRect(pxy[0]-cl, pxy[1]-cw, cl*2, cw*2);
            ctx.fillRect(pxy[0]-cw, pxy[1]-cl, cw*2, cl*2);
        }
    }
    
    //mp redraw_pms
    redraw_pms(ctx) {
        if (!this.ic.pms) {
            return;
        }
        const cl = 6;
        const cw = 2;
        
        let num_mappings = this.ic.pms.length;
        for (let i = 0; i < num_mappings; i++) { 
            const n = this.ic.pms.get_name(i);
            const np = this.ic.nps.get_pt(n);
            const xy = this.ic.pms.get_xy(i);
            const sxy = this.zw.scr_xy_of_img_xy(xy);
            ctx.strokeStyle = np.color;
            ctx.beginPath();
            ctx.arc(sxy[0], sxy[1], cl, 0, Math.PI * 2, true);
            ctx.stroke();
        }
    }

    //mp redraw_rays
    redraw_rays(ctx) {
        if (!this.ic.nps || !this.ic.trace_ray_name) {
            return;
        }
        const np = this.ic.nps.get_pt(this.ic.trace_ray_name);
        if (!np) {
            return;
        }
        ctx.strokeStyle = np.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i=0; i<this.ic.ncips(); i++) {
            if (i == this.ic.cip_of_project) {
                continue;
            }
            const cip = this.ic.cip(i);
            const mapping = cip.pms.mapping_of_name(this.ic.trace_ray_name);
            if (!mapping) {
                continue;
            }
            const ray = cip.camera.get_pm_as_ray(cip.pms, mapping, true);
            const focus_distance = cip.camera.focus_distance;
            for (let k=0; k<100; k++) {
                const xyz = ray.model_at_distance((k+50)*focus_distance/100);
                const pxy = this.zw.scr_xy_of_img_xy(this.ic.cam.map_model(xyz));
                if (k==0) {
                    ctx.moveTo(pxy[0], pxy[1]);
                } else {
                    ctx.lineTo(pxy[0], pxy[1]);
                }
            }
        }                    
        ctx.stroke();
    }

    //mp just_redraw_canvas
    just_redraw_canvas() {
        // this.ic.redraw_canvas(this.canvas, this.zw);
        const ctx = this.canvas.getContext("2d");

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.redraw_nps(ctx);
        this.redraw_pms(ctx);
        this.redraw_rays(ctx);

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
                html.clear(cursor_info);
                const me = this;

                const input = html.add_ele(cursor_info, "input");
                input.type = "button";
                input.value = `Cursor at ${html.position(cxy,0)}`;
                input.addEventListener('click', function(value) {me.focus_on_src(cxy);} );

                const clear = html.add_ele(cursor_info, "input");
                clear.type = "button";
                clear.value = "Clear";
                clear.addEventListener('click', function(value) {me.cursor_add();} );
            }
        } else {
            this.cursor = null;
            cursor_info.innerText = `No cursor`;
            this.redraw_canvas();
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
            for (let i=0; i<this.ic.ncips(); i++) {
                const opt = document.createElement("option");
                opt.setAttribute("value", i);
                opt.innerText = i;
                cip_list.appendChild(opt);
            }
        }
    }
    
    //mp load_project
    load_project(proj) {
        this.ic.load_project(proj);
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

    //mp nps_sort_by
    nps_sort_by(v) {
        this.nps_sort = v;
        this.refill_nps_pms();
    }

    //mp refill_nps_pms
    refill_nps_pms() {
        const nps = document.getElementById("nps_contents");
        if (nps) {
            html.clear(nps);

            const form = html.add_ele(nps, "form", "");
            form.id = "nps_form";
            const clear_ray = "<input type='button' value='Clear ray' onclick='window.image_canvas.rays_of_nps()'/>";
            const s_alpha = "<input type='radio' value='alpha' name='sort' id='nps_alpha' oninput='window.image_canvas.nps_sort_by(this.value)'/><label for='nps_alpha'>Alphabetical</label>";
            const s_cursor = "<input type='radio' value='cursor' name='sort' id='nps_cursor' oninput='window.image_canvas.nps_sort_by(this.value)'/><label for='nps_cursor'>Cursor</label>";
            const s_x = "<input type='radio' value='x' name='sort' id='nps_x' oninput='window.image_canvas.nps_sort_by(this.value)'/><label for='nps_x'>X</label>";
            const s_y = "<input type='radio' value='y' name='sort' id='nps_y' oninput='window.image_canvas.nps_sort_by(this.value)'/><label for='nps_y'>Y</label>";
            const s_err = "<input type='radio' value='err' name='sort' id='nps_err' oninput='window.image_canvas.nps_sort_by(this.value)'/><label for='nps_err'>Error</label>";
            const div = html.add_ele(form, "div", "");
            div.innerHTML = clear_ray + s_alpha + s_cursor + s_x + s_y + s_err;
            
            const table_classes = ["", "sticky_heading"];
            const headings = ["Rays", "Name", "Color", "Location", "R Err", "Expected at", "Focus", "Mapped to", "Focus", "Delete"];
            const contents = [];
            const pms = this.ic.pms;
            const cam = this.ic.cam;

            form.elements["sort"].value = this.nps_sort;

            let cx = 3360;
            let cy = 2240;
            if (this.cursor) {
                cx = this.cursor[0];
                cy = this.cursor[1];
            }
            const nps_data = [];
            for (const np_name of this.ic.nps.pts()) {
                const np = this.ic.nps.get_pt(np_name);
                const np_pxy = cam.map_model(np.model);
                const dx = np_pxy[0]-cx;
                const dy = np_pxy[1]-cy;
                const d2 = dx*dx+dy*dy;
                let data = {"name": np_name,
                            "color" : np.color,
                            "model": np.model,
                            "error" :  np.error,
                            "np_pxy": np_pxy,
                            "map_pxye": null,
                            "d2": d2,
                           };

                data.name_upp = np_name.toUpperCase();
                const pms_n = pms.mapping_of_name(np_name);
                if (pms_n !== undefined) {
                    data.map_pxye = pms.get_xy_err(pms_n);
                }
                nps_data.push(data);
            }
            
            switch (this.nps_sort) {
            case "x":
                nps_data.sort(function (a,b) {return a.np_pxy[0]-b.np_pxy[0]});
                break;
            case "y":
                nps_data.sort(function (a,b) {return a.np_pxy[1]-b.np_pxy[1]});
                break;
            case "err":
                nps_data.sort(function (a,b) {return a.error-b.error});
                break;
            case "pxy_err":
                nps_data.sort(function (a,b) {
                    if (a.map_pxye !== null) {
                        if (b.map_pxye !== null) {
                            return a.map_pxye[2]-b.map_pxye[2];
                        } else {
                            return -1;
                        }
                    } else if (b.map_pxye !== null) {
                        return 1;
                    } else {
                        return (a.name_upp<b.name_upp)? -1 : (0+(a.name_upp>b.name_upp));
                    }
                });
                break;
            case "cursor": 
                nps_data.sort(function (a,b) {return a.d2-b.d2});
                break;
            default:                  // alphabetical
                nps_data.sort(function (a,b) {return (a.name_upp<b.name_upp)? -1 : (0+(a.name_upp>b.name_upp))});
                break;
            }
            for (const np of nps_data) {
                const np_style = `style='color: ${np.color};'}`;
                const np_x = np.np_pxy[0];
                const np_y = np.np_pxy[1];

                const np_id = "np__" + np.name;
                const rays = `<input type='radio' value='${np.name}' name='nps' id='${np_id}' oninput='window.image_canvas.rays_of_nps(this.value)'/><label for='${np_id}'  ${np_style}>&#x263C;</label> `;
                const r_err = `${np.error.toFixed(3)}`;
                const expected_at = `${html.position([np_x-3360, np_y-2240],0)}`;
                const focus_np = `<input type='button' value='&#x271A;' ${np_style} onclick='window.image_canvas.focus_on_src([${np_x},${np_y}])'>`;
                let mapped_to = `<input type='button' value="Set to cursor" onclick='window.image_canvas.set_pms_to_cursor("${np.name}")'>`;
                let focus_pm = "";
                let delete_pms = "";
                if (np.map_pxye) {
                    let x = np.map_pxye[0];
                    let y = np.map_pxye[1];
                    let e = np.map_pxye[2];
                    focus_pm = `<input type='button' value='&xcirc;' ${np_style} onclick='window.image_canvas.focus_on_src([${x},${y}])'>`;
                    mapped_to = `(${html.position([x-3360,y-2240])}  (err ${e})`;
                    delete_pms =`<input type='button' value='&#x1F5D1;' onclick='window.image_canvas.delete_pms("${np.name}")'>`;
                }
                let location = `<input type='button' value='&#x1F5D1;' onclick='window.image_canvas.derive_nps_location("${np.name}")'>&nbsp;${html.position(np.model)}`;
                contents.push([rays, np.name, np.color, location, r_err, expected_at, focus_np, mapped_to, focus_pm, delete_pms]);
            }
            const table = html.table(table_classes, headings, contents);
            form.append(table);
            if (this.ic.trace_ray_name) {
                form.elements["nps"].value = this.ic.trace_ray_name;
            }
        }
    }    

    //mp refill_camera_info
    refill_camera_info() {
        const camera_info = document.getElementById("camera_info");
        if (camera_info) {
            html.clear(camera_info);

            const cip = this.ic.cip(this.ic.cip_of_project);
            const n_cip = this.ic.ncips();
            const cip_num = `${this.ic.cip_of_project} of ${n_cip}`;
            const itable = html.vtable("", 
                                       [ ["CIP", cip_num],
                                        ["Camera", cip.cam_file],
                                        ["Image", cip.img],
                                        ["PMS", cip.pms_file],
                                      ] );
            camera_info.append(itable);

            const location = html.position(this.ic.cam.location);

            var orientation = this.ic.cam.orientation;
            orientation = [-orientation[0].toFixed(2),
                           -orientation[1].toFixed(2),
                           -orientation[2].toFixed(2),
                           -orientation[3].toFixed(2),
                          ];
            orientation = `${orientation[0]}, ${orientation[1]}, ${orientation[2]}, ${orientation[3]}`;
            const focus_distance = this.ic.cam.focus_distance;
            const focused_on = html.position(quaternion_x_vector(this.ic.cam.orientation, [0,0,-focus_distance], this.ic.cam.location));
            const direction = html.position(quaternion_x_vector(this.ic.cam.orientation, [0,0,-focus_distance]));
            const up = html.position(quaternion_x_vector(this.ic.cam.orientation, [0,-10,0]));
            
            const table_classes = ["", "sticky_heading"];
            const headings = ["Parameter", "Value"];
            let focus_at = "";
            focus_at += `<input class="widget_button" type="button" style="font-weight: bold;" value="-" onclick="window.image_canvas.set_focus_distance(null,-10);"/>`;
            focus_at += `<input class="widget_button" type="button" value="-" onclick="window.image_canvas.set_focus_distance(null,-1);"/>`
            focus_at += `&nbsp;${focus_distance} mm&nbsp;`;
            focus_at += `<input class="widget_button" type="button" value="+" onclick="window.image_canvas.set_focus_distance(null,1);"/>`;
            focus_at += `<input class="widget_button" type="button" style="font-weight: bold;" value="+" onclick="window.image_canvas.set_focus_distance(null,10);"/>`;
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
            const table = html.table(table_classes, headings, contents);
            camera_info.append(table);
        }
    }    

    //mp select_cip_of_project
    select_cip_of_project(n) {
        this.ic.select_cip_of_project(n);
        this.image.src = this.ic.img_src;

        if (this.ic.trace_ray_name) {
            const np = this.ic.nps.get_pt(this.ic.trace_ray_name);
            const np_pxy = this.ic.cam.map_model(np.model);
            this.focus_on_src(np_pxy);
        }
        this.refill_camera_info();
        this.refill_nps_pms();
        this.redraw_canvas();
    }

    //mp save_project
    save_project() {
        this.ic.save_project();
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
            this.ic.pms.add_mapping(this.ic.nps, name, [cx, cy], 2);
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
                if (!this.ic.nps.get_pt(name)) {
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
        this.ic.nps.add_pt(wnp);
        this.ic.nps.set_model(name, xyz, 10.0);
        this.set_pms_to_cursor(name);
        this.refill_nps_pms();
        this.redraw_canvas();
    }

    //mp rays_of_nps
    rays_of_nps(name) {
        this.ic.trace_ray_name = name;
        const nps_form = document.getElementById("nps_form");
        if (nps_form) {
            console.log(nps_form, nps_form.elements["nps"].value,name);
            if (name) {
                nps_form.elements["nps"].value = name;
            } else {
                nps_form.elements["nps"].value = "banana";
            }
        }
        this.redraw_canvas();
    }

    //mp derive_nps_location
    derive_nps_location(name) {
        let current_e = this.ic.nps.get_pt(name).error;
        if (current_e < 0.01) {
            return;
        }
        const xyz_e = this.ic.derive_nps_location(name);
        if (xyz_e) {
            const xyz = [xyz_e[0], xyz_e[1], xyz_e[2]];
            this.ic.nps.set_model(name, xyz, xyz_e[3]);
            this.refill_nps_pms();
            this.redraw_canvas();
        }
    }

    //mp derive_all_nps_locations
    derive_all_nps_locations() {
        for (const name of this.ic.nps.pts()) {
            this.derive_nps_location(name);
        }
    }

    //mp locate_all
    locate_all() {
        this.ic.locate_all()
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

    //mp file_link
    file_link(type, f) {
        const link = document.createElement("a");
        link.innerText = f;
        link.download = f;
        const me = this;
        link.addEventListener('click',
                              function(value) {
                                  const data = me.file_set.load_file(type, f);
                                  this.href = "data:application/json," + encodeURIComponent(data)+"";
                              }
                             );
        link.href = f;
        return link;
    }

    //mp repopulate
    repopulate() {
        while (this.browser.firstChild) {
            this.browser.removeChild(this.browser.firstChild);
        }

        const cdb_contents = [];
        for (const f of window.file_set.dir().files_of_type("cdb")) {
            let t = this.file_set.load_file("cdb", f);
            const obj = utils.parse_json(t);
            var bodies_html = "";
            for (const b of obj.bodies) {
                bodies_html += `${b.name}<br>`;
            }
            var lenses_html = "";
            for (const l of obj.lenses) {
                lenses_html += `${l.name}<br>`;
            }
            const link = this.file_link("cdb", f);
            cdb_contents.push( [link, bodies_html, lenses_html] );
        }
        this.create_file_table("cdb", "Camera Database", ["Filename", "Bodies", "Lenses"], cdb_contents);

        const proj_contents = [];
        for (const f of window.file_set.dir().files_of_type("proj")) {
            let t = this.file_set.load_file("proj", f);
            const obj = utils.parse_json(t);
            const link = this.file_link("proj", f);
            proj_contents.push( [link, obj.cdb, obj.nps, obj.cips.length] );
        }
        this.create_file_table("proj", "Projects", ["Filename", "Cdb", "Nps", "Number CIP"], proj_contents);

        const nps_contents = [];
        for (const f of window.file_set.dir().files_of_type("nps")) {
            let t = this.file_set.load_file("nps", f);
            const obj = utils.parse_json(t);
            const num_pts = obj.length;
            nps_contents.push( [f, `${num_pts}`] );
        }
        this.create_file_table("nps", "Named PointSets", ["Filename", "Number of points"], nps_contents);

        const pms_contents = [];
        for (const f of window.file_set.dir().files_of_type("pms")) {
            let t = this.file_set.load_file("pms", f);
            const obj = utils.parse_json(t);
            const num_pts = obj.length;
            pms_contents.push( [f, `${num_pts}`] );
        }
        this.create_file_table("pms", "Point-mapping Sets", ["Filename", "Number of points"], pms_contents);

        const cam_contents = [];
        for (const f of window.file_set.dir().files_of_type("cam")) {
            let t = this.file_set.load_file("cam", f);
            const obj = utils.parse_json(t);
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
                if (d instanceof HTMLElement) {
                    td.appendChild(d);
                } else {
                    td.innerHTML = d;
                }
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
        project_list.addEventListener('click', function(value) {window.image_canvas.load_project(me.selectedOptions[0].value);} );
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
