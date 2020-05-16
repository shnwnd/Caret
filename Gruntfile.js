module.exports = function(grunt) {

  var exec = require("child_process").exec;
  var path = require("path");
  var fs = require("fs");
  var Zip = require("jszip");

  grunt.loadNpmTasks("grunt-contrib-less");
  grunt.loadNpmTasks("grunt-contrib-watch");

  grunt.initConfig({
    less: {
      light: {
        files: {
          "css/caret.css": "css/seed.less",
          "css/caret-twilight.css": "css/seed-twilight.less",
          "css/caret-dark.css": "css/seed-dark.less"
        }
      }
    },
    watch: {
      css: {
        files: ["css/*.less"],
        tasks: ["less"]
      },
      options: {
        spawn: false
      }
    },
    copy:  [
      "config/**",
      "_locales/**",
      "js/**",
      "css/*.css",//leave the LESS behind
      "**/*.html",//both main.html and the templates
      "templates/*",
      "require.js",
      "background.js",
      "installer.js",
      "./*.png", //in case we add images at some point
      "!node_modules/**"
    ]
  });

  grunt.registerTask("default", ["less", "watch"]);
  grunt.registerTask("prep", ["less", "cleanup", "copyUnpacked"]);
  grunt.registerTask("package", ["prep", "chrome", "webstore", "compress:store"]);
  grunt.registerTask("store", ["prep", "webstore", "compress:store"]);
  grunt.registerTask("crx", ["prep", "chrome"]);

  grunt.registerTask("copyUnpacked", "Copies files to the build directory", function() {
    var srcPatterns = grunt.config.get("copy");
    var files = grunt.file.expandMapping(srcPatterns, "./build/unpacked", {
      filter: "isFile"
    });
    files.forEach(function(f) {
      grunt.file.copy(f.src[0], f.dest);
    });
  });

  grunt.registerTask("compress", "Generates the store .zip file", function() {
    var zipfile = new Zip();
    var files = grunt.file.expand({ filter: "isFile", cwd: "./build/unpacked" }, "**/*");
    files.forEach(function(file) {
      var buffer = fs.readFileSync(path.join("./build/unpacked", file));
      zipfile.file(file, buffer);
    });
    var zipped = zipfile.generate({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 8 }
    });
    fs.writeFileSync("./build/caret.zip", zipped);
  });

  grunt.registerTask("chrome", "Makes a new CRX package", function() {
    var manifest = JSON.parse(fs.readFileSync("./manifest.json"));
    manifest.icons["128"] = "icon-128-inverted.png";
    fs.writeFileSync("./build/unpacked/manifest.json", JSON.stringify(manifest, null, 2));

    //perform the Chrome packaging
    var c = this.async();
    var here = fs.realpathSync(__dirname);

    var chrome = {
      win32: '"' + (process.env["ProgramFiles(x86)"] || process.env.ProgramFiles) + "\\Google\\Chrome\\Application\\chrome.exe" + '"',
      linux: "/opt/google/chrome/google-chrome",
      osx: "/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome"
    };

    var cmd = [ chrome[process.platform] ];
    cmd.push("--pack-extension=" + path.join(here, "build/unpacked"));
    cmd.push("--pack-extension-key=" + path.join(here, "../Caret.pem"));
    cmd = cmd.join(" ");
    exec(cmd,function(err, out, stderr) {
      if (err) {
        console.log("Unable to run Chrome for CRX packaging.");
        return c();
      }
      fs.renameSync("./build/unpacked.crx", "./build/Caret.crx");
      c();
    });
  });

  grunt.registerTask("webstore", "Prepares the manifest for the web store", function() {
    var manifest = JSON.parse(fs.readFileSync("./manifest.json"));
    delete manifest.update_url;
    delete manifest.key;
    manifest = JSON.stringify(manifest, null, 2);
    fs.writeFileSync("./build/unpacked/manifest.json", manifest);
  });

  grunt.registerTask("cleanup", "Removes the build/unpacked directory", function() {
    var c = this.async();
    exec("rm -rf ./build/*", c);
  });

  grunt.registerTask("checkLocale", "Finds unregistered strings for a given locale; checkLocale:XX for a language code XX", function(language) {
    var english = require("./_locales/en/messages.json");
    var other = require(`./_locales/${language}/messages.json`);
    console.log(`Checking ${language} against English string file`);
    for (var k in english) {
      if (!(k in other)) {
        console.log(`- Missing string: ${k}`);
      }
    }
  })

};
