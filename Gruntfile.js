/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
module.exports = function(grunt) {

	// Load tasks
	Object.keys(require("./package.json").devDependencies).forEach(function(dep) { if (dep.substring(0,6) === "grunt-") { return grunt.loadNpmTasks(dep); } });

	// Project configuration
	grunt.initConfig({


		// Bump files
		bump: {
			options: {
				pushTo: "origin master"
			}
		},

		// Publish to NPM
		shell: {
			publish: {
				command: "npm publish"
			}
		},

	});


	grunt.registerTask("default", ["coffeelint", "coffee"]);
	return grunt.registerTask("release", "Release a new version, push it and publish", function(target) {
		if (target == null) { target = "patch"; }
		return grunt.task.run("coffeelint", `bump-only:${target}`, "coffee", "bump-commit", "shell:publish");
	});
};
