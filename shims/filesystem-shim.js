
//
//  filesystem.js
//  GravityScore and 1lann
//



var fs = require('fs');

var filesystem = {};
var computerFilesystem = {};



//
//    Setup
//


filesystem.setup = function(callback) {
	//var_dump(filesystem.list(""));
	callback();
};



//
//    Basic Utilities
//


filesystem.format = function(path) {
	path = path.replace("\\", "/");
	if (!path.startsWith("./")) {
		path = "./" + path;
	}

	//path = path.replace(/\/+$/, "");

	if (path.length == 0) {
		path = "./";
	}
	return path;
}


filesystem.sanitise = function(path) {
	path = filesystem.format(path);

	path = path.replace(/(\/(\.\/)+)|(\/\.$)/g, "/").replace(/\/{2,}/g, "/");

	var leadingParents = path.substring(1).match(/^(\.\.\/)+/) || '';
	if (leadingParents) {
		leadingParents = leadingParents[0];
	}

	while (true) {
		var parent = path.indexOf("/..");
		if (parent == -1) {
			break;
		} else if (parent == 0) {
			path = path.substring(3);
			continue;
		}

		var pos = path.substring(0, parent).lastIndexOf("/");
		if (pos == -1) {
			pos = parent;
		}
		path = path.substring(0, pos) + path.substring(parent + 3);
	}

	path = leadingParents + path;
	return filesystem.format(path);
}


filesystem.getName = function(path) {
	path = filesystem.format(path);
	return path.substring(path.lastIndexOf("/") + 1);
}


filesystem.getContainingFolder = function(path) {
	path = filesystem.format(path);

	var folder = path.substring(0, path.lastIndexOf("/"));
	if (folder.length == 0) {
		folder = "./";
	}

	return folder;
}



//
//    Raw Filesystem
//

//  These functions do not resolve the path to a particular computer
//  They operate on absolute file paths starting from the actual root
//  No concept of "read only files" is present



//    Query


filesystem.list = function(path) {
	path = filesystem.sanitise(path);
	var files;
	try {
		files = fs.readdirSync(path);
	} catch (e) {
		if (e.code == "ENOENT") {
			files = [];
		} else {
			throw e;
		}
	}

	return files;
}


filesystem.listRecursively = function(path, includeDirectories) {
	path = filesystem.sanitise(path);
	
	var files = [];
	var contents = filesystem.list(path);
	for (var i in contents) {
		var filePath = path + "/" + contents[i];

		if (filesystem.isDir(filePath)) {
			if (includeDirectories) {
				files.push(filePath + "/");
			}

			var children = filesystem.listRecursively(filePath, includeDirectories);
			for (var i in children) {
				files.push(children[i]);
			}
		} else {
			files.push(filePath);
		}
	}

	return files;
}


filesystem.exists = function(path) {
	path = filesystem.sanitise(path);
	return fs.existsSync(path);
}


filesystem.isDir = function(path) {
	path = filesystem.sanitise(path);

	var is = false;
	try {
		var stat = fs.statSync(path);
		is = stat.isDirectory();
	} catch (e) {
		is = false;
		if (e.code != "ENOENT") {
			throw e;
		}
	}

	return is;
}



//    Modification


filesystem.read = function(path) {
	path = filesystem.sanitise(path);

	try {
		var contents = null;
		if (!filesystem.isDir(path)) {
			contents = fs.readFileSync(path).toString();
		}
	} catch (e) {
		if (e.code == "ENOENT") {
			return null;
		} else {
			throw e;
		}
	}

	return contents;
}


filesystem.write = function(path, contents) {
	path = filesystem.sanitise(path);
	if(path.startsWith("rom/")) {
		return;
	}
	if (!filesystem.isDir(path)) {
		var folder = filesystem.getContainingFolder(path);
		if (!filesystem.exists(folder)) {
			filesystem.makeDir(folder);
		}

		fs.writeFileSync(path, contents);
	}
}


