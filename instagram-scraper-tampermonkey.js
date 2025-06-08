// ==UserScript==
// @name         Instagram Profile Scraper
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Scrape Instagram profiles and save to IndexedDB
// @author       You
// @match        https://www.instagram.com/*
// @grant        none
// ==/UserScript==

(async function() {
    'use strict';

    // Constants
    const UNIFIED_STORAGE_KEY = 'instagram_users_unified';
    const USER_PREFERENCES_KEY = 'ig_user_preferences';
    const PROFILE_QUEUE_KEY = 'profile_queue';
    const QUEUE_STATUS_KEY = 'queue_status';
    const DB_NAME = 'InstagramScraperDB';
    const DB_VERSION = 4;

    // IndexedDB utility functions
    class IndexedDBManager {
        constructor() {
            this.db = null;
        }

        async init() {
            console.log('🔧 DEBUG: Initializing IndexedDB...');
            return new Promise((resolve, reject) => {
                // Add timeout for initialization
                const initTimeout = setTimeout(() => {
                    console.error('❌ IndexedDB initialization timeout');
                    reject(new Error('IndexedDB initialization timeout'));
                }, 3000);

                const request = indexedDB.open(DB_NAME, DB_VERSION);
                
                request.onerror = () => {
                    clearTimeout(initTimeout);
                    console.error('❌ IndexedDB open error:', request.error);
                    reject(request.error);
                };
                request.onsuccess = () => {
                    clearTimeout(initTimeout);
                    console.log('✅ IndexedDB initialized successfully');
                    this.db = request.result;
                    resolve(this.db);
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // Create object stores to match data manager schema
                    if (!db.objectStoreNames.contains('users')) {
                        console.log('Creating users store...');
                        const userStore = db.createObjectStore('users', { keyPath: 'username' });
                        userStore.createIndex('hasExtendedData', 'hasExtendedData');
                        userStore.createIndex('followerCount', 'followerCount');
                        userStore.createIndex('lastUpdated', 'lastUpdated');
                    }
                    if (!db.objectStoreNames.contains('settings')) {
                        console.log('Creating settings store...');
                        db.createObjectStore('settings', { keyPath: 'key' });
                    }
                    if (!db.objectStoreNames.contains('preferences')) {
                        console.log('Creating preferences store...');
                        db.createObjectStore('preferences', { keyPath: 'username' });
                    }
                    if (!db.objectStoreNames.contains('locations')) {
                        console.log('Creating locations store...');
                        const locationStore = db.createObjectStore('locations', { keyPath: 'id' });
                        locationStore.createIndex('name', 'name');
                        locationStore.createIndex('lastScraped', 'lastScraped');
                    }
                    if (!db.objectStoreNames.contains('posts')) {
                        console.log('Creating posts store...');
                        const postStore = db.createObjectStore('posts', { keyPath: 'id' });
                        postStore.createIndex('username', 'username');
                        postStore.createIndex('timestamp', 'timestamp');
                        postStore.createIndex('postType', 'postType');
                    }
                    if (!db.objectStoreNames.contains('queue')) {
                        console.log('Creating queue store...');
                        db.createObjectStore('queue', { keyPath: 'id' });
                    }
                };
            });
        }

        async setItem(storeName, key, value) {
            if (!this.db) await this.init();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
                let data;
                if (storeName === 'users') {
                    data = { username: key, ...value };
                } else if (storeName === 'settings') {
                    data = { key, value };
                } else if (storeName === 'preferences') {
                    data = { username: key, preference: value };
                } else if (storeName === 'queue') {
                    data = { id: key, data: value };
                }
                
                const request = store.put(data);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        async getItem(storeName, key) {
            if (!this.db) await this.init();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);
                
                request.onsuccess = () => {
                    const result = request.result;
                    if (!result) {
                        resolve(null);
                        return;
                    }
                    
                    if (storeName === 'users') {
                        const { username, ...userData } = result;
                        resolve(userData);
                    } else if (storeName === 'settings') {
                        resolve(result.value);
                    } else if (storeName === 'preferences') {
                        resolve(result.preference);
                    } else if (storeName === 'queue') {
                        resolve(result.data);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        }

        async getAllItems(storeName) {
            if (!this.db) await this.init();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const results = request.result;
                    if (storeName === 'users') {
                        const users = {};
                        results.forEach(item => {
                            const { username, ...userData } = item;
                            users[username] = userData;
                        });
                        resolve(users);
                    } else if (storeName === 'preferences') {
                        const prefs = {};
                        results.forEach(item => {
                            prefs[item.username] = item.preference;
                        });
                        resolve(prefs);
                    } else {
                        resolve(results);
                    }
                };
                request.onerror = () => reject(request.error);
            });
        }

        async removeItem(storeName, key) {
            if (!this.db) await this.init();
            
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(key);
                
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

    }

    // Initialize IndexedDB manager
    const dbManager = new IndexedDBManager();

    // Settings functions (using localStorage for better performance)
    function getSettingsKey(pageType) {
        return `ig_scraper_settings_${pageType}`;
    }

    async function saveSettings(pageType, settings) {
        try {
            // Save to IndexedDB instead of localStorage to avoid quota issues
            await dbManager.setItem('settings', getSettingsKey(pageType), settings);
            console.log('Settings saved to IndexedDB:', settings);
        } catch (error) {
            console.error('Error saving settings to IndexedDB:', error);
            // Fallback to localStorage if IndexedDB fails
            try {
                localStorage.setItem(getSettingsKey(pageType), JSON.stringify(settings));
                console.log('Settings saved to localStorage as fallback:', settings);
            } catch (fallbackError) {
                console.error('Error saving settings to localStorage:', fallbackError);
            }
        }
    }

    async function loadSettings(pageType) {
        try {
            // Try to load from IndexedDB first
            let settings = await dbManager.getItem('settings', getSettingsKey(pageType));
            
            // If not found in IndexedDB, try localStorage for backward compatibility
            if (!settings) {
                const stored = localStorage.getItem(getSettingsKey(pageType));
                settings = stored ? JSON.parse(stored) : null;
                
                // If found in localStorage, migrate to IndexedDB
                if (settings) {
                    console.log('Migrating settings from localStorage to IndexedDB');
                    await saveSettings(pageType, settings);
                    // Clean up localStorage
                    localStorage.removeItem(getSettingsKey(pageType));
                }
            }
            
            // Use defaults if no settings found
            if (!settings) {
                settings = {
                    autoScroll: false,
                    autoScrollPosts: false,
                    autoOpenProfiles: false,
                    maxScrolls: 5,
                    scrollDelay: 2000,
                    debugMode: false,
                    autoSave: false,
                    autoAdvance: false,
                    collectPosts: true,
                    maxPosts: 12
                };
            }
            
            console.log('Settings loaded:', settings);
            return settings;
        } catch (error) {
            console.error('Error loading settings:', error);
            return {
                autoScroll: false,
                autoScrollPosts: false,
                autoOpenProfiles: false,
                maxScrolls: 5,
                scrollDelay: 2000,
                debugMode: false,
                autoSave: false,
                autoAdvance: false,
                collectPosts: true,
                maxPosts: 12
            };
        }
    }

    async function updateSettings(pageType) {
        try {
            const settings = {
                autoScroll: document.getElementById('auto-scroll-posts')?.checked || false,
                autoOpenProfiles: document.getElementById('auto-open-profiles')?.checked || false,
                autoSave: document.getElementById('auto-save')?.checked || false,
                autoAdvance: document.getElementById('auto-advance')?.checked || false,
                debugMode: document.getElementById('debug-mode')?.checked || false
            };
            
            console.log('💾 Updating settings:', settings);
            await saveSettings(pageType, settings);
            console.log('✅ Settings saved successfully');
        } catch (error) {
            console.error('❌ Error updating settings:', error);
        }
    }

    // User preferences functions
    async function saveUserPreference(username, preference) {
        try {
            await dbManager.setItem('preferences', username, preference);
            console.log(`Saved preference for ${username}: ${preference}`);
        } catch (error) {
            console.error('Error saving user preference:', error);
        }
    }

    async function getUserPreference(username) {
        try {
            return await dbManager.getItem('preferences', username);
        } catch (error) {
            console.error('Error getting user preference:', error);
            return null;
        }
    }

    async function getAllUserPreferences() {
        try {
            return await dbManager.getAllItems('preferences');
        } catch (error) {
            console.error('Error getting all user preferences:', error);
            return {};
        }
    }

    // User data functions
    async function saveUserToUnifiedStorage(userData) {
        if (!userData || !userData.username) {
            console.error('❌ Cannot save user: invalid userData', userData);
            return;
        }

        // Clean username before saving to prevent duplicates
        const cleanedUsername = userData.username.replace(/[.\s]+$/, '').trim();
        const cleanedUserData = {
            ...userData,
            username: cleanedUsername
        };

        try {
            console.log(`✅ Saved user data for: ${cleanedUsername}`);
            await dbManager.setItem('users', cleanedUsername, cleanedUserData);
        } catch (error) {
            console.error('❌ Error saving to IndexedDB:', error);
        }
    }

    async function loadAllUsersFromUnifiedStorage() {
        try {
            console.log('🔧 DEBUG: Attempting to load users from IndexedDB...');
            
            // Add timeout protection
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('IndexedDB timeout')), 5000);
            });
            
            const loadPromise = dbManager.getAllItems('users');
            
            const users = await Promise.race([loadPromise, timeoutPromise]);
            console.log('🔧 DEBUG: Successfully loaded users from IndexedDB');
            return users;
        } catch (error) {
            console.error('Error loading users from unified storage:', error);
            console.log('🔧 DEBUG: Falling back to empty user object');
            return {};
        }
    }

    // Check if we're on a valid page
    function isValidPage() {
        const path = window.location.pathname;
        const search = window.location.search;
        return path.includes('/locations/') || 
               path.match(/^\/[^\/]+\/?$/) ||
               (path.includes('/explore/search/') && search.includes('q='));
    }

    // Extract location ID, username, or search query from URL
    function getPageInfo() {
        const path = window.location.pathname;
        const search = window.location.search;
        const locationMatch = path.match(/\/locations\/(\d+)/);
        const usernameMatch = path.match(/^\/([^\/]+)\/?$/);
        const searchMatch = path.match(/\/explore\/search\//) && search.match(/q=([^&]+)/);
        
        // Debug logging
        const isDebugMode = localStorage.getItem('ig_scraper_debug') === 'true';
        if (isDebugMode) {
            console.log('🔍 DEBUG: Page detection details:');
            console.log('  Path:', path);
            console.log('  Search:', search);
            console.log('  Location match:', locationMatch);
            console.log('  Username match:', usernameMatch);
            console.log('  Search match:', searchMatch);
        }
        
        if (locationMatch) {
            if (isDebugMode) console.log('✅ Detected as location page');
            return { type: 'location', id: locationMatch[1] };
        } else if (searchMatch) {
            const query = decodeURIComponent(searchMatch[1]);
            if (isDebugMode) console.log('✅ Detected as search page with query:', query);
            return { type: 'search', query: query };
        } else if (usernameMatch && !['explore', 'accounts', 'p', 'direct', 'stories', 'reels', 'tv'].includes(usernameMatch[1])) {
            // Clean the username to remove any trailing punctuation (but not underscores)
            const cleanedUsername = usernameMatch[1]
                .replace(/[.,;:!?'"()\[\]{}]+$/, '') // Remove trailing punctuation but preserve underscores
                .trim();
            
            if (isDebugMode) {
                console.log('  Raw username from path:', usernameMatch[1]);
                console.log('  Cleaned username:', cleanedUsername);
                console.log('  Regex test result:', /^[a-zA-Z0-9._]{1,30}$/.test(cleanedUsername));
                console.log('  Not only periods:', !cleanedUsername.match(/^\.+$/));
            }
            
            // Instagram username validation (more accurate):
            // - 1-30 characters
            // - Only letters, numbers, periods, and underscores
            // - Can start/end with underscores (valid in Instagram)
            // - Cannot be only periods
            if (/^[a-zA-Z0-9._]{1,30}$/.test(cleanedUsername) && 
                cleanedUsername !== '.' && 
                cleanedUsername !== '..' &&
                !cleanedUsername.match(/^\.+$/)) { // Reject usernames that are only periods
                if (isDebugMode) console.log('✅ Detected as profile page for username:', cleanedUsername);
                return { type: 'profile', username: cleanedUsername };
            } else {
                if (isDebugMode) console.log('❌ Username validation failed for:', cleanedUsername);
            }
        } else {
            if (isDebugMode) {
                if (usernameMatch) {
                    console.log('❌ Username is in exclusion list:', usernameMatch[1]);
                } else {
                    console.log('❌ No pattern matches found');
                }
            }
        }
        
        if (isDebugMode) console.log('❌ Page type could not be determined');
        return null;
    }

    // Wait for elements to load
    function waitForElements(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                resolve(elements);
                return;
            }

            const observer = new MutationObserver((mutations) => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    observer.disconnect();
                    resolve(elements);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timeout waiting for ${selector}`));
            }, timeout);
        });
    }

    // Create manager UI with single user view and filtering
    async function createManagerUI() {
        // Remove existing UIs
        const existingManager = document.getElementById('instagram-manager-ui');
        const existingScraper = document.getElementById('instagram-scraper-ui');
        if (existingManager) existingManager.remove();
        if (existingScraper) existingScraper.remove();

        const users = await loadAllUsersFromUnifiedStorage();
        
        // Filter to only show users with extended data (posts, bio, follower count, etc.)
        const extendedUsers = Object.values(users).filter(user => {
            return user.followerCount > 0 || 
                   user.biography || 
                   user.fullName || 
                   (user.recentPosts && user.recentPosts.length > 0);
        });
        
        if (extendedUsers.length === 0) {
            const noDataUI = document.createElement('div');
            noDataUI.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1e293b;
                color: white;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #334155;
                text-align: center;
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            `;
            noDataUI.innerHTML = `
                <h3 style="margin: 0 0 10px 0; color: #e2e8f0;">No Extended Profile Data</h3>
                <p style="margin: 0 0 15px 0; color: #94a3b8;">No profiles with extended data found. Use "Open Profiles" to collect detailed data first.</p>
                <button onclick="this.parentElement.remove()" style="padding: 8px 15px; background: #0095f6; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
            `;
            document.body.appendChild(noDataUI);
            return;
        }

        let currentFilter = 'pending'; // pending, liked, all
        let currentUserIndex = 0;

        // Filter users based on current filter
        async function getFilteredUsers() {
            if (currentFilter === 'all') {
                return extendedUsers;
            }
            
            const filteredUsers = [];
            for (const user of extendedUsers) {
                const preference = await getUserPreference(user.username);
                if (currentFilter === 'pending') {
                    if (!preference || preference === 'none') {
                        filteredUsers.push(user);
                    }
                } else if (currentFilter === 'liked') {
                    if (preference === 'like') {
                        filteredUsers.push(user);
                    }
                } else if (currentFilter === 'disliked') {
                    if (preference === 'dislike') {
                        filteredUsers.push(user);
                    }
                }
            }
            return filteredUsers;
        }

        // Sort users: pending (no preference) first, then liked, then disliked
        async function sortUsers(userList) {
            const usersWithPrefs = [];
            for (const user of userList) {
                const preference = await getUserPreference(user.username);
                usersWithPrefs.push({ user, preference: preference || 'none' });
            }
            
            usersWithPrefs.sort((a, b) => {
                // Priority: none (0) > like (1) > dislike (2)
                const priority = { 'none': 0, 'like': 1, 'dislike': 2 };
                return (priority[a.preference] || 0) - (priority[b.preference] || 0);
            });
            
            return usersWithPrefs.map(item => item.user);
        }

        // Count users by preference
        async function getUserCounts() {
            let pending = 0, liked = 0, disliked = 0;
            
            for (const user of extendedUsers) {
                const preference = await getUserPreference(user.username);
                if (!preference || preference === 'none') {
                    pending++;
                } else if (preference === 'like') {
                    liked++;
                } else if (preference === 'dislike') {
                    disliked++;
                }
            }
            
            return { pending, liked, disliked, total: extendedUsers.length };
        }

        const managerUI = document.createElement('div');
        managerUI.id = 'instagram-manager-ui';
        managerUI.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #0f172a;
            color: white;
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        async function updateUserDisplay() {
            const filteredUsers = await sortUsers(await getFilteredUsers());
            const counts = await getUserCounts();
            
            if (filteredUsers.length === 0) {
                managerUI.innerHTML = `
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                        <h2 style="color: #64748b; margin-bottom: 20px;">No ${currentFilter} profiles found</h2>
                        <div style="display: flex; gap: 10px; margin-bottom: 20px;" id="filter-buttons-container">
                            <button data-filter="pending" style="padding: 8px 15px; background: ${currentFilter === 'pending' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Pending (${counts.pending})
                            </button>
                            <button data-filter="liked" style="padding: 8px 15px; background: ${currentFilter === 'liked' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                Liked (${counts.liked})
                            </button>
                            <button data-filter="all" style="padding: 8px 15px; background: ${currentFilter === 'all' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                All (${counts.total})
                            </button>
                        </div>
                        <button id="close-manager-empty" style="padding: 8px 15px; background: #64748b; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
                    </div>
                `;
                
                // Attach event listeners for empty state
                const filterButtons = managerUI.querySelectorAll('[data-filter]');
                filterButtons.forEach(button => {
                    button.addEventListener('click', async () => {
                        currentFilter = button.getAttribute('data-filter');
                        currentUserIndex = 0;
                        await updateUserDisplay();
                    });
                });
                
                const closeButton = document.getElementById('close-manager-empty');
                if (closeButton) {
                    closeButton.addEventListener('click', () => {
                        managerUI.remove();
                    });
                }
                return;
            }

            // Reset index if it's out of bounds
            if (currentUserIndex >= filteredUsers.length) {
                currentUserIndex = 0;
            }

            const user = filteredUsers[currentUserIndex];
            const preference = await getUserPreference(user.username);
            const recentPosts = user.recentPosts || [];

            const content = `
                <div style="flex: 1; overflow-y: auto; padding: 0;">
                    <div style="max-width: 1000px; margin: 0 auto; padding: 20px;">
                        
                        <!-- Filter Buttons -->
                        <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 20px;" id="filter-buttons-main">
                            <button data-filter="pending" style="padding: 8px 15px; background: ${currentFilter === 'pending' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                Pending (${counts.pending})
                            </button>
                            <button data-filter="liked" style="padding: 8px 15px; background: ${currentFilter === 'liked' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                Liked (${counts.liked})
                            </button>
                            <button data-filter="all" style="padding: 8px 15px; background: ${currentFilter === 'all' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                All (${counts.total})
                            </button>
                        </div>

                        <!-- User Header -->
                        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px; background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                            <img src="${user.profilePicUrl || '/favicon.ico'}" 
                                 style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 2px solid #0095f6;"
                                 onerror="this.src='/favicon.ico'">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <h1 style="margin: 0; color: #0095f6; font-size: 22px; font-weight: 600;">
                                        <a href="https://www.instagram.com/${user.username}/" target="_blank" style="color: #0095f6; text-decoration: none;">
                                            @${user.username}
                                        </a>
                                    </h1>
                                    <div style="background: ${preference === 'like' ? '#10b981' : preference === 'dislike' ? '#ef4444' : '#64748b'}; color: white; padding: 3px 6px; border-radius: 3px; font-size: 11px; text-transform: uppercase;">
                                        ${preference === 'like' ? '👍 Liked' : preference === 'dislike' ? '👎 Disliked' : '⚪ Pending'}
                                    </div>
                                </div>
                                <h2 style="margin: 0 0 8px 0; color: #e2e8f0; font-size: 16px; font-weight: 500;">${user.fullName || 'Name not available'}</h2>
                                <div style="display: flex; gap: 15px; margin-bottom: 10px; color: #94a3b8; font-size: 14px;">
                                    <span><strong>${user.followerCount || 0}</strong> followers</span>
                                    <span><strong>${user.followingCount || 0}</strong> following</span>
                                    <span><strong>${user.postsCount || 0}</strong> posts</span>
                                </div>
                                ${user.biography ? `
                                <div style="background: #0f172a; padding: 10px; border-radius: 6px; border-left: 2px solid #0095f6;">
                                    <p style="margin: 0; color: #e2e8f0; font-size: 13px; line-height: 1.4;">${user.biography}</p>
                                </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Compact Controls Row -->
                        <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 20px; align-items: center;">
                            <button id="prev-user" ${currentUserIndex === 0 ? 'disabled' : ''} style="padding: 8px 12px; background: ${currentUserIndex === 0 ? '#334155' : '#0095f6'}; color: white; border: none; border-radius: 4px; cursor: ${currentUserIndex === 0 ? 'not-allowed' : 'pointer'}; font-weight: bold; font-size: 12px; min-width: 70px;">
                                ⬅️ Prev
                            </button>
                            
                            <button id="like-user" style="padding: 8px 16px; background: ${preference === 'like' ? '#10b981' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 4px; min-width: 80px; justify-content: center;">
                                👍 <span style="font-size: 10px; opacity: 0.8;">[1]</span>
                            </button>
                            
                            <button id="dislike-user" style="padding: 8px 16px; background: ${preference === 'dislike' ? '#ef4444' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 4px; min-width: 80px; justify-content: center;">
                                👎 <span style="font-size: 10px; opacity: 0.8;">[2]</span>
                            </button>
                            
                            <button id="neutral-user" style="padding: 8px 16px; background: ${preference === 'none' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 4px; min-width: 80px; justify-content: center;">
                                ⚪ <span style="font-size: 10px; opacity: 0.8;">[3]</span>
                            </button>
                            
                            <button id="next-user" ${currentUserIndex === filteredUsers.length - 1 ? 'disabled' : ''} style="padding: 8px 12px; background: ${currentUserIndex === filteredUsers.length - 1 ? '#334155' : '#0095f6'}; color: white; border: none; border-radius: 4px; cursor: ${currentUserIndex === filteredUsers.length - 1 ? 'not-allowed' : 'pointer'}; font-weight: bold; font-size: 12px; min-width: 70px;">
                                Next ➡️
                            </button>
                            
                            <span style="padding: 6px 10px; background: #1e293b; border-radius: 4px; color: #e2e8f0; font-weight: bold; border: 1px solid #334155; font-size: 11px; margin: 0 8px;">
                                ${currentUserIndex + 1} / ${filteredUsers.length}
                            </span>
                            
                            <button id="close-manager" style="padding: 8px 12px; background: #64748b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 4px;">
                                ✕ <span style="font-size: 10px; opacity: 0.8;">[ESC]</span>
                            </button>
                        </div>

                        <!-- Hotkeys Help -->
                        <div style="text-align: center; margin-bottom: 20px; padding: 8px; background: #0f172a; border-radius: 4px; border: 1px solid #334155;">
                            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">⚡ Hotkeys:</div>
                            <div style="font-size: 10px; color: #64748b; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
                                <span>1: Like</span>
                                <span>2: Dislike</span>
                                <span>3: Neutral</span>
                                <span>←→: Navigate</span>
                                <span>ESC: Close</span>
                                <span>Space: Next</span>
                            </div>
                        </div>

                        <!-- Recent Posts -->
                        ${recentPosts.length > 0 ? `
                        <div style="background: #1e293b; border-radius: 8px; padding: 20px; border: 1px solid #334155;">
                            <h3 style="margin: 0 0 15px 0; color: #e2e8f0; font-size: 16px; font-weight: 600;">Recent Posts (${recentPosts.length})</h3>
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                                ${recentPosts.slice(0, 12).map(post => `
                                    <div style="background: #0f172a; border-radius: 6px; overflow: hidden; border: 1px solid #334155;">
                                        <a href="${post.url}" target="_blank" style="display: block; text-decoration: none; position: relative;">
                                            <img src="${post.thumbnailUrl}" 
                                                 style="width: 100%; height: 240px; object-fit: cover; display: block;"
                                                 onerror="this.style.display='none'">
                                            ${post.isVideo ? `
                                                <div style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.8); color: white; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">📹</div>
                                            ` : ''}
                                        </a>
                                        ${post.caption ? `
                                            <div style="padding: 12px;">
                                                <p style="margin: 0; color: #e2e8f0; font-size: 12px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                                                    ${post.caption.length > 80 ? post.caption.substring(0, 80) + '...' : post.caption}
                                                </p>
                                            </div>
                                        ` : `
                                            <div style="padding: 12px; text-align: center; color: #64748b; font-size: 11px;">
                                                No caption
                                            </div>
                                        `}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : `
                        <div style="background: #1e293b; border-radius: 8px; padding: 30px; text-align: center; border: 1px solid #334155;">
                            <p style="color: #64748b; font-size: 14px; margin: 0;">No recent posts available for this user</p>
                        </div>
                        `}

                        <!-- User Metadata -->
                        <div style="margin-top: 20px; background: #1e293b; border-radius: 8px; padding: 15px; border: 1px solid #334155;">
                            <h3 style="margin: 0 0 10px 0; color: #e2e8f0; font-size: 14px; font-weight: 600;">User Information</h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; font-size: 12px; color: #94a3b8;">
                                ${user.locationId ? `<div><strong>Location ID:</strong> ${user.locationId}</div>` : ''}
                                ${user.profilePage ? `<div><strong>Profile Page:</strong> ${user.profilePage}</div>` : ''}
                                <div><strong>Last Updated:</strong> ${user.lastUpdated ? new Date(user.lastUpdated).toLocaleDateString() : 'Unknown'}</div>
                                <div><strong>Data Source:</strong> ${user.locationId ? 'Location Page' : user.profilePage ? 'Profile Page' : 'Manual'}</div>
                            </div>
                        </div>
                        
                    </div>
                </div>
            `;

            managerUI.innerHTML = content;

            // Helper function to advance to next user
            async function advanceToNext() {
                const filteredUsers = await sortUsers(await getFilteredUsers());
                if (currentUserIndex < filteredUsers.length - 1) {
                    currentUserIndex++;
                    await updateUserDisplay();
                } else {
                    // If at the end, show completion message in status
                    const statusDiv = document.createElement('div');
                    statusDiv.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #10b981;
                        color: white;
                        padding: 10px 15px;
                        border-radius: 4px;
                        z-index: 999999;
                        font-size: 12px;
                    `;
                    statusDiv.textContent = 'All users reviewed!';
                    document.body.appendChild(statusDiv);
                    setTimeout(() => statusDiv.remove(), 2000);
                }
            }

            // Filter button event listeners
            const filterButtons = managerUI.querySelectorAll('[data-filter]');
            filterButtons.forEach(button => {
                button.addEventListener('click', async () => {
                    currentFilter = button.getAttribute('data-filter');
                    currentUserIndex = 0;
                    await updateUserDisplay();
                });
            });

            // Add event listeners for this user
            const likeBtn = document.getElementById('like-user');
            const dislikeBtn = document.getElementById('dislike-user');
            const neutralBtn = document.getElementById('neutral-user');
            const prevBtn = document.getElementById('prev-user');
            const nextBtn = document.getElementById('next-user');
            const closeBtn = document.getElementById('close-manager');

            if (likeBtn) {
                likeBtn.addEventListener('click', async () => {
                    await saveUserPreference(user.username, 'like');
                    await advanceToNext();
                });
            }

            if (dislikeBtn) {
                dislikeBtn.addEventListener('click', async () => {
                    await saveUserPreference(user.username, 'dislike');
                    await advanceToNext();
                });
            }

            if (neutralBtn) {
                neutralBtn.addEventListener('click', async () => {
                    await saveUserPreference(user.username, 'none');
                    await updateUserDisplay(); // Don't auto-advance for neutral
                });
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', async () => {
                    if (currentUserIndex > 0) {
                        currentUserIndex--;
                        await updateUserDisplay();
                    }
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', async () => {
                    const filteredUsers = await sortUsers(await getFilteredUsers());
                    if (currentUserIndex < filteredUsers.length - 1) {
                        currentUserIndex++;
                        await updateUserDisplay();
                    }
                });
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    managerUI.remove();
                });
            }
        }

        document.body.appendChild(managerUI);
        await updateUserDisplay();

        // Global keyboard navigation - set up once
        const handleKeyPress = async (e) => {
            // Handle keyboard shortcuts for manager UI
            if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea') {
                return; // Don't trigger shortcuts when typing in inputs
            }
            
            const filteredUsers = await sortUsers(await getFilteredUsers());
            
            if (e.key === 'ArrowLeft' && currentUserIndex > 0) {
                currentUserIndex--;
                await updateUserDisplay();
            } else if (e.key === 'ArrowRight' && currentUserIndex < filteredUsers.length - 1) {
                currentUserIndex++;
                await updateUserDisplay();
            } else if (e.key === ' ' && currentUserIndex < filteredUsers.length - 1) {
                e.preventDefault(); // Prevent page scroll
                currentUserIndex++;
                await updateUserDisplay();
            } else if (e.key === 'Escape') {
                document.getElementById('instagram-manager-ui')?.remove();
            } else if (e.key === '1') {
                const currentUser = filteredUsers[currentUserIndex];
                if (currentUser) {
                    await saveUserPreference(currentUser.username, 'like');
                    if (currentUserIndex < filteredUsers.length - 1) {
                        currentUserIndex++;
                        await updateUserDisplay();
                    }
                }
            } else if (e.key === '2') {
                const currentUser = filteredUsers[currentUserIndex];
                if (currentUser) {
                    await saveUserPreference(currentUser.username, 'dislike');
                    if (currentUserIndex < filteredUsers.length - 1) {
                        currentUserIndex++;
                        await updateUserDisplay();
                    }
                }
            } else if (e.key === '3') {
                const currentUser = filteredUsers[currentUserIndex];
                if (currentUser) {
                    await saveUserPreference(currentUser.username, 'none');
                    await updateUserDisplay();
                }
            }
        };

        // Set up keyboard listener
        document.addEventListener('keydown', handleKeyPress);

        return managerUI;
    }

    // Create minimal corner UI when auto download & advance is disabled
    function createMinimalScraperUI(pageInfo, settings) {
        const scraperUI = document.createElement('div');
        scraperUI.id = 'instagram-scraper-ui';
        scraperUI.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1e293b;
            color: white;
            padding: 8px;
            border-radius: 50%;
            border: 2px solid #334155;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            z-index: 99998;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
        `;

        scraperUI.innerHTML = `
            <div style="font-size: 20px; text-align: center;" title="Instagram Scraper - Click to enable Auto Download & Advance">
                📊
            </div>
        `;

        // Add hover effect
        scraperUI.addEventListener('mouseenter', () => {
            scraperUI.style.transform = 'scale(1.1)';
            scraperUI.style.background = '#0095f6';
        });

        scraperUI.addEventListener('mouseleave', () => {
            scraperUI.style.transform = 'scale(1)';
            scraperUI.style.background = '#1e293b';
        });

        // Click to enable auto download & advance and switch to full UI
        scraperUI.addEventListener('click', async () => {
            console.log('Minimal UI clicked - enabling auto download & advance');
            
            // Update settings to enable auto download & advance
            settings.autoSave = true;
            settings.autoAdvance = true;
            await saveSettings(pageInfo.type, settings);
            
            // Show notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 12px 18px;
                border-radius: 6px;
                z-index: 999999;
                font-size: 12px;
                font-weight: bold;
                border: 2px solid #059669;
            `;
            notification.textContent = '🚀 Auto Download & Advance: ENABLED';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
            
            // Recreate UI with full interface
            createScraperUI(pageInfo);
        });

        document.body.appendChild(scraperUI);
        return scraperUI;
    }

    async function createScraperUI(pageInfo) {
        try {
            console.log('🔧 DEBUG: Starting createScraperUI with pageInfo:', pageInfo);
            
            // Handle null pageInfo
            if (!pageInfo) {
                console.log('⚠️ pageInfo is null, using fallback values');
                pageInfo = { type: 'unknown', query: null, username: null, id: null };
            }
            
            // Remove any existing UI
            const existingUI = document.getElementById('instagram-scraper-ui');
            if (existingUI) existingUI.remove();

            console.log('🔧 DEBUG: Loading users and settings...');
            
            console.log('🔧 DEBUG: Step 1 - Loading users from unified storage...');
            const users = await loadAllUsersFromUnifiedStorage();
            console.log('🔧 DEBUG: Step 1 COMPLETE - Loaded', Object.keys(users).length, 'users');
            
            console.log('🔧 DEBUG: Step 2 - Loading settings for page type:', pageInfo.type);
            const settings = await loadSettings(pageInfo.type);
            console.log('🔧 DEBUG: Step 2 COMPLETE - Settings loaded:', settings);

            // Check if auto download & advance is enabled
            const isAutoDownloadAdvanceEnabled = settings.autoSave && settings.autoAdvance;
            const isProfilePageCheck = pageInfo.type === 'profile';
            
            // If auto download & advance is disabled on profile pages, show minimal UI
            if (isProfilePageCheck && !isAutoDownloadAdvanceEnabled) {
                return createMinimalScraperUI(pageInfo, settings);
            }

            // Count users with and without extended data
            let usersWithoutExtendedData = 0;
            let usersWithExtendedData = 0;
            
            Object.values(users).forEach(user => {
                const hasExtendedData = user.followerCount > 0 || 
                                      user.biography || 
                                      user.fullName || 
                                      (user.recentPosts && user.recentPosts.length > 0);
                
                if (hasExtendedData) {
                    usersWithExtendedData++;
                } else {
                    usersWithoutExtendedData++;
                }
            });

            console.log('🔧 DEBUG: Users with extended data:', usersWithExtendedData, 'without:', usersWithoutExtendedData);

            const scraperUI = document.createElement('div');
            scraperUI.id = 'instagram-scraper-ui';
            scraperUI.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #1e293b;
                color: white;
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #334155;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 12px;
                z-index: 99998;
                min-width: 280px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;

            const isLocationPage = pageInfo.type === 'location';
            const isProfilePage = pageInfo.type === 'profile';
            const isSearchPage = pageInfo.type === 'search';
            const isUnknownPage = pageInfo.type === 'unknown';

            console.log('🔧 DEBUG: Page type - location:', isLocationPage, 'profile:', isProfilePage, 'search:', isSearchPage, 'unknown:', isUnknownPage);

            let content = `
                <div style="margin-bottom: 12px; display: flex; justify-content: between; align-items: center;">
                    <div>
                        <h3 style="margin: 0 0 8px 0; color: #0095f6; font-size: 14px; font-weight: 600;">
                            📊 Instagram Scraper v2.8
                        </h3>
                        <div style="color: #94a3b8; font-size: 11px;">
                            ${isLocationPage ? '📍 Location Page' : 
                              isProfilePage ? '👤 Profile Page' : 
                              isSearchPage ? `🔍 Search: "${pageInfo.query}"` : 
                              isUnknownPage ? '❓ Unknown Page Type' : '❓ Unknown Page'}
                        </div>
                    </div>
                    <button id="close-scraper" style="padding: 4px 8px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 10px; margin-left: 10px;">
                        ✕
                    </button>
                </div>

                <div id="scraper-status" style="margin-bottom: 10px; padding: 8px; background: #0f172a; border-radius: 4px; border-left: 3px solid #0095f6; font-size: 11px; color: #e2e8f0;">
                    ${isUnknownPage ? 'Page type not detected - limited functionality' : 'Ready to scrape'}
                </div>

                <div id="scraper-results" style="margin-bottom: 12px; padding: 6px; background: #064e3b; border-radius: 4px; color: #6ee7b7; font-size: 10px; min-height: 16px;">
                    <!-- Results will appear here -->
                </div>
            `;

            // Settings section
            content += `
                <div style="margin-bottom: 12px; padding: 8px; background: #0f172a; border-radius: 4px; border: 1px solid #334155;">
                    <div style="font-weight: 600; margin-bottom: 6px; color: #e2e8f0; font-size: 11px;">⚙️ Settings</div>
            `;

            if (isLocationPage || isSearchPage) {
                content += `
                    <label style="display: flex; align-items: center; margin-bottom: 6px; cursor: pointer; font-size: 11px;">
                        <input type="checkbox" id="auto-scroll-posts" ${settings.autoScrollPosts ? 'checked' : ''} style="margin-right: 6px;">
                        <span style="color: #e2e8f0;">Auto-scroll to load more ${isSearchPage ? 'results' : 'posts'}</span>
                    </label>
                    <label style="display: flex; align-items: center; margin-bottom: 6px; cursor: pointer; font-size: 11px;">
                        <input type="checkbox" id="auto-open-profiles" ${settings.autoOpenProfiles ? 'checked' : ''} style="margin-right: 6px;">
                        <span style="color: #e2e8f0;">Auto-open user profiles</span>
                    </label>
                `;
            }

            if (isProfilePage) {
                // Master toggle for auto download & advance
                const masterAutoEnabled = settings.autoSave && settings.autoAdvance;
                content += `
                    <label style="display: flex; align-items: center; margin-bottom: 8px; cursor: pointer; font-size: 11px; background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 4px; padding: 6px;">
                        <input type="checkbox" id="auto-download-advance" ${masterAutoEnabled ? 'checked' : ''} style="margin-right: 8px; transform: scale(1.2);">
                        <span style="color: #10b981; font-weight: 600;">🚀 Auto Download & Advance</span>
                    </label>
                    
                    <div style="margin-left: 12px; padding-left: 8px; border-left: 2px solid #374151;">
                        <label style="display: flex; align-items: center; margin-bottom: 4px; cursor: pointer; font-size: 10px;">
                            <input type="checkbox" id="auto-save" ${settings.autoSave ? 'checked' : ''} style="margin-right: 6px;">
                            <span style="color: #e2e8f0;">Auto-save profile data</span>
                        </label>
                        <label style="display: flex; align-items: center; margin-bottom: 6px; cursor: pointer; font-size: 10px;">
                            <input type="checkbox" id="auto-advance" ${settings.autoAdvance ? 'checked' : ''} style="margin-right: 6px;">
                            <span style="color: #e2e8f0;">Auto-advance to next profile</span>
                        </label>
                    </div>
                `;
            }

            content += `
                    <label style="display: flex; align-items: center; cursor: pointer; font-size: 11px;">
                        <input type="checkbox" id="debug-mode" ${settings.debugMode ? 'checked' : ''} style="margin-right: 6px;">
                        <span style="color: #e2e8f0;">Debug mode</span>
                    </label>
                </div>
            `;

            // Phase 1: Basic Collection
            content += `
                <div style="margin-bottom: 12px; padding: 8px; background: #0f172a; border-radius: 4px; border: 1px solid #334155;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; font-size: 11px;">📋 Basic Collection</div>
            `;

            if (isLocationPage) {
                content += `
                    <button id="start-basic-scraping" style="width: 100%; margin-bottom: 6px; padding: 8px 12px; background: #0095f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">
                        📍 Collect Usernames from Posts
                    </button>
                `;
            } else if (isSearchPage) {
                content += `
                    <button id="start-basic-scraping" style="width: 100%; margin-bottom: 6px; padding: 8px 12px; background: #0095f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">
                        🔍 Collect Usernames from Search Results
                    </button>
                `;
            } else if (isProfilePage) {
                content += `
                    <button id="start-basic-scraping" style="width: 100%; margin-bottom: 6px; padding: 8px 12px; background: #0095f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">
                        👤 Save Profile Data
                    </button>
                `;
            } else if (isUnknownPage) {
                content += `
                    <div style="padding: 8px; background: #451a03; border: 1px solid #92400e; border-radius: 4px; color: #fbbf24; font-size: 11px; text-align: center;">
                        ⚠️ Page type not recognized<br>
                        <span style="font-size: 10px; color: #d97706;">Limited scraping functionality available</span>
                    </div>
                `;
            }

            content += `
                </div>
            `;

            // Phase 2: Extended Data Collection (only show if relevant)
            if (usersWithoutExtendedData > 0 || usersWithExtendedData > 0) {
                content += `
                    <div id="extended-data-section" style="margin-bottom: 12px; padding: 8px; background: #0f172a; border-radius: 4px; border: 1px solid #334155;">
                        <div style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; font-size: 11px;">🔍 Extended Data Collection</div>
                `;

                if (usersWithoutExtendedData > 0) {
                    content += `
                        <button id="open-profiles" style="width: 100%; margin-bottom: 6px; padding: 8px 12px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">
                            🔄 Open Profiles Without Data (${usersWithoutExtendedData})
                        </button>
                    `;
                }

                if (usersWithExtendedData > 0) {
                    content += `
                        <button id="open-manager" style="width: 100%; margin-bottom: 6px; padding: 8px 12px; background: #7c3aed; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">
                            👥 Manage Users (${usersWithExtendedData})
                        </button>
                    `;
                }

                content += `
                    </div>
                `;
            }

            // Data Management
            content += `
                <div style="padding: 8px; background: #0f172a; border-radius: 4px; border: 1px solid #334155;">
                    <div style="font-weight: 600; margin-bottom: 8px; color: #e2e8f0; font-size: 11px;">💾 Data Management</div>
                    <button id="open-viewer" style="width: 100%; margin-bottom: 6px; padding: 8px 12px; background: #0369a1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">
                        📋 View All Users (${Object.keys(users).length})
                    </button>
                    <button id="download-users" style="width: 100%; padding: 8px 12px; background: #0d9488; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500;">
                        📥 Download All Data (${Object.keys(users).length})
                    </button>
                </div>
            `;

            scraperUI.innerHTML = content;
            document.body.appendChild(scraperUI);

            // Add event listeners AFTER the UI is added to DOM
            setTimeout(() => {
                // Master auto download & advance toggle
                const masterToggle = document.getElementById('auto-download-advance');
                if (masterToggle) {
                    masterToggle.addEventListener('change', async (e) => {
                        const isEnabled = e.target.checked;
                        console.log(`Master Auto Download & Advance: ${isEnabled ? 'enabled' : 'disabled'}`);
                        
                        // Update both auto-save and auto-advance checkboxes
                        const autoSaveCheckbox = document.getElementById('auto-save');
                        const autoAdvanceCheckbox = document.getElementById('auto-advance');
                        
                        if (autoSaveCheckbox) {
                            autoSaveCheckbox.checked = isEnabled;
                        }
                        if (autoAdvanceCheckbox) {
                            autoAdvanceCheckbox.checked = isEnabled;
                        }
                        
                        // Save the updated settings
                        await updateSettings(pageInfo.type);
                        
                        // Show notification
                        const notification = document.createElement('div');
                        notification.style.cssText = `
                            position: fixed;
                            top: 60px;
                            right: 20px;
                            background: ${isEnabled ? '#10b981' : '#6b7280'};
                            color: white;
                            padding: 12px 18px;
                            border-radius: 6px;
                            z-index: 999999;
                            font-size: 12px;
                            font-weight: bold;
                            border: 2px solid ${isEnabled ? '#059669' : '#4b5563'};
                        `;
                        notification.textContent = isEnabled ? 
                            '🚀 Auto Download & Advance: ON' : 
                            '⏸️ Auto Download & Advance: OFF';
                        document.body.appendChild(notification);
                        setTimeout(() => notification.remove(), 3000);
                        
                        // If disabled on profile page, switch to minimal UI after a short delay
                        if (!isEnabled && pageInfo.type === 'profile') {
                            setTimeout(() => {
                                createScraperUI(pageInfo);
                            }, 3500);
                        }
                    });
                }

                // Settings checkboxes
                const checkboxes = ['auto-scroll-posts', 'auto-open-profiles', 'auto-save', 'auto-advance', 'debug-mode'];
                checkboxes.forEach(checkboxId => {
                    const checkbox = document.getElementById(checkboxId);
                    if (checkbox) {
                        checkbox.addEventListener('change', async () => {
                            // Update master toggle state when individual toggles change
                            if (checkboxId === 'auto-save' || checkboxId === 'auto-advance') {
                                const autoSaveCheckbox = document.getElementById('auto-save');
                                const autoAdvanceCheckbox = document.getElementById('auto-advance');
                                const masterToggle = document.getElementById('auto-download-advance');
                                
                                if (autoSaveCheckbox && autoAdvanceCheckbox && masterToggle) {
                                    const newMasterState = autoSaveCheckbox.checked && autoAdvanceCheckbox.checked;
                                    masterToggle.checked = newMasterState;
                                    
                                    // If auto download & advance is disabled, switch to minimal UI
                                    if (!newMasterState && pageInfo.type === 'profile') {
                                        setTimeout(() => {
                                            createScraperUI(pageInfo);
                                        }, 500);
                                    }
                                }
                            }
                            
                            await updateSettings(pageInfo.type);
                            console.log(`Settings updated: ${checkboxId} = ${checkbox.checked}`);
                        });
                    } else {
                        console.warn(`Checkbox ${checkboxId} not found in DOM`);
                    }
                });

                // Button event listeners
                const closeBtn = document.getElementById('close-scraper');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        console.log('Close button clicked');
                        scraperUI.remove();
                    });
                }

                const startBtn = document.getElementById('start-basic-scraping');
                if (startBtn) {
                    startBtn.addEventListener('click', async () => {
                        console.log('Start scraping button clicked');
                        await startBasicScraping(pageInfo);
                    });
                }

                const openProfilesBtn = document.getElementById('open-profiles');
                if (openProfilesBtn) {
                    openProfilesBtn.addEventListener('click', async () => {
                        console.log('Open profiles button clicked');
                        await openProfilesWithoutData();
                    });
                }

                const downloadBtn = document.getElementById('download-users');
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', async () => {
                        console.log('Download button clicked');
                        await downloadData();
                    });
                }

                const managerBtn = document.getElementById('open-manager');
                if (managerBtn) {
                    managerBtn.addEventListener('click', () => {
                        console.log('Manager button clicked');
                        createManagerUI();
                    });
                }

                const debugCheckbox = document.getElementById('debug-mode');
                if (debugCheckbox) {
                    debugCheckbox.addEventListener('change', (e) => {
                        console.log(`Debug mode ${e.target.checked ? 'enabled' : 'disabled'}`);
                    });
                }

                const viewerBtn = document.getElementById('open-viewer');
                if (viewerBtn) {
                    viewerBtn.addEventListener('click', () => {
                        console.log('Viewer button clicked');
                        createViewerUI();
                    });
                }

                console.log('All event listeners attached successfully');
            }, 100);

            return scraperUI;
        } catch (error) {
            console.error('Error creating scraper UI:', error);
            return null;
        }
    }

    // Debug logging function
    function debugLog(message, data = null, isDebugMode = false) {
        if (isDebugMode) {
            console.log(message, data || '');
            
            const debugOutput = document.getElementById('debug-output');
            if (debugOutput) {
                debugOutput.style.display = 'block';
                const timestamp = new Date().toLocaleTimeString();
                const logEntry = document.createElement('div');
                logEntry.style.marginBottom = '2px';
                logEntry.style.fontSize = '10px';
                logEntry.innerHTML = `<span style="color: #64748b;">[${timestamp}]</span> ${message}`;
                debugOutput.appendChild(logEntry);
                debugOutput.scrollTop = debugOutput.scrollHeight;
            }
        }
    }

    // Auto-scroll to load more content
    async function autoScroll(isDebugMode = false) {
        return new Promise((resolve) => {
            let scrollCount = 0;
            const maxScrolls = 5;
            const scrollDelay = 2000;

            debugLog('🔄 Starting auto-scroll to load more content...', null, isDebugMode);

            function scrollStep() {
                if (scrollCount >= maxScrolls) {
                    debugLog(`✅ Auto-scroll completed (${scrollCount} scrolls)`, null, isDebugMode);
                    resolve();
                    return;
                }

                const beforeHeight = document.body.scrollHeight;
                window.scrollTo(0, document.body.scrollHeight);
                scrollCount++;

                debugLog(`📜 Scroll ${scrollCount}/${maxScrolls} - Height: ${beforeHeight}px`, null, isDebugMode);

                setTimeout(() => {
                    const afterHeight = document.body.scrollHeight;
                    if (afterHeight === beforeHeight) {
                        debugLog('✅ No new content loaded, stopping scroll', null, isDebugMode);
                        resolve();
                    } else {
                        scrollStep();
                    }
                }, scrollDelay);
            }

            scrollStep();
        });
    }

    // Comprehensive image analysis
    function analyzeImages(isDebugMode = false) {
        const allImages = document.querySelectorAll('img');
        debugLog(`🔍 COMPREHENSIVE IMAGE ANALYSIS - Found ${allImages.length} total images`, null, isDebugMode);

        if (isDebugMode && allImages.length > 0) {
            console.log(`🔍 DEBUG: ========== ALL IMAGES FOUND ==========`);
            allImages.forEach((img, index) => {
                const src = img.getAttribute('src');
                const alt = img.getAttribute('alt');
                const className = img.getAttribute('class');
                const style = img.getAttribute('style');
                const parentTag = img.parentElement?.tagName;
                const parentClass = img.parentElement?.getAttribute('class');
                const hasPostLink = !!img.closest('a[href*="/p/"]');
                const closestLink = img.closest('a');
                const linkHref = closestLink?.getAttribute('href');

                console.log(`🔍 DEBUG: Image ${index + 1}/${allImages.length}:`, {
                    src: src,
                    alt: alt?.substring(0, 150) + (alt?.length > 150 ? '...' : ''),
                    class: className,
                    style: style,
                    parentTag: parentTag,
                    parentClass: parentClass,
                    hasPostLink: hasPostLink,
                    linkHref: linkHref,
                    dimensions: {
                        width: img.getAttribute('width'),
                        height: img.getAttribute('height'),
                        naturalWidth: img.naturalWidth || 'unknown',
                        naturalHeight: img.naturalHeight || 'unknown'
                    },
                    isProfilePic: src?.includes('profile_pic'),
                    hasScontent: src?.includes('scontent'),
                    hasCdnInstagram: src?.includes('cdninstagram'),
                    hasIgCacheKey: src?.includes('ig_cache_key'),
                    srcLength: src?.length || 0
                });

                // Show the full URL for first 5 images
                if (index < 5 && src) {
                    console.log(`🔍 DEBUG: Full src for image ${index + 1}:`, src);
                }
            });
            console.log(`🔍 DEBUG: ========== END ALL IMAGES ==========`);

            // Additional analysis of image types
            const profilePics = Array.from(allImages).filter(img => 
                img.getAttribute('src')?.includes('profile_pic'));
            const scontentImages = Array.from(allImages).filter(img => 
                img.getAttribute('src')?.includes('scontent'));
            const cdnInstagramImages = Array.from(allImages).filter(img => 
                img.getAttribute('src')?.includes('cdninstagram'));
            const imagesWithCacheKey = Array.from(allImages).filter(img => 
                img.getAttribute('src')?.includes('ig_cache_key'));
            const imagesWithAlt = Array.from(allImages).filter(img => 
                img.getAttribute('alt') && img.getAttribute('alt').trim().length > 0);
            const imagesInPostLinks = Array.from(allImages).filter(img => 
                img.closest('a[href*="/p/"]'));

            console.log(`🔍 DEBUG: IMAGE TYPE ANALYSIS:`, {
                totalImages: allImages.length,
                profilePics: profilePics.length,
                scontentImages: scontentImages.length,
                cdnInstagramImages: cdnInstagramImages.length,
                imagesWithCacheKey: imagesWithCacheKey.length,
                imagesWithAlt: imagesWithAlt.length,
                imagesInPostLinks: imagesInPostLinks.length
            });

            // Show examples of each type
            if (scontentImages.length > 0) {
                console.log(`🔍 DEBUG: First scontent image:`, {
                    src: scontentImages[0].getAttribute('src'),
                    alt: scontentImages[0].getAttribute('alt')?.substring(0, 100)
                });
            }

            if (imagesWithCacheKey.length > 0) {
                console.log(`🔍 DEBUG: First image with cache key:`, {
                    src: imagesWithCacheKey[0].getAttribute('src'),
                    alt: imagesWithCacheKey[0].getAttribute('alt')?.substring(0, 100)
                });
            }

            if (imagesInPostLinks.length > 0) {
                console.log(`🔍 DEBUG: First image in post link:`, {
                    src: imagesInPostLinks[0].getAttribute('src'),
                    alt: imagesInPostLinks[0].getAttribute('alt')?.substring(0, 100),
                    linkHref: imagesInPostLinks[0].closest('a')?.getAttribute('href')
                });
            }
        }

        return allImages;
    }

    // Extract posts from current page DOM
    function extractPostsFromDOM(pageInfo, isDebugMode = false) {
        debugLog('🔍 Starting post extraction from DOM...', null, isDebugMode);

        // Multiple selectors for different Instagram layouts
        const postSelectors = [
            'a[href*="/p/"]',
            'article a[href*="/p/"]',
            'div[role="button"] a[href*="/p/"]',
            '._aagw a[href*="/p/"]',
            '._aabd a[href*="/p/"]'
        ];

        let postElements = [];
        for (const selector of postSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                debugLog(`✅ Found ${elements.length} posts with selector: "${selector}"`, null, isDebugMode);
                postElements = Array.from(elements);
                break;
            } else {
                debugLog(`❌ No posts found with selector: "${selector}"`, null, isDebugMode);
            }
        }

        if (postElements.length === 0) {
            debugLog('⚠️ No posts found with any selector, trying comprehensive search...', null, isDebugMode);
            const allLinks = document.querySelectorAll('a[href^="/"]');
            postElements = Array.from(allLinks).filter(link => {
                const href = link.getAttribute('href');
                return href && href.includes('/p/');
            });
            debugLog(`📋 Comprehensive search found ${postElements.length} post links`, null, isDebugMode);
        }

        const users = {};
        const processedPosts = new Set();

        postElements.forEach((element, index) => {
            const href = element.getAttribute('href');
            if (!href || processedPosts.has(href)) return;
            
            processedPosts.add(href);
            
            // Extract username from post URL
            const postMatch = href.match(/^\/([^/]+)\/p\/([^/]+)/);
            if (postMatch) {
                const rawUsername = postMatch[1];
                const postId = postMatch[2];
                
                // Clean the username to remove any trailing punctuation
                const username = rawUsername
                    .replace(/[.,;:!?'"()\[\]{}]+$/, '') // Remove trailing punctuation
                    .trim();
                
                // Validate cleaned username
                if (username && 
                    /^[a-zA-Z0-9._]{1,30}$/.test(username) && 
                    !username.startsWith('.') && 
                    !username.endsWith('.') &&
                    !username.startsWith('_') && 
                    !username.endsWith('_') &&
                    !['explore', 'accounts', 'reels', 'stories', 'tv', 'direct'].includes(username.toLowerCase()) &&
                    username.length > 0) {
                    if (!users[username]) {
                        // Find associated image for this post
                        const postImage = element.querySelector('img') || element.closest('article')?.querySelector('img');
                        
                        users[username] = {
                            username,
                            locationId: pageInfo.type === 'location' ? pageInfo.id : null,
                            profilePage: pageInfo.type === 'profile' ? pageInfo.username : null,
                            postUrl: `https://www.instagram.com${href}`,
                            postId: postId,
                            timestamp: new Date().toISOString(),
                            thumbnailUrl: postImage?.getAttribute('src') || null,
                            caption: postImage?.getAttribute('alt') || null
                        };
                        
                        debugLog(`👤 Found user: @${username} from post ${postId}`, null, isDebugMode);
                    }
                }
            }
        });

        const userCount = Object.keys(users).length;
        debugLog(`✅ Extraction complete: ${userCount} unique users found`, null, isDebugMode);
        
        return users;
    }

    // Extract recent posts from profile page
    function extractProfilePosts(username, isDebugMode = false) {
        debugLog(`📸 Extracting recent posts for @${username}...`, null, isDebugMode);
        
        const allImages = analyzeImages(isDebugMode);
        const recentPosts = [];
        const processedUrls = new Set();

        // Filter for post images (not profile pics, stories, etc.)
        const postImages = Array.from(allImages).filter(img => {
            const src = img.getAttribute('src');
            const alt = img.getAttribute('alt');
            const hasPostLink = !!img.closest('a[href*="/p/"]');
            
            // Skip profile pictures and other non-post images
            const isProfilePic = src?.includes('profile_pic') || 
                               alt?.includes('profile picture') || 
                               src?.includes('150x150') ||
                               img.closest('header');
                               
            return src && !isProfilePic && hasPostLink;
        });

        debugLog(`🎯 Found ${postImages.length} potential post images`, null, isDebugMode);

        postImages.slice(0, 12).forEach((img, index) => {
            const src = img.getAttribute('src');
            const alt = img.getAttribute('alt') || '';
            
            if (!src || processedUrls.has(src)) return;
            processedUrls.add(src);

            // Get post URL from parent link
            const postLink = img.closest('a[href*="/p/"]');
            const postHref = postLink?.getAttribute('href');
            
            if (postHref) {
                const shortcodeMatch = postHref.match(/\/p\/([^\/]+)/);
                const shortcode = shortcodeMatch?.[1] || `generated_${Date.now()}_${index}`;
                
                // Extract post ID from image URL or generate one
                let postId = '';
                const cacheKeyMatch = src.match(/ig_cache_key=([^&%]+)/);
                if (cacheKeyMatch) {
                    try {
                        const decoded = decodeURIComponent(cacheKeyMatch[1]);
                        postId = decoded.split('.')[0];
                    } catch (e) {
                        postId = shortcode;
                    }
                } else {
                    const urlMatch = src.match(/\/([0-9]+)_/);
                    postId = urlMatch?.[1] || shortcode;
                }

                const post = {
                    id: postId,
                    shortcode: shortcode,
                    url: `https://www.instagram.com${postHref}`,
                    thumbnailUrl: src,
                    thumbnailBase64: null, // Add field for downloaded image
                    caption: alt.length > 300 ? alt.substring(0, 300) + '...' : alt,
                    timestamp: new Date().toISOString(),
                    isVideo: src.includes('video') || alt.toLowerCase().includes('video'),
                    likeCount: 0,
                    commentCount: 0,
                    viewCount: null
                };

                recentPosts.push(post);
                debugLog(`📷 Post ${index + 1}: ${shortcode}`, { caption: alt.substring(0, 50) }, isDebugMode);
            }
        });

        debugLog(`✅ Extracted ${recentPosts.length} recent posts for @${username}`, null, isDebugMode);
        return recentPosts;
    }

    // Get profile data from current DOM (if on profile page)
    function getProfileDataFromDOM(username, isDebugMode = false) {
        debugLog(`👤 Extracting profile data for @${username}...`, null, isDebugMode);

        // Try to find profile data in various ways
        let profileData = {
            fullName: '',
            biography: '',
            profilePicUrl: '',
            profilePicBase64: null, // Add field for downloaded image
            followerCount: 0,
            followingCount: 0,
            postsCount: 0,
            isVerified: false,
            isPrivate: false,
            externalUrl: '',
            businessCategory: '',
            recentPosts: []
        };

        // First, try to extract profile picture from the main profile image element
        let profilePic = '';
        
        // Try to find the main profile image using multiple selectors
        const profileImageSelectors = [
            `img[alt*="${username}'s profile picture"]`,
            `img[alt*="profile picture"]`,
            'img[src*="profile_pic"]',
            'img[src*="scontent"]',
            'a[href*="/' + username + '/"] img',
            'span[aria-describedby] img[alt*="profile picture"]'
        ];
        
        for (const selector of profileImageSelectors) {
            try {
                const profileImg = document.querySelector(selector);
                if (profileImg && profileImg.src && !profileImg.src.includes('data:image')) {
                    profilePic = profileImg.src;
                    debugLog(`✅ Found profile picture using selector: ${selector}`, { src: profilePic }, isDebugMode);
                    break;
                }
            } catch (error) {
                debugLog(`⚠️ Error with selector ${selector}:`, error, isDebugMode);
            }
        }

        // Extract from meta tags as fallback
        const metaTags = document.querySelectorAll('meta');
        let description = '';
        let metaProfilePic = '';
        let title = '';

        metaTags.forEach(meta => {
            const property = meta.getAttribute('property');
            const content = meta.getAttribute('content');
            
            if (property === 'og:description' && content) {
                description = content;
            }
            if (property === 'og:image' && content) {
                metaProfilePic = content;
            }
            if (property === 'og:title' && content) {
                title = content;
            }
        });

        // Use the profile pic from DOM if found, otherwise use meta tag
        if (!profilePic && metaProfilePic) {
            profilePic = metaProfilePic;
            debugLog(`📋 Using profile picture from meta tag`, { src: profilePic }, isDebugMode);
        }

        // Extract biography from DOM elements (improved approach)
        let biography = '';
        
        // Try multiple selectors to find the biography
        const biographySelectors = [
            // Modern Instagram biography selectors
            'span._ap3a._aaco._aacu._aacx._aad7._aade[dir="auto"]',
            'span[dir="auto"] > div[role="button"] > span._ap3a._aaco._aacu._aacx._aad7._aade',
            // Alternative biography selectors
            'div[class*="x7a106z"] span[dir="auto"]',
            'span[dir="auto"]:not(:empty)',
            // Generic selectors for biography text
            'div[data-testid*="bio"] span',
            'span[class*="x1lliihq"][dir="auto"]',
            // Fallback selectors
            'h1 + div span[dir="auto"]',
            'img[alt*="profile picture"] ~ div span[dir="auto"]'
        ];
        
        for (const selector of biographySelectors) {
            try {
                const bioElements = document.querySelectorAll(selector);
                for (const bioElement of bioElements) {
                    const bioText = bioElement.textContent?.trim();
                    if (bioText && 
                        bioText.length > 0 && 
                        bioText.length < 200 && // Reasonable biography length
                        !bioText.includes('Followers') && 
                        !bioText.includes('Following') && 
                        !bioText.includes('Posts') &&
                        !bioText.toLowerCase().includes('instagram') &&
                        bioText !== username &&
                        !bioText.match(/^\d+$/)) { // Not just numbers
                        
                        biography = bioText;
                        debugLog(`✅ Found biography using selector: ${selector}`, { biography }, isDebugMode);
                        break;
                    }
                }
                if (biography) break;
            } catch (error) {
                debugLog(`⚠️ Error with biography selector ${selector}:`, error, isDebugMode);
            }
        }

        // Fallback to meta description parsing if DOM extraction didn't work
        let metaBiography = '';
        if (!biography && description) {
            // Try to extract biography from meta description
            // Format is usually: "Biography - XX Followers, XX Following, XX Posts"
            const bioMatch = description.split(' - ')[0];
            if (bioMatch && 
                bioMatch !== description && 
                !bioMatch.includes('Followers') && 
                bioMatch.length > 0) {
                metaBiography = bioMatch.trim();
            }
        }

        // Parse follower counts from description
        const followerMatch = description.match(/(\d+(?:\.\d+)?[KMB]?)\s+Followers/i);
        const followingMatch = description.match(/(\d+(?:\.\d+)?[KMB]?)\s+Following/i);
        const postsMatch = description.match(/(\d+(?:\.\d+)?[KMB]?)\s+Posts/i);

        profileData = {
            fullName: title ? title.replace(` (@${username})`, '').replace(` • Instagram`, '') : '',
            biography: biography || metaBiography || '',
            profilePicUrl: profilePic,
            profilePicBase64: null, // Add field for downloaded image
            followerCount: followerMatch ? parseCount(followerMatch[1]) : 0,
            followingCount: followingMatch ? parseCount(followingMatch[1]) : 0,
            postsCount: postsMatch ? parseCount(postsMatch[1]) : 0,
            isVerified: false,
            isPrivate: false,
            externalUrl: '',
            businessCategory: '',
            recentPosts: extractProfilePosts(username, isDebugMode)
        };

        debugLog(`✅ Profile data extracted for @${username}`, { 
            followers: profileData.followerCount, 
            posts: profileData.recentPosts.length,
            profilePicUrl: profileData.profilePicUrl ? 'Found' : 'Not found',
            biography: profileData.biography ? `"${profileData.biography}"` : 'Not found'
        }, isDebugMode);

        return profileData;
    }

    // Helper function to parse count strings like "1.2M" to numbers
    function parseCount(countStr) {
        if (!countStr) return 0;
        
        const num = parseFloat(countStr);
        if (countStr.includes('K')) return Math.floor(num * 1000);
        if (countStr.includes('M')) return Math.floor(num * 1000000);
        if (countStr.includes('B')) return Math.floor(num * 1000000000);
        return Math.floor(num);
    }

    // Auto-open user profiles for extended data collection
    async function autoOpenUserProfiles(users, isDebugMode = false) {
        const userList = Object.values(users);
        let processedCount = 0;
        let skippedCount = 0;
        let openedCount = 0;
        
        debugLog(`🚀 Starting auto-profile opening for ${userList.length} users`, null, isDebugMode);
        
        // Check existing users in storage to skip already downloaded profiles
        const existingUsers = await loadAllUsersFromUnifiedStorage();
        
        for (const user of userList) {
            try {
                processedCount++;
                
                // Check if user already has extended profile data
                const existingUser = existingUsers[user.username];
                const hasExtendedData = existingUser && (existingUser.followerCount > 0 || 
                    existingUser.biography || 
                    existingUser.fullName || 
                    (existingUser.recentPosts && existingUser.recentPosts.length > 0) ||
                    existingUser.status === 'inaccessible' || // Profile is private/deleted - skip
                    existingUser.status === 'no_data' || // Profile had no extractable data - skip
                    existingUser.followerCount === -1 || // Special marker for processed but no data
                    existingUser.processedAt); // Has been processed at least once - skip
                
                if (hasExtendedData) {
                    skippedCount++;
                    debugLog(`⏭️ Skipping @${user.username} - already has extended data (${existingUser.followerCount} followers)`, null, isDebugMode);
                    
                    // Update progress in UI
                    const profileProgressElement = document.getElementById('profile-progress');
                    if (profileProgressElement) {
                        profileProgressElement.textContent = `Checking profiles: ${processedCount}/${userList.length} - @${user.username} (skipped - already downloaded)`;
                    }
                    
                    // Small delay to show progress
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                }
                
                const profileUrl = `https://www.instagram.com/${user.username}/`;
                
                debugLog(`🔗 Opening profile ${processedCount}/${userList.length}: @${user.username}`, null, isDebugMode);
                
                // Update progress in UI
                const profileProgressElement = document.getElementById('profile-progress');
                if (profileProgressElement) {
                    profileProgressElement.textContent = `Opening profiles: ${processedCount}/${userList.length} - @${user.username}`;
                }
                
                // Open profile in the same reusable window
                const profileTab = window.open(profileUrl, 'instagram_profile_window', 'width=1200,height=800,scrollbars=yes,resizable=yes');
                
                if (profileTab) {
                    openedCount++;
                    debugLog(`✅ Profile tab opened for @${user.username} (${openedCount} opened so far)`, null, isDebugMode);
                    
                    // Add a longer delay between opening profiles to ensure proper loading and auto-save
                    await new Promise(resolve => setTimeout(resolve, 4000));
                } else {
                    debugLog(`❌ Failed to open profile tab for @${user.username} (popup blocked?)`, null, isDebugMode);
                }
                
            } catch (error) {
                debugLog(`❌ Error opening profile for @${user.username}`, error, isDebugMode);
            }
        }
        
        debugLog(`🏁 Auto-profile opening completed: ${processedCount}/${userList.length} processed, ${openedCount} opened, ${skippedCount} skipped`, null, isDebugMode);
        
        // Show completion message
        const profileProgressElement = document.getElementById('profile-progress');
        if (profileProgressElement) {
            profileProgressElement.textContent = `Profile opening completed: ${openedCount} profiles opened, ${skippedCount} skipped (already downloaded)`;
        }
        
        return { processed: processedCount, opened: openedCount, skipped: skippedCount };
    }

    // Profile processing queue management
    async function saveProfileQueue(profiles, currentIndex = 0) {
        const queueData = {
            profiles: profiles,
            currentIndex: currentIndex,
            timestamp: new Date().toISOString(),
            total: profiles.length
        };
        try {
            await dbManager.setItem('queue', PROFILE_QUEUE_KEY, queueData);
            await dbManager.setItem('queue', QUEUE_STATUS_KEY, 'processing');
        } catch (error) {
            console.error('Error saving profile queue:', error);
        }
    }

    async function loadProfileQueue() {
        try {
            const queueData = await dbManager.getItem('queue', PROFILE_QUEUE_KEY);
            return queueData;
        } catch (error) {
            console.error('Error loading profile queue:', error);
            return null;
        }
    }


    async function getQueueStatus() {
        try {
            const status = await dbManager.getItem('queue', QUEUE_STATUS_KEY);
            return status || 'idle';
        } catch (error) {
            console.error('Error getting queue status:', error);
            return 'idle';
        }
    }

    // Check if profile data collection is complete
    async function isProfileDataComplete(username) {
        const allUsers = await loadAllUsersFromUnifiedStorage();
        const user = allUsers[username];
        
        if (!user) return false;
        
        // Check if profile has extended data
        return user.followerCount > 0 || 
               user.biography || 
               user.fullName || 
               (user.recentPosts && user.recentPosts.length > 0) ||
               user.status === 'inaccessible' || // Profile is private/deleted - consider complete
               user.status === 'no_data' || // Profile had no extractable data - consider complete
               user.followerCount === -1; // Special marker for processed but no data
    }

    // Process the next profile in queue
    async function processNextProfileInQueue() {
        const queueData = await loadProfileQueue();
        const status = await getQueueStatus();
        
        if (!queueData || status !== 'processing') {
            return;
        }

        const { profiles, currentIndex } = queueData;
        
        if (currentIndex >= profiles.length) {
            // Queue completed - Clean up queue data
            try {
                await dbManager.removeItem('queue', PROFILE_QUEUE_KEY);
                await dbManager.setItem('queue', QUEUE_STATUS_KEY, 'idle');
                console.log(`🏁 Profile queue completed and cleaned up: ${profiles.length} profiles processed`);
            } catch (error) {
                console.error('Error cleaning up queue:', error);
            }
            
            // Show completion notification
            const statusDiv = document.createElement('div');
            statusDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 999999;
                font-size: 14px;
                font-weight: bold;
                border: 2px solid #059669;
            `;
            statusDiv.innerHTML = `
                ✅ Profile Collection Complete!<br>
                <span style="font-size: 12px; opacity: 0.9;">Processed ${profiles.length} profiles</span>
            `;
            document.body.appendChild(statusDiv);
            setTimeout(() => statusDiv.remove(), 5000);
            
            return;
        }

        const currentProfile = profiles[currentIndex];
        console.log(`🔄 Processing profile ${currentIndex + 1}/${profiles.length}: @${currentProfile.username}`);
        
        // Check if profile was already processed (avoid reprocessing)
        const isComplete = await isProfileDataComplete(currentProfile.username);
        if (isComplete) {
            console.log(`⏭️ Profile @${currentProfile.username} already processed, skipping to next`);
            // Skip to next profile
            await saveProfileQueue(profiles, currentIndex + 1);
            setTimeout(async () => {
                await processNextProfileInQueue();
            }, 1000);
            return;
        }
        
        // Update queue with next index before navigation
        await saveProfileQueue(profiles, currentIndex + 1);
        
        // Navigate to the profile
        const profileUrl = `https://www.instagram.com/${currentProfile.username}/`;
        window.location.href = profileUrl;
    }

    // Open profiles without extended data (Phase 2) - Updated for current window navigation
    async function openProfilesWithoutData() {
        const statusElement = document.getElementById('scraper-status');
        const resultsElement = document.getElementById('scraper-results');
        const openButton = document.getElementById('open-profiles');
        
        const isDebugMode = document.getElementById('debug-mode').checked;

        openButton.disabled = true;
        statusElement.textContent = 'Preparing profile queue...';
        
        try {
            const allUsers = await loadAllUsersFromUnifiedStorage();
            
            // Filter users without extended data
            const usersWithoutExtendedData = [];
            
            for (const [username, userData] of Object.entries(allUsers)) {
                // Enhanced checking to prevent infinite loops
                const hasExtendedData = userData.followerCount > 0 || 
                                      userData.biography || 
                                      userData.fullName || 
                                      (userData.recentPosts && userData.recentPosts.length > 0) ||
                                      userData.status === 'inaccessible' || // Profile is private/deleted - skip
                                      userData.status === 'no_data' || // Profile had no extractable data - skip
                                      userData.followerCount === -1 || // Special marker for processed but no data
                                      userData.processedAt; // Has been processed at least once - skip
                
                // Additional safeguard: skip profiles attempted too many times
                const tooManyAttempts = userData.attemptCount && userData.attemptCount >= 3;
                
                if (!hasExtendedData && !tooManyAttempts) {
                    // Ensure username is included in the user object
                    usersWithoutExtendedData.push({
                        username: username,
                        ...userData
                    });
                } else if (tooManyAttempts) {
                    console.log(`⏭️ Skipping @${username} - too many failed attempts (${userData.attemptCount})`);
                }
            }

            if (usersWithoutExtendedData.length === 0) {
                statusElement.textContent = 'No profiles need extended data';
                resultsElement.textContent = 'All profiles already have extended data!';
                openButton.disabled = false;
                return;
            }

            debugLog(`🚀 Setting up queue for ${usersWithoutExtendedData.length} profiles`, null, isDebugMode);
            
            // Save the queue and start processing
            await saveProfileQueue(usersWithoutExtendedData, 0);
            
            statusElement.textContent = 'Starting profile processing...';
            resultsElement.textContent = `Processing ${usersWithoutExtendedData.length} profiles sequentially`;
            
            // Show processing notification
            const notificationDiv = document.createElement('div');
            notificationDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #8b5cf6;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 999999;
                font-size: 14px;
                font-weight: bold;
                border: 2px solid #7c3aed;
            `;
            notificationDiv.innerHTML = `
                🔄 Profile Processing Started<br>
                <span style="font-size: 12px; opacity: 0.9;">Will process ${usersWithoutExtendedData.length} profiles automatically</span>
            `;
            document.body.appendChild(notificationDiv);
            setTimeout(() => notificationDiv.remove(), 3000);
            
            // Start processing the first profile
            setTimeout(async () => {
                await processNextProfileInQueue();
            }, 2000);
            
        } catch (error) {
            statusElement.textContent = 'Error setting up profile queue';
            resultsElement.textContent = `Error: ${error.message}`;
            debugLog(`❌ Profile queue error`, error, isDebugMode);
            
        }

        openButton.disabled = false;
    }

    // Start basic scraping (collect usernames from location or save profile data)
    async function startBasicScraping(pageInfo) {
        const statusElement = document.getElementById('scraper-status');
        const resultsElement = document.getElementById('scraper-results');
        const settings = await loadSettings(pageInfo.type);
        
        try {
            if (pageInfo.type === 'location') {
                if (statusElement) {
                    statusElement.textContent = 'Collecting usernames from location posts...';
                }
                
                const autoScroll = settings.autoScrollPosts;
                let allUsernames = new Set();
                let scrollRounds = 0;
                const maxScrollRounds = 30; // Increased from 10 for more comprehensive collection
                
                console.log(`🔧 Auto-scroll setting: ${autoScroll ? 'ENABLED' : 'DISABLED'}`, settings);
                
                // STEP 1: Always collect usernames from currently visible posts first
                if (statusElement) {
                    statusElement.textContent = 'Collecting usernames from visible posts...';
                }
                
                const initialUsernames = extractUsernamesFromLocation(settings.debugMode);
                initialUsernames.forEach(username => allUsernames.add(username));
                
                debugLog(`🎯 Initial collection from visible posts: ${allUsernames.size} usernames found`, null, settings.debugMode);
                
                if (statusElement) {
                    statusElement.textContent = `Found ${allUsernames.size} users from visible posts${autoScroll ? ' - starting auto-scroll...' : ''}`;
                }
                
                // STEP 2: If auto-scroll is enabled, scroll to load more posts
                if (autoScroll) {
                    if (statusElement) {
                        statusElement.textContent = 'Auto-scrolling to load more posts...';
                    }
                    
                    // Function to get current post count
                    function getCurrentPostCount() {
                        const posts = document.querySelectorAll('article[role="presentation"], a[href*="/p/"]');
                        return posts.length;
                    }
                    
                    // Function to scroll and wait for new content
                    async function scrollAndWait() {
                        const initialPostCount = getCurrentPostCount();
                        
                        // Scroll to bottom
                        window.scrollTo(0, document.body.scrollHeight);
                        
                        // Wait for new content to load
                        let waitTime = 0;
                        const maxWaitTime = 5000; // 5 seconds max wait
                        const checkInterval = 500; // Check every 500ms
                        
                        while (waitTime < maxWaitTime) {
                            await new Promise(resolve => setTimeout(resolve, checkInterval));
                            waitTime += checkInterval;
                            
                            const currentPostCount = getCurrentPostCount();
                            if (currentPostCount > initialPostCount) {
                                // New content loaded
                                debugLog(`📜 New posts loaded: ${currentPostCount - initialPostCount} posts`, null, settings.debugMode);
                                return currentPostCount - initialPostCount;
                            }
                        }
                        
                        // No new content loaded within timeout
                        return 0;
                    }
                    
                    // Collect usernames from newly loaded posts
                    function collectNewUsernames() {
                        const currentUsernames = extractUsernamesFromLocation(settings.debugMode);
                        const newUsernames = currentUsernames.filter(username => !allUsernames.has(username));
                        
                        newUsernames.forEach(username => allUsernames.add(username));
                        
                        return newUsernames.length;
                    }
                    
                    // Auto-scroll and collect loop
                    while (scrollRounds < maxScrollRounds) {
                        scrollRounds++;
                        
                        if (statusElement) {
                            statusElement.textContent = `Auto-scrolling: Round ${scrollRounds}/${maxScrollRounds} (${allUsernames.size} users)`;
                        }
                        
                        const newPostsLoaded = await scrollAndWait();
                        
                        if (newPostsLoaded === 0) {
                            // No new posts loaded, we've reached the end of available content
                            debugLog(`📜 No new posts loaded in round ${scrollRounds}, reached end of content`, null, settings.debugMode);
                            break;
                        }
                        
                        // Collect usernames from newly loaded posts
                        const newUsersFound = collectNewUsernames();
                        debugLog(`📜 Round ${scrollRounds}: ${newPostsLoaded} new posts, ${newUsersFound} new users (Total: ${allUsernames.size})`, null, settings.debugMode);
                        
                        if (statusElement) {
                            statusElement.textContent = `Round ${scrollRounds}: Found ${newUsersFound} new users (${allUsernames.size} total)`;
                        }
                        
                        // Continue scrolling even if no new users found - there might be different users further down
                        // Only stop if no new posts are loaded or max rounds reached
                        
                        // Brief pause between scroll rounds
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                    if (scrollRounds >= maxScrollRounds) {
                        debugLog(`📜 Reached maximum scroll rounds (${maxScrollRounds}), stopping`, null, settings.debugMode);
                    }
                    
                } else {
                    // No auto-scroll - collect from currently visible posts
                    const usernames = extractUsernamesFromLocation(settings.debugMode);
                    usernames.forEach(username => allUsernames.add(username));
                }
                
                // Save all collected usernames
                const finalUsernames = Array.from(allUsernames);
                if (finalUsernames.length > 0) {
                    // Check which users are new vs existing
                    const existingUsers = await loadAllUsersFromUnifiedStorage();
                    const newUsernames = [];
                    const existingUsernames = [];
                    
                    for (const username of finalUsernames) {
                        if (existingUsers[username]) {
                            existingUsernames.push(username);
                        } else {
                            newUsernames.push(username);
                        }
                    }
                    
                    // Save only new users to unified storage
                    let savedCount = 0;
                    for (const username of newUsernames) {
                        try {
                            const userData = {
                                username: username,
                                timestamp: new Date().toISOString(),
                                locationId: pageInfo.id,
                                lastUpdated: new Date().toISOString()
                            };
                            await saveUserToUnifiedStorage(userData);
                            savedCount++;
                        } catch (error) {
                            console.error(`❌ Failed to save user @${username}:`, error);
                        }
                    }
                    
                    // Log detailed results
                    debugLog(`📊 Collection Results:`, {
                        totalCollected: finalUsernames.length,
                        newUsers: newUsernames.length,
                        existingUsers: existingUsernames.length,
                        successfullySaved: savedCount,
                        locationId: pageInfo.id
                    }, settings.debugMode);
                    
                    if (statusElement) {
                        statusElement.textContent = autoScroll ? 
                            `Auto-scroll complete! Collected ${finalUsernames.length} users (${newUsernames.length} new) in ${scrollRounds} rounds` :
                            `Collection complete! Found ${finalUsernames.length} users (${newUsernames.length} new)`;
                    }
                    if (resultsElement) {
                        resultsElement.textContent = `Saved ${savedCount} new users to database (${existingUsernames.length} already existed)`;
                    }
                    
                    debugLog(`💾 Saved ${savedCount} new usernames from location ${pageInfo.id}`, newUsernames, settings.debugMode);
                    
                    // Update UI button counts
                    updateScraperUI(pageInfo);
                    
                    // Auto-open profiles if enabled
                    if (settings.autoOpenProfiles) {
                        if (statusElement) {
                            statusElement.textContent = 'Auto-opening user profiles...';
                        }
                        
                        // Small delay before starting profile opening
                        setTimeout(() => {
                            openProfilesWithoutData();
                        }, 2000);
                    }
                    
                } else {
                    if (statusElement) {
                        statusElement.textContent = 'No usernames found on this page';
                    }
                    if (resultsElement) {
                        resultsElement.textContent = 'No users to save';
                    }
                }
                
            } else if (pageInfo.type === 'search') {
                // Search page scraping
                if (statusElement) {
                    statusElement.textContent = 'Collecting usernames from search results...';
                }
                
                const autoScroll = settings.autoScrollPosts;
                let allUsernames = new Set();
                let scrollRounds = 0;
                const maxScrollRounds = 20; // Fewer rounds for search as content is more limited
                
                console.log(`🔧 Auto-scroll setting: ${autoScroll ? 'ENABLED' : 'DISABLED'}`, settings);
                
                // STEP 1: Always collect usernames from currently visible search results first
                if (statusElement) {
                    statusElement.textContent = 'Collecting usernames from visible search results...';
                }
                
                const initialUsernames = extractUsernamesFromSearch(settings.debugMode);
                initialUsernames.forEach(username => allUsernames.add(username));
                
                debugLog(`🎯 Initial collection from visible search results: ${allUsernames.size} usernames found`, null, settings.debugMode);
                
                if (statusElement) {
                    statusElement.textContent = `Found ${allUsernames.size} users from visible results${autoScroll ? ' - starting auto-scroll...' : ''}`;
                }
                
                // STEP 2: If auto-scroll is enabled, scroll to load more search results
                if (autoScroll) {
                    if (statusElement) {
                        statusElement.textContent = 'Auto-scrolling to load more search results...';
                    }
                    
                    // Function to get current result count (posts + profiles)
                    function getCurrentResultCount() {
                        const posts = document.querySelectorAll('a[href*="/p/"]');
                        const profiles = document.querySelectorAll('a[href^="/"][href*="/"]');
                        return posts.length + profiles.length;
                    }
                    
                    // Function to scroll and wait for new content
                    async function scrollAndWait() {
                        const initialResultCount = getCurrentResultCount();
                        
                        // Scroll to bottom
                        window.scrollTo(0, document.body.scrollHeight);
                        
                        // Wait for new content to load
                        let waitTime = 0;
                        const maxWaitTime = 4000; // 4 seconds max wait (shorter for search)
                        const checkInterval = 500; // Check every 500ms
                        
                        while (waitTime < maxWaitTime) {
                            await new Promise(resolve => setTimeout(resolve, checkInterval));
                            waitTime += checkInterval;
                            
                            const currentResultCount = getCurrentResultCount();
                            if (currentResultCount > initialResultCount) {
                                // New content loaded
                                debugLog(`📜 New search results loaded: ${currentResultCount - initialResultCount} items`, null, settings.debugMode);
                                return currentResultCount - initialResultCount;
                            }
                        }
                        
                        // No new content loaded within timeout
                        return 0;
                    }
                    
                    // Collect usernames from newly loaded search results
                    function collectNewUsernames() {
                        const currentUsernames = extractUsernamesFromSearch(settings.debugMode);
                        const newUsernames = currentUsernames.filter(username => !allUsernames.has(username));
                        
                        newUsernames.forEach(username => allUsernames.add(username));
                        
                        return newUsernames.length;
                    }
                    
                    // Auto-scroll and collect loop
                    while (scrollRounds < maxScrollRounds) {
                        scrollRounds++;
                        
                        if (statusElement) {
                            statusElement.textContent = `Auto-scrolling: Round ${scrollRounds}/${maxScrollRounds} (${allUsernames.size} users)`;
                        }
                        
                        const newResultsLoaded = await scrollAndWait();
                        
                        if (newResultsLoaded === 0) {
                            // No new results loaded, we've reached the end of available content
                            debugLog(`📜 No new search results loaded in round ${scrollRounds}, reached end of content`, null, settings.debugMode);
                            break;
                        }
                        
                        // Collect usernames from newly loaded search results
                        const newUsersFound = collectNewUsernames();
                        debugLog(`📜 Round ${scrollRounds}: ${newResultsLoaded} new results, ${newUsersFound} new users (Total: ${allUsernames.size})`, null, settings.debugMode);
                        
                        if (statusElement) {
                            statusElement.textContent = `Round ${scrollRounds}: Found ${newUsersFound} new users (${allUsernames.size} total)`;
                        }
                        
                        // Brief pause between scroll rounds
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                    if (scrollRounds >= maxScrollRounds) {
                        debugLog(`📜 Reached maximum scroll rounds (${maxScrollRounds}), stopping`, null, settings.debugMode);
                    }
                    
                } else {
                    // No auto-scroll - collect from currently visible search results
                    const usernames = extractUsernamesFromSearch(settings.debugMode);
                    usernames.forEach(username => allUsernames.add(username));
                }
                
                // Save all collected usernames
                const finalUsernames = Array.from(allUsernames);
                if (finalUsernames.length > 0) {
                    // Check which users are new vs existing
                    const existingUsers = await loadAllUsersFromUnifiedStorage();
                    const newUsernames = [];
                    const existingUsernames = [];
                    
                    for (const username of finalUsernames) {
                        if (existingUsers[username]) {
                            existingUsernames.push(username);
                        } else {
                            newUsernames.push(username);
                        }
                    }
                    
                    // Save only new users to unified storage
                    let savedCount = 0;
                    for (const username of newUsernames) {
                        try {
                            const userData = {
                                username: username,
                                timestamp: new Date().toISOString(),
                                searchQuery: pageInfo.query,
                                lastUpdated: new Date().toISOString()
                            };
                            await saveUserToUnifiedStorage(userData);
                            savedCount++;
                        } catch (error) {
                            console.error(`❌ Failed to save user @${username}:`, error);
                        }
                    }
                    
                    // Log detailed results
                    debugLog(`📊 Search Collection Results:`, {
                        totalCollected: finalUsernames.length,
                        newUsers: newUsernames.length,
                        existingUsers: existingUsernames.length,
                        successfullySaved: savedCount,
                        searchQuery: pageInfo.query
                    }, settings.debugMode);
                    
                    if (statusElement) {
                        statusElement.textContent = autoScroll ? 
                            `Auto-scroll complete! Collected ${finalUsernames.length} users (${newUsernames.length} new) in ${scrollRounds} rounds` :
                            `Collection complete! Found ${finalUsernames.length} users (${newUsernames.length} new)`;
                    }
                    if (resultsElement) {
                        resultsElement.textContent = `Saved ${savedCount} new users from search "${pageInfo.query}" (${existingUsernames.length} already existed)`;
                    }
                    
                    debugLog(`💾 Saved ${savedCount} new usernames from search "${pageInfo.query}"`, newUsernames, settings.debugMode);
                    
                    // Update UI button counts
                    updateScraperUI(pageInfo);
                    
                    // Auto-open profiles if enabled
                    if (settings.autoOpenProfiles) {
                        if (statusElement) {
                            statusElement.textContent = 'Auto-opening user profiles...';
                        }
                        
                        // Small delay before starting profile opening
                        setTimeout(() => {
                            openProfilesWithoutData();
                        }, 2000);
                    }
                    
                } else {
                    if (statusElement) {
                        statusElement.textContent = 'No usernames found in search results';
                    }
                    if (resultsElement) {
                        resultsElement.textContent = 'No users to save from search';
                    }
                }
                
            } else if (pageInfo.type === 'profile') {
                // Profile page scraping (unchanged)
                if (statusElement) {
                    statusElement.textContent = 'Saving profile data...';
                }
                
                const profileData = getProfileDataFromDOM(pageInfo.username, settings.debugMode);
                const userData = {
                    username: pageInfo.username,
                    timestamp: new Date().toISOString(),
                    profilePage: pageInfo.username,
                    lastUpdated: new Date().toISOString(),
                    ...profileData
                };
                
                // Save to unified storage
                await saveUserToUnifiedStorage(userData);
                
                if (statusElement) {
                    statusElement.textContent = 'Profile data saved successfully!';
                }
                if (resultsElement) {
                    resultsElement.textContent = `Profile @${pageInfo.username} saved to database`;
                }
                
                debugLog(`💾 Saved profile data for @${pageInfo.username}`, profileData, settings.debugMode);
                
                // Update UI button counts
                updateScraperUI(pageInfo);
            }
            
        } catch (error) {
            console.error('Basic scraping failed:', error);
            if (statusElement) {
                statusElement.textContent = 'Scraping failed - check console for details';
            }
            debugLog('❌ Basic scraping error', error, settings.debugMode);
        }
    }

    // Initialize the scraper
    async function initScraper() {
        try {
            console.log('🔧 Initializing scraper...');
            const pageInfo = getPageInfo();
            console.log('Instagram Scraper initialized for:', pageInfo);

            console.log('🔍 Checking if page is valid...');
            if (!isValidPage()) {
                console.log('❌ Page not supported for scraping');
                return;
            }
            console.log('✅ Page is valid for scraping');

            // Check if we have valid page info
            if (!pageInfo) {
                console.log('⚠️ Page info could not be detected, but page is valid. Using fallback UI.');
            }

            console.log('🗄️ Initializing IndexedDB...');
            try {
                await dbManager.init();
                console.log('✅ IndexedDB initialized successfully');
            } catch (dbError) {
                console.error('❌ IndexedDB initialization failed:', dbError);
                // Continue without IndexedDB - UI can still work
            }
            
            console.log('🧹 Performing username cleanup...');
            try {
                const duplicatesRemoved = await cleanupDuplicateUsernames();
                if (duplicatesRemoved > 0) {
                    console.log(`✅ Removed ${duplicatesRemoved} duplicate usernames`);
                } else {
                    console.log('✅ No duplicates found to clean');
                }
            } catch (cleanupError) {
                console.error('⚠️ Cleanup failed, continuing anyway:', cleanupError);
            }

            console.log('🔧 Creating scraper UI...');
            try {
                await createScraperUI(pageInfo);
                console.log('✅ Scraper UI created successfully');
            } catch (uiError) {
                console.error('❌ Failed to create scraper UI:', uiError);
                throw uiError; // This is critical, so re-throw
            }

            console.log('⏰ Setting up auto-save timer...');
            // Set up auto-save for profile pages
            if (pageInfo && pageInfo.type === 'profile') {
                setTimeout(async () => {
                    console.log('🔄 Starting auto-save profile data...');
                    try {
                        await autoSaveProfileData(pageInfo);
                        console.log('✅ Auto-save completed');
                    } catch (autoSaveError) {
                        console.error('❌ Auto-save failed:', autoSaveError);
                    }
                }, 3000);
            }

            console.log('🔍 Checking for profiles needing data...');
            try {
                await checkForProfilesNeedingData();
                console.log('✅ Profile check completed');
            } catch (checkError) {
                console.error('⚠️ Profile check failed:', checkError);
            }
            
        } catch (error) {
            console.error('❌ Critical error in initScraper:', error);
            console.error('Error stack:', error.stack);
            
            // Try to create minimal UI even if other things failed
            try {
                console.log('🔄 Attempting to create basic UI after error...');
                const pageInfo = getPageInfo();
                if (pageInfo) {
                    await createScraperUI(pageInfo);
                    console.log('✅ Basic UI created successfully after error recovery');
                }
            } catch (recoveryError) {
                console.error('❌ Failed to create recovery UI:', recoveryError);
            }
        }
    }

    // Check for profiles needing data on script load
    async function checkForProfilesNeedingData() {
        try {
            const settings = await loadSettings('profile');
            if (!settings.autoAdvance) return;
            
            const allUsers = await loadAllUsersFromUnifiedStorage();
            
            // Filter users without extended data and ensure username is included
            // Use the same comprehensive criteria as autoAdvanceToNextProfile
            const usersWithoutExtendedData = [];
            
            for (const [username, userData] of Object.entries(allUsers)) {
                const hasExtendedData = userData && (userData.followerCount > 0 || 
                                      userData.biography || 
                                      userData.fullName || 
                                      (userData.recentPosts && userData.recentPosts.length > 0) ||
                                      userData.status === 'inaccessible' || // Profile is private/deleted - skip
                                      userData.status === 'no_data' || // Profile had no extractable data - skip
                                      userData.status === 'completed' || // Profile processing completed - skip
                                      userData.status === 'private' || // Private profile - skip
                                      userData.status === 'error' || // Error during processing - skip
                                      userData.followerCount === -1 || // Special marker for processed but no data
                                      userData.processedAt); // Has been processed at least once - skip
                
                if (!hasExtendedData) {
                    // Ensure username is included in the user object
                    usersWithoutExtendedData.push({
                        username: username,
                        ...userData
                    });
                }
            }

            if (usersWithoutExtendedData.length > 0) {
                console.log(`🔍 Found ${usersWithoutExtendedData.length} profiles needing extended data`);
                
                // Show notification about available profiles
                const notificationDiv = document.createElement('div');
                notificationDiv.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    background: #0369a1;
                    color: white;
                    padding: 12px 18px;
                    border-radius: 6px;
                    z-index: 999999;
                    font-size: 13px;
                    font-weight: bold;
                    border: 2px solid #0284c7;
                    cursor: pointer;
                `;
                notificationDiv.innerHTML = `
                    🔍 ${usersWithoutExtendedData.length} profiles need data<br>
                    <span style="font-size: 11px; opacity: 0.9;">Click to start auto-processing</span>
                `;
                
                notificationDiv.addEventListener('click', async () => {
                    notificationDiv.remove();
                    await autoAdvanceToNextProfile();
                });
                
                document.body.appendChild(notificationDiv);
                setTimeout(() => notificationDiv.remove(), 10000);
            }
        } catch (error) {
            console.error('Error checking for profiles needing data:', error);
        }
    }

    // Wait for page load and initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScraper);
    } else {
        // Small delay to ensure Instagram's content is loaded
        setTimeout(initScraper, 2000);
    }

    // Handle navigation changes (Instagram is a SPA)
    let currentPath = window.location.pathname;
    setInterval(() => {
        if (window.location.pathname !== currentPath) {
            currentPath = window.location.pathname;
            console.log('Instagram page changed, reinitializing scraper...');
            setTimeout(initScraper, 3000); // Wait for new content to load
        }
    }, 1000);

    // Extract usernames from location posts (updated for current Instagram structure)
    function extractUsernamesFromLocation(isDebugMode = false) {
        const usernames = new Set();
        
        // Helper function to clean and validate usernames
        function cleanUsername(username) {
            if (!username) return null;
            
            // Remove trailing punctuation that shouldn't be part of usernames
            let cleaned = username.replace(/[.,;:!?'"()\[\]{}]+$/, '');
            
            // Also remove leading/trailing whitespace
            cleaned = cleaned.trim();
            
            // Validate Instagram username format
            if (!/^[a-zA-Z0-9._]{1,30}$/.test(cleaned)) {
                return null;
            }
            
            // Additional validation - usernames can't start or end with dots or underscores
            if (cleaned.startsWith('.') || cleaned.startsWith('_') || 
                cleaned.endsWith('.') || cleaned.endsWith('_')) {
                return null;
            }
            
            // Skip common non-username patterns
            if (['explore', 'accounts', 'reels', 'stories', 'tv', 'direct', 'reel', 'instagram'].includes(cleaned.toLowerCase())) {
                return null;
            }
            
            return cleaned;
        }
        
        try {
            if (isDebugMode) {
                console.log('🔍 DEBUG: Starting username extraction from location page...');
            }
            
            // Method 1: Extract usernames from post URLs (primary method for location pages)
            const postLinks = document.querySelectorAll('a[href*="/p/"]');
            if (isDebugMode) {
                console.log(`🔍 DEBUG: Found ${postLinks.length} post links`);
            }
            
            postLinks.forEach((link, index) => {
                const href = link.getAttribute('href');
                if (href) {
                    // Pattern: /username/p/postid/
                    const postMatch = href.match(/^\/([a-zA-Z0-9._]{1,30})\/p\/[^\/]+\/?$/);
                    if (postMatch) {
                        const rawUsername = postMatch[1];
                        const username = cleanUsername(rawUsername);
                        if (username) {
                            usernames.add(username);
                            if (isDebugMode) {
                                console.log(`📝 Found username from post URL #${index + 1}: @${username} (${href})`);
                            }
                        }
                    }
                }
            });

            // Method 2: Extract from image alt text for additional mentions
            const images = document.querySelectorAll('img[alt]');
            if (isDebugMode) {
                console.log(`🔍 DEBUG: Found ${images.length} images with alt text`);
            }
            
            images.forEach((img, index) => {
                const alt = img.getAttribute('alt');
                if (alt) {
                    // Pattern: "Photo by [Name] in [Location] with @username" or variations
                    const mentionMatches = alt.match(/@([a-zA-Z0-9._]{1,30})/g);
                    if (mentionMatches) {
                        mentionMatches.forEach(mention => {
                            const rawUsername = mention.substring(1); // Remove @
                            const username = cleanUsername(rawUsername);
                            if (username) {
                                usernames.add(username);
                                if (isDebugMode) {
                                    console.log(`📝 Found username from alt mention #${index + 1}: @${username} (${alt.substring(0, 50)}...)`);
                                }
                            }
                        });
                    }
                    
                    // Pattern: "Photo by [Username] in [Location]" - extract the username after "Photo by"
                    const photoByMatch = alt.match(/Photo by ([a-zA-Z0-9._\s]+?) in/i);
                    if (photoByMatch) {
                        // Try to extract username from the name
                        const nameText = photoByMatch[1].trim();
                        // If it looks like a username (no spaces, valid chars)
                        if (/^[a-zA-Z0-9._]{1,30}$/.test(nameText)) {
                            const username = cleanUsername(nameText);
                            if (username) {
                                usernames.add(username);
                                if (isDebugMode) {
                                    console.log(`📝 Found username from "Photo by": @${username}`);
                                }
                            }
                        }
                    }
                }
            });

            // Method 3: Look for direct profile links (less common on location pages but still possible)
            const profileLinks = document.querySelectorAll('a[href^="/"][href*="/"]');
            let profileLinkCount = 0;
            profileLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href) {
                    // Match Instagram username pattern (excluding posts and special pages)
                    const usernameMatch = href.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
                    if (usernameMatch) {
                        const rawUsername = usernameMatch[1];
                        const username = cleanUsername(rawUsername);
                        if (username) {
                            usernames.add(username);
                            profileLinkCount++;
                            if (isDebugMode) {
                                console.log(`📝 Found username from profile link: @${username} (${href})`);
                            }
                        }
                    }
                }
            });
            
            if (isDebugMode) {
                console.log(`🔍 DEBUG: Found ${profileLinkCount} profile links`);
            }

            // Method 4: Look for usernames in text elements near posts (backup method)
            const posts = document.querySelectorAll('a[href*="/p/"]');
            posts.forEach(post => {
                // Look for text elements in the same parent container
                const container = post.closest('article') || post.parentElement;
                if (container) {
                    const textElements = container.querySelectorAll('span, div');
                    textElements.forEach(element => {
                        const text = element.textContent?.trim();
                        if (text && text.length > 1 && text.length <= 30) {
                            // Clean and validate the potential username
                            const username = cleanUsername(text);
                            if (username) {
                                // Additional validation: check if element is clickable/linked
                                const parentLink = element.closest('a[href^="/"]');
                                if (parentLink) {
                                    const href = parentLink.getAttribute('href');
                                    // Check if it's a username link or post link with this username
                                    if (href?.match(new RegExp(`^/${username}(/|$)`))) {
                                        usernames.add(username);
                                        if (isDebugMode) {
                                            console.log(`📝 Found username from text element: @${username}`);
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            });

            const uniqueUsernames = Array.from(usernames);
            
            if (isDebugMode) {
                console.log(`🎯 FINAL RESULT: ${uniqueUsernames.length} unique usernames found`);
                console.log('Usernames:', uniqueUsernames);
                console.log('🔍 DEBUG: Username extraction complete');
            }
            
            return uniqueUsernames;
            
        } catch (error) {
            console.error('Error extracting usernames from location:', error);
            if (isDebugMode) {
                console.log('Error details:', error);
            }
            return [];
        }
    }

    // Extract usernames from search results pages
    function extractUsernamesFromSearch(isDebugMode = false) {
        const usernames = new Set();
        
        // Helper function to clean and validate usernames
        function cleanUsername(username) {
            if (!username) return null;
            
            // Remove trailing punctuation that shouldn't be part of usernames
            let cleaned = username.replace(/[.,;:!?'"()\[\]{}]+$/, '');
            
            // Also remove leading/trailing whitespace
            cleaned = cleaned.trim();
            
            // Validate Instagram username format
            if (!/^[a-zA-Z0-9._]{1,30}$/.test(cleaned)) {
                return null;
            }
            
            // Additional validation - usernames can't start or end with dots or underscores
            if (cleaned.startsWith('.') || cleaned.startsWith('_') || 
                cleaned.endsWith('.') || cleaned.endsWith('_')) {
                return null;
            }
            
            // Skip common non-username patterns
            if (['explore', 'accounts', 'reels', 'stories', 'tv', 'direct', 'reel', 'instagram'].includes(cleaned.toLowerCase())) {
                return null;
            }
            
            return cleaned;
        }
        
        try {
            if (isDebugMode) {
                console.log('🔍 DEBUG: Starting username extraction from search page...');
                const pageInfo = getPageInfo();
                console.log('🔍 DEBUG: Search query:', pageInfo?.query);
            }
            
            // Method 1: Extract usernames from post URLs (primary method for search pages)
            const postLinks = document.querySelectorAll('a[href*="/p/"]');
            if (isDebugMode) {
                console.log(`🔍 DEBUG: Found ${postLinks.length} post links`);
            }
            
            // For search results, we need to find the username from the post context
            // since the direct /p/ID/ links don't contain usernames
            postLinks.forEach((link, index) => {
                const href = link.getAttribute('href');
                if (href) {
                    // Look for username context near the post link
                    const container = link.closest('article, div[role="button"], div[class*="post"], div[class*="media"]') || link.parentElement;
                    if (container) {
                        // Method 1a: Look for profile links in the same container
                        const profileLinks = container.querySelectorAll('a[href^="/"][href*="/"]');
                        profileLinks.forEach(profileLink => {
                            const profileHref = profileLink.getAttribute('href');
                            if (profileHref && profileHref !== href) {
                                // Match Instagram username pattern (excluding posts and special pages)
                                const usernameMatch = profileHref.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
                                if (usernameMatch) {
                                    const rawUsername = usernameMatch[1];
                                    const username = cleanUsername(rawUsername);
                                    if (username) {
                                        usernames.add(username);
                                        if (isDebugMode) {
                                            console.log(`📝 Found username from profile link in post #${index + 1}: @${username} (${profileHref})`);
                                        }
                                    }
                                }
                            }
                        });
                        
                        // Method 1b: Look for text content that could be usernames
                        const textElements = container.querySelectorAll('span, div, a');
                        textElements.forEach(element => {
                            const text = element.textContent?.trim();
                            if (text && text.length > 1 && text.length <= 30) {
                                // Check if it starts with @ (mention) or is a clickable username
                                if (text.startsWith('@')) {
                                    const rawUsername = text.substring(1);
                                    const username = cleanUsername(rawUsername);
                                    if (username) {
                                        usernames.add(username);
                                        if (isDebugMode) {
                                            console.log(`📝 Found username from mention in post #${index + 1}: @${username}`);
                                        }
                                    }
                                } else {
                                    // Check if element is a clickable username link
                                    const parentLink = element.closest('a[href^="/"]');
                                    if (parentLink) {
                                        const linkHref = parentLink.getAttribute('href');
                                        const usernameMatch = linkHref?.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
                                        if (usernameMatch && usernameMatch[1] === text) {
                                            const username = cleanUsername(text);
                                            if (username) {
                                                usernames.add(username);
                                                if (isDebugMode) {
                                                    console.log(`📝 Found username from clickable text in post #${index + 1}: @${username}`);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                }
            });

            // Method 2: Extract from image alt text for additional mentions
            const images = document.querySelectorAll('img[alt]');
            if (isDebugMode) {
                console.log(`🔍 DEBUG: Found ${images.length} images with alt text`);
            }
            
            images.forEach((img, index) => {
                const alt = img.getAttribute('alt');
                if (alt) {
                    // Pattern: "@username" mentions in alt text
                    const mentionMatches = alt.match(/@([a-zA-Z0-9._]{1,30})/g);
                    if (mentionMatches) {
                        mentionMatches.forEach(mention => {
                            const rawUsername = mention.substring(1); // Remove @
                            const username = cleanUsername(rawUsername);
                            if (username) {
                                usernames.add(username);
                                if (isDebugMode) {
                                    console.log(`📝 Found username from alt mention #${index + 1}: @${username} (${alt.substring(0, 50)}...)`);
                                }
                            }
                        });
                    }
                    
                    // Pattern: Look for usernames in various alt text formats
                    const patterns = [
                        /Photo by ([a-zA-Z0-9._]{1,30})/i,
                        /Post by ([a-zA-Z0-9._]{1,30})/i,
                        /^([a-zA-Z0-9._]{1,30})'s/i, // "username's post"
                        /by ([a-zA-Z0-9._]{1,30})$/i  // "... by username"
                    ];
                    
                    patterns.forEach(pattern => {
                        const match = alt.match(pattern);
                        if (match) {
                            const rawUsername = match[1].trim();
                            const username = cleanUsername(rawUsername);
                            if (username) {
                                usernames.add(username);
                                if (isDebugMode) {
                                    console.log(`📝 Found username from alt pattern: @${username} (${alt.substring(0, 50)}...)`);
                                }
                            }
                        }
                    });
                }
            });

            // Method 3: Look for username links that are directly related to search results
            const allLinks = document.querySelectorAll('a[href^="/"]');
            let profileLinkCount = 0;
            allLinks.forEach(link => {
                const href = link.getAttribute('href');
                if (href) {
                    // Match Instagram username pattern (excluding posts and special pages)
                    const usernameMatch = href.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
                    if (usernameMatch) {
                        const rawUsername = usernameMatch[1];
                        const username = cleanUsername(rawUsername);
                        if (username) {
                            // Additional check: make sure this link is visible and part of search results
                            const linkText = link.textContent?.trim();
                            const isVisible = link.offsetParent !== null;
                            if (isVisible && (linkText === username || linkText === `@${username}` || linkText === '')) {
                                usernames.add(username);
                                profileLinkCount++;
                                if (isDebugMode) {
                                    console.log(`📝 Found username from profile link: @${username} (${href})`);
                                }
                            }
                        }
                    }
                }
            });
            
            if (isDebugMode) {
                console.log(`🔍 DEBUG: Found ${profileLinkCount} profile links`);
            }

            // Method 4: Look for search result user cards/profiles
            const userCards = document.querySelectorAll('[role="button"], [tabindex="0"]');
            userCards.forEach(card => {
                // Look for username text or links within user card elements
                const links = card.querySelectorAll('a[href^="/"]');
                const textElements = card.querySelectorAll('span, div');
                
                links.forEach(link => {
                    const href = link.getAttribute('href');
                    const usernameMatch = href?.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
                    if (usernameMatch) {
                        const username = cleanUsername(usernameMatch[1]);
                        if (username) {
                            usernames.add(username);
                            if (isDebugMode) {
                                console.log(`📝 Found username from user card: @${username}`);
                            }
                        }
                    }
                });
                
                textElements.forEach(element => {
                    const text = element.textContent?.trim();
                    if (text && text.startsWith('@') && text.length <= 31) {
                        const rawUsername = text.substring(1);
                        const username = cleanUsername(rawUsername);
                        if (username) {
                            usernames.add(username);
                            if (isDebugMode) {
                                console.log(`📝 Found username from user card text: @${username}`);
                            }
                        }
                    }
                });
            });

            const uniqueUsernames = Array.from(usernames);
            
            if (isDebugMode) {
                console.log(`🎯 FINAL RESULT: ${uniqueUsernames.length} unique usernames found from search`);
                console.log('Usernames:', uniqueUsernames);
                console.log('🔍 DEBUG: Username extraction from search complete');
            }
            
            return uniqueUsernames;
            
        } catch (error) {
            console.error('Error extracting usernames from search:', error);
            if (isDebugMode) {
                console.log('Error details:', error);
            }
            return [];
        }
    }

    // Create comprehensive viewer UI showing all users and their data status
    async function createViewerUI() {
        // Remove any existing UI
        const existingViewer = document.getElementById('instagram-viewer-ui');
        const existingManager = document.getElementById('instagram-manager-ui');
        const existingScraper = document.getElementById('instagram-scraper-ui');
        if (existingViewer) existingViewer.remove();
        if (existingManager) existingManager.remove();
        if (existingScraper) existingScraper.remove();

        const users = await loadAllUsersFromUnifiedStorage();
        const userList = Object.values(users);
        
        if (userList.length === 0) {
            const noDataUI = document.createElement('div');
            noDataUI.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1e293b;
                color: white;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #334155;
                text-align: center;
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            `;
            noDataUI.innerHTML = `
                <h3 style="margin: 0 0 10px 0; color: #e2e8f0;">No Users Found</h3>
                <p style="margin: 0 0 15px 0; color: #94a3b8;">No users have been collected yet. Start by scraping some profiles or locations.</p>
                <button onclick="this.parentElement.remove()" style="padding: 8px 15px; background: #0095f6; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
            `;
            document.body.appendChild(noDataUI);
            return;
        }

        // Determine data status for each user
        function getUserDataStatus(user) {
            const hasExtendedData = user.followerCount > 0 || 
                                  user.biography || 
                                  user.fullName || 
                                  (user.recentPosts && user.recentPosts.length > 0) ||
                                  user.status === 'inaccessible' || // Profile is private/deleted - skip
                                  user.status === 'no_data' || // Profile had no extractable data - skip
                                  user.followerCount === -1; // Special marker for processed but no data
            
            if (hasExtendedData) {
                // Handle special status cases
                if (user.status === 'inaccessible') {
                    return {
                        level: 'extended',
                        label: 'Inaccessible',
                        color: '#ef4444',
                        details: user.reason || 'Profile is private, deleted, or inaccessible'
                    };
                }
                
                if (user.status === 'no_data' || user.followerCount === -1) {
                    return {
                        level: 'extended',
                        label: 'No Data Found',
                        color: '#f59e0b',
                        details: user.reason || 'No extractable data found on profile page'
                    };
                }
                
                // Normal case with actual data
                const dataPoints = [];
                if (user.followerCount > 0) dataPoints.push('Followers');
                if (user.biography) dataPoints.push('Bio');
                if (user.fullName) dataPoints.push('Name');
                if (user.recentPosts && user.recentPosts.length > 0) dataPoints.push(`${user.recentPosts.length} Posts`);
                
                return {
                    level: 'extended',
                    label: 'Extended Data',
                    color: '#10b981',
                    details: dataPoints.join(', ')
                };
            } else {
                return {
                    level: 'basic',
                    label: 'Basic Only',
                    color: '#6b7280',
                    details: 'Username only'
                };
            }
        }

        // Sort users by status (extended data first, then by username)
        const sortedUsers = userList.sort((a, b) => {
            const statusA = getUserDataStatus(a);
            const statusB = getUserDataStatus(b);
            
            if (statusA.level !== statusB.level) {
                return statusA.level === 'extended' ? -1 : 1;
            }
            return a.username.localeCompare(b.username);
        });

        // Count by status
        const statusCounts = {
            extended: userList.filter(u => getUserDataStatus(u).level === 'extended').length,
            basic: userList.filter(u => getUserDataStatus(u).level === 'basic').length
        };

        // Count by preference
        const preferenceCounts = {
            liked: userList.filter(u => getUserPreference(u.username) === 'like').length,
            pending: userList.filter(u => getUserPreference(u.username) === 'none').length,
            disliked: userList.filter(u => getUserPreference(u.username) === 'dislike').length
        };

        let currentFilter = 'all'; // all, extended, basic, liked, pending, disliked

        const viewerUI = document.createElement('div');
        viewerUI.id = 'instagram-viewer-ui';
        viewerUI.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #0f172a;
            color: white;
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        function updateDisplay() {
            const filteredUsers = currentFilter === 'all' ? sortedUsers : 
                                currentFilter === 'extended' ? sortedUsers.filter(u => getUserDataStatus(u).level === 'extended') :
                                currentFilter === 'basic' ? sortedUsers.filter(u => getUserDataStatus(u).level === 'basic') :
                                currentFilter === 'liked' ? sortedUsers.filter(u => getUserPreference(u.username) === 'like') :
                                currentFilter === 'pending' ? sortedUsers.filter(u => getUserPreference(u.username) === 'none') :
                                currentFilter === 'disliked' ? sortedUsers.filter(u => getUserPreference(u.username) === 'dislike') :
                                sortedUsers;

            const content = `
                <div style="flex: 1; overflow-y: auto; padding: 0;">
                    <div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
                        
                        <!-- Header -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
                            <div>
                                <h1 style="margin: 0 0 8px 0; color: #0095f6; font-size: 24px; font-weight: 600;">
                                    📋 User Data Viewer
                                </h1>
                                <div style="color: #94a3b8; font-size: 14px;">
                                    Showing ${filteredUsers.length} of ${userList.length} users
                                </div>
                            </div>
                            <button id="close-viewer" style="padding: 10px 15px; background: #64748b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                                ✕ Close
                            </button>
                        </div>

                        <!-- Filter Buttons -->
                        <div style="display: flex; justify-content: center; gap: 10px; margin-bottom: 20px;">
                            <button data-filter="all" style="padding: 10px 20px; background: ${currentFilter === 'all' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                                All Users (${userList.length})
                            </button>
                            <button data-filter="extended" style="padding: 10px 20px; background: ${currentFilter === 'extended' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                                Extended Data (${statusCounts.extended})
                            </button>
                            <button data-filter="basic" style="padding: 10px 20px; background: ${currentFilter === 'basic' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                                Basic Only (${statusCounts.basic})
                            </button>
                            <button data-filter="liked" style="padding: 10px 20px; background: ${currentFilter === 'liked' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                                Liked (${preferenceCounts.liked})
                            </button>
                            <button data-filter="pending" style="padding: 10px 20px; background: ${currentFilter === 'pending' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                                Pending (${preferenceCounts.pending})
                            </button>
                            <button data-filter="disliked" style="padding: 10px 20px; background: ${currentFilter === 'disliked' ? '#0095f6' : '#334155'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
                                Disliked (${preferenceCounts.disliked})
                            </button>
                        </div>

                        <!-- Export Options -->
                        <div style="display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; padding: 15px; background: #1e293b; border-radius: 8px; border: 1px solid #334155;">
                            <button id="export-current" style="padding: 8px 15px; background: #0d9488; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                📥 Export Filtered (${filteredUsers.length})
                            </button>
                            <button id="export-extended" style="padding: 8px 15px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                📥 Export Extended Only (${statusCounts.extended})
                            </button>
                            <button id="export-liked" style="padding: 8px 15px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                👍 Export Liked (${preferenceCounts.liked})
                            </button>
                            <button id="export-usernames" style="padding: 8px 15px; background: #7c3aed; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                📝 Export Usernames (${userList.length})
                            </button>
                        </div>

                        <!-- User List -->
                        <div style="background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden;">
                            <div style="padding: 15px 20px; background: #0f172a; border-bottom: 1px solid #334155;">
                                <h3 style="margin: 0; color: #e2e8f0; font-size: 16px; font-weight: 600;">User Database</h3>
                            </div>
                            <div style="max-height: 500px; overflow-y: auto;">
                                ${filteredUsers.length === 0 ? `
                                    <div style="padding: 40px; text-align: center; color: #64748b;">
                                        No users match the current filter
                                    </div>
                                ` : `
                                    ${filteredUsers.map((user, index) => {
                                        const status = getUserDataStatus(user);
                                        const preference = getUserPreference(user.username);
                                        const preferenceColor = preference === 'like' ? '#10b981' : 
                                                              preference === 'dislike' ? '#ef4444' : '#64748b';
                                        
                                        return `
                                            <div style="display: flex; align-items: center; padding: 15px 20px; border-bottom: 1px solid #334155; hover: background-color: #0f172a;" 
                                                 onmouseover="this.style.backgroundColor='#0f172a'" 
                                                 onmouseout="this.style.backgroundColor='transparent'">
                                                
                                                <!-- Profile Picture -->
                                                <img src="${user.profilePicUrl || '/favicon.ico'}" 
                                                     style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid ${status.color}; margin-right: 15px;"
                                                     onerror="this.src='/favicon.ico'">
                                                
                                                <!-- User Info -->
                                                <div style="flex: 1;">
                                                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                                                        <a href="https://www.instagram.com/${user.username}/" target="_blank" 
                                                           style="color: #0095f6; text-decoration: none; font-weight: 600; font-size: 14px;">
                                                            @${user.username}
                                                        </a>
                                                        <div style="background: ${status.color}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 500;">
                                                            ${status.label}
                                                        </div>
                                                        ${preference !== 'none' ? `
                                                            <div style="background: ${preferenceColor}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                                                                ${preference === 'like' ? '👍' : '👎'}
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                    <div style="color: #e2e8f0; font-size: 13px; margin-bottom: 2px;">
                                                        ${user.fullName || 'No display name'}
                                                    </div>
                                                    <div style="color: #94a3b8; font-size: 11px;">
                                                        ${status.details}
                                                    </div>
                                                </div>
                                                
                                                <!-- Stats -->
                                                <div style="text-align: right; color: #94a3b8; font-size: 11px; min-width: 120px;">
                                                    ${user.followerCount > 0 ? `
                                                        <div><strong>${user.followerCount.toLocaleString()}</strong> followers</div>
                                                        <div>${user.postsCount || 0} posts</div>
                                                    ` : `
                                                        <div>No follower data</div>
                                                    `}
                                                    <div style="color: #64748b; font-size: 10px; margin-top: 2px;">
                                                        ${user.lastUpdated ? new Date(user.lastUpdated).toLocaleDateString() : 'Unknown date'}
                                                    </div>
                                                </div>
                                                
                                                <!-- Source -->
                                                <div style="text-align: center; margin-left: 15px; min-width: 80px;">
                                                    <div style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 500;">
                                                        ${user.locationId ? 'Location' : user.profilePage ? 'Profile' : 'Manual'}
                                                    </div>
                                                    <div style="color: #64748b; font-size: 9px;">
                                                        ${user.locationId || user.profilePage || 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                `}
                            </div>
                        </div>
                        
                        <!-- Summary Stats -->
                        <div style="margin-top: 20px; padding: 15px; background: #1e293b; border-radius: 8px; border: 1px solid #334155;">
                            <h3 style="margin: 0 0 10px 0; color: #e2e8f0; font-size: 14px; font-weight: 600;">Collection Summary</h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; font-size: 12px;">
                                <div>
                                    <div style="color: #10b981; font-weight: 600;">Extended Data: ${statusCounts.extended}</div>
                                    <div style="color: #94a3b8;">Profiles with detailed information</div>
                                </div>
                                <div>
                                    <div style="color: #f59e0b; font-weight: 600;">Basic Only: ${statusCounts.basic}</div>
                                    <div style="color: #94a3b8;">Usernames without extended data</div>
                                </div>
                                <div>
                                    <div style="color: #059669; font-weight: 600;">Liked: ${preferenceCounts.liked}</div>
                                    <div style="color: #94a3b8;">Users marked as liked</div>
                                </div>
                                <div>
                                    <div style="color: #64748b; font-weight: 600;">Pending: ${preferenceCounts.pending}</div>
                                    <div style="color: #94a3b8;">Users awaiting review</div>
                                </div>
                                <div>
                                    <div style="color: #ef4444; font-weight: 600;">Disliked: ${preferenceCounts.disliked}</div>
                                    <div style="color: #94a3b8;">Users marked as disliked</div>
                                </div>
                                <div>
                                    <div style="color: #0095f6; font-weight: 600;">Total Users: ${userList.length}</div>
                                    <div style="color: #94a3b8;">All collected usernames</div>
                                </div>
                                <div>
                                    <div style="color: #8b5cf6; font-weight: 600;">Completion: ${Math.round((statusCounts.extended / userList.length) * 100)}%</div>
                                    <div style="color: #94a3b8;">Profiles with extended data</div>
                                </div>
                                <div>
                                    <div style="color: #10b981; font-weight: 600;">Approval Rate: ${userList.length > 0 ? Math.round((preferenceCounts.liked / userList.length) * 100) : 0}%</div>
                                    <div style="color: #94a3b8;">Percentage of liked users</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            viewerUI.innerHTML = content;

            // Attach event listeners
            const filterButtons = viewerUI.querySelectorAll('[data-filter]');
            filterButtons.forEach(button => {
                button.addEventListener('click', () => {
                    currentFilter = button.getAttribute('data-filter');
                    updateDisplay();
                });
            });

            const closeBtn = document.getElementById('close-viewer');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    viewerUI.remove();
                });
            }

            // Export buttons
            const exportCurrentBtn = document.getElementById('export-current');
            if (exportCurrentBtn) {
                exportCurrentBtn.addEventListener('click', () => {
                    exportUsers(filteredUsers, `instagram_users_${currentFilter}_${new Date().toISOString().split('T')[0]}.json`);
                });
            }

            const exportExtendedBtn = document.getElementById('export-extended');
            if (exportExtendedBtn) {
                exportExtendedBtn.addEventListener('click', () => {
                    const extendedUsers = userList.filter(u => getUserDataStatus(u).level === 'extended');
                    exportUsers(extendedUsers, `instagram_users_extended_${new Date().toISOString().split('T')[0]}.json`);
                });
            }

            const exportLikedBtn = document.getElementById('export-liked');
            if (exportLikedBtn) {
                exportLikedBtn.addEventListener('click', () => {
                    const likedUsers = userList.filter(u => getUserPreference(u.username) === 'like');
                    exportUsers(likedUsers, `instagram_users_liked_${new Date().toISOString().split('T')[0]}.json`);
                });
            }

            const exportUsernamesBtn = document.getElementById('export-usernames');
            if (exportUsernamesBtn) {
                exportUsernamesBtn.addEventListener('click', () => {
                    const usernameList = userList.map(u => u.username).join('\n');
                    const blob = new Blob([usernameList], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `instagram_usernames_${new Date().toISOString().split('T')[0]}.txt`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                });
            }
        }

        // Helper function to export users
        function exportUsers(users, filename) {
            const dataStr = JSON.stringify(users, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        document.body.appendChild(viewerUI);
        updateDisplay();

        // Expose updateDisplay function for external refresh
        viewerUI.updateDisplay = updateDisplay;

        // Keyboard shortcuts
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                viewerUI.remove();
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        viewerUI.cleanup = () => {
            document.removeEventListener('keydown', handleKeyPress);
        };

        return viewerUI;
    }

    // Update scraper UI button counts and states
    async function updateScraperUI(pageInfo = null) {
        const allUsers = await loadAllUsersFromUnifiedStorage();
        const totalUsers = Object.keys(allUsers).length;
        
        // Filter users without extended data and ensure username is included
        const usersWithoutExtendedData = [];
        const usersWithExtendedData = [];
        
        for (const [username, userData] of Object.entries(allUsers)) {
            const hasExtendedData = userData && (userData.followerCount > 0 || 
                                  userData.biography || 
                                  userData.fullName || 
                                  (userData.recentPosts && userData.recentPosts.length > 0) ||
                                  userData.status === 'inaccessible' || // Profile is private/deleted - skip
                                  userData.status === 'no_data' || // Profile had no extractable data - skip
                                  userData.status === 'completed' || // Profile processing completed - skip
                                  userData.status === 'private' || // Private profile - skip
                                  userData.status === 'error' || // Error during processing - skip
                                  userData.followerCount === -1 || // Special marker for processed but no data
                                  userData.processedAt); // Has been processed at least once - skip
            
            const userWithUsername = {
                username: username,
                ...userData
            };
            
            if (hasExtendedData) {
                usersWithExtendedData.push(userWithUsername);
            } else {
                usersWithoutExtendedData.push(userWithUsername);
            }
        }

        // Update button text and states
        const managerButton = document.getElementById('open-manager');
        const downloadButton = document.getElementById('download-users');
        const openProfilesButton = document.getElementById('open-profiles');

        if (managerButton) {
            managerButton.textContent = `Manager (${usersWithExtendedData.length})`;
            managerButton.disabled = usersWithExtendedData.length === 0;
        }

        if (downloadButton) {
            downloadButton.textContent = `Download (${totalUsers})`;
            downloadButton.disabled = totalUsers === 0;
        }

        if (openProfilesButton) {
            openProfilesButton.textContent = `Open Profiles (${usersWithoutExtendedData.length})`;
            // If no users without extended data, remove the Phase 2 section
            if (usersWithoutExtendedData.length === 0 && pageInfo) {
                const phase2Section = openProfilesButton.closest('div[style*="border-left: 3px solid #8b5cf6"]');
                if (phase2Section) {
                    phase2Section.style.display = 'none';
                }
            }
        }
    }

    // Download function (downloads current session data)
    async function downloadData() {
        const allUsers = await loadAllUsersFromUnifiedStorage();
        
        if (Object.keys(allUsers).length === 0) {
            const statusElement = document.getElementById('scraper-status');
            const resultsElement = document.getElementById('scraper-results');
            if (statusElement) statusElement.textContent = 'No data to download';
            if (resultsElement) resultsElement.textContent = 'No users found in storage';
            return;
        }

        // Create download
        const dataStr = JSON.stringify(allUsers, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `instagram_users_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        const statusElement = document.getElementById('scraper-status');
        const resultsElement = document.getElementById('scraper-results');
        if (statusElement) statusElement.textContent = 'Download started';
        if (resultsElement) resultsElement.textContent = `Downloaded ${Object.keys(allUsers).length} users`;
    }

    // Auto-advance to next profile needing data after saving current profile
    async function autoAdvanceToNextProfile() {
        try {
            console.log('🔄 DEBUG: Starting auto-advance to next profile...');
            const allUsers = await loadAllUsersFromUnifiedStorage();
            console.log('🔄 DEBUG: Loaded users for auto-advance:', Object.keys(allUsers).length);
            
            // Filter users without extended data  
            const usersWithoutExtendedData = [];
            
            for (const [username, userData] of Object.entries(allUsers)) {
                // Clean username to ensure consistency
                const cleanedUsername = username.replace(/[.\s]+$/, '').trim();
                
                const hasExtendedData = userData && (userData.followerCount > 0 || 
                                      userData.biography || 
                                      userData.fullName || 
                                      (userData.recentPosts && userData.recentPosts.length > 0) ||
                                      userData.status === 'inaccessible' || // Profile is private/deleted - skip
                                      userData.status === 'no_data' || // Profile had no extractable data - skip
                                      userData.status === 'completed' || // Profile processing completed - skip
                                      userData.status === 'private' || // Private profile - skip
                                      userData.status === 'error' || // Error during processing - skip
                                      userData.followerCount === -1 || // Special marker for processed but no data
                                      userData.processedAt); // Has been processed at least once - skip
                
                // Debug logging for problematic users
                if (cleanedUsername === 'erinseneker' || username === 'erinseneker') {
                    console.log(`🔍 DEBUG: Checking user "${username}" (cleaned: "${cleanedUsername}"):`, {
                        userData: userData,
                        hasExtendedData: hasExtendedData,
                        status: userData?.status,
                        followerCount: userData?.followerCount,
                        processedAt: userData?.processedAt
                    });
                }
                
                if (!hasExtendedData) {
                    // Ensure username is cleaned and included in the user object
                    usersWithoutExtendedData.push({
                        username: cleanedUsername,
                        ...userData
                    });
                }
            }

            console.log('🔄 DEBUG: Found', usersWithoutExtendedData.length, 'users without extended data');

            // Debug: Show some of the users without extended data
            if (usersWithoutExtendedData.length > 0) {
                console.log('🔍 DEBUG: First 5 users without extended data:', 
                    usersWithoutExtendedData.slice(0, 5).map(u => ({
                        username: u.username,
                        status: u.status,
                        followerCount: u.followerCount,
                        processedAt: u.processedAt
                    }))
                );
            }

            if (usersWithoutExtendedData.length === 0) {
                console.log('✅ All profiles have extended data!');
                
                // Show completion notification
                const completionDiv = document.createElement('div');
                completionDiv.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #10b981;
                    color: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    z-index: 999999;
                    font-size: 14px;
                    font-weight: bold;
                    border: 2px solid #059669;
                `;
                completionDiv.innerHTML = `
                    🎉 All Profiles Complete!<br>
                    <span style="font-size: 12px; opacity: 0.9;">No more profiles need extended data</span>
                `;
                document.body.appendChild(completionDiv);
                setTimeout(() => completionDiv.remove(), 5000);
                return;
            }

            // Get the next profile to process
            const nextProfile = usersWithoutExtendedData[0];
            const nextUsername = nextProfile.username;
            
            if (!nextUsername || nextUsername === 'undefined') {
                console.error('❌ Next profile has invalid username:', nextProfile);
                return;
            }
            
            console.log(`🔄 Auto-advancing to next profile: @${nextUsername} (${usersWithoutExtendedData.length} remaining)`);
            
            // Show advancing notification
            const advanceDiv = document.createElement('div');
            advanceDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #0095f6;
                color: white;
                padding: 12px 18px;
                border-radius: 6px;
                z-index: 999999;
                font-size: 13px;
                font-weight: bold;
                border: 2px solid #0084d1;
            `;
            advanceDiv.innerHTML = `
                🔄 Auto-advancing...<br>
                <span style="font-size: 11px; opacity: 0.9;">Next: @${nextUsername} (${usersWithoutExtendedData.length} remaining)</span>
            `;
            document.body.appendChild(advanceDiv);
            setTimeout(() => advanceDiv.remove(), 2500);
            
            // Navigate to the next profile immediately (removed 400ms delay)
            const profileUrl = `https://www.instagram.com/${nextUsername}/`;
            console.log('🔄 Navigating to:', profileUrl);
            window.location.href = profileUrl;
            
        } catch (error) {
            console.error('❌ Error in auto-advance:', error);
        }
    }

    // Enhanced auto-save function with auto-advance capability
    async function autoSaveProfileData(pageInfo) {
        try {
            console.log('💾 Auto-save profile data started for:', pageInfo);
            
            if (!pageInfo || !pageInfo.username) {
                console.log('❌ Invalid pageInfo, cannot auto-save');
                return;
            }

            const username = pageInfo.username;
            
            // No wait needed - Instagram SPA loads dynamically, DOM elements are available immediately
            // Removed: await new Promise(resolve => setTimeout(resolve, 800));
            
            // Check if this is an error page or unavailable profile
            const pageText = document.body.innerText.toLowerCase();
            const isErrorPage = pageText.includes("sorry, this page isn't available") ||
                               pageText.includes("user not found") ||
                               pageText.includes("page not found") ||
                               document.title.includes("Page Not Found");
            
            const isPrivateProfile = pageText.includes("this account is private") ||
                                   document.querySelector('[data-testid="private-profile-message"]') ||
                                   pageText.includes("follow to see their photos and videos");

            // Check for profiles with no posts specifically
            const hasNoPosts = pageText.includes("no posts yet") ||
                             pageText.includes("hasn't shared any photos") || 
                             pageText.includes("when they share photos") ||
                             pageText.includes("when they post") ||
                             document.querySelector('[data-testid="emptyState"]') ||
                             (pageText.includes("posts") && pageText.includes("0 posts"));

            let userData = {};
            let saveStatus = '';

            if (isErrorPage) {
                console.log(`❌ Profile @${username} is not available (deleted/suspended)`);
                userData = {
                    username: username,
                    status: 'inaccessible',
                    followerCount: -1,
                    processedAt: new Date().toISOString(),
                    errorReason: 'Profile not available'
                };
                saveStatus = 'Profile marked as inaccessible';
            } else if (isPrivateProfile) {
                console.log(`🔒 Profile @${username} is private`);
                userData = {
                    username: username,
                    status: 'private',
                    isPrivate: true,
                    followerCount: 0,
                    processedAt: new Date().toISOString()
                };
                saveStatus = 'Private profile recorded';
            } else {
                // Extract profile data from the page
                console.log(`📊 Extracting profile data for @${username}...`);
                const profileData = getProfileDataFromDOM(username, true);
                
                // Check if we got meaningful data OR if this is a profile with no posts
                const hasData = profileData.followerCount > 0 || 
                              profileData.biography || 
                              profileData.fullName || 
                              (profileData.recentPosts && profileData.recentPosts.length > 0);
                
                if (hasData) {
                    // Download images for the profile data
                    console.log(`🖼️ Downloading images for @${username}...`);
                    const profileDataWithImages = await downloadProfileImages(profileData, true);
                    
                    userData = {
                        username: username,
                        ...profileDataWithImages,
                        processedAt: new Date().toISOString(),
                        status: 'completed'
                    };
                    
                    const imageStats = {
                        profilePic: profileDataWithImages.profilePicBase64 ? '✅' : '❌',
                        postImages: profileDataWithImages.recentPosts.filter(p => p.thumbnailBase64).length
                    };
                    
                    saveStatus = `Profile data saved (${profileDataWithImages.followerCount} followers, ${profileDataWithImages.recentPosts.length} posts, images: ${imageStats.profilePic} profile + ${imageStats.postImages} posts)`;
                    console.log(`✅ Successfully extracted data for @${username}:`, {
                        followers: profileDataWithImages.followerCount,
                        posts: profileDataWithImages.recentPosts.length,
                        hasFullName: !!profileDataWithImages.fullName,
                        hasBio: !!profileDataWithImages.biography,
                        profilePicDownloaded: !!profileDataWithImages.profilePicBase64,
                        postImagesDownloaded: profileDataWithImages.recentPosts.filter(p => p.thumbnailBase64).length
                    });
                } else if (hasNoPosts && (profileData.followerCount > 0 || profileData.fullName || profileData.biography)) {
                    // Profile exists with basic info but explicitly has no posts
                    // Still download profile picture if available
                    console.log(`🖼️ Downloading profile picture for @${username} (no posts)...`);
                    const profileDataWithImages = await downloadProfileImages(profileData, true);
                    
                    userData = {
                        username: username,
                        ...profileDataWithImages,
                        status: 'completed',
                        processedAt: new Date().toISOString(),
                        recentPosts: [], // Explicitly empty posts array
                        errorReason: 'Profile has no posts available'
                    };
                    saveStatus = `Profile completed (${profileDataWithImages.followerCount} followers, 0 posts - no posts available, profile pic: ${profileDataWithImages.profilePicBase64 ? '✅' : '❌'})`;
                    console.log(`✅ Profile @${username} processed - has basic data but no posts:`, {
                        followers: profileDataWithImages.followerCount,
                        hasFullName: !!profileDataWithImages.fullName,
                        hasBio: !!profileDataWithImages.biography,
                        hasNoPosts: true,
                        profilePicDownloaded: !!profileDataWithImages.profilePicBase64
                    });
                } else {
                    userData = {
                        username: username,
                        status: 'no_data',
                        followerCount: 0,
                        processedAt: new Date().toISOString(),
                        errorReason: 'No extractable data found'
                    };
                    saveStatus = 'No data found - marked as processed';
                    console.log(`⚠️ No meaningful data found for @${username}`);
                }
            }

            // Save the user data
            console.log(`💾 Saving profile data for @${username}...`);
            await saveUserToUnifiedStorage(userData);
            console.log(`✅ Profile data saved for @${username}: ${saveStatus}`);
            
            // Small delay to ensure data is committed to storage before auto-advancing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Update UI if available
            const statusElement = document.getElementById('scraper-status');
            if (statusElement) {
                statusElement.textContent = `✅ ${saveStatus}`;
            }
            
            // Check auto-advance settings immediately
            console.log('🔄 Checking auto-advance settings...');
            const settings = await loadSettings('profile');
            
            if (settings.autoAdvance) {
                console.log('🚀 Auto-advance enabled, moving to next profile...');
                
                // Show brief notification
                const advanceNotification = document.createElement('div');
                advanceNotification.style.cssText = `
                    position: fixed;
                    top: 60px;
                    right: 20px;
                    background: #059669;
                    color: white;
                    padding: 10px 15px;
                    border-radius: 6px;
                    z-index: 999999;
                    font-size: 12px;
                    font-weight: bold;
                `;
                advanceNotification.textContent = `✅ @${username} processed - Auto-advancing...`;
                document.body.appendChild(advanceNotification);
                setTimeout(() => advanceNotification.remove(), 2500);
                
                // Auto-advance to next profile immediately (removed 600ms delay)
                await autoAdvanceToNextProfile();
            } else {
                console.log('⏸️ Auto-advance disabled, staying on current profile');
                
                // Show notification that manual action is needed
                const manualNotification = document.createElement('div');
                manualNotification.style.cssText = `
                    position: fixed;
                    top: 60px;
                    right: 20px;
                    background: #0369a1;
                    color: white;
                    padding: 10px 15px;
                    border-radius: 6px;
                    z-index: 999999;
                    font-size: 12px;
                    font-weight: bold;
                `;
                manualNotification.textContent = `✅ @${username} processed - Enable auto-advance or navigate manually`;
                document.body.appendChild(manualNotification);
                setTimeout(() => manualNotification.remove(), 5000);
            }

        } catch (error) {
            console.error('❌ Error in autoSaveProfileData:', error);
            
            // Save error status for this user
            if (pageInfo && pageInfo.username) {
                try {
                    await saveUserToUnifiedStorage({
                        username: pageInfo.username,
                        status: 'error',
                        followerCount: -1,
                        processedAt: new Date().toISOString(),
                        errorReason: error.message || 'Unknown error during processing'
                    });
                    console.log(`💾 Error status saved for @${pageInfo.username}`);
                } catch (saveError) {
                    console.error('❌ Failed to save error status:', saveError);
                }
            }
        }
    }

    // Add function to clean up duplicate entries
    async function cleanupDuplicateUsernames() {
        try {
            console.log('🧹 Starting username cleanup...');
            const allUsers = await dbManager.getAllItems('users');
            const duplicatesToRemove = [];
            const cleanedUsers = {};

            // Find duplicates and clean usernames
            for (const [username, userData] of Object.entries(allUsers)) {
                const cleanedUsername = username.replace(/[.\s]+$/, '').trim();
                
                if (cleanedUsername !== username) {
                    // This is a username with extra characters
                    duplicatesToRemove.push(username);
                    console.log(`🔍 Found duplicate: "${username}" → "${cleanedUsername}"`);
                    
                    // If we don't have the clean version, or this version has more data, keep it
                    if (!cleanedUsers[cleanedUsername] || 
                        (userData && userData.status && userData.processedAt)) {
                        cleanedUsers[cleanedUsername] = userData;
                    }
                } else {
                    // This is already a clean username
                    if (!cleanedUsers[cleanedUsername] || 
                        (userData && userData.status && userData.processedAt)) {
                        cleanedUsers[cleanedUsername] = userData;
                    }
                }
            }

            // Remove duplicates
            for (const duplicateUsername of duplicatesToRemove) {
                await dbManager.removeItem('users', duplicateUsername);
                console.log(`🗑️ Removed duplicate: "${duplicateUsername}"`);
            }

            // Re-save cleaned users
            for (const [cleanedUsername, userData] of Object.entries(cleanedUsers)) {
                if (userData && userData.username) {
                    userData.username = cleanedUsername;
                    await dbManager.setItem('users', cleanedUsername, userData);
                }
            }

            console.log(`✅ Cleanup complete. Removed ${duplicatesToRemove.length} duplicates`);
            return duplicatesToRemove.length;
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
            return 0;
        }
    }

    // Add image downloading functionality
    async function downloadImageAsBase64(imageUrl, maxSize = 1024 * 1024) { // 1MB max size
        try {
            if (!imageUrl || imageUrl.includes('data:image')) {
                return null;
            }

            // Create a promise to handle the image download
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = function() {
                    try {
                        // Create canvas to convert image to base64
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // Set canvas dimensions to match image
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        
                        // Draw image on canvas
                        ctx.drawImage(img, 0, 0);
                        
                        // Convert to base64 with JPEG compression for smaller size
                        const base64Data = canvas.toDataURL('image/jpeg', 0.8);
                        
                        // Check if the base64 data is within size limits
                        if (base64Data.length > maxSize) {
                            // Try with lower quality
                            const compressedData = canvas.toDataURL('image/jpeg', 0.5);
                            if (compressedData.length > maxSize) {
                                console.warn('⚠️ Image too large even after compression:', imageUrl);
                                resolve(null);
                            } else {
                                resolve(compressedData);
                            }
                        } else {
                            resolve(base64Data);
                        }
                    } catch (error) {
                        console.error('❌ Error converting image to base64:', error);
                        resolve(null);
                    }
                };
                
                img.onerror = function() {
                    console.warn('⚠️ Failed to load image:', imageUrl);
                    resolve(null);
                };
                
                // Set source to start loading
                img.src = imageUrl;
                
                // Add timeout
                setTimeout(() => {
                    console.warn('⏱️ Image download timeout:', imageUrl);
                    resolve(null);
                }, 10000); // 10 second timeout
            });
        } catch (error) {
            console.error('❌ Error downloading image:', error);
            return null;
        }
    }

    async function downloadProfileImages(profileData, isDebugMode = false) {
        debugLog('🖼️ Starting image download for profile...', null, isDebugMode);
        
        const downloadedData = {
            ...profileData,
            profilePicBase64: null,
            recentPosts: []
        };

        // Download profile picture
        if (profileData.profilePicUrl) {
            debugLog('📸 Downloading profile picture...', { url: profileData.profilePicUrl }, isDebugMode);
            downloadedData.profilePicBase64 = await downloadImageAsBase64(profileData.profilePicUrl);
            if (downloadedData.profilePicBase64) {
                debugLog('✅ Profile picture downloaded successfully', null, isDebugMode);
            } else {
                debugLog('❌ Failed to download profile picture', null, isDebugMode);
            }
        }

        // Download post thumbnails
        if (profileData.recentPosts && profileData.recentPosts.length > 0) {
            debugLog(`🖼️ Downloading ${profileData.recentPosts.length} post images...`, null, isDebugMode);
            
            for (let i = 0; i < profileData.recentPosts.length; i++) {
                const post = profileData.recentPosts[i];
                const postWithImage = { ...post };
                
                if (post.thumbnailUrl) {
                    debugLog(`📷 Downloading post ${i + 1}/${profileData.recentPosts.length}...`, { url: post.thumbnailUrl }, isDebugMode);
                    postWithImage.thumbnailBase64 = await downloadImageAsBase64(post.thumbnailUrl);
                    
                    if (postWithImage.thumbnailBase64) {
                        debugLog(`✅ Post ${i + 1} image downloaded`, null, isDebugMode);
                    } else {
                        debugLog(`❌ Failed to download post ${i + 1} image`, null, isDebugMode);
                    }
                    
                    // Small delay between downloads to avoid overwhelming the server
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                downloadedData.recentPosts.push(postWithImage);
            }
        }

        debugLog('🎉 Image download process completed', {
            profilePic: !!downloadedData.profilePicBase64,
            postsWithImages: downloadedData.recentPosts.filter(p => p.thumbnailBase64).length,
            totalPosts: downloadedData.recentPosts.length
        }, isDebugMode);

        return downloadedData;
    }

    // Console commands for debugging and testing
    window.checkPostData = function() {
        console.log('🔍 Checking post data and image downloading...');
        
        if (!dbManager || !dbManager.db) {
            console.log('❌ Database not initialized');
            return;
        }
        
        dbManager.getAllItems('users').then(users => {
            const userList = Object.values(users);
            console.log(`📊 Found ${userList.length} users in database`);
            
            // Find a user with posts for testing
            const userWithPosts = userList.find(user => user.recentPosts && user.recentPosts.length > 0);
            if (userWithPosts) {
                console.log(`👤 Sample user: @${userWithPosts.username}`);
                console.log(`  - Posts: ${userWithPosts.recentPosts.length}`);
                console.log(`  - Profile pic (URL): ${userWithPosts.profilePicUrl ? '✅' : '❌'}`);
                console.log(`  - Profile pic (Base64): ${userWithPosts.profilePicBase64 ? '✅' : '❌'}`);
                
                const postsWithImages = userWithPosts.recentPosts.filter(p => p.thumbnailUrl).length;
                const postsWithBase64 = userWithPosts.recentPosts.filter(p => p.thumbnailBase64).length;
                console.log(`  - Posts with image URLs: ${postsWithImages}`);
                console.log(`  - Posts with base64 images: ${postsWithBase64}`);
                
                if (userWithPosts.recentPosts.length > 0) {
                    const firstPost = userWithPosts.recentPosts[0];
                    console.log(`  📷 First post:`, {
                        id: firstPost.id,
                        hasUrl: !!firstPost.thumbnailUrl,
                        hasBase64: !!firstPost.thumbnailBase64,
                        url: firstPost.thumbnailUrl?.substring(0, 80) + '...'
                    });
                }
            } else {
                console.log('⚠️ No users with posts found');
            }
        }).catch(error => {
            console.error('❌ Error checking post data:', error);
        });
    };

    window.testImageDownload = async function(imageUrl) {
        if (!imageUrl) {
            console.log('❌ Please provide an image URL');
            console.log('Usage: testImageDownload("https://example.com/image.jpg")');
            return;
        }
        
        console.log('🖼️ Testing image download...');
        console.log('📍 Image URL:', imageUrl);
        
        try {
            const base64Data = await downloadImageAsBase64(imageUrl);
            if (base64Data) {
                console.log('✅ Image downloaded successfully');
                console.log('📏 Base64 size:', Math.round(base64Data.length / 1024) + ' KB');
                console.log('🎨 Format:', base64Data.substring(0, 30) + '...');
                
                // Create a temporary image element to display the result
                const img = document.createElement('img');
                img.src = base64Data;
                img.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    max-width: 200px;
                    max-height: 200px;
                    border: 2px solid #10b981;
                    border-radius: 8px;
                    z-index: 999999;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                `;
                document.body.appendChild(img);
                
                setTimeout(() => {
                    img.remove();
                }, 5000);
                
                console.log('🎯 Preview shown for 5 seconds');
            } else {
                console.log('❌ Image download failed');
            }
        } catch (error) {
            console.error('❌ Error downloading image:', error);
        }
    };

    window.downloadCurrentProfileImages = async function() {
        const pageInfo = getPageInfo();
        if (!pageInfo || pageInfo.type !== 'profile') {
            console.log('❌ Not on a profile page');
            return;
        }
        
        console.log(`🖼️ Starting image download for @${pageInfo.username}...`);
        
        try {
            const profileData = getProfileDataFromDOM(pageInfo.username, true);
            console.log('📊 Profile data extracted:', {
                profilePic: !!profileData.profilePicUrl,
                posts: profileData.recentPosts.length
            });
            
            const profileDataWithImages = await downloadProfileImages(profileData, true);
            console.log('✅ Image download completed:', {
                profilePicDownloaded: !!profileDataWithImages.profilePicBase64,
                postsDownloaded: profileDataWithImages.recentPosts.filter(p => p.thumbnailBase64).length,
                totalPosts: profileDataWithImages.recentPosts.length
            });
            
            // Save the updated data
            await saveUserToUnifiedStorage({
                username: pageInfo.username,
                ...profileDataWithImages,
                processedAt: new Date().toISOString(),
                status: 'completed'
            });
            
            console.log('💾 Updated profile data saved with images');
        } catch (error) {
            console.error('❌ Error downloading current profile images:', error);
        }
    };

    // Add to existing console commands log
    console.log(`
🎮 Instagram User Manager - Console Commands:

Main Commands:
- startManager()           : Start the Instagram User Manager
- manager.showManager()    : Show the manager UI
- manager.hideManager()    : Hide the manager UI
- checkPostData()          : Check post data and image status
- testImageDownload(url)   : Test downloading a specific image
- downloadCurrentProfileImages() : Download images for current profile

Manager Commands (when manager is active):
- manager.nextProfile()    : Go to next profile
- manager.previousProfile(): Go to previous profile
- manager.handleLike()     : Like current profile
- manager.handleDislike()  : Dislike current profile
- manager.handleMessaged() : Mark as messaged

Search Commands:
- manager.searchUsers("query") : Search for users
- manager.handleSearch("query"): Handle search with UI update

Database Commands:
- db.getAllUsers()         : Get all users from database
- db.getAllPreferences()   : Get all user preferences
- db.saveUser(userData)    : Save user data
- db.exportData()          : Export all data as JSON

IndexedDB Commands:
- dbManager.getAllItems('users')        : Get all users
- dbManager.getAllItems('preferences')  : Get all preferences
- dbManager.setItem('users', 'username', userData) : Save user
- dbManager.getItem('users', 'username') : Get specific user

Debug Commands:
- testImageDownload(url)   : Test image downloading functionality
- downloadCurrentProfileImages() : Download images for current profile
- checkPostData()          : Check image download status

Image Commands:
- downloadImageAsBase64(url) : Download image and convert to base64
- downloadProfileImages(profileData) : Download all images for a profile
    `);
})();
