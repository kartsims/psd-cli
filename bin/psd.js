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
  .option('-l, --layer', 'Convert layer to PNG file named <FILENAME>/<LAYERNAME>.png')
  .option('-t, --text', 'Extract text content to <FILENAME>.txt')
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

function extractLayerFromFile(filepath, psdPromise, cb) {
  	var filedir = filepath.replace(/\.psd$/, '');	
	var start = new Date(); 	
        if (!fs.existsSync(filedir)){
    		fs.mkdirSync(filedir);
	}

	psdPromise.then(function(psd) {
	  psd.tree().descendants().forEach(function (node) {
	    if ( node.isGroup() ) return true;
            if (typeof node.text !== 'undefined' ) return true;
            if ( node.visible() ) { 
	    	node.saveAsPng(filedir+"/" + node.name.replace(/[^a-z0-9]/gi, '_').replace(/(_{2,})/gi, '_')+ ".png").catch(function (err) {
	     	 console.log(err.stack);
	    	});
	    }
	  });
	}).then(function () {
	  console.log("Finished in " + ((new Date()) - start) + "ms");
	}).catch(function (err) {
	  console.log(err.stack);
	});
}

// extract text from PSD file
function extractTextFromFile(filepath, psdPromise, cb) {
  var fileText = filepath.replace(/\.psd$/, '.txt');
  var fileString = '';
  var summarizeFonts = {};
  var summarizeFontsColor = {};
  var summarizeFontsSizes = {};
  psdPromise.then(function(psd) {

    psd.tree().export().children.forEach(function(child) {
      var layer = new PSDLayer([], child);
      var text = layer.extractText();

      text.forEach(function(t) {
        fileString += '\n\n' + '---';
        fileString += '\n' + t.path.join(' > ');
        fileString += '\n' + '---';
        fileString += '\n\n' + t.text.replace(/\r/g, '\n');
        fileString += '\n\n' + t.fontinfo.replace(/\r/g, '\n');
        summarizeFonts[t.font.name] = t.font.name;
        summarizeFontsColor[t.font.colors] = t.font.colors;
        summarizeFontsSizes[t.font.sizes] = t.font.sizes;
      });
    });
    fileString += '\n\n' + '===== SUMMARY =====';
    fileString += '\n' + 'FONTS: '+Object.keys(summarizeFonts).join(", ");
    fileString += '\n' + 'FONTS COLORS: '+Object.keys(summarizeFontsColor).join(" ");
    fileString += '\n' + 'FONTS SIZES: '+Object.keys(summarizeFontsSizes).join(" ");

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

    // convert layer to PNG
    if (program.layer) {
      asyncTasks.push(function(cb) {
        extractLayerFromFile(filepath, psdPromise, cb);
      });
    }

    // extract text data
    if (program.text) {
      asyncTasks.push(function(cb) {
        extractTextFromFile(filepath, psdPromise, cb);
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
  var convertPtToPx= function (pt) {
   var px = pt * 96 / 72;
   return Math.round((px*100))*0.01;
  };

  return {
    extractText: function() {
      var text = [];

      if (typeof element.text !== 'undefined' && element.text !== undefined) {
        
/*
samples:
{"name":"Novecentosanswide-Bold","sizes":[12.5,12.5,12.5,12.5],"colors":[[19,62,89,255],[19,62,89,255],[19,62,89,255],[19,62,89,255]],"alignment":["center","center","center","center"]}
*/
        var f = element.text.font;
	font = {};
        font.name = f.name ;
	font.sizes = convertPtToPx(f.sizes[0]);
	font.colors = 'rgba('+f.colors[0].join(', ')+')';
        font.alignment = f.alignment[0];

        text.push({
          path: self.path,
          text: element.text.value || null,
          font: font,
          fontinfo: JSON.stringify(font) || null
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
