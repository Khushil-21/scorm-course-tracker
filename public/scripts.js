// public/scripts.js
// Handles all frontend logic for uploading, listing, and launching courses

document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    const courseUploadForm = document.getElementById('courseUploadForm');
    const courseFileInput = document.getElementById('courseFile');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const coursesList = document.getElementById('coursesList');
    const overlay = document.getElementById('overlay');
    const launchSection = document.getElementById('launchSection');
    const displayCourseId = document.getElementById('displayCourseId');
    const displayCourseType = document.getElementById('displayCourseType');
    const launchBtn = document.getElementById('launchBtn');
    // Popup is now removed, so no popup DOM references
    
    // Current course data (for launch section)
    let currentCourse = null;
    
    // Load existing courses on page load
    loadExistingCourses();
    
    // --- File input change handler ---
    // Updates the file name display when a file is selected
    courseFileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            fileNameDisplay.textContent = this.files[0].name;
        } else {
            fileNameDisplay.textContent = 'No file chosen';
        }
    });
    
    // --- Form submission handler ---
    // Handles course upload, shows overlay, and updates UI on success/error
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
        
        // Show overlay while uploading
        overlay.classList.remove('hidden');
        
        // Upload the course via API
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
    
    // --- Launch button click handler ---
    // Opens the course in a new window and removes any popup remnants
    launchBtn.addEventListener('click', function() {
        if (currentCourse) {
            window.open(currentCourse.launchUrl, '_blank', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
        }
    });
    
    // --- Load existing courses and display as cards ---
    function loadExistingCourses() {
        coursesList.innerHTML = '<p class="loading-courses">Loading courses...</p>';
        
        fetch('/api/courses')
            .then(response => response.json())
            .then(courses => {
                if (courses.length === 0) {
                    coursesList.innerHTML = '<p class="no-courses">No courses available. Upload a course to get started.</p>';
                    return;
                }
                // Render each course as a card with launch button
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
                
                // Add event listeners to launch buttons for each course card
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
                    });
                });
            })
            .catch(error => {
                console.error('Error loading courses:', error);
                coursesList.innerHTML = '<p class="error-message">Error loading courses. Please try again later.</p>';
            });
    }
    
    // --- Display course info in launch section ---
    function displayCourseInfo(course) {
        displayCourseId.textContent = course.id;
        displayCourseType.textContent = course.type;
        launchSection.classList.remove('hidden');
        // Scroll to launch section for user convenience
        launchSection.scrollIntoView({ behavior: 'smooth' });
    }
}); 