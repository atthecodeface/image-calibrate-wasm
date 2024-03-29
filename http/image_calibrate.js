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
        
        const width = this.div.offsetWidth;
        const height = this.div.offsetHeight;

        this.canvas.width = width;
        this.canvas.height = height;
        this.image.width = width; // set the 'img' to be the zoomed size
        this.image_div.style.width = width+"px";
        this.image_div.style.height = height+"px";

        this.src_width = width;
        this.src_height = height;
        this.center_pxy= [0,0];

        this.drag = null;
        this.cursor = null;
        this.animating = false;
        this.min_grid_spacing = 30;
        this.zw = new ZoomedWindow([width, height]);
        this.trace_ray_name = null;

        const me = this;
        this.canvas.addEventListener('wheel', function(e) {me.wheel(e);});
        this.canvas.addEventListener('mousedown', function(e) {me.mouse_down(e);});
        this.canvas.addEventListener('mouseup', function(e) {me.mouse_up(e);});
        this.canvas.addEventListener('mouseout', function(e) {me.mouse_up(e);});
        this.canvas.addEventListener('mousemove', function(e) {me.mouse_move(e);});

        this.update_img_size_or_zoom();
        this.image_div.width = width;
        this.image_div.height = height;

        this.image.addEventListener('load', function(e) { me.update_img_size_or_zoom(); } );

        window.log.add_log(0, "window", "init", "Projects available:" + this.file_set.dir().files_of_type("proj"));

        this.project = new WasmProject();
        this.nps = this.project.nps;
        this.cam = null;
        this.pms = null;
        this.cip_of_project = 0;
        this.project_name = null;
        this.load_project(this.file_set.dir().files_of_type("proj")[0]);
        window.log.add_log(0, "project", "load", `Read project ${name}`);
        }

    //mp update_img_size_or_zoom
    update_img_size_or_zoom() {
        this.src_width = this.image.naturalWidth;
        this.src_height = this.image.naturalHeight;
        this.center_pxy= [this.src_width / 2, this.src_height / 2];
        this.zw.set_img(this.src_width, this.src_height);
            
        this.just_redraw_canvas();
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
    
    //mp redraw_nps
    redraw_nps(ctx) {
        if (!this.nps) {
            return;
        }
        const cl = 6;
        const cw = 2;

        for (const name of this.nps.pts()) {
            const np = this.nps.get_pt(name);
            const xyz = np.model;
            const pxy = this.zw.scr_xy_of_img_xy(this.camera.map_model(xyz));
            ctx.fillStyle = np.color;
            ctx.fillRect(pxy[0]-cl, pxy[1]-cw, cl*2, cw*2);
            ctx.fillRect(pxy[0]-cw, pxy[1]-cl, cw*2, cl*2);
        }
    }
    
    //mp redraw_pms
    redraw_pms(ctx) {
        if (!this.pms) {
            return;
        }
        const cl = 6;
        const cw = 2;
        
        let num_mappings = this.pms.length;
        for (let i = 0; i < num_mappings; i++) { 
            const n = this.pms.get_name(i);
            const np = this.nps.get_pt(n);
            const xy = this.pms.get_xy(i);
            const sxy = this.zw.scr_xy_of_img_xy(xy);
            ctx.strokeStyle = np.color;
            ctx.beginPath();
            ctx.arc(sxy[0], sxy[1], cl, 0, Math.PI * 2, true);
            ctx.stroke();
        }
    }

    //mp redraw_rays
    redraw_rays(ctx) {
        if (!this.nps || !this.trace_ray_name) {
            return;
        }
        const np = this.nps.get_pt(this.trace_ray_name);
        if (!np) {
            return;
        }
        ctx.strokeStyle = np.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i=0; i<this.project.ncips(); i++) {
            if (i == this.cip_of_project) {
                continue;
            }
            const cip = this.project.cip(i);
            const mapping = cip.pms.mapping_of_name(this.trace_ray_name);
            if (!mapping) {
                continue;
            }
            const ray = cip.camera.get_pm_as_ray(cip.pms, mapping, true);
            const focus_distance = cip.camera.focus_distance;
            for (let k=0; k<100; k++) {
                const xyz = ray.model_at_distance((k+50)*focus_distance/100);
                const pxy = this.zw.scr_xy_of_img_xy(this.camera.map_model(xyz));
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
        // Set the zw scr_ofs from the current canvas position over
        // the zoomed image
        this.zw.set_zoom_scr(this.image_div.scrollLeft, this.image_div.scrollTop);
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
                let cursor_rel = [cxy[0]-this.center_pxy[0],cxy[1]-this.center_pxy[1]];
                input.value = `Cursor at ${html.position(cursor_rel,0)}`;
                input.addEventListener('click', function(value) {me.focus_on_src(cxy);} );

                const clear = html.add_ele(cursor_info, "input");
                clear.type = "button";
                clear.value = "Clear";
                clear.addEventListener('click', function(value) {me.cursor_add();} );
            }
        } else {
            this.cursor = null;
            cursor_info.innerText = `No cursor`;
            this.just_redraw_canvas();
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
            for (let i=0; i<this.project.ncips(); i++) {
                const opt = document.createElement("option");
                opt.setAttribute("value", i);
                opt.innerText = i;
                cip_list.appendChild(opt);
            }
        }
    }
    
    //mp load_project
    load_project(name) {
        this.project = new WasmProject();
        const data = this.file_set.load_file("proj", name);
        if (!data) {
            window.log.add_log(5, "project", "load", `Failed to read project ${name}`);
            return;
        }
        this.project.read_json(data);
        this.project_name = name;
        this.refill_cip_list();
        this.select_cip_of_project(0);
    }

    //mp save_project
    save_project() {
        this.file_set.save_file("proj",
                                this.project_name,
                                this.project.to_json(true)
                               );
        window.log.add_log(5, "project", "save", `Saved to project ${this.project_name}`);
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
       
        this.zw.set_zoom_scr(this.image_div.scrollLeft, this.image_div.scrollTop);
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
        this.just_redraw_canvas();
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
            this.just_redraw_canvas();
        }
    }

    //mi scroll_by
    scroll_by(dx, dy) {
        this.image_div.scrollLeft -= dx;
        this.image_div.scrollTop -= dy;
        this.just_redraw_canvas();
    }

    //mi focus_on_src
    focus_on_src(xy) {
        this.zw.scr_focus_on_xy(xy);
        this.image_div.scrollLeft = this.zw.zoom_scr_ofs[0];
        this.image_div.scrollTop = this.zw.zoom_scr_ofs[1];
        this.just_redraw_canvas();
    }

    //mp locate
    locate() {
        console.log("Located with error", this.camera.locate_using_model_lines(this.pms));
        console.log("Oriented error", this.camera.orient_using_rays_from_model(this.pms));
        this.refill_camera_info();
        this.just_redraw_canvas();
    }

    //mp set_focus_distance
    set_focus_distance(f, delta=null) {
        if (f === null) {
            f = this.camera.focus_distance + delta;
        }
        this.camera.focus_distance = f;
        console.log("Located with error", this.camera.locate_using_model_lines(this.pms));
        console.log("Oriented error", this.camera.orient_using_rays_from_model(this.pms));
        this.refill_camera_info();
        this.just_redraw_canvas();
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
            const pms = this.pms;
            const cam = this.camera;

            form.elements["sort"].value = this.nps_sort;

            let cx = this.center_pxy[0];
            let cy = this.center_pxy[1];
            if (this.cursor) {
                cx = this.cursor[0];
                cy = this.cursor[1];
            }
            const nps_data = [];
            for (const np_name of this.nps.pts()) {
                const np = this.nps.get_pt(np_name);
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
                const expected_at = `${html.position([np_x-this.center_pxy[0], np_y-this.center_pxy[1]],0)}`;
                const focus_np = `<input type='button' value='&#x271A;' ${np_style} onclick='window.image_canvas.focus_on_src([${np_x},${np_y}])'>`;
                let mapped_to = `<input type='button' value="Set to cursor" onclick='window.image_canvas.set_pms_to_cursor("${np.name}")'>`;
                let focus_pm = "";
                let delete_pms = "";
                if (np.map_pxye) {
                    let x = np.map_pxye[0];
                    let y = np.map_pxye[1];
                    let e = np.map_pxye[2];
                    focus_pm = `<input type='button' value='&xcirc;' ${np_style} onclick='window.image_canvas.focus_on_src([${x},${y}])'>`;
                    mapped_to = `(${html.position([x-this.center_pxy[0],y-this.center_pxy[1]])}  (err ${e})`;
                    delete_pms =`<input type='button' value='&#x1F5D1;' onclick='window.image_canvas.delete_pms("${np.name}")'>`;
                }
                let location = `<input type='button' value='&#x1F5D1;' onclick='window.image_canvas.derive_nps_location("${np.name}")'>&nbsp;${html.position(np.model)}`;
                contents.push([rays, np.name, np.color, location, r_err, expected_at, focus_np, mapped_to, focus_pm, delete_pms]);
            }
            const table = html.table(table_classes, headings, contents);
            form.append(table);
            if (this.trace_ray_name) {
                form.elements["nps"].value = this.trace_ray_name;
            }
        }
    }    

    //mp refill_camera_info
    refill_camera_info() {
        const camera_info = document.getElementById("camera_info");
        if (camera_info) {
            html.clear(camera_info);

            const cip = this.project.cip(this.cip_of_project);
            const n_cip = this.project.ncips();
            const cip_num = `${this.cip_of_project} of ${n_cip}`;
            const itable = html.vtable("", 
                                       [ ["CIP", cip_num],
                                        ["Camera", cip.cam_file],
                                        ["Image", cip.img],
                                        ["PMS", cip.pms_file],
                                      ] );
            camera_info.append(itable);

            const location = html.position(this.camera.location);

            var orientation = this.camera.orientation;
            orientation = [-orientation[0].toFixed(2),
                           -orientation[1].toFixed(2),
                           -orientation[2].toFixed(2),
                           -orientation[3].toFixed(2),
                          ];
            orientation = `${orientation[0]}, ${orientation[1]}, ${orientation[2]}, ${orientation[3]}`;
            const focus_distance = this.camera.focus_distance;
            const focused_on = html.position(quaternion_x_vector(this.camera.orientation, [0,0,-focus_distance], this.camera.location));
            const direction = html.position(quaternion_x_vector(this.camera.orientation, [0,0,-focus_distance]));
            const up = html.position(quaternion_x_vector(this.camera.orientation, [0,-10,0]));
            
            const table_classes = ["", "sticky_heading"];
            const headings = ["Parameter", "Value"];
            let focus_at = "";
            focus_at += `<input class="widget_button" type="button" style="font-weight: bold;" value="-" onclick="window.image_canvas.set_focus_distance(null,-10);"/>`;
            focus_at += `<input class="widget_button" type="button" value="-" onclick="window.image_canvas.set_focus_distance(null,-1);"/>`
            focus_at += `&nbsp;${focus_distance} mm&nbsp;`;
            focus_at += `<input class="widget_button" type="button" value="+" onclick="window.image_canvas.set_focus_distance(null,1);"/>`;
            focus_at += `<input class="widget_button" type="button" style="font-weight: bold;" value="+" onclick="window.image_canvas.set_focus_distance(null,10);"/>`;
            const contents = [
                ["Body", this.camera.body],
                ["Lens", this.camera.lens],
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
        if (n > this.project.ncips()) {
            n = 0;
        }

        this.nps = this.project.nps;
        this.cip_of_project = n;
        const cip = this.project.cip(this.cip_of_project);
        this.camera = cip.camera;
        this.pms = cip.pms;
        this.image.src = cip.img;

        if (this.trace_ray_name) {
            const np = this.nps.get_pt(this.trace_ray_name);
            const np_pxy = this.camera.map_model(np.model);
            this.focus_on_src(np_pxy);
        }
        this.refill_camera_info();
        this.refill_nps_pms();
        this.update_img_size_or_zoom();
    }

    //mp delete_pms
    delete_pms(name) {
        const pms_n = this.pms.mapping_of_name(name);
        if (pms_n) {
            this.pms.remove_mapping(pms_n);
        }
        this.refill_nps_pms();
        this.just_redraw_canvas();
    }

    //mp set_pms_to_cursor
    set_pms_to_cursor(name) {
        const pms_n = this.pms.mapping_of_name(name);
        if (this.cursor) {
            const cx = this.cursor[0];
            const cy = this.cursor[1];
            this.pms.add_mapping(this.nps, name, [cx, cy], 2);
        }
        this.refill_nps_pms();
        this.just_redraw_canvas();
    }

    //mp add_np_at_cursor_fd
    add_np_at_cursor_fd(name) {
        if (!this.cursor) {
            return;
        }
        if (!name) {
            for (let uid = 10*1000; true; uid=uid+1) {
                name = `${uid}`;
                if (!this.nps.get_pt(name)) {
                    break;
                }
            }
        }
        const cx = this.cursor[0];
        const cy = this.cursor[1];
        const distance = this.camera.focus_distance;
        const xyz = this.camera.model_at_distance([cx,cy], distance);
        const color = "#0ff";
        const wnp = new WasmNamedPoint(name, color);
        this.nps.add_pt(wnp);
        this.nps.set_model(name, xyz, 10.0);
        this.set_pms_to_cursor(name);
        this.refill_nps_pms();
        this.just_redraw_canvas();
    }

    //mp rays_of_nps
    rays_of_nps(name) {
        this.trace_ray_name = name;
        const nps_form = document.getElementById("nps_form");
        if (nps_form) {
            if (name) {
                nps_form.elements["nps"].value = name;
            } else {
                nps_form.elements["nps"].value = "banana";
            }
        }
        this.just_redraw_canvas();
    }

    //mp derive_nps_location
    derive_nps_location(name) {
        let current_e = this.nps.get_pt(name).error;
        if (current_e < 0.01) {
            return;
        }
        const xyz_e = this.project.derive_nps_location(name);
        if (xyz_e) {
            const xyz = [xyz_e[0], xyz_e[1], xyz_e[2]];
            this.nps.set_model(name, xyz, xyz_e[3]);
            this.refill_nps_pms();
            this.just_redraw_canvas();
        }
    }

    //mp derive_all_nps_locations
    derive_all_nps_locations() {
        for (const name of this.nps.pts()) {
            this.derive_nps_location(name);
        }
    }

    //mp locate_all
    locate_all() {
        this.project.locate_all()
        this.refill_camera_info();
        this.just_redraw_canvas();
    }


    //zz All done
}

//a Top level init() =>
// This is invoked when the Wasm has initialized
init().then(() => {
    window.log = new Log(document.getElementById("Log"));
    window.file_set = new FileSet(window.localStorage, "nac/");
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
