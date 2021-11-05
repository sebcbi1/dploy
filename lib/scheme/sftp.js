/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let SFTP;
const { Client }	= require("ssh2");
const Signal	= require("signals");
const fs 		= require("fs");

module.exports = (SFTP = (function() {
	SFTP = class SFTP {
		static initClass() {
	
		
			this.prototype.sftp 		 = null;
			this.prototype.connection	 = null;
			this.prototype.connected	 = null;
			this.prototype.failed		 = null;
			this.prototype.closed		 = null;
			this.prototype.closing 	 = null;
		}

		constructor() {
			this.connected	= new Signal();
			this.failed		= new Signal();
			this.closed		= new Signal();
			this.closing 	= false;

			// Create a new instance of the FTP
			this.sftp = new Client();
			this.sftp.on("error", (err) => { if (!this.closing) { return this.failed.dispatch(); } });
			this.sftp.on("close", hadError => {
				if (this.hadError) {
					if (!this.closing) { return this.failed.dispatch(); }
				}
			});
			this.sftp.on("ready", () => {
				return this.sftp.sftp((error, connection) => {
					if (error) { return this.failed.dispatch(); }

					this.connection = connection;
					return this.connected.dispatch();
				});
			});
		}

		/*
		Connect to the FTP
		@param config <object> Configuration file for your connection
		*/
		connect(config) {
			return this.sftp.connect({
				host		: config.host,
				port		: config.port,
				username	: config.user,
				password	: config.pass,
				privateKey	: config.privateKey,
				publicKey	: config.publicKey,
				passphrase	: config.passphrase
			});
		}

		/*
		Close the connection
		*/
		close(callback) {
			if (this.closing) { return; }
			this.closing = true;

			this.sftp.on("end", () => this.closed.dispatch());
			return this.sftp.end();
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
			return this.connection.readFile(path, "utf-8", callback);
		}

		/*
		Upload a file to the server

		@param local_path: <string> The local path of your file
		@param remote_path: <string> The remote path where you want your file to be uploaded at
		@param callback: <function> Callback method
		*/
		upload(local_path, remote_path, callback) {
			return this.connection.fastPut(local_path, remote_path, callback);
		}

		/*
		Delete a file from the server

		@param remote_path: <string> The remote path you want to delete
		@param callback: <function> Callback method
		*/
		delete(remote_path, callback) {
			// Split the path of the file
			let i = remote_path.lastIndexOf("/");
			const paths = [];
			while (i > 0) {
				const content = remote_path.slice(0, i);
				paths.push(content);
				i = content.lastIndexOf("/");
			}

			return this.connection.unlink(remote_path, error => {
				if (error) { return callback.apply(this, [error]); }
				return this._rdelete(paths, callback);
			});
		}

		/*
		@private
		Delete directories recursively
		*/
		_rdelete(paths, callback) {
			const path = paths.shift();
			return this.connection.opendir(path, (error, handle) => { // Open the directory
				if (error) { return callback.apply(this, [error]); }

				return this.connection.readdir(handle, (error, list) => { // Read the directory
					if (error || (paths.length === 0)) { return callback.apply(this, [error]); } // If any errors reading the folder, just call the callback
					if (list.length <= 2) { // 2 because it includes the "." and ".."
						return this.connection.rmdir(path, error => { // Remove the directory if the directory is empty
							if (error || (paths.length === 0)) { return callback.apply(this, [error]); } // If any errors reading the folder, just call the callback
							return this._rdelete(paths, callback);
						}); // Keep cleaning the rest
					} else {
						return callback.apply(this, [error]);
					}
				});
			});
		}


		/*
		Create a directory

		@param path: <string> The path of the directory you want to create
		@param callback: <function> Callback method
		*/
		mkdir(path, callback) {
			let i = path.length;
			const paths = [];
			while (i > 0) {
				const content = path.slice(0, i);
				paths.push(content);
				i = content.lastIndexOf("/");
			}

			return this._rmkdir(paths, callback);
		}

		/*
		@private
		Create directories recursively
		*/
		_rmkdir(paths, callback) {
			const path = paths.pop();
			return this.connection.opendir(path, (error, handle) => {
				if (error) {
					return this.connection.mkdir(path, error => {
						if (error || (paths.length === 0)) { return callback.apply(this, [error]); }
						return this._rmkdir(paths, callback);
					});
				} else {
					if (paths.length === 0) { return callback.apply(this, [undefined]); }
					return this._rmkdir(paths, callback);
				}
			});
		}
	};
	SFTP.initClass();
	return SFTP;
})());
