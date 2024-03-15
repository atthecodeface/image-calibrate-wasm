//a Imports
import init, {WasmCameraDatabase, WasmCameraInstance, WasmNamedPoint, WasmNamedPointSet, WasmPointMappingSet} from "../pkg/image_calibrate_wasm.js";

//a Levels and description
//cp LevelDescriptor
/// A notional object...
///
/// Has 'properties' of:
///  kind  : string        (enumeration) (dydx/ ...)
///  y     : string        (User-visible textual expression for the level)
///  y_rpn : string        (RPN expression for the level)
///  tb    : list<string>  (toolbox entries required)
///  tr    : (float, float) (t range of graph)
///  xr    : (float, float) (default x range of graph)
///  yr    : (float, float) (default y range of graph)

//c LevelSet
class LevelSet {
    //cp constructor
    constructor(name, levels) {
        this.name = name
        this.levels = levels;
    }

    //ap has_level
    /// Return true if it has the level index
    has_level(index) {
        return index < this.levels.length;
    }

    //ap get_level
    /// Get the specific level
    get_level(index) {
        return this.levels[index];
    }

    //mp configure_toolbox
    /// Configure the toolbox for a particular level
    configure_toolbox(fa, index) {
        const level = this.get_level(index);
        let tb_state = "";
        let x = 0;
        for (const tb of level.tb) {
            tb_state += x.toString() + "@(" + (x*30+30).toString() + " 20):" + tb + " ";
            x += 1;
        }
        console.log("Load state", tb_state);
        fa.toolbox_load_state(tb_state);
    }

    //mp configure_graph
    /// Configure the graph area for a particular level
    configure_graph(ga, index) {
        const level = this.get_level(index);
        let expr = new WasmExpression();
        expr.set_rpn(level.y_rpn);
        ga.set_function(0);
        ga.set_expression(0, 1, expr);

        expr.differentiate("X");
        ga.set_function(1);
        ga.set_expression(1, 1, expr);

        if (level.tr !== undefined) {
            ga.set_steps(0, level.tr[2]);
            ga.set_trange(0, level.tr[0], level.tr[1]);

            ga.set_steps(1, level.tr[2]);
            ga.set_trange(1, level.tr[0], level.tr[1]);
        }
        if (level.xr !== undefined) {
            ga.set_axis_range(0, level.xr[0], level.xr[1]);
        }
        if (level.yr !== undefined) {
            ga.set_axis_range(1, level.yr[0], level.yr[1]);
        }

        ga.fill();
    }

    //mp configure_question
    /// Configure the question (text fields) for the level
    configure_question(ga, text_id, index) {
        const level = this.get_level(index);
        document.getElementById(text_id).innerText = level.y;
    }

    //mp populate_level_table
    /// Populate the 'levels' table HTML for this level set
    populate_level_table(table_id) {
        let table = document.getElementById(table_id);
        let inner_html = "";
        let n = 0;
        for (const level of this.levels) {
            let table_row = "<tr>";
            table_row += "<td>";
            table_row += "<input type='button' value='" + level.y+"' onclick='window.game.select_level(\"" + n + "\");'/>";
            table_row += "</td>";
            table_row += "<td>&#x2713</td>";
            table_row += "</tr>";
            inner_html += table_row;
            n += 1;
        }
        table.innerHTML = inner_html;
    }

}

//tp GameDescriptor
class GameDescriptor {
    //cp constructor
    ///
    /// Constructor
    constructor(level_sets) {
        this.level_sets = level_sets;
        this.level_set_of_name = new Map();
        for (const level_set of level_sets) {
            this.level_set_of_name.set(level_set.name, level_set);
        }
    }
    
    //ap has_level_set
    ///
    /// Return true if it has the named LevelSet
    has_level_set(name) {
        return this.level_set_of_name.has(name);
    }
    
    //ap level_set
    ///
    /// Get the named level set
    level_set(name) {
        return this.level_set_of_name.get(name);
    }

