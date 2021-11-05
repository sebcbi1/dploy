/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DPLOY;
const colors	= require("colors");

const Deploy = require("./deploy");
const Generator = require("./generator");
const Help = require("./help");
const Version = require("./version");

module.exports = (DPLOY = (function() {
	DPLOY = class DPLOY {
		static initClass() {
	
			this.prototype.servers			 = null;
			this.prototype.connection		 = null;
			this.prototype.ignoreInclude	 = false;
			this.prototype.catchup			 = false;
		}

		/*
		DPLOY
		If you set a custom config file for DPLOY
		It will use this config instead of trying to load a dploy.yaml file
	
		@param 	config (optional)		Custom config file of a server to deploy at
		@param 	completed (optional)	Callback for when the entire proccess is completed
		*/
		constructor(config, completed) {
			// DPLOY if there's a custom config
			this.deploy = this.deploy.bind(this);
			this.config = config;
			this.completed = completed;
			if (this.config) {
				this.servers = [null];
				return this.deploy();
			// Call the DPLOY generator
			} else if (process.argv.indexOf("install") >= 0) {
				return new Generator();
			// Open the help
			} else if ((process.argv.indexOf("--help") >= 0) || (process.argv.indexOf("-h") >= 0)) {
				return new Help();
			// Print version
			} else if ((process.argv.indexOf("--version") >= 0) || (process.argv.indexOf("-v") >= 0)) {
				return new Version();
			// Deploy
			} else {
				this.servers = process.argv.splice(2, process.argv.length);
				// Check if we should ignore the include parameter for this deploy
				this.ignoreInclude = (this.servers.indexOf("-i") >= 0) || (this.servers.indexOf("--ignore-include") >= 0);
				// Check if we should catchup with the server and only upload the revision file
				this.catchup = (this.servers.indexOf("-c") >= 0) || (this.servers.indexOf("--catchup") >= 0);
				// Filter the flags from the server names
				this.servers = this._filterFlags(this.servers, ["-i", "--ignore-include", "-c", "--catchup"]);
				// If you don't set any servers, add an empty one to upload the first environment only
				if (this.servers.length === 0) { this.servers.push(null); }

				this.deploy();
			}
		}

		deploy() {
			// Dispose the current connection
			if (this.connection) {
				this.connection.dispose();
				this.connection = null;
			}

			// Keep deploying until all servers are updated
			if (this.servers.length) {
				this.connection = new Deploy(this.config, this.servers[0], this.ignoreInclude, this.catchup);
				this.connection.completed.add(this.deploy);
				this.servers.shift();
			// Finish the process
			} else {
				console.log("All Completed :)".green.bold);
				if (this.completed) {
					this.completed.call(this);
				} else {
					let code;
					process.exit(code=0);
				}
			}

			return this;
		}


		_filterFlags(servers, flags) {
			servers = servers.filter(function(value) {
				let valid = true;
				flags.forEach(function(flag) { if (flag === value) { return valid = false; } });
				return valid;
			});
			return servers;
		}
	};
	DPLOY.initClass();
	return DPLOY;
})());