// server.js
// Main server file for xAPI/SCORM Course Uploader
// This file sets up the Express server, handles uploads, extraction, course listing, and course launching.

// Import required modules
const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure required directories exist at startup
fs.ensureDirSync(path.join(__dirname, 'uploads'));
fs.ensureDirSync(path.join(__dirname, 'courses'));
fs.ensureDirSync(path.join(__dirname, 'sandbox'));

// --- CORS and Security Headers Middleware ---
// Handles CORS for all requests and applies special headers for Articulate Storyline content
app.use((req, res, next) => {
  console.log(`[CORS] Processing request for: ${req.path}`);
  
  // Set standard CORS headers for all requests
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Detect if this is Articulate Storyline content
  const isStorylineContent = req.path.includes('/story_content/') || 
                            req.path.includes('/mobile/') || 
                            req.path.endsWith('story.html') || 
                            req.path.endsWith('story_html5.html');
                            
  const isMediaFile = /\.(mp4|webm|mp3|wav|ogg|ogv|m4v|flv|f4v)$/i.test(req.path);
  
  // Set special headers for Articulate Storyline content
  if (isStorylineContent) {
    console.log(`[CORS] Applying Articulate Storyline specific headers for: ${req.path}`);
    
    // Security headers for improved cross-origin content loading
    res.header('Cross-Origin-Embedder-Policy', 'credentialless');
    res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Permissive CSP for Storyline content
    res.header('Content-Security-Policy', 
      "default-src * 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
      "script-src * 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "connect-src * 'self'; " +
      "img-src * data: blob: 'self'; " +
      "frame-src *; " +
      "style-src * 'self' 'unsafe-inline'; " +
      "font-src * 'self'; " +
      "media-src * blob: 'self';"
    );
  }
  
  // Add cache control headers for media files for better playback performance
  if (isMediaFile) {
    console.log(`[CORS] Setting cache headers for media file: ${req.path}`);
    res.header('Cache-Control', 'public, max-age=86400'); // 1 day cache
  }

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    console.log(`[CORS] Handling OPTIONS preflight request for: ${req.path}`);
    return res.status(200).end();
  }

  next();
});

// --- Express Middleware ---
// Enable CORS, JSON parsing, URL encoding, and file uploads
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
  optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
}));

// Serve static files from the public directory
app.use(express.static('public'));

// --- Special Middleware for Articulate Storyline Courses ---
// Ensures correct MIME types for media files
app.use('/courses', (req, res, next) => {
  // Make sure mp4 and media files are served with correct MIME types
  const filePath = req.path;
  
  if (filePath.endsWith('.mp4')) {
    res.setHeader('Content-Type', 'video/mp4');
  } else if (filePath.endsWith('.mp3')) {
    res.setHeader('Content-Type', 'audio/mpeg');
  } else if (filePath.endsWith('.webm')) {
    res.setHeader('Content-Type', 'video/webm');
  } else if (filePath.endsWith('.ogg')) {
    res.setHeader('Content-Type', 'audio/ogg');
  }
  
  // Let the static middleware handle the actual file serving
  next();
});