    //mp populate_level_set_table
    /// Populate the (HTML) table of level sets
    populate_level_set_table(table_id) {
        let table = document.getElementById(table_id);
        let inner_html = "";
        for (const level_set of this.level_sets) {
            let table_row = "<tr><td><input type='button' value='" + level_set.name+"' onclick='window.game.select_level_set(\"" + level_set.name + "\");'/></td></tr>";
            inner_html += table_row;
        }
        table.innerHTML = inner_html;
    }

    //zz All done
}

//a GameState and the like
//c LevelState
///
/// This class contains the state of the current playing of a level
///
/// Should probably have level set name, and level number within the set
class LevelState {

    //fp constructor
    constructor() {
        this.fa_state = "";
    }

    //mp as_obj
    as_obj() {
        return this.fa_state;
    }

    //mp from_obj
    from_obj(o) {
        if (typeof(o) === "string") {
            this.fa_state = o;
        }
    }

    //mp to_fa
    to_fa(fa) {
        fa.load_state(this.fa_state);
    }

    //mp from_fa
    from_fa(fa) {
        this.fa_state = fa.get_state();
    }
}

//tp LevelSetState
/// The state of completion of a particular level set
class LevelSetState {
    constructor() {
    }
}

//tp GameState
///
/// The state of the game in its entirety, that can be saved in local
/// storage
class GameState {
    //cp constructor
    ///
    /// Create the GameState with a given local state key name (used
    /// for load and save)
    constructor(game_descriptor, ls_key_name) {
        this.game_descriptor = game_descriptor;
        this.ls_key_name = ls_key_name;
        this.reset();
        this.load();
    }

    //mp reset
    ///
    /// Reset the state
    reset() {
        this.level_sets = [];
        this.level_state = new LevelState();
        this.level_set_name = "";
        this.level_number = 0;
    }

    //mp ensure_valid
    ensure_valid() {
        if (this.get_level() === undefined) {
            this.level_number = 0;
        }
        if (this.get_level() === undefined) {
            this.level_set_name = "Basic";
        }
    }
    
    //mp set_level_set
    set_level_set(level_set_name) {
        if (this.game_descriptor.has_level_set(level_set_name)) {
            this.level_set_name = level_set_name;
        }
    }

    //mp set_level_number
    set_level_number(level_number) {
        if (this.game_descriptor.has_level_set(this.level_set_name)) {
            const level_set = this.game_descriptor.level_set(this.level_set_name);
            if (level_set.has_level(level_number)) {
                this.level_number = level_number;
            }
        }
    }

    //ap get_level
    get_level() {
        if (!this.game_descriptor.has_level_set(this.level_set_name)) {
            return undefined;
        }
        const level_set = this.game_descriptor.level_set(this.level_set_name);
        return {level_set:level_set, level:this.level_number};
    }

    //mp load
    ///
    /// Load the last saved state; invoke with load()
    load(key_name = this.ls_key_name) {
        let data = window.localStorage.getItem(this.ls_key_name);
        if (typeof data !== "string") {
            return;
        }
        var obj;
        try {
            obj = JSON.parse(data);
        } catch (e) {
            return;
        }
        if (typeof obj["level_set_name"] === "string") {
            this.set_level_set(obj["level_set_name"]);
        }
        if (typeof obj["level_number"] === "number") {
            this.set_level_number(obj["level_number"]);
        }
    }

    //mp save
    ///
    /// Save the current state
    ///
    /// Invoke with save()
    save(key_name = this.ls_key_name) {
        let obj = {};
        obj.level_state = this.level_state.as_obj();
        obj.level_set = this.level_set;
        obj.level_number = this.level_number;
        window.localStorage.setItem(key_name, JSON.stringify(obj));
    }

    //mp backup
    ///
    /// Save the data to a specific key_name
    backup(key_name) {
        this.save(key_name);
    }

    //mp recover
    ///
    /// Load the data to a specific key_name
    recover(key_name) {
        this.load(key_name);
    }
}

//c GraphAndFunction
class GraphAndFunction {

