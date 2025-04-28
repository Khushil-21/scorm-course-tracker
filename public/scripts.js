document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const courseUploadForm = document.getElementById('courseUploadForm');
    const courseFileInput = document.getElementById('courseFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const overlay = document.getElementById('overlay');
    const launchSection = document.getElementById('launchSection');
    const displayCourseId = document.getElementById('displayCourseId');
    const displayCourseType = document.getElementById('displayCourseType');
    const launchBtn = document.getElementById('launchBtn');
    const coursePlayer = document.getElementById('coursePlayer');
    const courseFrame = document.getElementById('courseFrame');
    const closePlayer = document.getElementById('closePlayer');
    const playerTitle = document.getElementById('playerTitle');
    const coursesList = document.getElementById('coursesList');

    // Variables to store course data
    let currentCourse = {
        courseId: '',
        launchUrl: '',
        type: ''
    };

    // Display selected filename
    courseFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
        } else {
            fileNameDisplay.textContent = 'No file chosen';
        }
    });

    // Handle form submission
    courseUploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validate file input
        if (!courseFileInput.files.length) {
            alert('Please select a file to upload.');
            return;
        }
        
        // Check if the file is a zip
        const fileName = courseFileInput.files[0].name;
        if (!fileName.endsWith('.zip')) {
            alert('Please upload a zip file.');
            return;
        }
        
        // Show loading overlay
        overlay.classList.remove('hidden');
        
        // Create form data
        const formData = new FormData();
        formData.append('courseFile', courseFileInput.files[0]);
        
        // Add course ID if provided
        const courseIdInput = document.getElementById('courseId');
        if (courseIdInput.value.trim()) {
            formData.append('courseId', courseIdInput.value.trim());
        }
        
        try {
            // Send the upload request
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }
            
            // Store course data
            currentCourse = {
                courseId: data.courseId,
                launchUrl: data.launchUrl,
                type: data.type
            };
            
            // Update the launch section
            displayCourseId.textContent = data.courseId;
            displayCourseType.textContent = data.type;
            
            // Show launch section
            launchSection.classList.remove('hidden');
            
            // Scroll to launch section
            launchSection.scrollIntoView({ behavior: 'smooth' });
            
            // Refresh the course list
            checkExistingCourses();
            
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error: ' + error.message);
        } finally {
            // Hide loading overlay
            overlay.classList.add('hidden');
        }
    });
    
    // Launch course button handler 
    launchBtn.addEventListener('click', () => {
        if (currentCourse.courseId) {
            // Option 1: Use the direct launch URL received from the server
            launchCourse(currentCourse.launchUrl);
            
            // Option 2: Use the dedicated launch route (safer option)
            // launchCourse(`/launch/${currentCourse.courseId}`);
        }
    });
    
    // Function to launch the course
    function launchCourse(url) {

        // Open in a new tab instead of iframe
        window.open(url, '_blank');

        // Update iframe and course player
        courseFrame.src = url;
        
        // Set the course title if we have current course info
        if (currentCourse.courseId) {
            playerTitle.textContent = `${currentCourse.type} Course: ${currentCourse.courseId}`;
        }
        
        coursePlayer.classList.remove('hidden');
        
        // For debugging - try to detect if iframe content didn't load correctly
        courseFrame.addEventListener('load', () => {
            console.log('Course iframe loaded:', url);
            
            // Check if we got a 404 page or other error
            try {
                // This will throw an error if cross-origin, which is expected
                // and we can ignore that error
                const frameContent = courseFrame.contentDocument || courseFrame.contentWindow.document;
                console.log('Frame content available:', frameContent.title);
            } catch (e) {
                console.log('Frame is cross-origin, which is normal for course content');
            }
        });
        
        courseFrame.addEventListener('error', (e) => {
            console.error('Error loading course iframe:', e);
        });
    }
    
    // Close player
    closePlayer.addEventListener('click', () => {
        coursePlayer.classList.add('hidden');
        // Clear the iframe src to stop any running content
        courseFrame.src = '';
    });
    
    // Check if any courses are already uploaded and provide direct launch buttons
    async function checkExistingCourses() {
        try {
            const response = await fetch('/api/courses');
            if (!response.ok) {
                throw new Error('Failed to load courses');
            }
            
            const courses = await response.json();
            
            // Clear the courses list
            coursesList.innerHTML = '';
            
            if (courses && courses.length > 0) {
                console.log('Existing courses:', courses);
                
                // Create a card for each course
                courses.forEach(course => {
                    const courseCard = document.createElement('div');
                    courseCard.className = 'course-card';
                    
                    const courseTitle = document.createElement('div');
                    courseTitle.className = 'course-title';
                    courseTitle.textContent = course.id;
                    
                    const courseType = document.createElement('div');
                    courseType.className = 'course-type';
                    courseType.textContent = course.type;
                    
                    const launchButton = document.createElement('button');
                    launchButton.className = 'btn btn-success';
                    launchButton.textContent = 'Launch';
                    launchButton.addEventListener('click', () => {
                        // Update current course
                        currentCourse = {
                            courseId: course.id,
                            type: course.type,
                            launchUrl: course.launchUrl
                        };
                        
                        // Launch the course
                        launchCourse(course.launchUrl);
                    });
                    
                    courseCard.appendChild(courseTitle);
                    courseCard.appendChild(courseType);
                    courseCard.appendChild(launchButton);
                    
                    coursesList.appendChild(courseCard);
                });
            } else {
                coursesList.innerHTML = '<p>No courses available. Upload a course package to get started.</p>';
            }
        } catch (error) {
            console.log('Error loading courses:', error);
            coursesList.innerHTML = '<p>Error loading courses. Try refreshing the page.</p>';
        }
    }
    
    // Load existing courses when the page loads
    checkExistingCourses();
}); 