let Generator;
const colors	= require("colors");
const fs 		= require("fs");
const path	= require("path");
const Signal	= require("signals");

module.exports = (Generator = class Generator {


	constructor() {
		let code;
		const packageConfig = require("../package.json");

		let usage  = `DPLOY v${packageConfig.version}\n`.bold;
		usage += "Command line tool to deploy websites using FTP/SFTP and git.\n\n".grey;

		usage += "Usage:\n";
		usage += `  dploy [${'environment(s)'.green}]\n\n`;

		usage += "Commands:\n";
		usage += `  install \t\t ${'# Install the dploy.yaml and the post-commit script'.grey}\n`;
		usage += `  -h, --help \t\t ${'# Show this instructions'.grey}\n\n`;
		usage += `  -v, --version \t\t ${'# Show the current version of DPLOY'.grey}\n\n`;

		usage += "Flags:\n";
		usage += `  -c, --catchup \t ${'# Upload only the revision file and nothing more'.grey}\n\n`;
		usage += `  -i, --ignore-include \t ${'# Ignore the files that are on your include list'.grey}\n\n`;

		usage += "Examples:\n";
		usage += `  dploy \t\t ${'# Deploy to the first environment on your dploy.yaml'.grey}\n`;
		usage += `  dploy dev \t\t ${'# Deploy to the environment \"dev\" on your dploy.yaml'.grey}\n`;
		usage += `  dploy dev stage \t ${'# Deploy to the environments \"dev\" and \"stage\" on your dploy.yaml'.grey}\n`;
		usage += `  dploy dev stage -i \t ${'# Deploy to the environments \"dev\" and \"stage\" on your dploy.yaml and ignore the \"include\" parameter'.grey}\n`;
		usage += `  dploy install \t ${'# Install dploy files'.grey}\n`;
		usage += `  dploy -h \t\t ${'# Show the instructions'.grey}`;

		console.log(usage);
		process.exit(code=0);
	}
});