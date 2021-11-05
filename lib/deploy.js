/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let Deploy;
const colors		= require("colors");
const path 		= require("path");
const fs			= require("fs");
const YAML		= require("yamljs");
const Signal		= require("signals");
const expand		= require("glob-expand");
const minimatch	= require("minimatch");
const prompt		= require("prompt");
const {
    exec
} = require("child_process");


module.exports = (Deploy = (function() {
	Deploy = class Deploy {
		static initClass() {
	
			this.prototype.server 			 = null;
			this.prototype.ignoreInclude	 = null;
	
			this.prototype.local_hash		 = null;
			this.prototype.remote_hash		 = null;
			this.prototype.connection		 = null;
			this.prototype.revisionPath 	 = null;
	
			this.prototype.connections 	 = null;
			this.prototype.numConnections 	 = null;
			this.prototype.toUpload		 = null;
			this.prototype.toDelete		 = null;
			this.prototype.dirCreated		 = null;
	
			this.prototype.isConnected 	 = null;
			this.prototype.completed 		 = null;
		}

		/*
		@constructor

		@param	config (optional)		Default configuration for this server
		@param	server (optional)		Set the server to load from the YAML file
		@param	ignoreInclude (false)	Ignore the 'include' tag
		@param	catchup (false)			Catchup with the server and only uploads the revision file
		*/
		constructor(config, server, ignoreInclude, catchup) {
			this.canUpload = this.canUpload.bind(this);
			this.canDelete = this.canDelete.bind(this);
			this.checkBeforeUpload = this.checkBeforeUpload.bind(this);
			this.uploadItem = this.uploadItem.bind(this);
			this.deleteItem = this.deleteItem.bind(this);
			this.setFolderAsCreated = this.setFolderAsCreated.bind(this);
			this.removeConnections = this.removeConnections.bind(this);
			this.dispose = this.dispose.bind(this);
			this.complete = this.complete.bind(this);
			this.config = config;
			this.server = server;
			if (ignoreInclude == null) { ignoreInclude = false; }
			this.ignoreInclude = ignoreInclude;
			if (catchup == null) { catchup = false; }
			this.catchup = catchup;
			this.completed		= new Signal();
			this.connections	= [];
			this.numConnections	= 0;
			this.toUpload		= [];
			this.toDelete		= [];
			this.dirCreated		= {};
			this.isConnected	= false;

			// Set the default messages for the prompt
			prompt.message = "– ".red;
			prompt.delimiter = "";

			// If you set a config file, go straight to the @configLoaded
			// Otherwise load the dploy.yaml
			if (this.config != null) { this.configLoaded(); } else { this.loadYAML(); }
		}

		/*
		Load the dploy.yaml, parse and find the current server
		*/
		loadYAML() {
			// Load the config file
			return fs.readFile("dploy.yaml", (error, data) => {
				let code;
				if (error) {
					return console.log("Error:".bold.red, "The file \"dploy.yaml\" could not be found.");
					process.exit(code=0);
				}

				// Set the config file based on the arguments
				// If no arguments were found, use the first environment on the file
				const yaml = YAML.parse(data.toString());
				if (!this.server) {
					for (let key in yaml) {
						this.server = key;
						break;
					}
				}

				this.config = yaml[this.server];
				if (!this.config) {
					return console.log("Error:".bold.red, "We couldn't find the settings for " + `${this.server}`.bold.red);
					process.exit(code=0);
				}

				return this.configLoaded();
			});
		}

		/*
		Method for when the config file is loaded
		*/
		configLoaded() {
			this.setupFallbackConfig();
			return this.checkPassword(this.checkBranch);
		}

		/*
		Set the fallback configuration
		*/
		setupFallbackConfig() {
			// If the server name doesn't exist, use the host name
			if (this.server == null) { this.server = this.config.host; }

			if (this.config.scheme == null) { this.config.scheme = "ftp"; }
			if (this.config.port == null) { this.config.port = (this.config.scheme === "ftp" ? 21 : 22); }
			if (this.config.secure == null) { this.config.secure = false; }
			if (this.config.secureOptions == null) { this.config.secureOptions = {}; }
			if (this.config.slots == null) { this.config.slots = 1; }
			if (this.config.revision == null) { this.config.revision = ".rev"; }
			if (this.config.path == null) { this.config.path = {}; }
			if (this.config.path.local == null) { this.config.path.local = ""; }
			if (this.config.path.remote == null) { this.config.path.remote = ""; }
			if (this.config.exclude == null) { this.config.exclude = []; }
			if (this.config.include == null) { this.config.include = {}; }

			// Fix the paths
			const regExpPath = new RegExp("(.*[^/]$)");
			if (this.config.path.local === "/") { this.config.path.local = ""; }
			if (this.config.path.local !== "") { this.config.path.local = this.config.path.local.replace(regExpPath, "$1/"); }
			if (this.config.path.remote !== "") { this.config.path.remote = this.config.path.remote.replace(regExpPath, "$1/"); }

			// Set the revision path
			this.revisionPath = this.config.path.local ? this.config.path.local + this.config.revision : this.config.revision;
		
			return this;
		}

		/*
		This method will double check for the password, publicKey and privateKey
		If none of those are found, DPLOY will prompt you to type it

		@param	callback 				The callback for when the password is found
		*/
		checkPassword(callback) {
			// If the password is set, just keep it going
			if (this.config.pass) { return callback.call(this); }

			// Load the privateKey and publicKey if there's one (only for SFTP)
			if (this.config.privateKey || (this.config.publicKey && (this.config.scheme === "sftp"))) {
				if (this.config.privateKey) {
					this.config.privateKey = fs.readFileSync(this._resolveHomeFolder(this.config.privateKey));
				}
				if (this.config.publicKey) {
					this.config.publicKey = fs.readFileSync(this._resolveHomeFolder(this.config.publicKey));
				}

				return callback.call(this);
			}
		
			// If no password, privateKey or publicKey is found, prompt the user to enter the password
			prompt.get([{
				name: "password",
				description: "Enter the password for ".red + `${this.config.host}:`.underline.bold.red,
				required: true,
				hidden: true
			}
				], (error, result) => {
					this.config.pass = result.password;
					return callback.call(this);
			});
		}

		/*
		Check if the branch you are working on can be deployed to that server
		*/
		checkBranch() {
			if (!this.config.branch) { return this.setupGit(); }

			if (typeof this.config.branch === "string") { this.config.branch = [this.config.branch]; }

			return exec("git rev-parse --abbrev-ref HEAD", (error, stdout, stderr) => {
				if (error) { return console.log("An error occurred when retrieving the current branch.".bold.red, error); }
				const currentBranch = stdout.replace(/\s/g, "");

				for (let branch of Array.from(this.config.branch)) {
					if (currentBranch === branch) { return this.setupGit(); }
				}

				console.log("Error: ".red.bold + "You are not allowed to deploy from ".red + `${currentBranch}`.bold.underline.red + " to ".red + `${this.server}`.bold.underline.red);
				return this.removeConnections(false);
			});
		}


		/*
		Get the HEAD hash id so we can compare to the hash on the server
		*/
		setupGit() {
			console.log("Connecting to ".bold.yellow + `${this.server}`.bold.underline.yellow + "...".bold.yellow);

			return exec("git log --pretty=format:%H -n 1", (error, stdout, stderr) => {
				if (error) { return console.log("An error occurred when retrieving the local hash.".bold.red, error); }
				this.local_hash	= stdout;

				// Call the server
				return this.setupServer();
			});
		}

		/*
		Connect to the server and once it's done, check for the remote revision file
		*/
		setupServer() {
			// Create a new instance of your server based on the scheme
			const scheme = require(`./scheme/${this.config.scheme}`);
			this.connection = new scheme();
			this.connection.failed.add(() => { if (!this.isConnected) { return console.log("Connection failed.".bold.red); } });
			this.connection.connected.add(() => {
				this.isConnected = true;
				this.numConnections++;
				this.connections.push(this.connection);

				// Once is connected, check the revision files
				return this.checkRevision();
			});

			// Connect using the config information
			return this.connection.connect(this.config);
		}

		/*
		Create more connections of your server for multiple uploads
		*/
		setupMultipleServers() {
			const scheme = require(`./scheme/${this.config.scheme}`);
			const con = new scheme();
			con.connected.add(() => {
				// Once is connected, check the revision files
				this.connections.push(con);
				this.numConnections++;
				return this.nextOnQueue(con);
			});

			// Connect using the config information
			return con.connect(this.config);
		}

		/*
		Check if the revision files exist, if not we will create one
		*/
		checkRevision() {
			console.log("Checking revisions...".bold.yellow);
		
			// Retrieve the revision file from the server so we can compare to our local one
			const remotePath = this._normalize(this.config.path.remote + this.config.revision);
			return this.connection.get(remotePath, (error, data) => {
				// If the file was not found, we need to create one with HEAD hash
				if (error) {
					fs.writeFile(this.revisionPath, this.local_hash, error => {
						if (error) { return console.log("Error creating revision file at:".red, `${this.revisionPath}`.red.bold.underline, error); }

						// Since this is our first upload, we will upload our entire local tree
						return this.addAll();
					});
					return;
				}

				// Update our local revision file with the HEAD hash
				fs.writeFileSync(this.revisionPath, this.local_hash);

				// If the remote revision file exists, let's get it's content
				if (typeof data === "string") {
					this.remote_hash = this._removeSpecialChars(data);
					return this.checkDiff(this.remote_hash, this.local_hash);
				} else {
					return data.on("data", e => {
						data.end();
						this.remote_hash = this._removeSpecialChars(e.toString());
						return this.checkDiff(this.remote_hash, this.local_hash);
					});
				}
			});
		}


		/*
		Get the diff tree between the local and remote revisions

		@param	old_rev					The remote hash, usually it's the old version
		@param	new_rev					The local hash, usually the latest one
		*/
		checkDiff(old_rev, new_rev) {
			// If any of the revisions is empty, add all
			if (!/([^\s])/.test(old_rev) || !/([^\s])/.test(new_rev)) { return this.addAll(); }

			console.log("Checking diffs between".bold.yellow, `[${old_rev}]`.yellow, ">".yellow, `[${new_rev}]`.yellow);

			// If both revisions are the same, our job is done.
			// We can finish the process.
			if (old_rev === new_rev) {
				if (this.config.include) {
					this.includeExtraFiles();
					if (this.config.check) { this.askBeforeUpload(); } else { this.startUploads(); }
					return;
				} else {
					console.log("No diffs between local and remote :)".blue);
					return this.removeConnections();
				}
			}

			// Call git to get the tree list of the modified items
			return exec(`git diff --name-status ${old_rev} ${new_rev}`, { maxBuffer: 5000*1024 }, (error, stdout, stderr) => {
				if (error) { return console.log(`An error occurred when retrieving the 'git diff --name-status ${old_rev} ${new_rev}'`.bold.red, error); }

				if (!this.catchup) {
					// Split the lines to get a list of items
					const files = stdout.split("\n");
					for (let detail of Array.from(files)) {
						// Check if the file was deleted, modified or added
						const data = detail.split("\t");
						if (data.length > 1) {
							// If you set a local path, we need to replace the remote name to match the remote path
							const remoteName = this.config.path.local ? data[1].split(this.config.path.local).join("") : data[1];

							// The file was deleted
							if (data[0] === "D") {
								if (this.canDelete(data[1])) { this.toDelete.push({name:data[1], remote:remoteName}); }
							// Everything else
							} else {
								if (this.canUpload(data[1])) { this.toUpload.push({name:data[1], remote:remoteName}); }
							}
						}
					}

					this.includeExtraFiles();
				}

				// Add the revision file
				this.toUpload.push({name:this.revisionPath, remote:this.config.revision});
			
				if (this.config.check) { this.askBeforeUpload(); } else { this.startUploads(); }
			});
		}

		/*
		Add the entire tree to our "toUpload" group
		*/
		addAll() {
			console.log("Uploading files...".bold.yellow);

			// Call git to get the tree list of all our tracked files
			return exec("git ls-tree -r --name-only HEAD", { maxBuffer: 5000*1024 }, (error, stdout, stderr) => {
				if (error) { return console.log("An error occurred when retrieving 'git ls-tree -r --name-only HEAD'".bold.red, error); }
			
				if (!this.catchup) {
					// Split the lines to get individual files
					const files = stdout.split("\n");
					for (let detail of Array.from(files)) {
						// If you set a local path, we need to replace the remote name to match the remote path
						const remoteName = this.config.path.local ? detail.split(this.config.path.local).join("") : detail;

						// Add them to our "toUpload" group
						if (this.canUpload(detail)) { this.toUpload.push({name:detail, remote:remoteName}); }
					}

					this.includeExtraFiles();
				}

				// Add the revision file
				this.toUpload.push({name:this.revisionPath, remote:this.config.revision});
			
				if (this.config.check) { this.askBeforeUpload(); } else { this.startUploads(); }
			});
		}
			

		/*
		Include extra files from the config file
		*/
		includeExtraFiles() {
			if (this.ignoreInclude || this.catchup) { return false; }

			for (let key in this.config.include) {
				const files = expand({ filter: "isFile", cwd:process.cwd() }, key);
				// Match the path of the key object to remove everything that is not a glob
				const match = path.dirname(key).match(/^[0-9a-zA-Z_\-/\\]+/);
				for (let file of Array.from(files)) {
					// If there's any match for this key, we remove from the remote file name
					// And we also clean the remote url
					let remoteFile = match && match.length ? file.substring(match[0].length) : file;
					remoteFile = this.config.include[key] + remoteFile;
					remoteFile = remoteFile.replace(/(\/\/)/g, "/");

					this.toUpload.push({name:file, remote:remoteFile});
				}
			}
			return true;
		}


		/*
		Method to check if you can upload those files or not

		@param	name (string)			The local file name
		@return <boolean> if you can delete or not
		*/
		canUpload(name) {
			// Return false if the name is empty
			if (name.length <= 0) { return false; }

			// Check if your are settings the local path
			if (this.config.path.local) {
				// Check if the name of the file matchs with the local path
				// And also ignore where the revision file is
				if (name.indexOf(this.config.path.local) < 0) { return false; }
			}

			for (let exclude of Array.from(this.config.exclude)) {
				if (minimatch(name, exclude, { dot: true })) { return false; }
			}

			return true;
		}

		/*
		Method to check if you can delete those files or not

		@param	name (string)			The local file name
		@return <boolean> if you can delete or not
		*/
		canDelete(name) {
			// Return false if the name is empty
			if (name.length <= 0) { return false; }

			// Check if your are settings the local path
			if (this.config.path.local) {
				// Check if the name of the file matchs with the local path
				// And also ignore where the revision file is
				if (name.indexOf(this.config.path.local) === 0) {
					return true;
				} else {
					return false;
				}
			}
			return true;
		}
	
		/*
		Get the user's confirmation before uploading the file
		*/
		askBeforeUpload() {
			let file;
			if (!this.hasFilesToUpload()) { return; }

			if (this.toDelete.length) {
				console.log("Files that will be deleted:".bold.red);
				for (file of Array.from(this.toDelete)) {
					console.log("[ ? ]".grey, `${file.remote}`.red);
				}
			}

			if (this.toUpload.length) {
				console.log("Files that will be uploaded:".bold.blue);
				for (file of Array.from(this.toUpload)) {
					const remoteFile = this._normalize(this.config.path.remote + file.remote);
					console.log("[ ? ]".blue, `${file.name}`.blue, ">".green, `${remoteFile}`.blue);
				}
			}

			prompt.start();
			return prompt.get([{
				name: "answer",
				pattern: /y|n|Y|N/,
				description: "Are you sure you want to upload those files?".bold.red + " (Y/n)",
				message: "The answer should be YES (y) or NO (n)."
			}
				], (error, result) => {
					if ((result.answer.toLowerCase() === "y") || (result.answer.toLowerCase() === "")) {
						return this.startUploads();
					} else {
						console.log("Upload aborted by the user.".red);
						return this.removeConnections(false);
					}
			});
		}

		/*
		Start the upload and create the other connections if necessary
		*/
		startUploads() {
			if (!this.hasFilesToUpload()) { return; }

			this.nextOnQueue(this.connection);
			let i = this.config.slots - 1;
			while (i-- > 0) { this.setupMultipleServers(); }
		}

		/*
		Check if there's file to upload/delete

		@return <boolean> if there's files or not
		*/
		hasFilesToUpload() {
			if ((this.toUpload.length === 0) && (this.toDelete.length === 0)) {
				console.log("No files to upload".blue);
				this.removeConnections();
				return false;
			}
			return true;
		}

		/*
		Upload or delete the next file in the queue
	
		@param	connection 				The FTP/SFTP connection to use
		*/
		nextOnQueue(connection) {
			// Files to delete
			let item;
			if (this.toDelete.length) {
				// We loop between all the files that we need to delete until they are all done.
				for (item of Array.from(this.toDelete)) {
					if (!item.started) {
						this.deleteItem(connection, item);
						return;
					}
				}
			}

			// Files to upload
			if (this.toUpload.length) {
				// We loop between all files that wee need to upload until they are all done
				for (item of Array.from(this.toUpload)) {
					if (!item.started) {
						this.checkBeforeUpload(connection, item);
						return;
					}
				}
			}


			for (item of Array.from(this.toDelete)) {
				if (!item.completed) { return; }
			}

			for (item of Array.from(this.toUpload)) {
				if (!item.completed) { return; }
			}

			// Everything is updated, we can finish the process now.
			return this.removeConnections();
		}


		/*
		Check if the file is inside subfolders
		If it's is, create the folders first and then upload the file.
		*/
		checkBeforeUpload(connection, item) {
			item.started = true;

			// Split the name to see if there's folders to create
			const nameSplit = item.remote.split("/");

			// If there is, we will have to create the folders
			if (nameSplit.length > 1) {
				nameSplit.length = nameSplit.length - 1;
				const folder = nameSplit.join("/");

				if (this.dirCreated[folder]) {
					this.uploadItem(connection, item);
					return;
				}

				// Create the folder recursively in the server
				return connection.mkdir(this._normalize(this.config.path.remote + folder), error => {
					if (!this.dirCreated[folder]) {
						if (error) {
							// console.log "[ + ]".green, "Fail creating directory: #{folder}:".red
						} else {
							// console.log "[ + ]".green, "Directory created: #{folder}:".green unless @dirCreated[folder]
							// Set the folder as created
							this.setFolderAsCreated(folder);
						}
					}
				
					if (error) {
						item.started = false;
						return this.nextOnQueue(connection);
					} else {
						// Upload the file once the folder is created
						return this.uploadItem(connection, item);
					}
				});

			} else {
				// No folders need to be created, so we just upload the file
				return this.uploadItem(connection, item);
			}
		}

		/*
		Upload the file to the remote directory
	
		@param	connection 				The FTP/SFTP connection to use
		@param 	item 					The item to upload
		*/
		uploadItem(connection, item) {
			// Set the entire remote path
			const remote_path = this._normalize(this.config.path.remote + item.remote);

			// Upload the file to the server
			return connection.upload(item.name, remote_path, error => {
				if (error) {
					console.log("[ + ]".blue, `Fail uploading file ${item.name}:`.red, error);
					item.started = false;
					item.completed = false;
				} else {
					console.log("[ + ]".blue + ` File uploaded: ${item.name}:`.blue);
					item.completed = true;
				}

				// Keep uploading the rest
				return this.nextOnQueue(connection);
			});
		}

		/*
		Delete an item from the remote server

		@param	connection 				The FTP/SFTP connection to use
		@param 	item 					The item to delete
		*/
		deleteItem(connection, item) {
			item.started = true;

			// Set the entire remote path
			const remote_path = this._normalize(this.config.path.remote + item.remote);

			// Delete the file from the server
			return connection.delete(remote_path, error => {
				if (error) {
					console.log("[ × ]".grey, `Fail deleting file ${remote_path}:`.red);
				} else {
					console.log("[ × ]".grey, `File deleted: ${remote_path}:`.grey);
				}

				item.completed = true;

				// Keep uploading the rest
				return this.nextOnQueue(connection);
			});
		}
	
		/*
		When we are creating the folders in the remote server we got make sure
		we don't try to rec-reate they, otherwise expect chaos
		*/
		setFolderAsCreated(folder) {
			let i = folder.lastIndexOf("/");

			if (this.dirCreated[folder]) { return; }

			while (i > 0) {
				const content = folder.slice(0, i);
				this.dirCreated[content] = true;
				i = content.lastIndexOf("/");
			}

			return this.dirCreated[folder] = true;
		}

		/*
		Remove/destroy all connections

		@param displayMessage <true>	Set if you want to display a message for when the upload is completed
		*/
		removeConnections(displayMessage) {
			if (displayMessage == null) { displayMessage = true; }
			if (this.numConnections > 0) {
				return (() => {
					const result = [];
					for (let con of Array.from(this.connections)) {
						con.closed.add(() => {
							this.numConnections--;
							if (this.numConnections === 0) { return this.complete(displayMessage); }
						});
						result.push(con.close());
					}
					return result;
				})();
			} else {
				return this.complete(displayMessage);
			}
		}

		/*
		Remove/destroy all connections
		*/
		dispose() {
			if (this.completed) {
				for (let con of Array.from(this.connections)) { con.dispose(); }

				this.completed.dispose();
				return this.completed = null;
			}
		}

		/*
		When everything is completed

		@param displayMessage <true>	Set if you want to display a message for when the upload is completed
		*/
		complete(displayMessage) {
			// Delete the revision file localy and complete :)
			return fs.unlink(this.revisionPath, err => {
				if (displayMessage) { console.log("Upload completed for ".green + `${this.server}`.bold.underline.green); }
				return this.completed.dispatch();
			});
		}


		// Change backslashes to forward slashes on Windows
		_normalize(str) { return path.normalize(str).replace(/\\+/g, "/"); }

		// Remove special chars
		_removeSpecialChars(str) { return str.replace(/[\W]/g, ""); }

		// Resolve User's home folder
		_resolveHomeFolder(str) {
			const homeFolder = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE);
			if (str.substr(0, 1) === "~") { return path.resolve(path.join(homeFolder, str.substr(1))); }
			return str;
		}
	};
	Deploy.initClass();
	return Deploy;
})());
