#!/usr/bin/env node

var PSD = require('psd');
var program = require('commander');
var cp = require('child_process');
var async = require('async');
var fileType = require('file-type');
var readChunk = require('read-chunk');

var filesProcessed = [];

// setup Commander program
program
  .version(require('./package.json').version)
  .arguments('<file...>')
  .option('-o, --open', 'Preview file after conversion')
  .action(processFiles)
  .parse(process.argv);


// here lies the PSD magic
function processFiles(files, env) {
  async.each(files, function(file, cb) {

    try {
      var buffer = readChunk.sync(file, 0, 262);
      var type = fileType(buffer).ext;
      if (type!='psd') {
        console.log(file, "is not a PSD file, type detected :", type);
        return cb();
      }
    }
    catch (e) {
      console.log(file, "could not be opened with PSD library");
      return cb();
    }

    var filePng = file.replace(/\.psd$/, '.png');

    PSD.open(file).then(function (psd) {
      return psd.image.saveAsPng(filePng);
    }).then(function (err) {
      console.log('PNG saved to', filePng);
      filesProcessed.push(filePng);
      return cb();
    });
  }, processDone);
}


function processDone(err) {
  if (err) {
    console.log("Error processing the files", err);
  }
  
  console.log("Files processed successfully", filesProcessed);

  if (program.open) {
    var commandLine = getCommandLine();
    console.log('Opening files command :', commandLine);
    cp.spawn(commandLine, filesProcessed, { detached: true })
      .unref();
  }
}

function getCommandLine() {
   switch (process.platform) { 
      case 'darwin' : return 'open';
      case 'win32' : return 'start';
      case 'win64' : return 'start';
      default : return 'xdg-open';
   }
}