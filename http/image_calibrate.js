//a Imports
import init, {WasmCameraDatabase, WasmCameraInstance, WasmNamedPoint, WasmNamedPointSet, WasmPointMappingSet} from "../pkg/image_calibrate_wasm.js";

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
  "camera": {
    "body": "Canon EOS 5D mark IV",
    "lens": "EF50mm f1.8",
    "mm_focus_distance": 453.0
  },
    "position": [ 0.0, 0.0, 0.0 ],
    "direction": [ 0.0, 0.0, 0.0, 1.0 ]
}

`;

//a Ic
class Ic {

    //fp constructor
    constructor() {
        this.cdb = new WasmCameraDatabase(camera_db_json);
        this.nps = new WasmNamedPointSet();
        this.cam = new WasmCameraInstance(this.cdb, camera_inst_json);
        this.pms = new WasmPointMappingSet();
        this.other_cams = [];
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
    
    redraw_canvas(canvas, scale, left, top) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.redraw_nps(ctx, scale, left, top);
        this.redraw_pms(ctx, scale, left, top);
    }
}

//a ImageCanvas
class ImageCanvas {
    //fp constructor
    constructor(wrp_id, img_div_id, can_id, img_id) {
        this.div = document.getElementById(wrp_id);
        this.canvas = document.getElementById(can_id);
        this.image_div = document.getElementById(img_div_id);
        this.image = document.getElementById(img_id);

        this.ic = new Ic();
        
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
        }

    //mp redraw_canvas
    redraw_canvas() {
        this.ic.redraw_canvas(this.canvas, this.img_width/6720, this.image_div.scrollLeft, this.image_div.scrollTop);
    }

    //mp load_nps
    load_nps(nps_json) {
        const wnps = new WasmNamedPointSet();
        wnps.read_json(nps_json);
        this.ic.nps_set(wnps);
        this.redraw_canvas();
    }

    //mp load_camera
    load_camera(camera_json) {
        const camera = new WasmCameraInstance(this.ic.cdb, camera_json);
        this.ic.camera_set(camera);
        this.redraw_canvas();
    }
    
    //mp load_pms
    load_pms(pms_json) {
        const wpms = new WasmPointMappingSet();
        wpms.read_json(this.ic.nps, pms_json);
        this.ic.pms_set(wpms);
        this.redraw_canvas();
    }
    
    //mi wheel
    wheel(e) {
        console.log(e.offsetX, e.offsetY);
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
            console.log(this.drag, this.drag[0], this.drag[1]);
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

    //mp img_select_file
    img_select_file(file) {
        if (file) {
            this.image.src = URL.createObjectURL(file);
        }
    }

    //mp nps_select_file
    nps_select_file(file) {
        if (file) {
            file.text().then(
                (value) => { this.load_nps(value);
                           }
            );
        }
    }

    //mp camera_select_file
    camera_select_file(file) {
        if (file) {
            file.text().then(
                (value) => { this.load_camera(value);
                           }
            );
        }
    }

    //mp pms_select_file
    pms_select_file(file) {
        if (file) {
            file.text().then(
                (value) => { this.load_pms(value);
                           }
            );
        }
    }

    //zz All done
}

//a Top level init() =>
init().then(() => {
    window.image_canvas = new ImageCanvas('image_canvas', 'image_div', 'canvas', 'image');
});
