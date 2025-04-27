# xAPI/SCORM Course Uploader

A Node.js application that allows you to upload and play SCORM, AICC, xAPI, or cmi5 course packages.

## Features

- Upload and extract xAPI, SCORM, AICC, and cmi5 packages
- Automatically detect course type and launch file
- Modern, responsive UI
- In-browser course player

## Requirements

- Node.js 14.x or higher
- npm or yarn

## Installation

1. Clone this repository or download the code
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Optionally enter a unique Course ID or leave blank for auto-generation
2. Click "Choose file" and select a course package (.zip file)
3. Click "Upload Course" to upload and process the package
4. Once processing is complete, click "Launch Course" to play the course

## Package Requirements

- **SCORM Package**: Must include an `imsmanifest.xml` file
- **xAPI Package**: Must include a `tincan.xml` file
- **AICC Package**: Must include the 4 AICC descriptor files (AU, CRS, CST, & DES)
- **cmi5 Package**: Must include a `cmi5.xml` file

## Directory Structure

- `/public` - Static frontend files
- `/uploads` - Temporary storage for uploaded zip files
- `/courses` - Extracted course packages

## License

MIT 