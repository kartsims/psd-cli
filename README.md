# PSD from CLI

Convert and preview Photoshop files using the CLI

## Requirements

This tool has no native dependencies (**no need for ImageMagick or even Photoshop**) thanks to the great work done by the folks of [PSD.js](https://www.npmjs.com/package/psd). Unfortunately, not all image modes and depths are supported *yet*.

You just need to have a recent version of NodeJS installed on your system.

## Install

```
npm install -g psd-cli
```

## Usage

### Single file conversion

```
psd path/to/my_psd_file.psd
# Creates path/to/my_psd_file.png
```

### Multiple file conversion

```
psd path/to/my_psd_file.psd another/psd_file.psd
# Creates path/to/my_psd_file.png and another/psd_file.png
```

### File conversion and opening

```
psd -o path/to/my_psd_file.psd
# Creates path/to/my_psd_file.png and opens it in your default image preview software
```

## Help

Full usage available by typing `psd --help` 

```
  Usage: psd [options] <file...>

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
    -o, --open     Preview file after conversion
```
