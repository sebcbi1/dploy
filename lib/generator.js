/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let Generator;
const colors	= require("colors");
const fs 		= require("fs");
const path	= require("path");
const Signal	= require("signals");

module.exports = (Generator = class Generator {


	constructor() {
		this._generateConfig = this._generateConfig.bind(this);
		this._generatePostCommit = this._generatePostCommit.bind(this);
		this._dployCompleted = new Signal();
		this._dployCompleted.add(this._generatePostCommit);

		this._postCommitCompleted = new Signal();
		this._postCommitCompleted.add(this._completed);

		console.log("Installing ".yellow + "DPLOY".bold.yellow + "...".yellow);

		this._generateConfig();
	}

	_generateConfig() {
		const fileName = "dploy.yaml";

		if (!fs.existsSync(fileName)) {
			// If the file does not exist, copy the generator example to user's folder
			fs.createReadStream(path.resolve(__dirname, "../generator/dploy.yaml")).pipe(fs.createWriteStream(fileName));
		}

		return this._dployCompleted.dispatch();
	}


	// Generate the content of the post-commit hook
	_generatePostCommit() {
		// Ignore the installation if it's not a .git repository
		if (!fs.existsSync(".git")) { return this._postCommitCompleted.dispatch(); }
			
		const fileName = ".git/hooks/post-commit";
		let content	= fs.readFileSync(path.resolve(__dirname, "../generator/post-commit")).toString();

		// Check if the file already exists
		if (fs.existsSync(fileName)) {
			// If it does, read the content to see if the command already exists in the file
			const fileData = fs.readFileSync(fileName).toString();
			if (fileData.toLowerCase().indexOf("dploy") >= 0) {
				return this._postCommitCompleted.dispatch();
			}
			
			// Remove the bash import if it's already there
			if (fileData.indexOf("#!/bin/bash") >= 0) { content = content.replace(new RegExp("#!\/bin\/bash", "g"), ""); }
		}

		// Append the command to the file
		return fs.appendFile(fileName, content, error => {
			if (error) {
				console.log("Error:".bold.red, "The post-commit file could not be created. Check the permissions of the folder.".red);
				console.log(`\t ${error}`);
				return this._postCommitCompleted.dispatch();
			}

			fs.chmodSync(fileName, "0755");
			return this._postCommitCompleted.dispatch();
		});
	}
	
	_completed() {
		let code;
		console.log("Done!".bold.green + " Your project is ready to ".green + "DEPLOY".green.bold + " :) ".green);
		return process.exit(code=0);
	}
});