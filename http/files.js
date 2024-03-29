//a Directory
export class Directory {
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
export class FileSet {

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

