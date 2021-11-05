let Generator;
const fs      = require("fs");
const Signal  = require("signals");

module.exports = (Generator = class Generator {


	constructor() {
		let code;
		const packageConfig = require("../package.json");

		console.log("v" + packageConfig.version);
		process.exit(code=0);
	}
});