# PSD from CLI

Convert to PNG and extract text from Photoshop files using the CLI

## Requirements

This tool has no native dependencies (**no need for ImageMagick or even Photoshop**) thanks to the great work done by the folks of [PSD.js](https://www.npmjs.com/package/psd). Unfortunately, not all image modes and depths are supported *yet*.

You just need to have a recent version of NodeJS installed on your system.

## Install

```
npm install -g psd-cli
```

## Usage

### Convert a single file

```
psd path/to/my_psd_file.psd -c
# Creates path/to/my_psd_file.png
```

### Extract text from a single file

```
psd path/to/my_psd_file.psd -t
# Creates path/to/my_psd_file.txt
```

### Preview a single file

```
psd path/to/my_psd_file.psd -o
# Still creates path/to/my_psd_file.png
```

### Multiple file handling

```
psd *.psd -o
# Creates PNG files and opens them in your default image preview software
```

## Help

Full usage available by typing `psd --help` 

```
Usage: psd [options] <file...>

Options:

  -h, --help     output usage information
  -V, --version  output the version number
  -c, --convert  Convert to PNG file named <FILENAME>.png
  -t, --text     Extract text content to <FILENAME>.txt
  -o, --open     Preview file after conversion (triggers -c option)
```

## Upcoming features

The text extraction feature is still *experimental*. If you experience any issues with it, please let me know by filing an [issue on GitHub](https://github.com/kartsims/psd-cli/issues) and attach your PSD file.

There are many cool features available around PSD files. Most of them are covered by other NPM tools. Again, throw in an [issue on GitHub](https://github.com/kartsims/psd-cli/issues) to discuss about what would be useful to you.
