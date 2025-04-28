document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const courseUploadForm = document.getElementById('courseUploadForm');
    const courseFileInput = document.getElementById('courseFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const coursesList = document.getElementById('coursesList');
    const overlay = document.getElementById('overlay');
    const launchSection = document.getElementById('launchSection');
    const displayCourseId = document.getElementById('displayCourseId');
    const displayCourseType = document.getElementById('displayCourseType');
    const launchBtn = document.getElementById('launchBtn');
    const coursePopup = document.getElementById('coursePopup');
    const courseFrame = document.getElementById('courseFrame');
    const closePopup = document.getElementById('closePopup');
    const popupTitle = document.getElementById('popupTitle');
    
    // Current course data
    let currentCourse = null;
    
    // Load existing courses on page load
    loadExistingCourses();
    
    // File input change handler
    courseFileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            fileNameDisplay.textContent = this.files[0].name;
        } else {
            fileNameDisplay.textContent = 'No file chosen';
        }
    });
    
    // Form submission handler
    courseUploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (!courseFileInput.files.length) {
            alert('Please select a course file to upload');
            return;
        }
        
        const formData = new FormData();
        formData.append('courseFile', courseFileInput.files[0]);
        
        const courseId = document.getElementById('courseId').value.trim();
        if (courseId) {
            formData.append('courseId', courseId);
        }
        
        // Show overlay
        overlay.classList.remove('hidden');
        
        // Upload the course
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Hide overlay
            overlay.classList.add('hidden');
            
            if (data.success) {
                // Show success message
                alert(`Course uploaded successfully! Course ID: ${data.courseId}`);
                
                // Reset form
                courseUploadForm.reset();
                fileNameDisplay.textContent = 'No file chosen';
                
                // Reload courses list
                loadExistingCourses();
                
                // Show launch section with course info
                currentCourse = {
                    id: data.courseId,
                    type: data.type,
                    launchUrl: data.launchUrl
                };
                
                displayCourseInfo(currentCourse);
            } else {
                alert(`Error: ${data.error}`);
            }
        })
        .catch(error => {
            // Hide overlay
            overlay.classList.add('hidden');
            
            console.error('Error:', error);
            alert('An error occurred while uploading the course. Please try again.');
        });
    });
    
    // Launch button click handler
    launchBtn.addEventListener('click', function() {
        if (currentCourse) {
            // Open the course in a new window
            window.open(currentCourse.launchUrl, '_blank', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
            // Remove the popup from the DOM if it exists
            if (coursePopup) {
                coursePopup.remove();
            }
        }
    });
    
    // Close popup button click handler
    closePopup.addEventListener('click', function() {
        if (coursePopup) {
            coursePopup.remove();
        }
    });
    
    // Close popup when clicking outside the content
    coursePopup.addEventListener('click', function(e) {
        if (e.target === coursePopup) {
            if (coursePopup) {
                coursePopup.remove();
            }
        }
    });
    
    // Function to load existing courses
    function loadExistingCourses() {
        coursesList.innerHTML = '<p class="loading-courses">Loading courses...</p>';
        
        fetch('/api/courses')
            .then(response => response.json())
            .then(courses => {
                if (courses.length === 0) {
                    coursesList.innerHTML = '<p class="no-courses">No courses available. Upload a course to get started.</p>';
                    return;
                }
                
                const coursesHTML = courses.map(course => `
                    <div class="course-card">
                        <div class="course-info">
                            <h3>${course.id}</h3>
                            <p class="course-type">${course.type}</p>
                        </div>
                        <div class="course-actions">
                            <button class="btn btn-primary launch-course" data-course-id="${course.id}" data-course-type="${course.type}" data-launch-url="${course.launchUrl}">Launch</button>
                        </div>
                    </div>
                `).join('');
                
                coursesList.innerHTML = coursesHTML;
                
                // Add event listeners to launch buttons
                document.querySelectorAll('.launch-course').forEach(button => {
                    button.addEventListener('click', function() {
                        const courseId = this.getAttribute('data-course-id');
                        const courseType = this.getAttribute('data-course-type');
                        const launchUrl = this.getAttribute('data-launch-url');
                        currentCourse = {
                            id: courseId,
                            type: courseType,
                            launchUrl: launchUrl
                        };
                        // Open the course in a new window
                        window.open(launchUrl, '_blank', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
                        // Remove the popup from the DOM if it exists
                        if (coursePopup) {
                            coursePopup.remove();
                        }
                    });
                });
            })
            .catch(error => {
                console.error('Error loading courses:', error);
                coursesList.innerHTML = '<p class="error-message">Error loading courses. Please try again later.</p>';
            });
    }
    
    // Function to display course info in launch section
    function displayCourseInfo(course) {
        displayCourseId.textContent = course.id;
        displayCourseType.textContent = course.type;
        launchSection.classList.remove('hidden');
        
        // Scroll to launch section
        launchSection.scrollIntoView({ behavior: 'smooth' });
    }
}); 