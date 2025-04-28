# xAPI/SCORM Course Uploader

A modern Node.js application for uploading, extracting, and launching SCORM, xAPI, cmi5, and AICC e-learning course packages. This project provides a beautiful, responsive web interface for managing and playing e-learning content in the browser.

## What does this project do?

- **Upload**: Users can upload zipped course packages (SCORM, xAPI, cmi5, or AICC).
- **Extract & Detect**: The server extracts the package, detects its type, and finds the correct launch file.
- **List**: All available courses are shown as cards in a modern, responsive grid.
- **Launch**: Courses can be launched in a new browser window/tab directly from the UI.
- **In-Browser Player**: Courses are played in the browser, with proper CORS and security headers for compatibility.

## Features

- Upload and extract xAPI, SCORM, AICC, and cmi5 packages
- Automatic detection of course type and launch file
- Modern, responsive frontend (HTML/CSS/JS)
- Courses displayed as cards with clean design
- Launch courses in a new window/tab
- Secure file handling and extraction
- Handles Articulate Storyline and other common e-learning formats

## How it works

1. **User uploads a course** (zip file) via the web interface.
2. **Server extracts** the zip, checks for key files (e.g. `imsmanifest.xml`, `tincan.xml`, `cmi5.xml`, AICC files), and determines the course type.
3. **Server finds the launch file** (e.g. `index.html`, `story.html`, or as specified in `tincan.xml`).
4. **Course is added to the list** and shown as a card in the UI.
5. **User can launch any course** by clicking its Launch button, which opens the course in a new window/tab.

## Technical Overview

- **Backend**: Node.js with Express. Handles uploads, extraction, course listing, and secure static file serving.
- **Frontend**: Pure HTML, CSS, and JavaScript. No frameworks required. Responsive and modern design.
- **Security**: Prevents directory traversal, sets CORS and security headers for e-learning compatibility.
- **Supported formats**: SCORM (with `imsmanifest.xml`), xAPI (with `tincan.xml`), cmi5 (with `cmi5.xml`), and AICC (with descriptor files).

## Directory Structure

- `/server.js` - Main server file. Handles all backend logic, uploads, extraction, and API endpoints. Well-commented for clarity.
- `/public` - All frontend files:
  - `index.html` - Main web page. Contains the UI for uploading and launching courses. Well-commented for structure.
  - `styles.css` - Modern, responsive styles for the UI. Well-commented for each section.
  - `scripts.js` - Handles all frontend logic (upload, list, launch). Well-commented for clarity.
- `/uploads` - Temporary storage for uploaded zip files (auto-created).
- `/courses` - Extracted course packages, each in its own folder (auto-created).

## Usage

1. Start the server:
   ```bash
   npm install
   npm start
   ```
2. Open your browser and go to `http://localhost:3000`
3. Upload a course package (zip file) and launch it from the UI.

## Course Package Requirements

- **SCORM**: Must include an `imsmanifest.xml` file
- **xAPI**: Must include a `tincan.xml` file
- **AICC**: Must include the 4 AICC descriptor files (AU, CRS, CST, & DES)
- **cmi5**: Must include a `cmi5.xml` file

## License

MIT 