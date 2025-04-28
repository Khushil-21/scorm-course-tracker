// api/server.js
// Simplified version for Vercel serverless deployment

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

// Create an Express app
const app = express();

// In-memory storage for Vercel (since we can't use the filesystem)
const inMemoryCourses = new Map();

// Enable middleware
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
  optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware to handle CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// --- API Routes ---

// Course listing endpoint (returns in-memory courses)
app.get('/api/courses', (req, res) => {
  try {
    const courses = Array.from(inMemoryCourses.values());
    res.json(courses);
  } catch (error) {
    console.error('Error listing courses:', error);
    res.status(500).json({ error: 'Failed to list courses' });
  }
});

// Mock upload endpoint - in production, you would use S3 or another storage service
app.post('/api/upload', (req, res) => {
  try {
    // For Vercel, we'll just create a dummy course entry
    // In a real production app, you would upload to S3 or similar
    
    if (!req.body || !req.body.courseId) {
      return res.status(400).json({ error: 'Course ID is required.' });
    }
    
    const courseId = req.body.courseId;
    const courseType = req.body.courseType || 'SCORM';
    
    // Create demo course entry
    const course = {
      id: courseId,
      type: courseType,
      launchUrl: `/launch/${courseId}`
    };
    
    // Store in our in-memory map
    inMemoryCourses.set(courseId, course);
    
    return res.json({
      success: true,
      courseId,
      launchUrl: `/launch/${courseId}`,
      type: courseType,
      message: "Course uploaded. Note: On Vercel's serverless platform, files aren't stored persistently. For production, you would use S3 or a similar storage service."
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: 'An error occurred during upload: ' + error.message
    });
  }
});

// Launch endpoint stub
app.get('/launch/:courseId', (req, res) => {
  const courseId = req.params.courseId;
  const course = inMemoryCourses.get(courseId);
  
  if (!course) {
    return res.status(404).json({ error: 'Course not found' });
  }
  
  // Since we can't actually serve course files on Vercel, return a message
  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Course Launch</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
        .card { background: #f8f9fa; border-radius: 10px; padding: 20px; box-shadow: 0 2px 15px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Course: ${courseId}</h1>
        <p>Type: ${course.type}</p>
        <p><strong>Note:</strong> This is a demo deployment on Vercel's serverless platform. 
        In actual production, you would either:</p>
        <ul>
          <li>Use S3 or another storage service for course files</li>
          <li>Deploy to a server with persistent storage</li>
        </ul>
        <p>For a fully functional version with file storage, deploy to a regular server or modify the app to use cloud storage.</p>
      </div>
    </body>
    </html>
  `);
});

// Catch-all error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

// Export the Express API 
module.exports = app; 