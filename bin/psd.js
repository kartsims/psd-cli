#!/usr/bin/env node

var PSD = require('psd');
var program = require('commander');
var cp = require('child_process');
var async = require('async');
var fileType = require('file-type');
var readChunk = require('read-chunk');
var chalk = require('chalk');
var fs = require('fs');

var filesProcessed = [];

// setup Commander program
program
  .version(require('../package.json').version)
  .arguments('<file...>')
  .option('-c, --convert', 'Convert to PNG file named <FILENAME>.png')
  .option('-t, --text', 'Extract text content to <FILENAME>.txt')
  .option('-f, --font', 'Extract font information to <FILENAME>.txt (triggers -t option)')
  .option('-o, --open', 'Preview file after conversion (triggers -c option)')
  .action(processFiles)
  .parse(process.argv);

// save PNG
function convertFile(filepath, psdPromise, cb) {
  var filePng = filepath.replace(/\.psd$/, '.png');

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

// extract text from PSD file
function extractTextFromFile(filepath, psdPromise, cb, includeFont) {
  var fileText = filepath.replace(/\.psd$/, '.txt');
  var fileString = '';

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
        if (includeFont) {
          fileString += '\n\nFont Family: ' + t.font.family;
          fileString += '\nFont Sizes: ' + t.font.sizes.map(function(size) {
            return size + 'px';
          }).join(', ');
          fileString += '\nFont Colors: ' + t.font.colors.join(', ');
        }
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
    // extract text data
    if (program.text || program.font) {
      asyncTasks.push(function(cb) {
        extractTextFromFile(filepath, psdPromise, cb, program.font);
      });
    }

    async.series(asyncTasks, cb);

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

        var colors = element.text.font.colors;

        for (var i = 0; i < colors.length; i++) {
          for (var j = 0; j < colors[i].length; j++) {
            colors[i][j] = Number(colors[i][j]).toString(16);
            if (colors[i][j].length < 2) {
              colors[i][j] = '0' + colors[i][j];
            }
          }
          colors[i] = '#' + colors[i].join('');
        }

        text.push({
          font: {
            colors: colors,
            family: element.text.font.name || null,
            sizes: element.text.font.sizes,
          },
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
