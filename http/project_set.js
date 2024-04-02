//a Imports
import {Log} from "./log.js";
import * as utils from "./utils.js";

//a ProjectSet
export class ProjectSet {
    //fp constructor
    constructor(file_set) {
        this.file_set = file_set;
        const local = this.file_set.dir().files_of_type("proj");
        this.projects = {};
        this.projects.local = local;
        this.callback = null;
        this.add_server_projects();
        window.log.add_log(0, "project_set", "init", "Local projects "+this.projects.local);
    }
    //mp decode_locator
    decode_locator(locator) {
        if (locator.startsWith("local:")) {
            const n = Number(locator.slice(6));
            return ["local", this.projects.local[n]];
        } else if (locator.startsWith("server:")) {
            const n = Number(locator.slice(7));
            return ["server", this.projects.server[n]];
        }
        return null;
    }
    //mp load_project_json
    load_project(locator_str, callback) {
        const locator = this.decode_locator(locator_str);
        if (!locator) {return;}
        if (locator[0] == "local") {
            const name = locator[1];
            const data = this.file_set.load_file("proj", name);
            if (!data) {
                window.log.add_log(5, "project", "load", `Failed to read project ${name}`);
                return;
            }
            callback(data);
        } else if (locator[0] == "server") {
            const name = locator[1];
            fetch("/project/"+name+"?load")
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch server project ${name}: ${response.status}`);
                    }
                    return response.text();
                })
                .then((text) => {
                    callback(text);
                });
        }
    }
    //mp save_project
    save_project(locator_str, project) {
        const locator = this.decode_locator(locator_str);
        if (!locator) {return;}
        if (locator[0] == "local") {
            this.file_set.save_file("proj",
                                    locator[1],
                                    project.to_json(true)
                                   );
            window.log.add_log(5, "project", "save", `Saved to project ${locator[1]}`);
        } else if (locator[0] == "server") {
            this.file_set.save_file("proj",
                                    "server_bkp_"+locator[1],
                                    project.to_json(true)
                                   );
            window.log.add_log(5, "project", "save", `Saved local backup to project server_bkp_${locator[1]}`);
            const name = locator[1];
            const put_data = {
                method: "PUT",                
                headers: {
                    "Content-Type": "application/json",
                },
                body: project.to_json(false), 
                mode: "cors",
                cache: "no-cache",
                credentials: "same-origin",
            };
            fetch("/project/"+name+"?save", put_data)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch server project ${name}: ${response.status}`);
                    } else {
                        window.log.add_log(5, "project", "save", `Server saved project ${locator[1]}`);
                    }
                });
        }
    }

    //ap get_projects
    get_projects() {
        var projects = [];
        for (const p in this.projects.local) {
            projects.push(["local", this.projects.local[p], "local:"+p]);
        }
        for (const p in this.projects.server) {
            projects.push(["server", this.projects.server[p], "server:"+p]);
        }
        return projects;
    }
    //mp add_server_projects
    add_server_projects(server) {
        const me = this;
        this.projects.server = [];
        fetch("/project?list")
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch server projects: ${response.status}`);
                }
                return response.json();
            })
            .then((json) => me.server_projects_json(json))
            .catch((err) => console.error(`Fetch problem: ${err.message}`));
    }
    //mp server_projects_json
    server_projects_json(json) {
        if (utils.is_array(json)) {
            for (name of json) {
                if (utils.is_string(name)) {
                    this.projects.server.push(name);
                }
            }
        }
        window.log.add_log(0, "project_set", "init", "Remote projects "+this.projects.server);
        if (this.callback) {
            this.callback(this);
        }
    }
}

