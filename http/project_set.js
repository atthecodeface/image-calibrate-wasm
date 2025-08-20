//a Imports
import {Log} from "./log.js";
import * as utils from "./utils.js";

//a ServerProject
export class ServerProject {
    //fp constructor
    constructor(uri, project) {
        this.uri = uri;
        this.project = project;
        this.thumbnails = [];
        this.meshes = [];
        this.interestings = [];
    }

    //mp fetch_thumbnail
    async fetch_thumbnail(cip, width) {
        while (this.thumbnails.length < cip) {
            this.thumbnails.push(null);
        }
        this.thumbnails[cip] = null;
        return fetch(`${this.uri}?thumbnail&cip=${cip}&width=${width}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch thumbnail: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then((data) => {
                const blob = new Blob([data], {type:"image/jpeg"});
                return blob;
            })
    }

    //mp fetch_mesh
    async fetch_mesh(cip) {
        while (this.meshes.length < cip) {
            this.meshes.push(null);
        }
        this.meshes[cip] = [];
        return fetch(`${this.uri}?mesh&cip=${cip}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch mesh: ${response.status}`);
                }
                return response.json();
            })
    }

    //mp fetch_interesting
    async fetch_interesting(cip) {
        while (this.interestings.length < cip) {
            this.interestings.push([]);
        }
        this.interestings[cip] = [];
        return fetch(`${this.uri}?interesting&cip=${cip}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch interesting points: ${response.status}`);
                }
                return response.json();
            })
    }

    //mp fetch_thumbnails
    fetch_thumbnails(width, callback) {
        this.thumbnails = [];
        const me = this;
        let promises = [];
        for (let i=0; i<this.project.ncips(); i++) {
            promises.push(
                this.fetch_thumbnail(i, width)
                    .then((blob) => {
                        me.thumbnails[i] = blob;
                    })
                    .catch((err) => console.error(`Fetch problem: ${err.message}`))
            );
        }
        Promise.all(promises).then(() => {callback(me);});
    }

    //mp issue_fetch_interestings
    issue_fetch_interestings(cip, callback) {
        if ((cip >= this.interestings.length) && this.interestings[cip]) {
         callback(this);
         return;
         }
        const me = this;
        let promises = [];
        promises.push(
                this.fetch_interesting(cip)
                    .then((m) => {
                        me.interestings[cip] = m;
                    })
                    .catch((err) => console.error(`Fetch problem: ${err.message}`))
            );
        Promise.all(promises).then(() => {callback(me);});
    }

    //mp issue_fetch_mesh
    issue_fetch_mesh(cip, callback) {
        if ((cip >= this.meshes.length) && this.meshes[cip]) {
         callback(this);
         return;
         }
        const me = this;
        let promises = [];
        promises.push(
            this.fetch_mesh(cip)
                .then((m) => {
                    me.meshes[cip] = m;
                })
                .catch((err) => console.error(`Fetch problem: ${err.message}`))
        );
        Promise.all(promises).then(() => {callback(me);});
    }

    //mp get_mesh
    get_mesh(cip) {
        if (cip < this.meshes.length) {
            return this.meshes[cip];
        }
        return null;
    }

    //mp get_interestings
    get_interestings(cip) {
        if (cip < this.interestings.length) {
            return this.interestings[cip];
        }
        return null;
    }

    //mp clear_meshes
    clear_meshes() {
        this.meshes = [];
    }

    //mp image_uri
    image_uri(cip) {
        return `${this.uri}?image&cip=${cip}`;
    }

    //zz All Done
}

//a ProjectSet
export class ProjectSet {
    //fp constructor
    constructor(file_set, callback) {
        this.file_set = file_set;
        const local = this.file_set.dir().files_of_type("proj");
        this.projects = {};
        this.projects.local = local;
        this.projects.server = [];
        this.callback = callback;
        this.add_server_projects();
        window.log.add_log(0, "project_set", "init", "Local projects "+this.projects.local);
    }

    //mp decode_locator
    decode_locator(locator) {
        if (locator.startsWith("local:")) {
            const n = Number(locator.slice(6));
            return ["local", this.projects.local[n]];
        } else if (locator.startsWith("server:")) {
            const name = locator.slice(7);
            const n = Number(name);
            if (!isNaN(n)) {
                return ["server", this.projects.server[n]];
            }
            for (const pname of this.projects.server) {
                if (pname == name) {
                    return ["server", pname];
                }
            }
        }
        return null;
    }
    //mp load_project
    load_project(locator_str, callback) {
        const locator = this.decode_locator(locator_str);
        if (locator == null) {return;}
        if (locator[0] == "local") {
            const name = locator[1];
            const data = this.file_set.load_file("proj", name);
            if (!data) {
                window.log.add_log(5, "project", "load", `Failed to read project ${name}`);
                return;
            }
            callback(true, data);
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
                    callback(false, text);
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
            this.callback(this, "server_projects");
        }
    }

    //zz All done
}