    //fp constructor
    constructor(graph_id, function_id) {
        this.graph_area = new WasmGraphCanvas(document.getElementById(graph_id));
        this.function_area = new WasmFunctionCanvas(document.getElementById(function_id));
        this.animating = false;

        this.function_area.toolbox_load_state("0@(10 20):id(0) 1@(50 20):constant(1) ");
        this.function_area.set_update_callback(() => this.update_fa_callback());
        this.run_step_pending = false;
    }

    //fp update_fa_callback
    update_fa_callback() {
        console.log("update_fa_callback");
        let e = undefined;
        try {e = this.function_area.get_expr();
            } catch(x) {console.log(x)}
        if (e !== undefined) {
            console.log(e);
             this.graph_area.set_function(2,"0","");
             this.graph_area.set_expression(2,1,e);
             this.graph_area.set_color(2,'#fdcc00');
            const txt = e.as_string();
            document.getElementById('dydx').innerText = txt;
            let expr = new WasmExpression();
            expr.set_rpn("X");
            console.log(this.graph_area.compare(1, expr, e));
        }
    }

    //mp set_test_fn
    set_test_fn(rpn) {
        let expr = new WasmExpression();
        expr.set_rpn(rpn);
        this.graph_area.set_expression(0,1,expr);
        this.graph_area.set_color(0,'gradient');

        // this.graph_area.set_function(1,rpn,"x");
        // this.graph_area.set_color(1,'red');
    }

    //mp animating
    set_animating(a) {
        if (a) {
            if (this.run_step_pending) {return;}
            this.animating = true;
            requestAnimationFrame((x)=>this.run_step(x));
            // Single threaded so the next line is atomic with this
            this.run_step_pending = true;
        } else {
            this.animating = false;
        }
    }

    //mp run_step
    run_step(time_now) {
        this.run_step_pending = false;
        if (this.animating) {
            var ms = Math.floor(time_now/100) % 1000;
            this.function_area.redraw(ms);
            requestAnimationFrame((x)=>this.run_step(x));
            // Single threaded so the next line is atomic with this
            this.run_step_pending = true;
        }
    }

    //mp undo
    undo() {
        this.function_area.undo_state();
        this.function_area.redraw(0);
        this.set_animating(true);
    }

    //mp redo
    redo() {
        this.function_area.redo_state();
        this.function_area.redraw(0);
        this.set_animating(false);
    }
}

//a Game
class Game {

    //fp constructor
    constructor() {
        this.gaf = new GraphAndFunction('graph','widgets');
        this.gaf.set_test_fn('X X * 2 +');

        this.gs = new GameState(GameDescription, "saved_state");
        this.gs.ensure_valid();
        const {level_set:ls, level:level} = this.gs.get_level();
        this.gs.game_descriptor.populate_level_set_table("level_sets_table");

        ls.populate_level_table("levels_table");
        this.select_level(level);
    }
    
    //mp select_level_set
    ///
    /// Select a level set
    select_level_set(level_set_name) {
        this.gs.set_level_set(level_set_name);
        const {level_set:ls, level:level} = this.gs.get_level();
        ls.populate_level_table("levels_table");
        this.show_levels_page();
    }
    
    //mp select_level
    ///
    /// Select a level
    select_level(index) {
        this.gs.set_level_number(index);
        const {level_set:ls, level:level} = this.gs.get_level();
        ls.configure_toolbox(this.gaf.function_area, level);
        ls.configure_graph(this.gaf.graph_area, level);
        ls.configure_question(this.gaf.graph_area, "function", level);
        this.show_game_page();
    }
    
    //mp show_previous_page
    ///
    /// Show the previous
    show_previous_page() {
        let c = document.getElementById("game").getAttribute("class");
        if (c == "slide_right") {
            this.show_level_sets_page();
        } else if (c === "slide_center") {
            this.show_levels_page();
        }
    }

    //mp show_level_sets_page
    ///
    /// Show the level sets page
    show_level_sets_page() {
        document.getElementById("game").setAttribute("class", "slide_right2");
        document.getElementById("levels").setAttribute("class", "slide_right");
        document.getElementById("level_sets").setAttribute("class", "slide_center");
    }

