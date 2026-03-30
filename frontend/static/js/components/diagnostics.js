// diagnostics.js — Real AI analysis progress with bounding box overlays
document.addEventListener('DOMContentLoaded', async () => {
    const findingsList = document.getElementById('findings-list');
    const anomaliesUl = document.querySelector('.anomalies');
    const statusText = document.getElementById('status-text');
    const statusPulse = document.getElementById('status-pulse');
    const scannerLine = document.getElementById('scanner-line');
    const scanOverlay = document.getElementById('scan-overlay');
    const reportBtn = document.getElementById('report-btn');
    
    // Get scan_id from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    let scanId = urlParams.get('scan_id') || localStorage.getItem('diagnostix_scan_id');
    
    // Update URL quietly to keep it shareable/clear if read from local storage
    if (scanId && !urlParams.has('scan_id')) {
        window.history.replaceState({}, '', `/diagnostics?scan_id=${scanId}`);
    }
    
    if (!scanId) {
        if(statusText) statusText.textContent = "Error: No scan ID provided.";
        if(statusPulse) statusPulse.className = 'pulse danger';
        stopAnimations();
        return;
    }

    const scanFilenameElement = document.getElementById('scan-filename');
    const diagnostixFilename = localStorage.getItem('diagnostix_filename') || 'Patient Scan';
    if (scanFilenameElement) {
        scanFilenameElement.textContent = diagnostixFilename;
    }
    
    // Update the image right away
    const scannedImage = document.getElementById('scanned-image');
    if (scannedImage) {
        // Try to get the locally cached preview for zero-latency display
        const localPreview = sessionStorage.getItem('diagnostix_preview');
        
        if (localPreview) {
            console.log("Using instant local preview cache.");
            scannedImage.src = localPreview;
            scannedImage.style.opacity = '1';
        } else {
            console.log("No local preview found, fetching from API...");
            scannedImage.onerror = () => {
                if (!scannedImage.dataset.fallback) {
                    scannedImage.dataset.fallback = 'true';
                    scannedImage.src = 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&q=80&w=800';
                }
            };
            scannedImage.src = `/api/image/${scanId}`;
        }
    }
    const startTime = Date.now();
    let progressInterval;
    const progressBar = document.getElementById('progress-bar');

    function startRealTimeProgress() {
        console.info("Progress engine started...");
        let currentProgress = 0;
        const speed = 30; // ms per update
        
        progressInterval = setInterval(() => {
            if (currentProgress < 35) {
                // Rapid start
                currentProgress += 0.8;
            } else if (currentProgress < 75) {
                // Steady processing
                currentProgress += 0.15;
            } else if (currentProgress < 92) {
                // Slowing down as it approaches completion (Gemini latency)
                currentProgress += 0.04;
            }
            
            if (progressBar) {
                progressBar.style.width = `${Math.min(currentProgress, 94)}%`;
            }
        }, speed);
    }

    function finishProgress() {
        console.info("Finishing progress bar...");
        clearInterval(progressInterval);
        if (progressBar) {
            progressBar.style.transition = 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
            progressBar.style.width = '100%';
        }
    }

    // Initialize progress immediately
    startRealTimeProgress();
    
    try {
        const responseData = await fetch(`/api/analyze/${scanId}`).then(res => res.json());
        
        // Ensure at least 2.5 seconds of scanning animation for continuity
        const elapsedTime = Date.now() - startTime;
        const minWait = 2500;
        const remainingTime = Math.max(0, minWait - elapsedTime);
        
        setTimeout(() => {
            finishProgress();
            stopAnimations();
            
            if (responseData.error) {
                if(statusText) statusText.textContent = `Analysis Failed: ${responseData.error}`;
                if(statusPulse) statusPulse.className = 'pulse danger';
                if(progressBar) {
                    progressBar.style.background = 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)';
                }
                const metaTag = document.querySelector('.scan-meta-tag');
                if (metaTag) {
                    metaTag.innerHTML = '<span id="scan-status-text">Failed</span>';
                    metaTag.style.background = 'rgba(239, 68, 68, 0.1)';
                    metaTag.style.color = '#ef4444';
                    metaTag.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                }
                return;
            }
            
            // Success
            if(statusText) statusText.textContent = 'Analysis Complete';
            if(statusPulse) statusPulse.className = 'pulse success';
            populateFindings(responseData);
        }, remainingTime);
        
    } catch (err) {
        clearInterval(progressInterval);
        stopAnimations();
        if(statusText) statusText.textContent = 'Network error fetching analysis.';
        if(statusPulse) statusPulse.className = 'pulse danger';
    }

    function populateFindings(data) {
        const metaTag = document.querySelector('.scan-meta-tag');
        if (metaTag) {
            // Smoothly transition from "computing" pulse to "complete" state
            metaTag.classList.remove('computing');
            metaTag.classList.add('complete');
            
            metaTag.innerHTML = `
                <svg class="icon-sm" style="display:inline-block; vertical-align:middle; margin-right:4px;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <span id="scan-status-text">Complete</span>
            `;
        }

        const rolloutDrawer = document.getElementById('results-rollout-drawer');
        if (rolloutDrawer) {
            // Tiny delay ensures DOM is ready for a smooth transition from 0fr height
            setTimeout(() => {
                rolloutDrawer.classList.add('open');
                
                // Auto-scroll to focus view on the top of the dashboard as it slides out
                setTimeout(() => {
                    rolloutDrawer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 400); // Wait for the "roll" to be clearly visible
            }, 50);
        }
        
        if (anomaliesUl && data.findings) {
            anomaliesUl.innerHTML = '';
            data.findings.forEach((finding, index) => {
                const li = document.createElement('li');
                li.className = `anomaly-item ${finding.level || 'warning'}`;
                const tagClass = finding.level === 'danger' ? 'tag-danger' : 
                                 finding.level === 'success' ? 'tag-success' : 'tag-warning';
                li.innerHTML = `
                    <div class="anomaly-header">
                        <span class="tag ${tagClass}">${finding.priority_label || 'Review'}</span>
                        <span class="confidence">${finding.confidence_percentage}%</span>
                    </div>
                    <p><strong>${finding.title}</strong> — ${finding.description}</p>
                `;
                
                // Highlight corresponding bounding box on hover
                li.addEventListener('mouseenter', () => {
                    const bbox = document.getElementById(`bbox-${index}`);
                    if (bbox) bbox.classList.add('bbox-highlight');
                });
                li.addEventListener('mouseleave', () => {
                    const bbox = document.getElementById(`bbox-${index}`);
                    if (bbox) bbox.classList.remove('bbox-highlight');
                });

                anomaliesUl.appendChild(li);
            });

            // ── Render Bounding Box Overlays on the Scan Image ──
            renderBoundingBoxes(data.findings);

            if(findingsList) {
                findingsList.style.transition = 'opacity 0.6s ease';
                findingsList.style.opacity = '1';
            }
        }
        if (reportBtn) {
            reportBtn.classList.remove('disabled');
            reportBtn.href = `/report?scan_id=${scanId}`;
        }
    }

    /**
     * Renders bounding box overlays on the scan image for each finding.
     * Uses normalized coordinates [x_min, y_min, x_max, y_max] (0–1).
     * Skips full-image boxes [0,0,1,1] (normal scans).
     */
    function renderBoundingBoxes(findings) {
        const scanWrapper = document.querySelector('.scan-wrapper');
        if (!scanWrapper) return;

        // Remove any existing bounding boxes (in case of re-render)
        scanWrapper.querySelectorAll('.bbox-overlay').forEach(el => el.remove());

        findings.forEach((finding, index) => {
            const bbox = finding.bounding_box;
            if (!bbox || bbox.length !== 4) return;

            // Skip full-image bounding box (normal scan indicator)
            const [xMin, yMin, xMax, yMax] = bbox;
            if (xMin === 0 && yMin === 0 && xMax === 1 && yMax === 1) return;

            const overlay = document.createElement('div');
            overlay.className = `bbox-overlay bbox-${finding.level || 'warning'}`;
            overlay.id = `bbox-${index}`;

            // Position using percentage-based coordinates
            overlay.style.left = `${xMin * 100}%`;
            overlay.style.top = `${yMin * 100}%`;
            overlay.style.width = `${(xMax - xMin) * 100}%`;
            overlay.style.height = `${(yMax - yMin) * 100}%`;

            // Create label
            const label = document.createElement('span');
            label.className = 'bbox-label';
            label.textContent = finding.title;
            overlay.appendChild(label);

            // Animate in with staggered delay
            overlay.style.animationDelay = `${index * 0.2}s`;

            scanWrapper.appendChild(overlay);
        });
    }
    
    function stopAnimations() {
        if (scannerLine) scannerLine.style.display = 'none';
        if (scanOverlay) {
            scanOverlay.style.animation = 'none';
            scanOverlay.style.background = 'transparent';
        }
    }
});
