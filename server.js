const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Create required directories at startup
fs.ensureDirSync(path.join(__dirname, 'uploads'));
fs.ensureDirSync(path.join(__dirname, 'courses'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  createParentPath: true,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
}));

// Serve static files from public directory
app.use(express.static('public'));

// Serve extracted course files
app.use('/courses', express.static('courses'));

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Direct launch route for a specific course
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
          return res.redirect(`/courses/${courseId}/${launchFile}`);
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

// Debug route to check course files
app.get('/debug/courses/:courseId', async (req, res) => {
  const courseId = req.params.courseId;
  const courseDir = path.join(__dirname, 'courses', courseId);
  
  if (!fs.existsSync(courseDir)) {
    return res.status(404).json({ error: 'Course directory not found' });
  }
  
  try {
    // Get all files recursively
    const getFilesRecursively = async (dir) => {
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(dirents.map((dirent) => {
        const res = path.join(dir, dirent.name);
        return dirent.isDirectory() ? getFilesRecursively(res) : res;
      }));
      return Array.prototype.concat(...files);
    };
    
    const allFiles = await getFilesRecursively(courseDir);
    const relativeFiles = allFiles.map(file => path.relative(courseDir, file));
    
    // Check for specific file types
    const htmlFiles = relativeFiles.filter(file => file.endsWith('.html'));
    const xmlFiles = relativeFiles.filter(file => file.endsWith('.xml'));
    
    // Check tincan.xml if it exists
    let launchFile = null;
    const tincanPath = path.join(courseDir, 'tincan.xml');
    if (fs.existsSync(tincanPath)) {
      const tincanContent = fs.readFileSync(tincanPath, 'utf8');
      const launchMatch = tincanContent.match(/<launch.*?>(.+?)<\/launch>/);
      if (launchMatch && launchMatch[1]) {
        launchFile = launchMatch[1].trim();
      }
    }
    
    return res.json({ 
      courseId, 
      exists: true,
      rootFiles: fs.readdirSync(courseDir),
      htmlFiles,
      xmlFiles,
      launchFile,
      allFiles: relativeFiles
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Recursive function to find files by name or extension
async function findFiles(dir, options = {}) {
  const { extension, name, recursive = true } = options;
  const results = [];
  
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(dir, item.name);
      
      if (item.isFile()) {
        const fileName = item.name;
        const fileExt = path.extname(fileName).toLowerCase();
        
        if ((extension && fileExt === extension) || 
            (name && fileName === name)) {
          results.push(itemPath);
        }
      } else if (item.isDirectory() && recursive) {
        const subResults = await findFiles(itemPath, options);
        results.push(...subResults);
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error searching directory ${dir}:`, error);
    return results;
  }
}

// Upload course route
app.post('/upload', async (req, res) => {
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
    const launchUrl = `/courses/${courseId}/${launchFile.replace(/\\/g, '/')}`;
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

// API endpoint to list available courses
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
}); 