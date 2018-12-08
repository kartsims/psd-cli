#!/usr/bin/env node

var PSD = require('psd');
var program = require('commander');
var cp = require('child_process');
var async = require('async');
var fileType = require('file-type');
var readChunk = require('read-chunk');
var chalk = require('chalk');
var fs = require('fs');
var Path = require('path');
var filenamify = require('filenamify');
var mkdirp = require('mkdirp');

var filesProcessed = [];
var outputDir = null;

// setup Commander program
program
  .version(require('../package.json').version)
  .arguments('<file...>')
  .option('-c, --convert', 'Convert to PNG file named <FILENAME>.png')
  .option('-l, --layers', 'Convert layers to PNG files named <LAYER-NAME>.png')
  .option('-t, --text', 'Extract text content to <FILENAME>.txt')
  .option('-o, --open', 'Preview file after conversion (triggers -c option)')
  .option('-d, --dir <DIR>', 'Write output file(s) to <DIR>')
  .action(processFiles)
  .parse(process.argv);

// save PNG
function convertFile(filepath, psdPromise, cb) {
  var filePng = filepath.replace(/\.psd$/, '.png');

  if (outputDir) {
    filePng = Path.join(outputDir, Path.basename(filePng));
  }

  psdPromise.then(function(psd) {
    return psd.image.saveAsPng(filePng);
  }).then(function(err) {
    if (err) {
      console.log(chalk.red.bold("Error while saving %s"), filePng);
      return cb(err);
    }

    console.log(chalk.gray("PNG saved to %s"), filePng);
    filesProcessed.push(filePng);
    cb(null, filePng);
  });
}

// save layers to PNG
function convertLayers(filepath, psdPromise, cb) {
  var fileDir = Path.dirname(filepath);

  if (outputDir) {
    fileDir = outputDir;
  }

  try {
    psdPromise.then(function(psd) {
      psd.tree().descendants().forEach(function(node) {
        saveLayer(node, fileDir, cb);
      });
    });
  } catch (err) {
    console.log(
      chalk.red.bold('Error while extracting layers from %s'), filepath);
      return cb(err);
  }

  filesProcessed.push(filepath);
  cb(null, filepath);
}

// extract text from PSD file
function extractTextFromFile(filepath, psdPromise, cb) {
  var fileText = filepath.replace(/\.psd$/, '.txt');
  var fileString = '';

  if (outputDir) {
    fileText = Path.join(outputDir, Path.basename(fileText));
  }

  psdPromise.then(function(psd) {

    psd.tree().export().children.forEach(function(child) {
      var layer = new PSDLayer([], child);
      var text = layer.extractText();

      text.forEach(function(t) {
        if (typeof t.text !== 'string') {
          return;
        }
        fileString += '\n\n' + '---';
        fileString += '\n' + t.path.join(' > ');
        fileString += '\n' + '---';
        fileString += '\n\n' + t.text.replace(/\r/g, '\n');
      });
    });

    fs.writeFile(fileText, fileString, function(err) {
      if (err) {
        console.log(chalk.red.bold("Error while saving %s"), fileText);
        return cb(err);
      }

      console.log(chalk.gray("Text saved to %s"), fileText);
      filesProcessed.push(fileText);
      cb(null, fileText);
    });
  });
}

// here lies the PSD magic
function processFiles(files, env) {
  async.eachSeries(files, function(filepath, cb) {

    console.log("\nProcessing %s ...", filepath);

    try {
      var buffer = readChunk.sync(filepath, 0, 262);
      var type = fileType(buffer).ext;
      if (type != 'psd') {
        console.log(chalk.red.bold("%s is not a PSD file, type detected : %s"), filepath, type);
        return cb();
      }
    } catch (e) {
      console.log(chalk.red.bold("%s could not be opened with PSD library"), filepath);
      return cb();
    }

    var psdPromise = PSD.open(filepath);
    var asyncTasks = [];

    // convert file to PNG
    if (program.convert || program.open) {
      asyncTasks.push(function(cb) {
        convertFile(filepath, psdPromise, cb);
      });
    }
    if (program.layers) {
      asyncTasks.push(function(cb) {
        convertLayers(filepath, psdPromise, cb);
      });
    }
    // extract text data
    if (program.text) {
      asyncTasks.push(function(cb) {
        extractTextFromFile(filepath, psdPromise, cb);
      });
    }
    // set output directory
    if (program.dir) {
      outputDir = Path.resolve(program.dir);
    }

    if (program.dir) {
      // check that directory exists and is a directory
      try {
        if (fs.statSync(outputDir).isDirectory()) {
          async.series(asyncTasks, cb);
        } else {
          console.log(chalk.red.bold('%s is not a directory'), outputDir);
          return cb();
        }
      } catch (err) {
        if (err.code === 'ENOENT') {
          // make directory
          mkdirp(outputDir, function(error) {
            if (error) {
              console.log(chalk.red.bold('Error while creating %s'), outputDir);
              return cb();
            }

            console.log(chalk.gray('Created directory %s'), outputDir);
            async.series(asyncTasks, cb);
          });
        } else {
          console.log(chalk.red.bold('Error accessing %s'), outputDir);
          return cb();
        }
      }
    } else {
      async.series(asyncTasks, cb);
    }

  }, processDone);
}


function processDone(err, results) {
  if (err) {
    return console.log(chalk.red("\n\nError processing the files"), err);
  }

  console.log("\n\nThe following files have been created :");
  console.log(chalk.green("- %s"), filesProcessed.join("\n- "));

  if (program.open) {
    var commandLine = getCommandLine();
    console.log(chalk.gray("\nOpening PNG files using command-line tool '%s'"), commandLine);
    cp.spawn(commandLine, filesProcessed.filter(function(filepath){
      return filepath.match(/png$/);
    }), {
        detached: true
      })
      .unref();
  }
  console.log("\n");
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


function PSDLayer(path, element) {
  this.path = path.slice();
  this.path.push(element.name);

  var self = this;

  return {
    extractText: function() {
      var text = [];

      if (typeof element.text !== 'undefined' && element.text !== undefined) {
        text.push({
          path: self.path,
          text: element.text.value || null,
        });
      }

      if (typeof(element.children) !== 'undefined') {
        element.children.forEach(function(child) {
          var layer = new PSDLayer(self.path, child);
          var childText = layer.extractText();
          childText.forEach(function(t) {
            text.push(t);
          });
        });
      }

      return text;
    }
  }
}

function saveLayer(node, fileDir, cb) {

  if (node && node.hasChildren()) {
    node.children().forEach(function(child) {
      saveLayer(child, fileDir, cb);
    });
  } else if (node) {
    var filepath = Path.join(
      fileDir, filenamify(node.layer.name, {replacement: '-'}) + '.png');
    node.layer.image.saveAsPng(filepath).then(function(err) {
      if (err) {
        console.log(chalk.red.bold("Error while saving %s"), filepath);
      }

      console.log(chalk.gray("PNG saved to %s"), filepath);
    });
  }
}
