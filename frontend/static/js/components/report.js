document.addEventListener('DOMContentLoaded', async () => {
    // Check URL or local storage
    const urlParams = new URLSearchParams(window.location.search);
    let scanId = urlParams.get('scan_id') || localStorage.getItem('diagnostix_scan_id');
    
    if (scanId && !urlParams.has('scan_id')) {
        window.history.replaceState({}, '', `/report?scan_id=${scanId}`);
    }

    if (!scanId) {
        document.querySelector('.report-body').innerHTML = `<p class="alert alert-danger" style="color:red; margin:2rem;">Error: No scan ID provided.</p>`;
        return;
    }

    // Modal elements
    const modal = document.getElementById('patient-modal');
    const form = document.getElementById('patient-form');
    const skipBtn = document.getElementById('modal-skip-btn');
    const pScanInput = document.getElementById('p-scan');

    // Display elements
    const findingsContainer = document.getElementById('findings-container');
    const loadingText = document.getElementById('loading-findings-text');
    const downloadBtn = document.getElementById('download-pdf-btn');

    // Current date
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    const reportIdSpan = document.getElementById('report-id-span');
    if (reportIdSpan) {
        reportIdSpan.textContent = `DX-${scanId.substring(0,8).toUpperCase()}`;
    }

    // Update the reference scan image
    const referenceImg = document.querySelector('.reference-image');
    if (referenceImg) {
        referenceImg.src = `/api/image/${scanId}`;
        referenceImg.onload = () => { referenceImg.style.display = 'block'; };
        referenceImg.onerror = () => {
            referenceImg.src = 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&q=80&w=600';
            referenceImg.style.display = 'block';
        };
    }

    // 1. Optimized Flow: Parallelize fetches and show modal faster
    (async function initReportPage() {
        console.time("report_init");
        try {
            // Kick off both requests in parallel
            console.log("Starting parallel API fetches...");
            console.time("scan_info_fetch");
            console.time("report_data_fetch");
            const scanInfoPromise = fetch(`/api/scan_info/${scanId}`).then(res => res.json());
            const reportDataPromise = fetch(`/api/report_data/${scanId}`).then(res => res.json());

            // Await the LIGHT status check first to show the modal ASAP
            const infoData = await scanInfoPromise;
            console.timeEnd("scan_info_fetch");
            
            if (infoData.file_ext) {
                pScanInput.value = infoData.file_ext;
            }

            if (!infoData.has_patient_info) {
                // If we're missing info, show the modal INSTANTLY
                console.log("Patient info missing. Showing modal immediately.");
                if (modal) modal.classList.add('active');
            } else {
                console.log("Patient info already exists. Pre-populating...");
            }

            // Always wait for and handle report data regardless of modal state
            const reportData = await reportDataPromise;
            console.timeEnd("report_data_fetch");
            
            if (!reportData.error) {
                populatePatientDetails(reportData.patient_info);
                renderFindings(reportData.report_findings);
                // If we already have info, hide modal (in case it was popped by slow info check)
                if (infoData.has_patient_info && modal) modal.classList.remove('active');
            }
            
            console.timeEnd("report_init");
        } catch (e) {
            console.error("Failed to initialize report page", e);
            console.timeEnd("report_init");
            if (modal) modal.classList.add('active');
        }
    })();

    // 2. Handle Modal Skip
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            if (modal) modal.classList.remove('active');
            generateReport();
        });
    }

    // 3. Handle Modal Submit
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const ptId = document.getElementById('p-id').value.trim();
            const ptAge = document.getElementById('p-age').value.trim();
            const ptGender = document.getElementById('p-gender').value;
            const ptScan = document.getElementById('p-scan').value.trim();
            const ptCondition = document.getElementById('p-condition').value.trim();

            if (skipBtn) skipBtn.disabled = true;
            const submitBtn = document.getElementById('modal-submit-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Saving...";
            }

            try {
                await fetch(`/api/save_patient_info/${scanId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        patient_id: ptId,
                        age: ptAge,
                        gender: ptGender,
                        scan_type: ptScan,
                        previous_condition: ptCondition
                    })
                });
                if (modal) modal.classList.remove('active');
                generateReport();
            } catch (err) {
                console.error(err);
                if (modal) modal.classList.remove('active');
                generateReport();
            }
        });
    }

    // 4. Generate & Fetch Report
    async function generateReport() {
        if (loadingText) loadingText.style.display = 'block';
        if (findingsContainer) findingsContainer.innerHTML = '';

        try {
            const response = await fetch(`/api/report_data/${scanId}`);
            const data = await response.json();
            
            if (loadingText) loadingText.style.display = 'none';

            if (data.error) {
                if (findingsContainer) findingsContainer.innerHTML = `<p class="alert alert-danger" style="color:red;">Report Generation Failed: ${data.error}</p>`;
                return;
            }

            // Always populate details from whatever the server has
            populatePatientDetails(data.patient_info);
            renderFindings(data.report_findings);

        } catch (err) {
            if (loadingText) loadingText.style.display = 'none';
            if (findingsContainer) findingsContainer.innerHTML = `<p class="alert alert-danger" style="color:red;">Network error connecting to backend.</p>`;
        }
    }

    function populatePatientDetails(info) {
        if (!info) return;
        const displayId = document.getElementById('display-id');
        const displayAgeGender = document.getElementById('display-age-gender');
        const displayScan = document.getElementById('display-scan');
        const displayCondition = document.getElementById('display-condition');

        if (displayId) displayId.textContent = info.patient_id || '—';
        
        if (displayAgeGender) {
            const ageStr = info.age ? `${info.age} yrs` : '';
            const genderStr = info.gender || '';
            const combined = [ageStr, genderStr].filter(Boolean).join(' / ');
            displayAgeGender.textContent = combined || '—';
        }
        
        if (displayScan) displayScan.textContent = info.scan_type || '—';
        if (displayCondition) displayCondition.textContent = info.previous_condition || '—';

        // Check if report is "Downloadable" (needs at least some detail)
        const hasSomeInfo = info.patient_id || info.age || (info.gender && info.gender !== "");
        if (downloadBtn) {
            if (hasSomeInfo) {
                downloadBtn.disabled = false;
                downloadBtn.removeAttribute('title');
            } else {
                downloadBtn.disabled = true;
                downloadBtn.title = "Please provide patient details to enable PDF download.";
            }
        }
    }

    function renderFindings(findings) {
        if (findings && findings.length > 0) {
            findings.forEach((finding, index) => {
                const div = document.createElement('div');
                div.className = `report-finding ${finding.level || 'warning'}`;
                
                const tagClass = finding.level === 'danger' ? 'tag-danger' : 
                                 finding.level === 'success' ? 'tag-success' : 'tag-warning';
                
                // Truncate description for collapsed view
                const fullText = finding.detailed_description || '';
                const truncateLength = 150;
                const needsTruncation = fullText.length > truncateLength;
                const truncatedText = needsTruncation ? fullText.substring(0, truncateLength) + '…' : fullText;
                const collapseId = `desc-${index}`;
                                 
                div.innerHTML = `
                    <div class="finding-head">
                        <span class="tag ${tagClass}">${finding.priority_label || 'Review'}</span>
                        <span class="finding-confidence">${finding.confidence_percentage}% Confidence</span>
                    </div>
                    <h5>${finding.title}</h5>
                    <div class="description-wrapper" id="${collapseId}">
                        <p class="description-text">${needsTruncation ? truncatedText : fullText}</p>
                        ${needsTruncation ? `<button class="desc-toggle" data-target="${collapseId}" data-full="${escapeAttr(fullText)}" data-short="${escapeAttr(truncatedText)}">Show more</button>` : ''}
                    </div>
                `;
                findingsContainer.appendChild(div);
            });

            // Attach toggle event listeners
            findingsContainer.querySelectorAll('.desc-toggle').forEach(btn => {
                btn.addEventListener('click', () => {
                    const wrapper = document.getElementById(btn.dataset.target);
                    const textEl = wrapper.querySelector('.description-text');
                    const isExpanded = btn.classList.contains('expanded');

                    if (isExpanded) {
                        textEl.textContent = btn.dataset.short;
                        btn.textContent = 'Show more';
                        btn.classList.remove('expanded');
                    } else {
                        textEl.textContent = btn.dataset.full;
                        btn.textContent = 'Show less';
                        btn.classList.add('expanded');
                    }
                });
            });
        } else {
            findingsContainer.innerHTML = `<p>No findings to report.</p>`;
        }
    }

    // PDF Download Logic
    downloadBtn.addEventListener('click', () => {
        // Temporarily expand all descriptions for printing
        const toggles = document.querySelectorAll('.desc-toggle:not(.expanded)');
        toggles.forEach(btn => btn.click());

        // Hide "Show more/less" buttons during PDF gen
        const togglesAll = document.querySelectorAll('.desc-toggle');
        togglesAll.forEach(btn => btn.style.display = 'none');

        const element = document.getElementById('pdf-report-content');
        const opt = {
            margin:       0.5,
            filename:     `DiagnostiX_Report_${scanId.substring(0,6).toUpperCase()}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        // Generate PDF
        html2pdf().set(opt).from(element).save().then(() => {
            // Restore "Show more/less" buttons
            togglesAll.forEach(btn => btn.style.display = 'inline-block');
        });
    });
});

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