    //mp show_levels_page
    ///
    /// Show the levels page
    show_levels_page() {
        document.getElementById("game").setAttribute("class", "slide_right");
        document.getElementById("levels").setAttribute("class", "slide_center");
        document.getElementById("level_sets").setAttribute("class", "slide_left");
    }

    //mp show_game_page
    ///
    /// Show the game page
    show_game_page() {
        document.getElementById("game").setAttribute("class", "slide_center");
        document.getElementById("levels").setAttribute("class", "slide_left");
        document.getElementById("level_sets").setAttribute("class", "slide_left2");
    }

    //mp undo
    undo() {
        this.gaf.function_area.undo_state();
        this.gaf.function_area.redraw(0);
        this.gaf.set_animating(true);
    }

    //mp redo
    redo() {
        this.gaf.function_area.redo_state();
        this.gaf.function_area.redraw(0);
        this.gaf.set_animating(false);
    }

}
//a The game content - Levels, LevelSets, and GameDescription
//cp LSB* - level descriptions
const LSB1 = { kind:"dydx", y:"X",   y_rpn:"X",     tb:["id(0)","constant(1)"], tr:[-3, 3, 40], xr:[-3, 3], yr:[-3, 3] }
const LSB2 = { kind:"dydx", y:"X+2", y_rpn:"X 2 +", tb:["id(0)","constant(1)"], tr:[-3, 3, 40], xr:[-3, 3], yr:[-3, 3] }
const LSB3 = { kind:"dydx", y:"3X",  y_rpn:"X 3 *", tb:["id(0)","constant(1)"], tr:[-3, 3, 40], xr:[-3, 3], yr:[-3, 3] }
const LSB4 = { kind:"dydx", y:"X^2", y_rpn:"X X *", tb:["id(0)","constant(1)"], tr:[-3, 3, 40], xr:[-3, 3], yr:[-3, 3] }
const LSB5 = { kind:"dydx", y:"4X^2 + 5", y_rpn:"4 X X * * 5 +", tb:["id(0)","constant(1)"], tr:[-3, 3, 40], xr:[-3, 3], yr:[-1, 40] }
const LSB6 = { kind:"dydx", y:"X + 3X^2", y_rpn:"X 3 X X * * +", tb:["id(0)","constant(1)"], tr:[-3, 3, 40], xr:[-3, 3], yr:[-1, 15] }
const LSB7 = { kind:"dydx", y:"1/X", y_rpn:"1 X /", tb:["id(0)","constant(1)"], tr:[-3, 3, 41], xr:[-3, 3], yr:[-3, 3] }
const LSB8 = { kind:"dydx", y:"1/(X^7)", y_rpn:"1 X 7 pow /", tb:["id(0)","constant(1)"], tr:[-3, 3, 41], xr:[-3, 3], yr:[-3, 3] }

const LSE1 = { kind:"dydx", y:"e^X", y_rpn:"X e", tb:["id(0)","constant(1)"], tr:[-3, 3, 40], xr:[-3, 3], yr:[-3, 3] }

const LST1 = { kind:"dydx", y:"cos(X)", y_rpn:"X cos", tb:["id(0)","constant(1)", "fn(0)", "fn(1)", "fn(2)"], tr:[-5, 5, 100], xr:[-5, 5], yr:[-1.1, 1.1] }
const LST2 = { kind:"dydx", y:"sin(X)", y_rpn:"X sin", tb:["id(0)","constant(1)", "fn(0)", "fn(1)", "fn(2)"], tr:[-5, 5, 100], xr:[-5, 5], yr:[-1.1, 1.1] }

const LSC1 = { kind:"dydx", y:"sin(X)*exp(cos(X))", y_rpn:"X sin X cos e *", tb:["id(0)","constant(1)", "fn(0)", "fn(1)", "fn(2)", "fn(3)", "fn(4)"], tr:[-5, 5, 100], xr:[-5, 5], yr:[-2, 3] }

