// upload.js — File upload & preview interactions
document.addEventListener('DOMContentLoaded', () => {
    // Clear persistent state on home page refresh
    localStorage.removeItem('diagnostix_scan_id');
    localStorage.removeItem('diagnostix_filename');
    sessionStorage.removeItem('diagnostix_preview');
    
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    const imagePreview = document.getElementById('image-preview');
    const fileNameDisplay = document.getElementById('file-name');
    const removeBtn = document.getElementById('remove-file');
    const generateBtn = document.getElementById('generate-btn');

    // Click to open file dialog
    dropZone.addEventListener('click', (e) => {
        if (e.target !== removeBtn && !removeBtn.contains(e.target)) {
            fileInput.click();
        }
    });

    // Drag events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => {
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    // Generate button — works with or without file upload for demo
    generateBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (!fileInput.files.length) {
            alert('Please select or drag and drop a file before generating diagnostics.');
            return;
        }
        
        generateBtn.innerHTML = `
            <svg class="icon-sm spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"></path>
            </svg> Uploading…
        `;
        generateBtn.style.pointerEvents = 'none';
        
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            
            if (data.scan_id) {
                // Save state to persist across pages
                localStorage.setItem('diagnostix_scan_id', data.scan_id);
                window.location.href = `/diagnostics?scan_id=${data.scan_id}`;
            } else {
                alert('Upload failed: ' + data.error);
                resetGenerateBtn();
            }
        } catch (err) {
            alert('Error connecting to backend.');
            resetGenerateBtn();
        }
    });

    function resetGenerateBtn() {
        generateBtn.innerHTML = 'Generate Diagnostics';
        generateBtn.style.pointerEvents = 'auto';
    }

    function handleFile(file) {
        if (!file.type.startsWith('image/') && !file.name.endsWith('.dcm')) {
            alert('Please upload a supported image file (JPEG, PNG) or DICOM scan.');
            return;
        }

        fileNameDisplay.textContent = file.name;
        localStorage.setItem('diagnostix_filename', file.name);

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                imagePreview.src = dataUrl;
                previewContainer.style.display = 'flex';
                // Store for instant display on diagnostics page
                sessionStorage.setItem('diagnostix_preview', dataUrl);
                toggleHints(false);
            };
            reader.readAsDataURL(file);
        } else {
            previewContainer.style.display = 'flex';
            toggleHints(false);
        }
    }

    // Remove file
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.value = '';
        previewContainer.style.display = 'none';
        imagePreview.src = '';
        toggleHints(true);
    });

    function toggleHints(show) {
        const display = show ? 'block' : 'none';
        const icon = dropZone.querySelector('.upload-icon-wrapper');
        const h3 = dropZone.querySelector('h3');
        const ps = dropZone.querySelectorAll(':scope > p');
        if (icon) icon.style.display = show ? 'block' : 'none';
        if (h3) h3.style.display = display;
        ps.forEach(p => p.style.display = display);
    }
});

// Inject spinner keyframe
const style = document.createElement('style');
style.textContent = `
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.spinner { animation: spin 0.8s linear infinite; }
`;
document.head.appendChild(style);