filesystem.append = function(path, contents) {
	path = filesystem.sanitise(path);
	if(path.startsWith("rom/")) {
		return;
	}
	if (!filesystem.isDir(path)) {
		var folder = filesystem.getContainingFolder(path);
		if (!filesystem.exists(folder)) {
			filesystem.makeDir(folder);
		}

		fs.appendFileSync(path, contents);
	}
}


filesystem.makeDir = function(path, mode, position) {
	path = filesystem.sanitise(path);
	mode = mode || 0777;
	position = position || 0;
	
	if(path.startsWith("rom/")) {
		return;
	}

	var parts = path.split("/");

	if (position >= parts.length) {
		return true;
	}

	var directory = parts.slice(0, position + 1).join("/") || "/";
	try {
		fs.statSync(directory);
		filesystem.makeDir(path, mode, position + 1);
	} catch (e) {
		try {
			fs.mkdirSync(directory, mode);
			filesystem.makeDir(path, mode, position + 1);
		} catch (e) {
			if (e.code != "EEXIST") {
				throw e;
			}

			filesystem.makeDir(path, mode, position + 1);
		}
	}
}


filesystem.delete = function(path) {
	path = filesystem.sanitise(path);

	if(path.startsWith("rom/")) {
		return false;
	}

	var success = false;

	if (path != "/") {
		if (filesystem.isDir(path)) {
			var fileList = filesystem.listRecursively(path, true);
			var directoryList = [];

			for (var i in fileList) {
				if (filesystem.isDir(fileList[i])) {
					directoryList.push(fileList[i]);
				} else {
					fs.unlinkSync(fileList[i]);
				}
			}

			for (var i in directoryList) {
				if (filesystem.exists(directoryList[i])) {
					fs.rmdirSync(directoryList[i]);
				}
			}

			fs.rmdirSync(path);
		} else if (filesystem.exists(path)) {
			fs.unlinkSync(path);
		}

		success = true;
	}

	return success;
}



//    File Manipulation


filesystem.copy = function(from, to) {
	from = filesystem.sanitise(from);
	to = filesystem.sanitise(to);
	
	if(to.startsWith("rom/")) {
		return false;
	}

	if (!filesystem.exists(from)) {
		return false;
	}

	var success = false;

	if (filesystem.isDir(to)) {
		var locallyResolved = computerFilesystem.resolve("/" + filesystem.getName(from));
		if (to == from && filesystem.exists(locallyResolved)) {

		} else if (filesystem.isDir(from)) {
			if (filesystem.exists(to + "/" + filesystem.getName(from))) {

			} else if (to == "/" && filesystem.exists("/" + filesystem.getName(from))) {

			} else {
				var fileList = filesystem.listRecursively(from, true);
				for (var i in fileList) {
					if (!filesystem.isDir(fileList[i])) {
						var fileName = filesystem.getName(from) + "/" + fileList[i].substring(from.length);
						filesystem.write(to + "/" + fileName, filesystem.read(fileList[i]));
					}
				}

				success = true;
			}
		} else if (!filesystem.exists(to + "/" + filesystem.getName(from))) {
			filesystem.write(to + "/" + filesystem.getName(from), filesystem.read(from));
			success = true;
		}
	} else if (!filesystem.exists(to)) {
		if (filesystem.isDir(from)) {
			var fileList = filesystem.listRecursively(from, true);

			for (var i in fileList) {
				if (!filesystem.isDir(fileList[i])) {
					var fileName = fileList[i].substring(from.length);
					filesystem.write(to + "/" + fileName, filesystem.read(fileList[i]));
				}
			}
		} else {
			filesystem.write(to, filesystem.read(from));
		}

		success = true;
	}

	return success;
}