// Serve extracted course files with proper MIME types
app.use('/courses', express.static('courses', {
  setHeaders: (res, filePath) => {
    // Set additional headers for specific file types
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// --- ROUTES ---

// Home route - serves the main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Course launcher endpoint - opens course in a popup window or new tab
app.get('/launch/:courseId', (req, res) => {
  const courseId = req.params.courseId;
  const courseDir = path.join(__dirname, 'courses', courseId);
  
  if (!fs.existsSync(courseDir)) {
    return res.status(404).send('Course not found');
  }
  
  try {
    // First, check if tincan.xml exists to determine launch file
    const tincanPath = path.join(courseDir, 'tincan.xml');
    if (fs.existsSync(tincanPath)) {
      const tincanContent = fs.readFileSync(tincanPath, 'utf8');
      const launchMatch = tincanContent.match(/<launch.*?>(.+?)<\/launch>/);
      
      if (launchMatch && launchMatch[1]) {
        const launchFile = launchMatch[1].trim();
        console.log(`Found launch file in tincan.xml: ${launchFile}`);
        
        // Check if the launch file exists
        if (fs.existsSync(path.join(courseDir, launchFile))) {
          // Generate xAPI parameters
          const xapiParams = {
            actor: JSON.stringify({
              "name": ["SCORM Player User"],
              "account": [{
                "accountServiceHomePage": "http://localhost:" + PORT,
                "accountName": "scorm-player-user"
              }],
              "objectType": "Agent"
            }),
            endpoint: `http://localhost:${PORT}/xapi/${courseId}`,
            auth: `Basic ${Buffer.from(':' + crypto.randomBytes(16).toString('hex')).toString('base64')}`,
            content_token: crypto.randomBytes(16).toString('hex'),
            activity_id: `http://${courseId}`,
            registration: crypto.randomUUID().replace(/-/g, '')
          };
          
          const xapiQuery = new URLSearchParams(xapiParams).toString();
          const launchUrl = `/courses/${courseId}/${launchFile}?${xapiQuery}`;
          
          // Return HTML that opens the course in a popup window
          return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Launching Course</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                .launching { margin: 20px; }
                .spinner { 
                  width: 40px; 
                  height: 40px; 
                  border: 4px solid #f3f3f3; 
                  border-top: 4px solid #3498db; 
                  border-radius: 50%; 
                  animation: spin 1s linear infinite; 
                  margin: 20px auto;
                }
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              </style>
            </head>
            <body>
              <div class="launching">
                <h2>Launching Course...</h2>
                <div class="spinner"></div>
                <p>If the course doesn't open automatically, <a href="${launchUrl}" target="_blank">click here</a></p>
              </div>
              <script>
                window.onload = function() {
                  window.open('${launchUrl}', 'courseWindow', 
                    'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
                }
              </script>
            </body>
            </html>
          `);
        }
      }
    }
    
    // Fallback to common launch files if tincan.xml doesn't specify or file doesn't exist
    const commonLaunchFiles = [
      'index_lms.html',
      'index.html',
      'story.html',
      'presentation.html',
      'default.html'
    ];
    
    for (const file of commonLaunchFiles) {
      if (fs.existsSync(path.join(courseDir, file))) {
        return res.redirect(`/courses/${courseId}/${file}`);
      }
    }
    
    return res.status(404).send('No launch file found for this course');
    
  } catch (error) {
    console.error('Error launching course:', error);
    return res.status(500).send('Error launching course');
  }
});

// xAPI endpoint to receive statements (stub for LRS integration)
app.post('/xapi/:courseId', express.json({limit: '50mb'}), (req, res) => {
  const courseId = req.params.courseId;
  console.log(`[xAPI] Received statement for course ${courseId}:`, 
    req.body.verb ? req.body.verb.display : 'No verb');
  
  // In a real implementation, you would store these statements
  // For now, just acknowledge receipt
  res.status(200).json({
    success: true,
    message: 'Statement received'
  });
});

// Course listing endpoint - returns all available courses
app.get('/api/courses', async (req, res) => {
  try {
    const coursesDir = path.join(__dirname, 'courses');
    await fs.ensureDir(coursesDir);
    
    const items = await fs.readdir(coursesDir, { withFileTypes: true });
    const courses = items
      .filter(item => item.isDirectory())
      .map(dir => {
        const courseId = dir.name;
        const courseDir = path.join(coursesDir, courseId);
        
        // Determine course type
        let type = 'Unknown';
        if (fs.existsSync(path.join(courseDir, 'tincan.xml'))) {
          type = 'xAPI';
        } else if (fs.existsSync(path.join(courseDir, 'imsmanifest.xml'))) {
          type = 'SCORM';
        } else if (fs.existsSync(path.join(courseDir, 'cmi5.xml'))) {
          type = 'cmi5';
        }
        
        return {
          id: courseId,
          type: type,
          launchUrl: `/launch/${courseId}`
        };
      });
    
    res.json(courses);
  } catch (error) {
    console.error('Error listing courses:', error);
    res.status(500).json({ error: 'Failed to list courses' });
  }
});

// Upload course endpoint - handles file upload, extraction, and validation
app.post('/api/upload', async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }

    // Extract file information
    const courseFile = req.files.courseFile;
    const fileName = courseFile.name;
    const courseId = req.body.courseId || path.parse(fileName).name;
    
    console.log(`Processing upload for course ID: ${courseId}, filename: ${fileName}`);
    
    // Check if file is a zip
    if (!fileName.endsWith('.zip')) {
      return res.status(400).json({ error: 'Please upload a zip file.' });
    }

    // Set up directories
    const uploadsDir = path.join(__dirname, 'uploads');
    const coursesDir = path.join(__dirname, 'courses');
    const courseDir = path.join(coursesDir, courseId);
    
    console.log(`Ensuring directories: ${uploadsDir}, ${coursesDir}, ${courseDir}`);
    await fs.ensureDir(uploadsDir);
    await fs.ensureDir(coursesDir);
    
    // Save the zip file
    const zipPath = path.join(uploadsDir, fileName);
    console.log(`Saving uploaded file to: ${zipPath}`);
    await courseFile.mv(zipPath);
    
    // Clear and recreate course directory
    await fs.emptyDir(courseDir);
    
    // Extract the zip file
    console.log(`Extracting ZIP to: ${courseDir}`);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(courseDir, true);
    
    // List root files for debugging
    const rootFiles = await fs.readdir(courseDir);
    console.log('Files in root directory:', rootFiles);
    
    // Check for tincan.xml to determine launch file
    let launchFile = '';
    let courseType = 'Unknown';
    
    const tincanPath = path.join(courseDir, 'tincan.xml');
    if (fs.existsSync(tincanPath)) {
      courseType = 'xAPI';
      console.log('Found tincan.xml, analyzing content...');
      
      try {
        const tincanContent = fs.readFileSync(tincanPath, 'utf8');
        const launchMatch = tincanContent.match(/<launch.*?>(.+?)<\/launch>/);
        
        if (launchMatch && launchMatch[1]) {
          launchFile = launchMatch[1].trim();
          console.log(`Found launch file in tincan.xml: ${launchFile}`);
          
          // Verify launch file exists
          if (!fs.existsSync(path.join(courseDir, launchFile))) {
            console.log(`Warning: Launch file ${launchFile} specified in tincan.xml doesn't exist`);
            launchFile = ''; // Reset so we can use fallbacks
          }
        }
      } catch (error) {
        console.error('Error parsing tincan.xml:', error);
      }
    } else if (fs.existsSync(path.join(courseDir, 'imsmanifest.xml'))) {
      courseType = 'SCORM';
    } else if (fs.existsSync(path.join(courseDir, 'cmi5.xml'))) {
      courseType = 'cmi5';
    }
    
    // If we couldn't find a launch file from tincan.xml, use common fallbacks
    if (!launchFile) {
      const commonLaunchFiles = [
        'index_lms.html',
        'index.html',
        'story.html',
        'presentation.html',
        'default.html'
      ];
      
      for (const commonFile of commonLaunchFiles) {
        if (fs.existsSync(path.join(courseDir, commonFile))) {
          launchFile = commonFile;
          console.log(`Using common launch file: ${launchFile}`);
          break;
        }
      }
    }
    
    // If we still don't have a launch file, try to find any HTML file
    if (!launchFile) {
      // Helper function to find files with a specific extension
      const findFiles = async (dir, options) => {
        const files = [];
        const items = await fs.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            const subFiles = await findFiles(fullPath, options);
            files.push(...subFiles);
          } else if (options.extension && item.name.endsWith(options.extension)) {
            files.push(fullPath);
          }
        }
        
        return files;
      };
      
      const htmlFiles = await findFiles(courseDir, { extension: '.html' });
      if (htmlFiles.length > 0) {
        launchFile = path.relative(courseDir, htmlFiles[0]);
        console.log(`Using first HTML file as launch: ${launchFile}`);
      }
    }
    
    // If we still don't have a course type or launch file, return an error
    if (!launchFile) {
      await fs.remove(courseDir); // Clean up
      return res.status(400).json({ 
        error: 'Invalid course package. Could not find a launch file.'
      });
    }
    
    // Construct the final launch URL (ensuring proper path separators)
    const launchUrl = `/launch/${courseId}`;
    console.log(`Final launch URL: ${launchUrl}`);
    
    return res.json({
      success: true,
      courseId,
      launchUrl,
      type: courseType
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'An error occurred during upload and extraction: ' + error.message
    });
  }
});

// Serve course content (HTML, media, etc.) with security and MIME type handling
app.get('/courses/:id/*', async (req, res) => {
  try {
    const courseId = req.params.id;
    // Use path.normalize to prevent directory traversal attacks
    const relativePath = path.normalize(req.params[0] || '');
    const absolutePath = path.join(__dirname, 'courses', courseId, relativePath);
    
    console.log(`[CourseContent] Serving: ${absolutePath}`);
    console.log(`[CourseContent] User-Agent: ${req.headers['user-agent']}`);
    
    // Basic security check to prevent directory traversal
    const normalizedCoursePath = path.normalize(path.join(__dirname, 'courses', courseId));
    if (!absolutePath.startsWith(normalizedCoursePath)) {
      console.error(`[Security] Attempted directory traversal: ${absolutePath}`);
      return res.status(403).send('Forbidden');
    }

    // Check if file exists
    try {
      await fs.access(absolutePath);
    } catch (err) {
      console.error(`[Error] File not found: ${absolutePath}`);
      return res.status(404).send('File not found');
    }

    // Get file stats
    const stats = await fs.stat(absolutePath);
    
    // Detect if this is a directory request
    if (stats.isDirectory()) {
      // Redirect to index file if it exists
      const indexPath = path.join(absolutePath, 'index.html');
      try {
        await fs.access(indexPath);
        return res.redirect(`/courses/${courseId}/${relativePath}/index.html`);
      } catch (err) {
        // Try story.html
        const storyPath = path.join(absolutePath, 'story.html');
        try {
          await fs.access(storyPath);
          return res.redirect(`/courses/${courseId}/${relativePath}/story.html`);
        } catch (err) {
          // No index found
          return res.status(404).send('Directory index not found');
        }
      }
    }

    // Set appropriate MIME type
    const ext = path.extname(absolutePath).toLowerCase();
    let contentType = 'application/octet-stream'; // Default
    
    // Comprehensive MIME type mapping
    const mimeTypes = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'video/ogg',
      '.ogv': 'video/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'font/otf',
      '.swf': 'application/x-shockwave-flash',
      '.flv': 'video/x-flv',
      '.f4v': 'video/mp4',
      '.m4v': 'video/mp4',
      '.xap': 'application/x-silverlight-app',
      '.tincan': 'application/json',
      '.txt': 'text/plain',
    };

    if (mimeTypes[ext]) {
      contentType = mimeTypes[ext];
    }
    
    // Special handling for Articulate Storyline content
    const isStoryContent = absolutePath.includes('story_content') || 
                          absolutePath.includes('mobile') || 
                          absolutePath.endsWith('story.html') || 
                          absolutePath.endsWith('story_html5.html');
                          
    const isHTML5Content = absolutePath.includes('html5') || contentType === 'text/html';
    
    console.log(`[ContentType] ${absolutePath} -> ${contentType} (isStoryContent: ${isStoryContent}, isHTML5: ${isHTML5Content})`);
    
    // Handle video files and range requests (streaming support)
    const isVideo = /\.(mp4|webm|ogv|mov|m4v|f4v|flv)$/i.test(absolutePath);
    const isAudio = /\.(mp3|wav|ogg)$/i.test(absolutePath);
    const isMediaFile = isVideo || isAudio;
    
    if (isMediaFile) {
      console.log(`[Media] Processing media file: ${absolutePath}`);
      
      // Video files need special handling for streaming (range requests)
      const range = req.headers.range;
      
      // Set special headers for Articulate media
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', contentType);
      
      // If no range request, send entire file
      if (!range) {
        console.log(`[Media] Serving complete file (no range request): ${absolutePath}`);
        res.setHeader('Content-Length', stats.size);
        
        // Add custom headers for Articulate player
        if (isStoryContent) {
          res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache for media
        }
        
        // Stream the file
        const readStream = fs.createReadStream(absolutePath);
        readStream.on('error', (err) => {
          console.error(`[Error] Error streaming file: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).send('Error streaming file');
          }
        });
        return readStream.pipe(res);
      }
      
      // Parse range request
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      
      // Validate range request
      if (isNaN(start) || isNaN(end) || start < 0 || end >= stats.size || start > end) {
        console.error(`[Error] Invalid range request: ${range} for file size ${stats.size}`);
        res.setHeader('Content-Range', `bytes */${stats.size}`);
        return res.status(416).send('Range Not Satisfiable');
      }
      
      const chunkSize = end - start + 1;
      console.log(`[Media] Range request: ${start}-${end}/${stats.size} (${chunkSize} bytes)`);
      
      // Set response headers for range request
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
      res.setHeader('Content-Length', chunkSize);
      
      // Add custom headers for Articulate player if needed
      if (isStoryContent) {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache for media
      }
      
      // Stream the chunk
      const readStream = fs.createReadStream(absolutePath, { start, end });
      readStream.on('error', (err) => {
        console.error(`[Error] Error streaming file chunk: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).send('Error streaming file');
        }
      });
      return readStream.pipe(res);
    }
    
    // For non-media files, serve directly
    console.log(`[Serving] Regular file: ${absolutePath}`);
    
    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    
    // Add caching for static assets
    if (ext.match(/\.(css|js|jpg|jpeg|png|gif|webp|ico|woff|woff2|ttf|eot|otf)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
    }
    
    // Additional headers for Articulate content
    if (isStoryContent) {
      // HTML5 content may need specific headers
      if (isHTML5Content) {
        res.setHeader('Cache-Control', 'no-cache'); // Don't cache HTML
      }
    }
    
    // Stream the file
    const readStream = fs.createReadStream(absolutePath);
    readStream.on('error', (err) => {
      console.error(`[Error] Error streaming file: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).send('Error streaming file');
      }
    });
    return readStream.pipe(res);
  } catch (err) {
    console.error(`[Error] Unhandled error serving course content: ${err.message}`);
    res.status(500).send('Server error');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
});