//cp LSBasic
const LSBasic = new LevelSet("Basic", [LSB1, LSB2, LSB3, LSB4, LSB5, LSB6, LSB7, LSB8]);
const LSExp   = new LevelSet("e^", [LSE1]);
const LSTrig  = new LevelSet("Trig", [LST1, LST2]);
const LSC     = new LevelSet("Difficult", [LSC1]);

//cp GameDescription
const GameDescription = new GameDescriptor( [LSBasic,
                                             LSExp,
                                             LSTrig,
                                             LSC,
                                            ] );

//a blah
const nps_json = `
[ // On 6040 Move a pink point to left make X smaller
    // 6040 has dxyz [-0.65,-0.70,0.30]
    // On 6041 Move a pink point up left without impacting 6040 add dxyz
    // 6041 has dxyz [-0.24,-0.78,0.58]

    // 6, 7, ad 13 are used in training 6040 and 6041
    // -2.959,-8.947,1.912
    ["0cm ruler","#ff0000",[-3.0,51.0,2.0]],
    ["1cm ruler","#ff0011",[-3.0,41.0,2.0]],
    ["2cm ruler","#ff0022",[-3.0,31.0,2.0]],
    ["3cm ruler","#ff0033",[-3.0,21.0,2.0]],
    ["4cm ruler","#ff0044",[-3.0,11.0,2.0]],
    ["5cm ruler","#ff0055",[-3.0, 1.0,2.0]],
    ["6cm ruler","#ff0066",[-3.0,-9.0,2.0]],
    ["7cm ruler","#ff0077",[-3.0,-19.0,2.0]],
    ["8cm ruler","#ff0088",[-3.0,-29.0,2.0]],
    ["9cm ruler","#ff0099",[-3.0,-39.0,2.0]],
    ["10cm ruler","#ff00aa",[-3.0,-49.0,2.0]],
    ["11cm ruler","#ff00bb",[-3.0,-59.0,2.0]],
    ["12cm ruler","#ff00cc",[-3.0,-69.0,2.0]],
    ["13cm ruler","#ff00dd",[-3.0,-79.0,2.0]],

    ["1 tl game","#00ff44",[0.8103541649616705,-1.76737256160823,96.16956541921931]],

    ["M middle",  "#0000ff", [70.39412548709862,11.845754488145616,97.26309225972878]],
    ["M middle 1","#1100ff", [0.0,0.0,0.0]],
    ["M middle 2","#2200ff", [0.0,0.0,0.0]],
    ["M middle 3","#3300ff", [0.0,0.0,0.0]],
    ["M middle 4","#4400ff", [0.0,0.0,0.0]],
    ["M middle 5","#5500ff", [0.0,0.0,0.0]],
    ["M middle 6","#6600ff", [0.0,0.0,0.0]],

    ["0 bl game","#00ff66",[-1.9942996443006313,-0.14935713906283787,2.9652766551674503]],
    ["5 tl text","#00FF00", [4.343028305782383,107.52130585958037,95.541380389441]],
    ["x bl text","#00FF22", [0.0,0.0,0.0]]
]`;
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

const pms_json = `
[
  [
    "M middle 5",
    [
      3915.0,
      909.0
    ],
    2.0
  ],
  [
    "M middle 3",
    [
      4252.0,
      1017.0
    ],
    2.0
  ],
  [
    "M middle 6",
    [
      3900.0,
      1096.0
    ],
    2.0
  ],
  [
    "M middle 1",
    [
      4248.0,
      1115.0
    ],
    2.0
  ],
  [
    "M middle",
    [
      4111.0,
      1182.0
    ],
    2.0
  ],
  [
    "M middle 4",
    [
      3121.0,
      1185.0
    ],
    2.0
  ],
  [
    "M middle 2",
    [
      3810.0,
      1221.0
    ],
    2.0
  ],
  [
    "1 tl game",
    [
      3161.0,
      1559.0
    ],
    2.0
  ],
  [
    "1cm ruler",
    [
      2499.0,
      3480.0
    ],
    2.0
  ],
  [
    "2cm ruler",
    [
      2660.0,
      3548.0
    ],
    2.0
  ],
  [
    "3cm ruler",
    [
      2811.0,
      3621.0
    ],
    2.0
  ],
  [
    "4cm ruler",
    [
      2986.0,
      3691.0
    ],
    2.0
  ],
  [
    "5cm ruler",
    [
      3139.0,
      3765.0
    ],
    2.0
  ],
  [
    "6cm ruler",
    [
      3303.0,
      3842.0
    ],
    2.0
  ],
  [
    "7cm ruler",
    [
      3486.0,
      3920.0
    ],
    2.0
  ],
  [
    "8cm ruler",
    [
      3664.0,
      4000.0
    ],
    2.0
  ],
  [
    "9cm ruler",
    [
      3858.0,
      4082.0
    ],
    2.0
  ],
  [
    "10cm ruler",
    [
      4055.0,
      4166.0
    ],
    2.0
  ]
]
`;