filesystem.move = function(from, to) {
	var success = false;
	
	if(to.startsWith("lua/rom/")) {
		return;
	}

	if (filesystem.copy(from, to)) {
		if (filesystem.delete(from)) {
			//sidebar.update();
			success = true;
		} else {
			filesystem.delete(to);
		}
	}

	return success;
}



//
//    Computer Specific Filesystem
//

//  These functions use the current computer ID to resolve paths for
//  a particular computer
// Mounts the rom folder
// Checks for read only


//    Utilities


computerFilesystem.resolve = function(path, computerID) {
	var init = path;
	var computer = core.getActiveComputer();
	computerID = computerID || computer.id;
	//if(path.startsWith("/")) {path=path.replace("/","./");}
	if (path != "/") {
		computerFilesystem.createRoot();
	}
	if (path.indexOf("rom") == 0) {
		path = "./lua/"+path.substring(path.indexOf("rom"));
	} else if (path.indexOf("./rom") == 0) {
		path = "./lua/"+path.substring(path.indexOf("./rom")+2);
	} else if (path.indexOf("/rom") == 0) {
		path = "./lua/"+path.substring(path.indexOf("/rom")+1);
	} else {
		var base = "./data/" + computerID.toString();
		var sp = filesystem.sanitise(path);
		if(sp.startsWith("./")) {sp=sp.replace("./", "/");}
		path = filesystem.format(base + sp);
	}

	return path;
}


computerFilesystem.isReadOnly = function(path) {
	var computer = core.getActiveComputer();
	var base = "./data/" + computer.id.toString();
	var is = true;

	if (path.indexOf(base) == 0) {
		return false;
	}

	return is;
}


computerFilesystem.createRoot = function() {
	var rootPath = computerFilesystem.resolve("/");
	if (!filesystem.isDir(rootPath)) {
		filesystem.makeDir(rootPath);
	}
}



//    Query


computerFilesystem.list = function(path) {
	path = computerFilesystem.resolve(path);

	var files = filesystem.list(path);
	if (path == computerFilesystem.resolve("/")) {
		files.push("rom");
	}

	return files;
}


computerFilesystem.exists = function(path) {
	path = computerFilesystem.resolve(path);
	return filesystem.exists(path);
}


computerFilesystem.isDir = function(path) {
	path = computerFilesystem.resolve(path);
	return filesystem.isDir(path);
}



//    Modification


computerFilesystem.read = function(path) {
	path = computerFilesystem.resolve(path);
	return filesystem.read(path);
}


computerFilesystem.write = function(path, contents) {
	path = computerFilesystem.resolve(path);

	var success = true;
	if (!computerFilesystem.isReadOnly(path)) {
		filesystem.write(path, contents);
	} else {
		success = false;
	}

	//sidebar.update();
	return success;
}


computerFilesystem.append = function(path, contents) {
	path = computerFilesystem.resolve(path);

	var success = true;
	if (!computerFilesystem.isReadOnly(path)) {
		filesystem.append(path, contents);
	} else {
		success = false;
	}

	//sidebar.update();
	return success;
}


computerFilesystem.makeDir = function(path) {
	path = computerFilesystem.resolve(path);

	var success = true;
	if (!computerFilesystem.isReadOnly(path)) {
		filesystem.makeDir(path);
	} else {
		success = false;
	}

	//sidebar.update();
	return success;
}


computerFilesystem.delete = function(path) {
	path = computerFilesystem.resolve(path);

	var success = true;
	if (!computerFilesystem.isReadOnly(path)) {
		success = filesystem.delete(path);
	} else {
		success = false;
	}

	//sidebar.update();
	return success;
}



//    File Manipulation


computerFilesystem.move = function(from, to) {
	from = computerFilesystem.resolve(from);
	to = computerFilesystem.resolve(to);

	return filesystem.move(from, to)
}


computerFilesystem.copy = function(from, to) {
	from = computerFilesystem.resolve(from);
	to = computerFilesystem.resolve(to);

	var success = filesystem.copy(from, to);

	//sidebar.update();
	return success;
}
