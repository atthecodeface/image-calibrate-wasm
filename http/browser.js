//a Imports
import init, {WasmProject, WasmCip, WasmCameraDatabase, WasmCameraInstance, WasmNamedPoint, WasmNamedPointSet, WasmPointMappingSet, WasmRay} from "../pkg/image_calibrate_wasm.js";
import {Directory, FileSet} from "./files.js";
import {Log} from "./log.js";
import * as html from "./html.js";
import * as utils from "./utils.js";

//a Useful functions
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


//a Top level on load
window.addEventListener("load", (e) => {
    window.log = new Log(document.getElementById("Log"));
    window.file_set = new FileSet(window.localStorage, "nac/");
    const browser = document.getElementById("FileBrowser");
    if (browser) {
        window.browser = new Browser(file_set, browser);
    }
});
