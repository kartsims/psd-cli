#!/usr/bin/env node

var PSD = require('psd');
var program = require('commander');
var cp = require('child_process');
var async = require('async');
var fileType = require('file-type');
var readChunk = require('read-chunk');
var chalk = require('chalk');

var filesProcessed = [];

// setup Commander program
program
  .version(require('../package.json').version)
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
      if (type != 'psd') {
        console.log(chalk.red.bold("%s is not a PSD file, type detected : %s"), file, type);
        return cb();
      }
    } catch (e) {
      console.log(chalk.red.bold("%s could not be opened with PSD library"), file);
      return cb();
    }

    var filePng = file.replace(/\.psd$/, '.png');

    PSD.open(file).then(function(psd) {
      return psd.image.saveAsPng(filePng);
    }).then(function(err) {
      console.log(chalk.gray("PNG saved to %s"), filePng);
      filesProcessed.push(filePng);
      return cb();
    });
  }, processDone);
}


function processDone(err) {
  if (err) {
    console.log(chalk.red("Error processing the files"), err);
  }

  console.log(chalk.green("Files processed successfully :\n- %s"), filesProcessed.join("\n- "));

  if (program.open) {
    var commandLine = getCommandLine();
    console.log(chalk.gray("Opening files command '%s'"), commandLine);
    cp.spawn(commandLine, filesProcessed, {
        detached: true
      })
      .unref();
  }
}

function getCommandLine() {
  switch (process.platform) {
    case 'darwin':
      return 'open';
    case 'win32':
      return 'start';
    case 'win64':
      return 'start';
    default:
      return 'xdg-open';
  }
}
