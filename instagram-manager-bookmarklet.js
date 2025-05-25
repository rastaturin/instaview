javascript:(function() {
    // Check if manager is already open
    if (document.getElementById('instagram-manager-overlay')) {
        document.getElementById('instagram-manager-overlay').remove();
        return;
    }

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'instagram-manager-overlay';
    overlay.tabIndex = -1; // Make it focusable
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        overflow-y: auto;
        outline: none;
    `;

    // Create manager container
    const container = document.createElement('div');
    container.className = 'manager-container';
    container.style.cssText = `
        max-width: 1200px;
        margin: 20px auto;
        background: #fafafa;
        border-radius: 8px;
        padding: 20px;
        color: #262626;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        position: relative;
    `;

    container.innerHTML = `
        <style>
            .manager-header {
                text-align: center;
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid #dbdbdb;
            }
            .manager-header h1 {
                font-size: 24px;
                font-weight: 600;
                color: #262626;
                margin-bottom: 10px;
            }
            .close-btn {
                position: absolute;
                top: 15px;
                right: 15px;
                background: #ed4956;
                color: white;
                border: none;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                cursor: pointer;
                font-size: 16px;
            }
            .manager-nav-tabs {
                display: flex;
                border-bottom: 1px solid #dbdbdb;
                margin-bottom: 20px;
            }
            .manager-nav-tab {
                padding: 10px 20px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                background: none;
                border: none;
                color: #262626;
            }
            .manager-nav-tab.active {
                border-bottom: 2px solid #0095f6;
                color: #0095f6;
            }
            .manager-tab-content {
                display: none;
            }
            .manager-tab-content.active {
                display: block;
            }
            .manager-location-select {
                width: 100%;
                padding: 10px;
                margin-bottom: 20px;
                border: 1px solid #dbdbdb;
                border-radius: 4px;
                font-size: 14px;
            }
            .manager-filter-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
            }
            .manager-category-select {
                padding: 10px;
                border: 1px solid #dbdbdb;
                border-radius: 4px;
                font-size: 14px;
                background-color: white;
            }
            .manager-stats {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                margin-bottom: 20px;
                text-align: center;
            }
            .manager-stat-item {
                padding: 15px;
                background-color: white;
                border: 1px solid #dbdbdb;
                border-radius: 4px;
            }
            .manager-stat-number {
                font-size: 24px;
                font-weight: 600;
                color: #0095f6;
            }
            .manager-stat-label {
                font-size: 14px;
                color: #8e8e8e;
            }
            .manager-browse-container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                align-items: start;
            }
            .manager-user-card {
                background-color: white;
                border: 1px solid #dbdbdb;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            }
            .manager-user-info {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
            }
            .manager-user-avatar {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background-color: #f0f0f0;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 15px;
                font-size: 24px;
                color: #0095f6;
                font-weight: bold;
                background-size: cover;
                background-position: center;
                border: 2px solid #dbdbdb;
            }
            .manager-user-details h2 {
                font-size: 18px;
                margin-bottom: 5px;
                font-weight: 600;
            }
            .manager-user-fullname {
                font-size: 14px;
                color: #8e8e8e;
                margin-bottom: 3px;
                font-style: italic;
            }
            .manager-user-meta {
                font-size: 14px;
                color: #8e8e8e;
                margin-bottom: 5px;
            }
            .manager-user-bio {
                font-size: 13px;
                color: #262626;
                margin-bottom: 10px;
                line-height: 1.4;
                max-height: 60px;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .manager-user-stats {
                display: flex;
                gap: 15px;
                margin-bottom: 10px;
                font-size: 12px;
                color: #8e8e8e;
            }
            .manager-user-stat {
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .manager-stat-number {
                font-weight: 600;
                color: #262626;
            }
            .manager-user-badges {
                display: flex;
                gap: 5px;
                margin-bottom: 10px;
            }
            .manager-badge {
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 10px;
                font-weight: 600;
            }
            .manager-verified-badge {
                background-color: #0095f6;
                color: white;
            }
            .manager-private-badge {
                background-color: #ed4956;
                color: white;
            }
            .manager-business-badge {
                background-color: #10b981;
                color: white;
            }
            .manager-user-actions {
                display: flex;
                justify-content: space-between;
                margin-top: 15px;
                gap: 10px;
            }
            .manager-action-button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                font-weight: 600;
                cursor: pointer;
                font-size: 14px;
                flex: 1;
            }
            .manager-like-button {
                background-color: #0095f6;
                color: white;
            }
            .manager-dislike-button {
                background-color: #ed4956;
                color: white;
            }
            .manager-skip-button {
                background-color: #efefef;
                color: #262626;
            }
            .manager-view-profile {
                background-color: #efefef;
                color: #262626;
            }
            .manager-navigation {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 20px;
            }
            .manager-nav-button {
                padding: 10px 20px;
                background-color: #0095f6;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
            }
            .manager-nav-button:disabled {
                background-color: #b2dffc;
                cursor: not-allowed;
            }
            .manager-profile-preview {
                background-color: white;
                border: 1px solid #dbdbdb;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                height: 800px;
                position: relative;
                display: flex;
                flex-direction: column;
                overflow-y: auto;
            }
            .manager-profile-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                font-size: 16px;
                color: #8e8e8e;
                background-color: #f8f9fa;
                text-align: center;
                padding: 20px;
            }
            .manager-profile-info {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                padding: 20px;
                min-height: 100%;
            }
            .manager-profile-avatar-large {
                width: 120px;
                height: 120px;
                border-radius: 50%;
                background: linear-gradient(45deg, #405de6, #5851db, #833ab4, #c13584, #e1306c, #fd1d1d);
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 20px;
                font-size: 48px;
                color: white;
                font-weight: bold;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            .manager-profile-username {
                font-size: 24px;
                font-weight: 600;
                color: #262626;
                margin-bottom: 10px;
            }
            .manager-profile-url {
                font-size: 14px;
                color: #8e8e8e;
                margin-bottom: 30px;
            }
            .manager-auto-open-btn {
                background: linear-gradient(45deg, #405de6, #833ab4, #e1306c);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 15px 30px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin-bottom: 15px;
                box-shadow: 0 4px 12px rgba(64, 93, 230, 0.3);
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            .manager-auto-open-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(64, 93, 230, 0.4);
            }
            .manager-auto-open-info {
                font-size: 12px;
                color: #8e8e8e;
                line-height: 1.4;
            }
            .manager-keyboard-shortcuts {
                margin-top: 20px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #e1e8ed;
            }
            .manager-shortcut-title {
                font-size: 14px;
                font-weight: 600;
                color: #262626;
                margin-bottom: 10px;
            }
            .manager-shortcut-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 5px;
                font-size: 12px;
            }
            .manager-shortcut-key {
                background-color: #262626;
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 11px;
            }
            .manager-search-bar {
                display: flex;
                margin-bottom: 20px;
                gap: 10px;
            }
            .manager-search-bar input {
                flex: 1;
                padding: 10px;
                border: 1px solid #dbdbdb;
                border-radius: 4px;
                font-size: 14px;
            }
            .manager-search-bar button {
                padding: 10px 15px;
                background-color: #0095f6;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
            }
            .manager-user-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 20px;
            }
            .manager-user-grid-item {
                background-color: white;
                border: 1px solid #dbdbdb;
                border-radius: 8px;
                padding: 15px;
                text-align: center;
            }
            .manager-user-grid-avatar {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background-color: #f0f0f0;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 10px;
                font-size: 20px;
                color: #0095f6;
                font-weight: bold;
            }
            .manager-user-grid-name {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 10px;
            }
            .manager-user-grid-actions {
                display: flex;
                justify-content: center;
                gap: 5px;
                margin-top: 10px;
            }
            .manager-user-grid-actions button {
                padding: 6px 10px;
                font-size: 12px;
            }
            .manager-no-data {
                text-align: center;
                padding: 50px 0;
                color: #8e8e8e;
            }
            .manager-profile-about {
                margin: 15px 0;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #e1e8ed;
            }
            .manager-about-title {
                font-size: 14px;
                font-weight: 600;
                color: #262626;
                margin-bottom: 8px;
            }
            .manager-about-text {
                font-size: 13px;
                line-height: 1.4;
                color: #262626;
                word-wrap: break-word;
            }
            .manager-recent-posts {
                margin: 20px 0;
            }
            .manager-posts-title {
                font-size: 16px;
                font-weight: 600;
                color: #262626;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .manager-posts-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin-bottom: 15px;
            }
            .manager-post-item {
                position: relative;
                aspect-ratio: 1;
                border-radius: 6px;
                overflow: hidden;
                cursor: pointer;
                border: 1px solid #dbdbdb;
                background-color: #f8f9fa;
            }
            .manager-post-image {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.2s ease;
            }
            .manager-post-item:hover .manager-post-image {
                transform: scale(1.05);
            }
            .manager-post-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s ease;
                color: white;
                font-size: 12px;
                font-weight: 600;
                gap: 10px;
            }
            .manager-post-item:hover .manager-post-overlay {
                opacity: 1;
            }
            .manager-post-stat {
                display: flex;
                align-items: center;
                gap: 3px;
            }
            .manager-video-indicator {
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 600;
            }
            .manager-no-posts {
                text-align: center;
                padding: 20px;
                color: #8e8e8e;
                font-style: italic;
                background-color: #f8f9fa;
                border-radius: 8px;
                border: 1px solid #e1e8ed;
            }
        </style>

        <button class="close-btn" onclick="document.getElementById('instagram-manager-overlay').remove()">×</button>
        
        <div class="manager-header">
            <h1>Instagram User Manager</h1>
            <p>Browse, filter, and organize users from Instagram locations</p>
        </div>
        
        <select id="manager-locationSelect" class="manager-location-select">
            <option value="">Select a location...</option>
        </select>
        
        <div class="manager-filter-container">
            <select id="manager-categorySelect" class="manager-category-select">
                <option value="pending">Pending</option>
                <option value="liked">Liked</option>
                <option value="disliked">Disliked</option>
                <option value="all">All</option>
            </select>
        </div>
        
        <div class="manager-stats">
            <div class="manager-stat-item">
                <div id="manager-totalCount" class="manager-stat-number">0</div>
                <div class="manager-stat-label">Total</div>
            </div>
            <div class="manager-stat-item">
                <div id="manager-likedCount" class="manager-stat-number">0</div>
                <div class="manager-stat-label">Liked</div>
            </div>
            <div class="manager-stat-item">
                <div id="manager-dislikedCount" class="manager-stat-number">0</div>
                <div class="manager-stat-label">Disliked</div>
            </div>
            <div class="manager-stat-item">
                <div id="manager-pendingCount" class="manager-stat-number">0</div>
                <div class="manager-stat-label">Pending</div>
            </div>
        </div>
        
        <div class="manager-nav-tabs">
            <button id="manager-browseTab" class="manager-nav-tab active">Browse</button>
            <button id="manager-likedTab" class="manager-nav-tab">Liked Users</button>
            <button id="manager-searchTab" class="manager-nav-tab">Search</button>
        </div>
        
        <!-- Browse Tab -->
        <div id="manager-browseContent" class="manager-tab-content active">
            <div class="manager-browse-container">
                <div class="manager-left-panel">
                    <div id="manager-userCard" class="manager-user-card">
                        <div class="manager-user-info">
                            <div class="manager-user-avatar">U</div>
                            <div class="manager-user-details">
                                <h2>Username</h2>
                                <div class="manager-user-meta">Select a location to start browsing users</div>
                            </div>
                        </div>
                        <div class="manager-user-actions">
                            <button id="manager-viewProfile" class="manager-action-button manager-view-profile" disabled>View Profile</button>
                            <button id="manager-viewPost" class="manager-action-button manager-view-profile" disabled>View Post</button>
                            <button id="manager-dislikeButton" class="manager-action-button manager-dislike-button" disabled>Dislike</button>
                            <button id="manager-skipButton" class="manager-action-button manager-skip-button" disabled>Skip</button>
                            <button id="manager-likeButton" class="manager-action-button manager-like-button" disabled>Like</button>
                        </div>
                    </div>
                    
                    <div class="manager-navigation">
                        <button id="manager-prevButton" class="manager-nav-button" disabled>Previous</button>
                        <span id="manager-userCounter">0 / 0</span>
                        <button id="manager-nextButton" class="manager-nav-button" disabled>Next</button>
                    </div>
                </div>
                
                <div class="manager-right-panel">
                    <div class="manager-profile-preview">
                        <div id="manager-profileLoading" class="manager-profile-loading">
                            Select a user to preview their profile
                        </div>
                        <div id="manager-profileInfo" class="manager-profile-info" style="display: none;">
                            <div class="manager-profile-avatar-large">U</div>
                            <div class="manager-profile-username">@username</div>
                            <div class="manager-profile-url">instagram.com/username</div>
                            <button id="manager-autoOpenBtn" class="manager-auto-open-btn">🔄 Reopen Profile</button>
                            <div class="manager-auto-open-info">Profile opens automatically when you navigate to users</div>
                            
                            <div class="manager-keyboard-shortcuts">
                                <div class="manager-shortcut-title">⌨️ Keyboard Shortcuts</div>
                                <div id="focus-status" style="font-size: 11px; color: #10b981; margin-bottom: 8px; font-weight: 600;">✅ Manager focused - shortcuts active</div>
                                <div class="manager-shortcut-item">
                                    <span>Like user</span>
                                    <span class="manager-shortcut-key">L</span>
                                </div>
                                <div class="manager-shortcut-item">
                                    <span>Dislike user</span>
                                    <span class="manager-shortcut-key">D</span>
                                </div>
                                <div class="manager-shortcut-item">
                                    <span>Skip user</span>
                                    <span class="manager-shortcut-key">S</span>
                                </div>
                                <div class="manager-shortcut-item">
                                    <span>Open profile</span>
                                    <span class="manager-shortcut-key">Enter</span>
                                </div>
                                <div class="manager-shortcut-item">
                                    <span>Next user</span>
                                    <span class="manager-shortcut-key">→</span>
                                </div>
                                <div class="manager-shortcut-item">
                                    <span>Previous user</span>
                                    <span class="manager-shortcut-key">←</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Liked Users Tab -->
        <div id="manager-likedContent" class="manager-tab-content">
            <div class="manager-search-bar">
                <input type="text" id="manager-likedSearchInput" placeholder="Filter liked users...">
                <button id="manager-clearLikedFilter">Clear</button>
            </div>
            <div id="manager-likedGrid" class="manager-user-grid">
                <div class="manager-no-data">No liked users yet</div>
            </div>
        </div>
        
        <!-- Search Tab -->
        <div id="manager-searchContent" class="manager-tab-content">
            <div class="manager-search-bar">
                <input type="text" id="manager-searchInput" placeholder="Search username...">
                <button id="manager-searchButton">Search</button>
            </div>
            <div id="manager-searchResults" class="manager-user-grid">
                <div class="manager-no-data">Enter a search term to find users</div>
            </div>
        </div>
    `;

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // Initialize manager functionality
    const state = {
        users: [],
        filteredUsers: [],
        currentIndex: 0,
        currentLocationId: null,
        currentCategory: 'pending',
        userPreferences: {},
        locations: {}
    };

    // Load user preferences
    function loadUserPreferences() {
        const savedPrefs = localStorage.getItem('instagram_user_preferences');
        if (savedPrefs) {
            try {
                state.userPreferences = JSON.parse(savedPrefs);
            } catch (error) {
                state.userPreferences = {};
            }
        }
    }

    // Save user preferences
    function saveUserPreferences() {
        localStorage.setItem('instagram_user_preferences', JSON.stringify(state.userPreferences));
    }

    // Load locations
    function loadLocations() {
        const locationSelect = document.getElementById('manager-locationSelect');
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('instagram_users_')) {
                const locationId = key.replace('instagram_users_', '');
                try {
                    const users = JSON.parse(localStorage.getItem(key));
                    if (Array.isArray(users) && users.length > 0) {
                        state.locations[locationId] = {
                            id: locationId,
                            name: `Location: ${locationId}`,
                            userCount: users.length
                        };
                        
                        const option = document.createElement('option');
                        option.value = locationId;
                        option.textContent = `Location ${locationId} (${users.length} users)`;
                        locationSelect.appendChild(option);
                    }
                } catch (error) {
                    console.error('Error parsing location data:', error);
                }
            }
        }
    }

    // Load users for location
    function loadUsersForLocation(locationId) {
        const key = `instagram_users_${locationId}`;
        try {
            const users = JSON.parse(localStorage.getItem(key));
            if (Array.isArray(users)) {
                state.users = users;
                state.currentLocationId = locationId;
                state.currentIndex = 0;
                
                // Apply current category filter
                filterUsersByCategory(state.currentCategory);
                
                updateUI();
                updateStats();
            }
        } catch (error) {
            state.users = [];
            state.filteredUsers = [];
        }
    }

    // Get current user
    function getCurrentUser() {
        if (state.filteredUsers.length === 0 || state.currentIndex < 0 || state.currentIndex >= state.filteredUsers.length) {
            return null;
        }
        return state.filteredUsers[state.currentIndex];
    }

    // Set user preference
    function setUserPreference(username, preference) {
        if (!username) return;
        
        const key = `${username}_${state.currentLocationId}`;
        state.userPreferences[key] = {
            username,
            locationId: state.currentLocationId,
            preference,
            timestamp: new Date().toISOString()
        };
        
        saveUserPreferences();
        updateStats();
    }

    // Get user preference
    function getUserPreference(username, locationId) {
        if (!username || !locationId) return null;
        const key = `${username}_${locationId}`;
        return state.userPreferences[key]?.preference || null;
    }

    // Update profile preview
    function updateProfilePreview(username) {
        const profileLoading = document.getElementById('manager-profileLoading');
        const profileInfo = document.getElementById('manager-profileInfo');
        
        if (!username) {
            profileLoading.style.display = 'flex';
            profileInfo.style.display = 'none';
            profileLoading.textContent = 'Select a user to preview their profile';
            return;
        }
        
        // Get current user data
        const currentUser = getCurrentUser();
        
        profileLoading.style.display = 'none';
        profileInfo.style.display = 'flex';
        
        // Update profile info
        const avatarLarge = profileInfo.querySelector('.manager-profile-avatar-large');
        const usernameText = profileInfo.querySelector('.manager-profile-username');
        const urlText = profileInfo.querySelector('.manager-profile-url');
        const autoOpenBtn = document.getElementById('manager-autoOpenBtn');
 
        // Set profile picture or fallback to letter
        if (currentUser?.profilePicUrl) {
            avatarLarge.style.backgroundImage = `url(${currentUser.profilePicUrl})`;
            avatarLarge.style.backgroundSize = 'cover';
            avatarLarge.style.backgroundPosition = 'center';
            avatarLarge.textContent = '';
        } else {
            avatarLarge.style.backgroundImage = 'none';
            avatarLarge.textContent = username.charAt(0).toUpperCase();
        }
        
        usernameText.textContent = `@${username}`;
        urlText.textContent = `instagram.com/${username}`;
        
        // Add or update about section
        let aboutSection = profileInfo.querySelector('.manager-profile-about');
        if (currentUser?.biography) {
            if (!aboutSection) {
                aboutSection = document.createElement('div');
                aboutSection.className = 'manager-profile-about';
                profileInfo.insertBefore(aboutSection, autoOpenBtn);
            }
            aboutSection.innerHTML = `
                <div class="manager-about-title">About</div>
                <div class="manager-about-text">${currentUser.biography}</div>
            `;
        } else if (aboutSection) {
            aboutSection.remove();
        }
        
        // Add or update recent posts section
        let postsSection = profileInfo.querySelector('.manager-recent-posts');
        if (currentUser?.recentPosts && currentUser.recentPosts.length > 0) {
            if (!postsSection) {
                postsSection = document.createElement('div');
                postsSection.className = 'manager-recent-posts';
                profileInfo.insertBefore(postsSection, profileInfo.querySelector('.manager-keyboard-shortcuts'));
            }
            
            const postsHtml = `
                <div class="manager-posts-title">
                    📸 Recent Posts (${currentUser.recentPosts.length})
                </div>
                <div class="manager-posts-grid">
                    ${currentUser.recentPosts.map(post => `
                        <div class="manager-post-item" onclick="window.open('${post.url}', 'instagram_post')">
                            ${post.isVideo ? '<div class="manager-video-indicator">📹</div>' : ''}
                            <img class="manager-post-image" src="${post.thumbnailUrl}" alt="${post.caption.substring(0, 50)}..." loading="lazy" onerror="this.style.display='none'">
                            <div class="manager-post-overlay">
                                <div class="manager-post-stat">❤️ ${formatCount(post.likeCount)}</div>
                                <div class="manager-post-stat">💬 ${formatCount(post.commentCount)}</div>
                                ${post.isVideo && post.viewCount ? `<div class="manager-post-stat">👁️ ${formatCount(post.viewCount)}</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            postsSection.innerHTML = postsHtml;
        } else if (currentUser?.recentPosts && currentUser.recentPosts.length === 0) {
            // Show no posts message
            if (!postsSection) {
                postsSection = document.createElement('div');
                postsSection.className = 'manager-recent-posts';
                profileInfo.insertBefore(postsSection, profileInfo.querySelector('.manager-keyboard-shortcuts'));
            }
            postsSection.innerHTML = `
                <div class="manager-posts-title">📸 Recent Posts</div>
                <div class="manager-no-posts">No recent posts available</div>
            `;
        } else if (postsSection) {
            postsSection.remove();
        }
        
        // Remove previous event listeners
        const newAutoOpenBtn = autoOpenBtn.cloneNode(true);
        autoOpenBtn.parentNode.replaceChild(newAutoOpenBtn, autoOpenBtn);
        
        // Add click handler for manual profile opening (backup)
        newAutoOpenBtn.addEventListener('click', () => {
            openProfileWithFocusManagement(username);
        });
        
        // Auto-open profile in the same window
        setTimeout(() => {
            openProfileWithFocusManagement(username);
        }, 300);
    }

    // Helper function to open profile while managing focus
    function openProfileWithFocusManagement(username) {
        // Show focus lost indicator
        showFocusLostIndicator();
        
        // Open the profile window
        const profileWindow = window.open(`https://www.instagram.com/${username}/`, 'instagram_profile_window');
        
        // Implement multiple focus recovery strategies
        let focusAttempts = 0;
        const maxAttempts = 10;
        
        const attemptRefocus = () => {
            focusAttempts++;
            
            try {
                // Try to focus the window
                window.focus();
                
                // Focus the overlay
                const overlay = document.getElementById('instagram-manager-overlay');
                if (overlay) {
                    overlay.focus();
                }
                
                // Check if we successfully got focus
                if (document.hasFocus()) {
                    hideFocusLostIndicator();
                    return; // Success, stop trying
                }
            } catch (e) {
                console.log('Focus attempt failed:', e);
            }
            
            // Continue trying if we haven't exceeded max attempts
            if (focusAttempts < maxAttempts) {
                setTimeout(attemptRefocus, focusAttempts * 200); // Increasing delay
            }
        };
        
        // Start focus recovery attempts
        setTimeout(attemptRefocus, 300);
        
        // Also try when the profile window potentially loads
        setTimeout(attemptRefocus, 1000);
        setTimeout(attemptRefocus, 2000);
        
        // Monitor focus changes and try to regain focus
        const focusMonitor = setInterval(() => {
            if (!document.hasFocus() && document.getElementById('instagram-manager-overlay')) {
                showFocusLostIndicator();
            } else if (document.hasFocus()) {
                hideFocusLostIndicator();
                clearInterval(focusMonitor);
            }
        }, 1000);
        
        // Clean up monitor after 30 seconds
        setTimeout(() => clearInterval(focusMonitor), 30000);
    }
    
    // Show focus lost indicator
    function showFocusLostIndicator() {
        let indicator = document.getElementById('focus-lost-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'focus-lost-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(45deg, #ff6b6b, #ee5a24);
                color: white;
                text-align: center;
                padding: 10px;
                z-index: 10001;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-weight: 600;
                font-size: 14px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                cursor: pointer;
                animation: focusLostPulse 2s infinite;
            `;
            
            indicator.innerHTML = `
                <div>⚠️ Click here to return focus to manager (Keyboard shortcuts disabled until focused)</div>
                <div style="font-size: 11px; margin-top: 3px; opacity: 0.9;">Profile opened in new tab - click anywhere on this manager to continue using keyboard shortcuts</div>
            `;
            
            // Add CSS animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes focusLostPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; }
                }
            `;
            document.head.appendChild(style);
            
            // Click handler to regain focus
            indicator.addEventListener('click', () => {
                const overlay = document.getElementById('instagram-manager-overlay');
                if (overlay) {
                    overlay.focus();
                    hideFocusLostIndicator();
                }
            });
            
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'block';
        
        // Update focus status in shortcuts
        const focusStatus = document.getElementById('focus-status');
        if (focusStatus) {
            focusStatus.textContent = '⚠️ Manager not focused - click to activate shortcuts';
            focusStatus.style.color = '#ed4956';
        }
    }
    
    // Hide focus lost indicator
    function hideFocusLostIndicator() {
        const indicator = document.getElementById('focus-lost-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
        
        // Update focus status in shortcuts
        const focusStatus = document.getElementById('focus-status');
        if (focusStatus) {
            focusStatus.textContent = '✅ Manager focused - shortcuts active';
            focusStatus.style.color = '#10b981';
        }
    }
    
    // Add click handler to overlay to regain focus
    function setupOverlayFocusHandler() {
        const overlay = document.getElementById('instagram-manager-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                // Don't interfere with form elements
                if (e.target.tagName === 'SELECT' || 
                    e.target.tagName === 'INPUT' || 
                    e.target.tagName === 'BUTTON' || 
                    e.target.tagName === 'TEXTAREA' ||
                    e.target.closest('select') ||
                    e.target.closest('input') ||
                    e.target.closest('button') ||
                    e.target.closest('textarea')) {
                    return; // Let the form element handle the click
                }
                
                // Only focus if clicking on the overlay itself or empty areas of the container
                if (e.target === overlay || 
                    (e.target.closest('.manager-container') && 
                     !e.target.closest('select') && 
                     !e.target.closest('input') && 
                     !e.target.closest('button'))) {
                    overlay.focus();
                    hideFocusLostIndicator();
                }
            });
            
            // Also handle when the overlay gains focus
            overlay.addEventListener('focus', () => {
                hideFocusLostIndicator();
            });
        }
    }

    // Update UI
    function updateUI() {
        const currentUser = getCurrentUser();
        const userCard = document.getElementById('manager-userCard');
        const userAvatar = userCard.querySelector('.manager-user-avatar');
        const userTitle = userCard.querySelector('h2');
        const userMeta = userCard.querySelector('.manager-user-meta');
        const viewProfileBtn = document.getElementById('manager-viewProfile');
        const viewPostBtn = document.getElementById('manager-viewPost');
        const likeButton = document.getElementById('manager-likeButton');
        const dislikeButton = document.getElementById('manager-dislikeButton');
        const skipButton = document.getElementById('manager-skipButton');
        const userCounter = document.getElementById('manager-userCounter');
        const prevButton = document.getElementById('manager-prevButton');
        const nextButton = document.getElementById('manager-nextButton');

        if (currentUser) {
            userTitle.textContent = `@${currentUser.username}`;
            
            // Set profile picture or fallback to letter
            if (currentUser.profilePicUrl) {
                userAvatar.style.backgroundImage = `url(${currentUser.profilePicUrl})`;
                userAvatar.textContent = '';
            } else {
                userAvatar.style.backgroundImage = 'none';
                userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
            }
            
            // Update user details HTML to include new profile information
            const userDetails = userCard.querySelector('.manager-user-details');
            userDetails.innerHTML = `
                <h2>@${currentUser.username}</h2>
                ${currentUser.fullName ? `<div class="manager-user-fullname">${currentUser.fullName}</div>` : ''}
                <div class="manager-user-meta">Added: ${new Date(currentUser.timestamp).toLocaleString()}</div>
                ${currentUser.biography ? `<div class="manager-user-bio">${currentUser.biography}</div>` : ''}
                ${currentUser.followerCount !== undefined ? `
                    <div class="manager-user-stats">
                        <div class="manager-user-stat">
                            <div class="manager-stat-number">${formatCount(currentUser.postsCount || 0)}</div>
                            <div>Posts</div>
                        </div>
                        <div class="manager-user-stat">
                            <div class="manager-stat-number">${formatCount(currentUser.followerCount || 0)}</div>
                            <div>Followers</div>
                        </div>
                        <div class="manager-user-stat">
                            <div class="manager-stat-number">${formatCount(currentUser.followingCount || 0)}</div>
                            <div>Following</div>
                        </div>
                    </div>
                ` : ''}
                ${(currentUser.isVerified || currentUser.isPrivate || currentUser.businessCategory) ? `
                    <div class="manager-user-badges">
                        ${currentUser.isVerified ? '<span class="manager-badge manager-verified-badge">✓ Verified</span>' : ''}
                        ${currentUser.isPrivate ? '<span class="manager-badge manager-private-badge">🔒 Private</span>' : ''}
                        ${currentUser.businessCategory ? `<span class="manager-badge manager-business-badge">${currentUser.businessCategory}</span>` : ''}
                    </div>
                ` : ''}
                ${currentUser.recentPosts && currentUser.recentPosts.length > 0 ? `
                    <div style="margin-top: 10px;">
                        <div style="font-size: 12px; font-weight: 600; color: #262626; margin-bottom: 5px;">Recent Posts</div>
                        <div style="display: flex; gap: 4px; overflow-x: auto;">
                            ${currentUser.recentPosts.slice(0, 4).map(post => `
                                <div style="position: relative; flex-shrink: 0;">
                                    ${post.isVideo ? '<div style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); color: white; padding: 1px 3px; border-radius: 2px; font-size: 8px;">📹</div>' : ''}
                                    <img src="${post.thumbnailUrl}" alt="Post" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid #dbdbdb;" onclick="window.open('${post.url}', 'instagram_post')" onerror="this.style.display='none'">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            `;
            
            viewProfileBtn.disabled = false;
            viewPostBtn.disabled = !currentUser.postUrl;
            likeButton.disabled = false;
            dislikeButton.disabled = false;
            skipButton.disabled = false;
            
            const preference = getUserPreference(currentUser.username, state.currentLocationId);
            likeButton.style.opacity = preference === 'liked' ? '1' : '0.8';
            dislikeButton.style.opacity = preference === 'disliked' ? '1' : '0.8';
            skipButton.style.opacity = preference === 'skipped' ? '1' : '0.8';
            
            userCounter.textContent = `${state.currentIndex + 1} / ${state.filteredUsers.length}`;
            
            prevButton.disabled = state.currentIndex === 0;
            nextButton.disabled = state.currentIndex === state.filteredUsers.length - 1;
            
            // Update profile preview
            updateProfilePreview(currentUser.username);
        } else {
            userTitle.textContent = 'No User Selected';
            userAvatar.style.backgroundImage = 'none';
            userAvatar.textContent = '?';
            
            // Reset user details to default
            const userDetails = userCard.querySelector('.manager-user-details');
            userDetails.innerHTML = `
                <h2>Username</h2>
                <div class="manager-user-meta">Select a location to start browsing users</div>
            `;
            
            viewProfileBtn.disabled = true;
            viewPostBtn.disabled = true;
            likeButton.disabled = true;
            dislikeButton.disabled = true;
            skipButton.disabled = true;
            
            userCounter.textContent = '0 / 0';
            prevButton.disabled = true;
            nextButton.disabled = true;
            
            // Clear profile preview
            updateProfilePreview(null);
        }
    }

    // Update stats
    function updateStats() {
        const totalCountEl = document.getElementById('manager-totalCount');
        const likedCountEl = document.getElementById('manager-likedCount');
        const dislikedCountEl = document.getElementById('manager-dislikedCount');
        const pendingCountEl = document.getElementById('manager-pendingCount');

        if (!state.currentLocationId) {
            totalCountEl.textContent = '0';
            likedCountEl.textContent = '0';
            dislikedCountEl.textContent = '0';
            pendingCountEl.textContent = '0';
            return;
        }

        const total = state.filteredUsers.length;
        let liked = 0;
        let disliked = 0;

        state.filteredUsers.forEach(user => {
            const pref = getUserPreference(user.username, state.currentLocationId);
            if (pref === 'liked') liked++;
            else if (pref === 'disliked') disliked++;
        });

        const pending = total - liked - disliked;

        totalCountEl.textContent = total;
        likedCountEl.textContent = liked;
        dislikedCountEl.textContent = disliked;
        pendingCountEl.textContent = pending;
    }

    // Switch tabs
    function switchTab(tabName) {
        const browseTab = document.getElementById('manager-browseTab');
        const likedTab = document.getElementById('manager-likedTab');
        const searchTab = document.getElementById('manager-searchTab');
        const browseContent = document.getElementById('manager-browseContent');
        const likedContent = document.getElementById('manager-likedContent');
        const searchContent = document.getElementById('manager-searchContent');

        [browseTab, likedTab, searchTab].forEach(tab => tab.classList.remove('active'));
        [browseContent, likedContent, searchContent].forEach(content => content.classList.remove('active'));

        if (tabName === 'browse') {
            browseTab.classList.add('active');
            browseContent.classList.add('active');
        } else if (tabName === 'liked') {
            likedTab.classList.add('active');
            likedContent.classList.add('active');
            updateLikedUsersGrid();
        } else if (tabName === 'search') {
            searchTab.classList.add('active');
            searchContent.classList.add('active');
        }
    }

    // Update liked users grid
    function updateLikedUsersGrid(filterText = '') {
        const likedGrid = document.getElementById('manager-likedGrid');
        
        if (!state.currentLocationId) {
            likedGrid.innerHTML = '<div class="manager-no-data">No location selected</div>';
            return;
        }

        const likedUsers = state.filteredUsers.filter(user => {
            const pref = getUserPreference(user.username, state.currentLocationId);
            return pref === 'liked';
        });

        const filteredUsers = filterText 
            ? likedUsers.filter(user => user.username.toLowerCase().includes(filterText.toLowerCase()))
            : likedUsers;

        if (filteredUsers.length === 0) {
            likedGrid.innerHTML = '<div class="manager-no-data">No liked users found</div>';
            return;
        }

        likedGrid.innerHTML = '';

        filteredUsers.forEach(user => {
            const gridItem = document.createElement('div');
            gridItem.className = 'manager-user-grid-item';
            
            gridItem.innerHTML = `
                <div class="manager-user-grid-avatar" ${user.profilePicUrl ? `style="background-image: url(${user.profilePicUrl}); background-size: cover; background-position: center;"` : ''}>${user.profilePicUrl ? '' : user.username.charAt(0).toUpperCase()}</div>
                <div class="manager-user-grid-name">@${user.username}</div>
                ${user.fullName ? `<div style="font-size: 12px; color: #8e8e8e; margin-bottom: 5px;">${user.fullName}</div>` : ''}
                ${user.followerCount !== undefined ? `<div style="font-size: 11px; color: #8e8e8e;">${formatCount(user.followerCount)} followers</div>` : ''}
                <div class="manager-user-grid-actions">
                    <button class="manager-action-button manager-view-profile">View</button>
                    <button class="manager-action-button manager-dislike-button">Dislike</button>
                </div>
            `;

            const viewBtn = gridItem.querySelector('.manager-view-profile');
            const dislikeBtn = gridItem.querySelector('.manager-dislike-button');

            viewBtn.addEventListener('click', () => {
                openProfileWithFocusManagement(user.username);
            });

            dislikeBtn.addEventListener('click', () => {
                setUserPreference(user.username, 'disliked');
                updateLikedUsersGrid(filterText);
                updateUI();
            });

            likedGrid.appendChild(gridItem);
        });
    }

    // Event listeners
    document.getElementById('manager-locationSelect').addEventListener('change', (e) => {
        if (e.target.value) {
            loadUsersForLocation(e.target.value);
        } else {
            state.users = [];
            state.filteredUsers = [];
            state.currentLocationId = null;
            updateUI();
        }
    });

    // Category filter listener
    document.getElementById('manager-categorySelect').addEventListener('change', (e) => {
        state.currentCategory = e.target.value;
        state.currentIndex = 0;
        filterUsersByCategory(state.currentCategory);
        updateUI();
        updateStats();
    });

    // Navigation
    document.getElementById('manager-prevButton').addEventListener('click', () => {
        if (state.currentIndex > 0) {
            state.currentIndex--;
            updateUI();
        }
    });

    document.getElementById('manager-nextButton').addEventListener('click', () => {
        if (state.currentIndex < state.filteredUsers.length - 1) {
            state.currentIndex++;
            updateUI();
        }
    });

    // Action buttons
    document.getElementById('manager-likeButton').addEventListener('click', () => {
        const currentUser = getCurrentUser();
        if (currentUser) {
            setUserPreference(currentUser.username, 'liked');
            
            // Re-filter to update the list
            filterUsersByCategory(state.currentCategory);
            
            // If current category is not 'liked' or 'all', advance to next user
            if (state.currentCategory !== 'liked' && state.currentCategory !== 'all') {
                // Current user is no longer in the filtered list, so don't advance index
                if (state.currentIndex >= state.filteredUsers.length) {
                    state.currentIndex = Math.max(0, state.filteredUsers.length - 1);
                }
            } else {
                // In 'liked' or 'all' view, advance to next user
                if (state.currentIndex < state.filteredUsers.length - 1) {
                    state.currentIndex++;
                }
            }
            updateUI();
            updateStats();
        }
    });

    document.getElementById('manager-dislikeButton').addEventListener('click', () => {
        const currentUser = getCurrentUser();
        if (currentUser) {
            setUserPreference(currentUser.username, 'disliked');
            
            // Re-filter to update the list
            filterUsersByCategory(state.currentCategory);
            
            // If current category is not 'disliked' or 'all', advance to next user
            if (state.currentCategory !== 'disliked' && state.currentCategory !== 'all') {
                // Current user is no longer in the filtered list, so don't advance index
                if (state.currentIndex >= state.filteredUsers.length) {
                    state.currentIndex = Math.max(0, state.filteredUsers.length - 1);
                }
            } else {
                // In 'disliked' or 'all' view, advance to next user
                if (state.currentIndex < state.filteredUsers.length - 1) {
                    state.currentIndex++;
                }
            }
            updateUI();
            updateStats();
        }
    });

    document.getElementById('manager-skipButton').addEventListener('click', () => {
        const currentUser = getCurrentUser();
        if (currentUser) {
            setUserPreference(currentUser.username, 'skipped');
            
            // Re-filter to update the list
            filterUsersByCategory(state.currentCategory);
            
            // Skip is treated as pending, so in pending view, advance to next
            if (state.currentCategory === 'pending' || state.currentCategory === 'all') {
                if (state.currentIndex < state.filteredUsers.length - 1) {
                    state.currentIndex++;
                }
            } else {
                // In other views, user is removed from list
                if (state.currentIndex >= state.filteredUsers.length) {
                    state.currentIndex = Math.max(0, state.filteredUsers.length - 1);
                }
            }
            updateUI();
            updateStats();
        }
    });

    document.getElementById('manager-viewProfile').addEventListener('click', () => {
        const currentUser = getCurrentUser();
        if (currentUser) {
            openProfileWithFocusManagement(currentUser.username);
        }
    });

    document.getElementById('manager-viewPost').addEventListener('click', () => {
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.postUrl) {
            // For post URLs, use regular window.open since we're not navigating to next user
            window.open(currentUser.postUrl, 'instagram_post_window');
            
            // Still refocus the manager
            setTimeout(() => {
                window.focus();
                const overlay = document.getElementById('instagram-manager-overlay');
                if (overlay) overlay.focus();
            }, 500);
        }
    });

    // Tab navigation
    document.getElementById('manager-browseTab').addEventListener('click', () => switchTab('browse'));
    document.getElementById('manager-likedTab').addEventListener('click', () => switchTab('liked'));
    document.getElementById('manager-searchTab').addEventListener('click', () => switchTab('search'));

    // Liked users search
    document.getElementById('manager-likedSearchInput').addEventListener('input', (e) => {
        updateLikedUsersGrid(e.target.value);
    });

    document.getElementById('manager-clearLikedFilter').addEventListener('click', () => {
        document.getElementById('manager-likedSearchInput').value = '';
        updateLikedUsersGrid();
    });

    // Search functionality
    function performSearch() {
        const query = document.getElementById('manager-searchInput').value.trim().toLowerCase();
        const searchResults = document.getElementById('manager-searchResults');
        
        if (!query || !state.currentLocationId) {
            searchResults.innerHTML = '<div class="manager-no-data">Enter a search term to find users</div>';
            return;
        }

        const results = state.filteredUsers.filter(user => 
            user.username.toLowerCase().includes(query)
        );

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="manager-no-data">No matching users found</div>';
            return;
        }

        searchResults.innerHTML = '';

        results.forEach(user => {
            const pref = getUserPreference(user.username, state.currentLocationId);
            
            const gridItem = document.createElement('div');
            gridItem.className = 'manager-user-grid-item';
            
            gridItem.innerHTML = `
                <div class="manager-user-grid-avatar" ${user.profilePicUrl ? `style="background-image: url(${user.profilePicUrl}); background-size: cover; background-position: center;"` : ''}>${user.profilePicUrl ? '' : user.username.charAt(0).toUpperCase()}</div>
                <div class="manager-user-grid-name">@${user.username}</div>
                ${user.fullName ? `<div style="font-size: 12px; color: #8e8e8e; margin-bottom: 5px;">${user.fullName}</div>` : ''}
                <div style="font-size: 12px; color: #8e8e8e;">${pref ? `Status: ${pref}` : 'Status: pending'}</div>
                ${user.followerCount !== undefined ? `<div style="font-size: 11px; color: #8e8e8e;">${formatCount(user.followerCount)} followers</div>` : ''}
                <div class="manager-user-grid-actions">
                    <button class="manager-action-button manager-view-profile">View</button>
                    <button class="manager-action-button manager-like-button">Like</button>
                    <button class="manager-action-button manager-dislike-button">Dislike</button>
                </div>
            `;

            const viewBtn = gridItem.querySelector('.manager-view-profile');
            const likeBtn = gridItem.querySelector('.manager-like-button');
            const dislikeBtn = gridItem.querySelector('.manager-dislike-button');

            viewBtn.addEventListener('click', () => {
                openProfileWithFocusManagement(user.username);
            });

            likeBtn.addEventListener('click', () => {
                setUserPreference(user.username, 'liked');
                performSearch();
            });

            dislikeBtn.addEventListener('click', () => {
                setUserPreference(user.username, 'disliked');
                performSearch();
            });

            searchResults.appendChild(gridItem);
        });
    }

    document.getElementById('manager-searchButton').addEventListener('click', performSearch);
    document.getElementById('manager-searchInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // Add keyboard shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when the manager is open and focused
            if (!document.getElementById('instagram-manager-overlay') || 
                e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Check if manager has focus
            const overlay = document.getElementById('instagram-manager-overlay');
            if (!overlay || !document.hasFocus()) {
                // Show focus indicator if not focused
                if (!document.hasFocus()) {
                    showFocusLostIndicator();
                }
                return;
            }

            const currentUser = getCurrentUser();
            if (!currentUser) return;

            switch(e.key.toLowerCase()) {
                case 'l':
                    e.preventDefault();
                    document.getElementById('manager-likeButton').click();
                    break;
                case 'd':
                    e.preventDefault();
                    document.getElementById('manager-dislikeButton').click();
                    break;
                case 's':
                    e.preventDefault();
                    document.getElementById('manager-skipButton').click();
                    break;
                case 'enter':
                    e.preventDefault();
                    openProfileWithFocusManagement(currentUser.username);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    document.getElementById('manager-nextButton').click();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    document.getElementById('manager-prevButton').click();
                    break;
            }
        });
        
        // Also listen for focus events to hide indicator
        window.addEventListener('focus', () => {
            hideFocusLostIndicator();
        });
        
        // Handle visibility change (when user switches tabs)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && document.hasFocus()) {
                hideFocusLostIndicator();
            } else if (document.hidden) {
                // Don't show indicator when tab is just hidden
                hideFocusLostIndicator();
            }
        });
    }

    // Filter users based on category
    function filterUsersByCategory(category) {
        if (!state.currentLocationId || !state.users.length) {
            state.filteredUsers = [];
            return;
        }

        switch (category) {
            case 'pending':
                state.filteredUsers = state.users.filter(user => {
                    const pref = getUserPreference(user.username, state.currentLocationId);
                    return !pref || pref === 'skipped';
                });
                break;
            case 'liked':
                state.filteredUsers = state.users.filter(user => {
                    const pref = getUserPreference(user.username, state.currentLocationId);
                    return pref === 'liked';
                });
                break;
            case 'disliked':
                state.filteredUsers = state.users.filter(user => {
                    const pref = getUserPreference(user.username, state.currentLocationId);
                    return pref === 'disliked';
                });
                break;
            case 'all':
                state.filteredUsers = [...state.users];
                break;
            default:
                state.filteredUsers = state.users.filter(user => {
                    const pref = getUserPreference(user.username, state.currentLocationId);
                    return !pref || pref === 'skipped';
                });
        }
        
        // Reset current index if it's out of bounds
        if (state.currentIndex >= state.filteredUsers.length) {
            state.currentIndex = Math.max(0, state.filteredUsers.length - 1);
        }
    }

    // Helper function to format large numbers
    function formatCount(count) {
        if (!count) return '0';
        if (count >= 1000000000) return (count / 1000000000).toFixed(1) + 'B';
        if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
        if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
        return count.toString();
    }

    // Initialize
    loadUserPreferences();
    loadLocations();
    updateUI();
    updateStats();
    setupKeyboardShortcuts();
    setupOverlayFocusHandler();

    // Focus the overlay to ensure keyboard shortcuts work
    setTimeout(() => {
        overlay.focus();
    }, 100);

    console.log('Instagram User Manager loaded successfully!');
})(); 