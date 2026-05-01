document.addEventListener("DOMContentLoaded", function () {

    function animateCounter(element, target) {
        let start = 0;
        const duration = 800; 
        const increment = target / (duration / 16);

        function updateCounter() {
            start += increment;

            if (start >= target) {
                element.textContent = target;
            } else {
                element.textContent = Math.floor(start);
                requestAnimationFrame(updateCounter);
            }
        }

        updateCounter();
    }

    const isAuthority = localStorage.getItem("authority_logged_in") === "true";
    const authorityName = localStorage.getItem("authority_name") || "Authority";

    // --- Authority Sidebar State ---
    const loginLink = document.getElementById("authority-login-link");
    const logoutSection = document.getElementById("authority-logout-section");
    const logoutBtn = document.getElementById("logoutBtn");

    if (isAuthority) {
        if (loginLink) loginLink.style.display = "none";
        if (logoutSection) {
            logoutSection.style.display = "block";
            // Update the label to show the logged-in authority's name
            const label = logoutSection.querySelector("div");
            if (label) label.textContent = `Logged in as ${authorityName}`;
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            localStorage.removeItem("authority_logged_in");
            localStorage.removeItem("authority_name");
            localStorage.removeItem("authority_email");
            localStorage.removeItem("authority_department");
            window.location.href = "index.html";
        });
    }

    // --- Authority Signup Logic ---
    function showError(message) {
        const errorEl = document.getElementById("signupError");
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = "block";
        }
    }

    const signupBtn = document.getElementById("signupBtn");
    if (signupBtn) {
        signupBtn.addEventListener("click", async function (event) {
            event.preventDefault();

            const name = document.getElementById("name").value.trim();
            const email = document.getElementById("email").value.trim();
            const department = document.getElementById("department").value.trim();
            const city = document.getElementById("city").value.trim();
            const password = document.getElementById("password").value.trim();

            const successEl = document.getElementById("signupSuccess");
            const errorEl = document.getElementById("signupError");
            
            if (errorEl) errorEl.style.display = "none";
            if (successEl) successEl.style.display = "none";

            if (!name || !email || !department || !city || !password) {
                showError("Please fill in all fields.");
                return;
            }

            const options = {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    department: department,
                    city: city,
                    password: password
                })
            };

            try {
                const response = await fetch("http://127.0.0.1:8000/authority/signup", options);

                const data = await response.json();

                if (!response.ok) {
                    showError(data.detail || "Signup failed");
                    return;
                }

                window.location.href = "authority_login.html";

            } catch (error) {
                console.error("Signup error:", error);
                showError("Server connection failed. Check backend.");
            }
        });
    }

    const form = document.getElementById("reportForm");

    if (form) {
        form.addEventListener("submit", async function (event) {

            event.preventDefault(); // stop page reload

            const title = document.getElementById("title").value;
            const description = document.getElementById("description").value;
            const location = document.getElementById("location").value;

            try {
                const formData = new FormData();
                formData.append("title", title);
                formData.append("description", description);
                formData.append("location", location);

                const lat = document.getElementById("latitude")?.value;
                const lng = document.getElementById("longitude")?.value;
                if (lat && lng) {
                    formData.append("latitude", lat);
                    formData.append("longitude", lng);
                }

                const imageFile = document.getElementById("image").files[0];
                if (imageFile) {
                    formData.append("image", imageFile);
                }

                const response = await fetch("http://127.0.0.1:8000/report-issue", {
                    method: "POST",
                    body: formData
                });

                const data = await response.json();

                // Handle duplicate detection response
                if (data.duplicate === true) {
                    alert(
                        `⚠️ Similar issue already reported!\n\n` +
                        `"${data.existing_issue_title}" has already been reported at this location.\n\n` +
                        `This report has been counted as community support (${data.support_count} citizen(s) agree).\n\n` +
                        `Please visit the Issues page to view and support the existing report.`
                    );
                    form.reset();
                    return;
                }

                if (response.ok) {
                    alert("Issue submitted successfully!");
                    form.reset();
                } else {
                    alert("Failed to submit issue");
                }

            } catch (error) {

                alert("Server connection error");

            }

        });
    }

    // Logic for loading issues on the dashboard
    const issuesContainer = document.getElementById("issues-container");
    const analyticsChart = document.getElementById("issuesChart"); // trigger load on analytics page
    const mapContainer = document.getElementById('issuesMap'); // trigger load on map page
    let chartInstance = null; // track Chart.js instance for updates

    if (issuesContainer || document.getElementById("recent-issues-container") || analyticsChart || mapContainer) {
        fetchIssues();
    }

    async function fetchIssues() {
        try {
            const isDashboard = document.getElementById("recent-issues-container") !== null;
            const targetContainer = isDashboard ? document.getElementById("recent-issues-container") : issuesContainer;

            const response = await fetch("http://127.0.0.1:8000/issues");
            if (!response.ok) {
                console.error("Failed to load issues");
                return;
            }

            const issues = await response.json();
            
            // Remove frontend severity sorting to respect backend chronological order
            
            if (issues.length === 0) {
                if (targetContainer) targetContainer.innerHTML = '<p style="text-align: center; color: #64748b; grid-column: 1 / -1;">No issues reported yet.</p>';
                // Reset stats to 0 if there are no issues
                if (document.getElementById('total-count')) animateCounter(document.getElementById('total-count'), 0);
                if (document.getElementById('pending-count')) animateCounter(document.getElementById('pending-count'), 0);
                if (document.getElementById('resolved-count')) animateCounter(document.getElementById('resolved-count'), 0);
                return;
            }

            if (targetContainer) targetContainer.innerHTML = ""; // Clear existing content

            // Calculate Statistics
            const totalIssues = issues.length;
            const pendingIssues = issues.filter(issue => issue.status !== 'Resolved').length;
            const resolvedIssues = issues.filter(issue => issue.status === 'Resolved').length;

            // Update Theology Check Explicitly
            if (document.getElementById('total-count')) animateCounter(document.getElementById('total-count'), totalIssues);
            if (document.getElementById('pending-count')) animateCounter(document.getElementById('pending-count'), pendingIssues);
            if (document.getElementById('resolved-count')) animateCounter(document.getElementById('resolved-count'), resolvedIssues);

            // Update the analytics chart
            updateChart(pendingIssues, resolvedIssues);

            // Calculate AI Insights
            if (issues.length > 0) {
                let categoryCount = {};
                let cityCount = {};
                let departmentCount = {};

                issues.forEach(issue => {
                    const cat = issue.category || 'Other';
                    const loc = issue.location || 'Unknown';
                    const dept = issue.department || 'Municipal Department';

                    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
                    cityCount[loc] = (cityCount[loc] || 0) + 1;
                    departmentCount[dept] = (departmentCount[dept] || 0) + 1;
                });

                function getTopItem(obj) {
                    return Object.entries(obj).sort((a,b)=>b[1]-a[1])[0] || ["N/A", 0];
                }

                const topCategory = getTopItem(categoryCount);
                const topCity = getTopItem(cityCount);
                const topDepartment = getTopItem(departmentCount);

                if (document.getElementById("top-category")) {
                    document.getElementById("top-category").textContent =
                    `🔥 Most reported issue: ${topCategory[0]} (${topCategory[1]} reports)`;
                }

                if (document.getElementById("top-city")) {
                    document.getElementById("top-city").textContent =
                    `🏙️ Most affected city: ${topCity[0]}`;
                }

                if (document.getElementById("top-department")) {
                    document.getElementById("top-department").textContent =
                    `🏢 Department with highest workload: ${topDepartment[0]}`;
                }
            } else {
                if (document.getElementById('top-category')) {
                    document.getElementById('top-category').textContent = "No data yet";
                    document.getElementById('top-city').textContent = "No data yet";
                    document.getElementById('top-department').textContent = "No data yet";
                }
            }

            issues.forEach(issue => {
                const isPending = issue.status === 'Pending'; // Keep legacy fallback
                const statusStr = issue.status || 'Reported';
                
                // Determine timeline state
                const states = ['Reported', 'Assigned', 'In Progress', 'Resolved'];
                const currentIndex = states.indexOf(statusStr) !== -1 ? states.indexOf(statusStr) : 0;
                
                let timelineHtml = `<div class="status-timeline">`;
                states.forEach((s, idx) => {
                    let stepClass = '';
                    if (idx < currentIndex) stepClass = 'completed';
                    else if (idx === currentIndex) stepClass = 'active';
                    timelineHtml += `<div class="status-step ${stepClass}">${s}</div>`;
                });
                timelineHtml += `</div>`;

                // Badge mapping
                const badgeClassMap = {
                    'Reported': 'status-reported',
                    'Assigned': 'status-assigned',
                    'In Progress': 'status-inprogress',
                    'Resolved': 'status-resolved',
                    'Pending': 'status-pending'
                };
                const badgeClass = badgeClassMap[statusStr] || 'status-reported';
                
                let deleteIconHtml = '';
                if (isAuthority) {
                    deleteIconHtml = `<div class="delete-icon" data-id="${issue.id}" style="cursor:pointer; font-size:1.2rem; filter: grayscale(100%); opacity:0.6; transition: all 0.2s;" onmouseover="this.style.filter='grayscale(0%)'; this.style.opacity='1'; this.style.transform='scale(1.1)';" onmouseout="this.style.filter='grayscale(100%)'; this.style.opacity='0.6'; this.style.transform='scale(1)';" title="Delete Issue">🗑️</div>`;
                }

                // Add data-status attribute to enable easy filtering
                let cardHtml = `
                    <div class="issue-card" data-status="${statusStr}" data-source="${issue.source || 'mongo'}" style="position:relative;">
                        <div class="issue-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                            <h3 class="issue-title" style="flex:1; margin:0;">${issue.title}</h3>
                            <div style="display:flex; align-items:center; gap: 12px;">
                                <span class="status-badge ${badgeClass}">${statusStr}</span>
                                ${deleteIconHtml}
                            </div>
                        </div>
                        <p class="issue-location">📍 ${issue.location}</p>
                        ${timelineHtml}
                        <p class="issue-description">${issue.description}</p>
                        ${(issue.support_count && issue.support_count > 1)
                            ? `<p class="support-count">👍 Supported by ${issue.support_count} citizens</p>`
                            : ''}
                        <div style="margin-top: 10px; margin-bottom: 5px; min-height: 32px; display: flex; align-items: center;">
                            <button class="btn btn-secondary evidence-btn" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px;" data-image="${issue.image_url ? 'http://127.0.0.1:8000/' + issue.image_url : ''}">
                                🖼️ View Evidence
                            </button>
                        </div>
                        <div class="ai-analysis">
                            <span class="ai-label">🏷️ Category: <strong>${issue.category || 'Other'}</strong></span>
                            <span class="ai-label">⚠️ Severity: <strong>${issue.severity || 'Low'}</strong></span>
                            <span class="ai-label">🏢 Department: <strong>${issue.department || 'Municipal Department'}</strong></span>
                        </div>
                        <div class="issue-timestamps" style="margin-top:0.6rem; display:flex; flex-wrap:wrap; gap:0.4rem 1rem; font-size:0.78rem; color:#64748b;">
                            ${issue.created_at && issue.created_at !== 'None' && issue.created_at.trim() !== '' ? `<span>🕐 Reported: <strong>${issue.created_at}</strong></span>` : ''}
                            ${issue.updated_at && issue.updated_at !== 'None' && issue.updated_at.trim() !== '' ? `<span>🔄 Updated: <strong>${issue.updated_at}</strong></span>` : ''}
                            ${issue.resolved_at && issue.resolved_at !== 'None' && issue.resolved_at.trim() !== '' ? `<span style="color:#22c55e;">✅ Resolved: <strong>${issue.resolved_at}</strong></span>` : ''}
                        </div>
                `;

                if (isAuthority && statusStr !== 'Resolved') {
                    let actionText = '';
                    let nextStatus = '';

                    if (statusStr === 'Reported' || statusStr === 'Pending') {
                        actionText = 'Assign Issue';
                        nextStatus = 'Assigned';
                    } else if (statusStr === 'Assigned') {
                        actionText = 'Start Work';
                        nextStatus = 'In Progress';
                    } else if (statusStr === 'In Progress') {
                        actionText = 'Mark Resolved';
                        nextStatus = 'Resolved';
                    }

                    if (actionText) {
                        cardHtml += `
                            <button class="btn btn-secondary mt-3 resolve-btn" data-id="${issue.id}" data-next-status="${nextStatus}" style="margin-top: 1rem;">${actionText}</button>
                        `;
                    }
                }



                cardHtml += `</div>`;
                if (targetContainer) {
                     targetContainer.insertAdjacentHTML('beforeend', cardHtml);
                }
            });

            // Add event listeners tracking the dynamic workflow button clicks
            document.querySelectorAll('.resolve-btn').forEach(button => {
                button.addEventListener('click', async function() {
                    const issueId = this.getAttribute('data-id');
                    const nextStatus = this.getAttribute('data-next-status') || 'Resolved'; // Fallback
                    const source = this.closest('.issue-card').getAttribute('data-source') || 'mongo';
                    await updateIssueStatus(issueId, nextStatus, source);
                });
            });

            // Add event listeners for delete icons
            document.querySelectorAll('.delete-icon').forEach(icon => {
                icon.addEventListener('click', async function(e) {
                    e.stopPropagation();
                    if (!confirm("Are you sure you want to delete this issue?")) return;
                    const issueId = this.getAttribute('data-id');
                    const source = this.closest('.issue-card').getAttribute('data-source') || 'mongo';
                    try {
                        const response = await fetch(`http://127.0.0.1:8000/delete-issue/${issueId}?source=${source}`, {
                            method: 'DELETE'
                        });
                        if (response.ok) {
                            this.closest('.issue-card').remove();
                        } else {
                            alert("Failed to delete issue.");
                        }
                    } catch (error) {
                        console.error("Error deleting issue:", error);
                        alert("An error occurred while trying to delete the issue.");
                    }
                });
            });

            // Modal Evidence Logic
            const modalOverlay = document.getElementById('evidenceModal');
            const modalImg = document.getElementById('modalImage');
            
            document.querySelectorAll('.evidence-btn').forEach(button => {
                button.addEventListener('click', function () {
                    const imageUrl = this.getAttribute('data-image');
                    if(imageUrl && imageUrl !== '') {
                        if(modalOverlay && modalImg) {
                            modalImg.src = imageUrl;
                            modalOverlay.classList.add('active');
                        }
                    } else {
                        alert("No evidence uploaded by user");
                    }
                });
            });

            if(modalOverlay) {
                const closeBtn = document.querySelector('.close-modal');
                if(closeBtn) {
                    closeBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
                }
                modalOverlay.addEventListener('click', (e) => {
                    if (e.target === modalOverlay) modalOverlay.classList.remove('active');
                });
            }

            // After fetching issues, explicitly apply the current active filter
            applyCurrentFilter();

            // Update map markers for all issues
            updateMap(issues);

        } catch (error) {
            console.error("Error fetching issues:", error);
            if (issuesContainer) issuesContainer.innerHTML = '<p style="text-align: center; color: #ef4444; grid-column: 1 / -1;">Error connecting to the server. Could not load issues.</p>';
        }
    }

    async function updateIssueStatus(issueId, newStatus, source) {
        try {
            const response = await fetch(`http://127.0.0.1:8000/issues/${issueId}?source=${source || 'mongo'}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                // Refresh list automatically to show Status changes
                fetchIssues();
            } else {
                alert(`Failed to update the issue status to ${newStatus}.`);
            }
        } catch (error) {
            console.error("Error updating issue:", error);
            alert("An error occurred while trying to update the issue status.");
        }
    }

    // --- Filter Logic ---
    const filterButtons = document.querySelectorAll('.filters button');
    
    // Set 'All Issues' as default active styling if initial load
    const defaultFilterBtn = document.querySelector('.filters button[data-filter="all"]');
    if (defaultFilterBtn && !document.querySelector('.filters button.active')) {
        defaultFilterBtn.classList.add('active');
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            applyCurrentFilter();
        });
    });

    function applyCurrentFilter() {
        const activeBtn = document.querySelector('.filters button.active');
        if (!activeBtn) return;

        const filterValue = activeBtn.getAttribute('data-filter');

        // Get the current search query (if search bar exists on the page)
        const searchInput = document.getElementById('issue-search');
        const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

        const cards = document.querySelectorAll('.issue-card');

        cards.forEach(card => {
            const cardStatus = card.getAttribute('data-status');

            // Check filter match
            // 'Pending' means all non-resolved issues (Reported, Assigned, In Progress)
            const filterMatch = filterValue === 'all'
                || (filterValue === 'Pending' && cardStatus !== 'Resolved')
                || filterValue === cardStatus;

            // Check search match against title, description, location
            let searchMatch = true;
            if (searchQuery) {
                const title = (card.querySelector('.issue-title')?.textContent || '').toLowerCase();
                const description = (card.querySelector('.issue-description')?.textContent || '').toLowerCase();
                const location = (card.querySelector('.issue-location')?.textContent || '').toLowerCase();
                searchMatch = title.includes(searchQuery) || description.includes(searchQuery) || location.includes(searchQuery);
            }

            // Show card only if both filter and search match
            card.style.display = (filterMatch && searchMatch) ? 'flex' : 'none';
        });
    }

    // --- Search Logic ---
    const searchInput = document.getElementById('issue-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            applyCurrentFilter();
        });
    }

    // --- Automatic Refresh Logic ---
    if (issuesContainer || document.getElementById('recent-issues-container') || analyticsChart || mapContainer) {
        // Refresh issues every 5 seconds (5000 milliseconds)
        setInterval(fetchIssues, 5000);
    }

    // --- Location Picker Map Logic (Report Issue Page) ---
    const locationPickerContainer = document.getElementById('locationPickerMap');
    const openMapModalBtn = document.getElementById('openMapModalBtn');
    const mapPickerModal = document.getElementById('mapPickerModal');
    const cancelMapBtn = document.getElementById('cancelMapBtn');
    const confirmMapBtn = document.getElementById('confirmMapBtn');
    const closePickerBtn = document.querySelector('.close-picker-modal');

    if (locationPickerContainer && mapPickerModal && openMapModalBtn) {
        let pickerMap = null;
        let pickerMarker = null;
        let tempLat = null;
        let tempLng = null;
        let tempAddress = "";

        const closeModal = () => {
            mapPickerModal.classList.remove('active');
        };

        openMapModalBtn.addEventListener('click', () => {
            mapPickerModal.classList.add('active');
            
            // Only initialize the map once
            if (!pickerMap) {
                // Initialize map inside modal on first open (India center)
                pickerMap = L.map('locationPickerMap').setView([22.9734, 78.6569], 5);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors'
                }).addTo(pickerMap);

                pickerMap.on('click', async function(e) {
                    tempLat = e.latlng.lat;
                    tempLng = e.latlng.lng;

                    // Place or move marker
                    if (pickerMarker) {
                        pickerMarker.setLatLng(e.latlng);
                    } else {
                        pickerMarker = L.marker(e.latlng).addTo(pickerMap);
                    }

                    // Reverse Geocoding to Auto-fill temp location
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${tempLat}&lon=${tempLng}&zoom=18&addressdetails=1`, {
                            headers: {"User-Agent": "CrowdSolveApp/1.0 (contact: admin@crowdsolve.local)"}
                        });
                        if (response.ok) {
                            const data = await response.json();
                            if (data && data.display_name) {
                                tempAddress = data.display_name;
                            }
                        }
                    } catch (err) {
                        console.error("Reverse geocoding failed", err);
                    }
                });
            }
            
            // Wait for transition, then invalidate size to fix gray box glitch in modals
            setTimeout(() => { pickerMap.invalidateSize(); }, 350);
        });

        if (cancelMapBtn) {
            cancelMapBtn.addEventListener('click', closeModal);
        }

        if (closePickerBtn) {
            closePickerBtn.addEventListener('click', closeModal);
        }
        
        mapPickerModal.addEventListener('click', (e) => {
            if (e.target === mapPickerModal) closeModal();
        });

        if (confirmMapBtn) {
            confirmMapBtn.addEventListener('click', () => {
                if (tempLat !== null && tempLng !== null) {
                    document.getElementById('latitude').value = tempLat;
                    document.getElementById('longitude').value = tempLng;
                    
                    if (tempAddress) {
                        document.getElementById('location').value = tempAddress;
                    }
                }
                closeModal();
            });
        }
    }

    // --- Leaflet Map Logic ---
    let issuesMap = null;
    let mapMarkers = [];
    let lastIssueSignature = null; // track changes to avoid unnecessary redraws

    // Initialize the map only once when the map container exists
    if (mapContainer) {
        issuesMap = L.map('issuesMap').setView([22.9734, 78.6569], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(issuesMap);
    }

    function updateMap(issues) {
        if (!issuesMap) return;

        // Build signature to avoid redrawing when data is unchanged
        const signature = issues.map(i => `${i.id}:${i.status}:${i.latitude}:${i.longitude}`).join(',');
        if (signature === lastIssueSignature) return;
        lastIssueSignature = signature;

        // Clear old markers
        mapMarkers.forEach(marker => issuesMap.removeLayer(marker));
        mapMarkers = [];

        // Track offset index per location to slightly spread overlapping markers
        const locationOffset = {};

        issues.forEach(issue => {
            if (!issue.latitude || !issue.longitude) return;

            const isResolved = issue.status === 'Resolved';

            // Color: green for resolved, orange-red for pending (any non-resolved)
            const color = isResolved ? '#22c55e' : '#f97316';
            const statusLabel = isResolved ? 'Resolved' : issue.status || 'Reported';

            // Apply small spiral offset so markers in same city don't all stack
            const locKey = `${issue.latitude},${issue.longitude}`;
            if (!locationOffset[locKey]) locationOffset[locKey] = 0;
            const idx = locationOffset[locKey]++;
            const angle = idx * 45 * (Math.PI / 180);
            const spreadDeg = 0.003 * Math.ceil(idx / 8); // grows per ring
            const latOffset = idx === 0 ? 0 : spreadDeg * Math.sin(angle);
            const lngOffset = idx === 0 ? 0 : spreadDeg * Math.cos(angle);

            const marker = L.circleMarker(
                [parseFloat(issue.latitude) + latOffset, parseFloat(issue.longitude) + lngOffset],
                {
                    radius: 10,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.85,
                    weight: 2
                }
            )
            .addTo(issuesMap)
            .bindPopup(`
                <div style="min-width:160px;">
                    <strong style="font-size:1em;">${issue.title}</strong><br>
                    <span style="color:${color}; font-weight:600;">● ${statusLabel}</span><br>
                    <span style="color:#64748b; font-size:0.85em;">📍 ${issue.city}</span><br>
                    <span style="color:#64748b; font-size:0.85em;">🏷️ ${issue.category}</span>
                </div>
            `);

            mapMarkers.push(marker);
        });
    }

    // --- Analytics Chart Logic ---
    function updateChart(pendingCount, resolvedCount) {
        const canvas = document.getElementById('issuesChart');
        if (!canvas) return;

        if (chartInstance) {
            // Update existing chart data without recreating it
            chartInstance.data.datasets[0].data = [pendingCount, resolvedCount];
            chartInstance.update();
        } else {
            // Create new chart instance
            chartInstance = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: ['Pending', 'Resolved'],
                    datasets: [{
                        data: [pendingCount, resolvedCount],
                        backgroundColor: ['#fde68a', '#bbf7d0'],
                        borderColor: ['#f59e0b', '#22c55e'],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                font: { family: 'Inter', size: 13 },
                                padding: 16
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const pct = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                                    return ` ${context.label}: ${context.parsed} (${pct}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    // ===== NOTIFICATION BELL =====
    const bellBtn = document.getElementById('notif-bell-btn');
    const bellDropdown = document.getElementById('notif-dropdown');
    const bellBadge = document.getElementById('notif-badge');
    const notifList = document.getElementById('notif-list');
    const markAllBtn = document.getElementById('notif-mark-all');

    if (bellBtn) {
        const notifUserType = isAuthority ? 'authority' : 'citizen';

        async function fetchNotifications() {
            try {
                const res = await fetch(`http://127.0.0.1:8000/notifications?user_type=${notifUserType}`);
                if (!res.ok) return;
                const notifs = await res.json();

                const unreadCount = notifs.filter(n => n.is_read === 0).length;
                if (bellBadge) {
                    bellBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    bellBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
                }

                if (notifList) {
                    if (notifs.length === 0) {
                        notifList.innerHTML = '<div class="notif-empty">No notifications yet 🔔</div>';
                    } else {
                        notifList.innerHTML = notifs.map(n => `
                            <div class="notif-item ${n.is_read === 0 ? 'unread' : ''}" data-id="${n.id}">
                                <span>${n.message}</span>
                                <span class="notif-time">${n.created_at || ''}</span>
                            </div>`).join('');
                        notifList.querySelectorAll('.notif-item').forEach(item => {
                            item.addEventListener('click', async function() {
                                const id = this.getAttribute('data-id');
                                await fetch(`http://127.0.0.1:8000/notifications/${id}/read`, { method: 'PATCH' });
                                this.classList.remove('unread');
                                fetchNotifications();
                            });
                        });
                    }
                }
            } catch(e) { /* silently fail if API unreachable */ }
        }

        bellBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            bellDropdown.classList.toggle('open');
            if (bellDropdown.classList.contains('open')) fetchNotifications();
        });

        document.addEventListener('click', function(e) {
            const container = document.getElementById('notif-bell-container');
            if (container && !container.contains(e.target)) bellDropdown.classList.remove('open');
        });

        if (markAllBtn) {
            markAllBtn.addEventListener('click', async function() {
                await fetch(`http://127.0.0.1:8000/notifications/read-all?user_type=${notifUserType}`, { method: 'PATCH' });
                fetchNotifications();
            });
        }

        fetchNotifications();
        setInterval(fetchNotifications, 5000);
    }

});