//a Ic
class Ic {

    //fp constructor
    constructor() {
        this.cdb = new WasmCameraDatabase(camera_db_json);
        this.nps = new WasmNamedPointSet();
        this.nps.read_json(nps_json);

        this.cam = new WasmCameraInstance(this.cdb, camera_inst_json);
        this.pms = new WasmPointMappingSet();
        this.pms.read_json(this.nps, pms_json);

        this.nps.add_pt(new WasmNamedPoint("Me!", "#123456"));
        this.nps.add_pt(new WasmNamedPoint("Him!", "#543210"));
        console.log(this.cam);
    }

    json_to_element( id ) {
        var ele = document.getElementById(id);
        ele.innerText = this.nps.to_json();
    }

    pms_set(wpms) {
        this.pms = wpms;
    }

    redraw_nps(ctx, scale, left, top) {
        const cl = 6;
        const cw = 2;
        let names = this.nps.pts();
        let num_mappings = this.pms.len();
        for (let i = 0; i < num_mappings; i++) { 
            const n = this.pms.get_name(i);
            const p = this.nps.get_pt(n);
            const xye = this.pms.get_xy_err(i);
            // const m = p.model();
            ctx.fillStyle = p.color();
            const x = xye[0];
            const y = xye[1];
            const sx = x*scale-left;
            const sy = y*scale-top;
            ctx.fillRect(sx-cl, sy-cw, cl*2, cw*2);
            ctx.fillRect(sx-cw, sy-cl, cw*2, cl*2);
        }
    }
    
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
            ctx.fillStyle = p.color();
            const x = xye[0];
            const y = xye[1];
            const sx = x*scale-left;
            const sy = y*scale-top;
            ctx.fillRect(sx-cl, sy-cw, cl*2, cw*2);
            ctx.fillRect(sx-cw, sy-cl, cw*2, cl*2);
        }
    }
    
    redraw_canvas(canvas, scale, left, top) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        console.log(image_div, width, height);

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

    redraw_canvas() {
        this.ic.redraw_canvas(this.canvas, this.img_width/6720, this.image_div.scrollLeft, this.image_div.scrollTop);
    }

    load_pms(pms_json) {
        const wpms = new WasmPointMappingSet();
        wpms.read_json(this.ic.nps, pms_json);
        this.ic.pms_set(wpms);
        this.redraw_canvas();
    }
    
    wheel(e) {
        console.log(e.offsetX, e.offsetY);
        if (e.ctrlKey) {
            this.zoom_image_canvas((200-e.deltaY)/200, e.offsetX, e.offsetY);
        } else {
            this.scroll_by(-e.deltaX, -e.deltaY);
        }
        e.preventDefault();
    }

    mouse_down(e) {
        this.drag = [e.layerX, e.layerY];
        e.preventDefault();
    }

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

    mouse_up(e) {
        this.drag = null;
        e.preventDefault();
    }

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

    scroll_by(dx, dy) {
        this.image_div.scrollLeft -= dx;
        this.image_div.scrollTop -= dy;
        this.redraw_canvas();
    }
}

//a Top level init() =>
init().then(() => {
    window.image_canvas = new ImageCanvas('image_canvas', 'image_div', 'canvas', 'image');
});
