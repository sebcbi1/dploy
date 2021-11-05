/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let FTP;
const ftp		= require("ftp");
const Signal	= require("signals");

module.exports = (FTP = (function() {
	FTP = class FTP {
		static initClass() {
	
		
			this.prototype.connection	 = null;
			this.prototype.connected	 = null;
			this.prototype.failed		 = null;
			this.prototype.closed		 = null;
		}

		constructor() {
			this.connected	= new Signal();
			this.failed		= new Signal();
			this.closed		= new Signal();

			// Create a new instance of the FTP
			this.connection = new ftp();
			this.connection.on("error", () => this.failed.dispatch());
			this.connection.on("ready", () => this.connected.dispatch());
		}

		/*
		Connect to the FTP

		@param config <object> Configuration file for your connection
		*/
		connect(config) {
			return this.connection.connect({
				host			: config.host,
				port			: config.port,
				user			: config.user,
				password		: config.pass,
				secure			: config.secure,
				secureOptions	: config.secureOptions
			});
		}

		/*
		Close the connection
		*/
		close(callback) {
			this.connection.on("end", () => this.closed.dispatch());
			return this.connection.end();
		}

		/*
		Dispose
		*/
		dispose() {
			if (this.connected) {
				this.connected.dispose();
				this.connected = null;
			}

			if (this.failed) {
				this.failed.dispose();
				this.failed = null;
			}

			if (this.closed) {
				this.closed.dispose();
				return this.closed = null;
			}
		}

		/*
		Retrieve a file on the server

		@param path: <string> The path of your file
		@param callback: <function> Callback method
		*/
		get(path, callback) {
			return this.connection.get(path, callback);
		}

		/*
		Upload a file to the server

		@param local_path: <string> The local path of your file
		@param remote_path: <string> The remote path where you want your file to be uploaded at
		@param callback: <function> Callback method
		*/
		upload(local_path, remote_path, callback) {
			return this.connection.put(local_path, remote_path, callback);
		}

		/*
		Delete a file from the server

		@param remote_path: <string> The remote path you want to delete
		@param callback: <function> Callback method
		*/
		delete(remote_path, callback) {
			return this.connection.delete(remote_path, callback);
		}

		/*
		Create a directory

		@param path: <string> The path of the directory you want to create
		@param callback: <function> Callback method
		*/
		mkdir(path, callback) {
			return this.connection.mkdir(path, true, callback);
		}
	};
	FTP.initClass();
	return FTP;
})());


		