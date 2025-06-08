// Instagram User Data Manager - Console Edition v4.0
// Includes: IndexedDB Manager + User Management Interface
// Usage: Copy entire script to console, then run loadUserManager()

(function() {
    'use strict';

    // ========================================
    // PART 1: INDEXEDDB MANAGER
    // ========================================

    class InstagramDB {
        constructor() {
            this.dbName = 'InstagramScraperDB';
            this.version = 4;
            this.db = null;
            this.isReady = false;
            this.useLocalStorageFallback = false;
            
            // Check if IndexedDB was previously problematic
            this.indexedDBFailureFlag = 'igDB_indexeddb_failed';
            this.shouldSkipIndexedDB = localStorage.getItem(this.indexedDBFailureFlag) === 'true';
        }

        async init() {
            // If IndexedDB failed before, skip directly to localStorage
            if (this.shouldSkipIndexedDB) {
                console.log('📂 IndexedDB previously failed - using localStorage mode directly');
                console.log('💡 Run igDB.resetIndexedDBFlag() to retry IndexedDB');
                this.enableLocalStorageFallback();
                return { fallback: true };
            }
            
            console.log('🔧 Opening IndexedDB connection...');
            
            // First check if IndexedDB is blocked by other tabs
            try {
                await this.checkForBlockedDB();
            } catch (error) {
                console.warn('⚠️ Database might be blocked:', error.message);
            }
            
            return new Promise((resolve, reject) => {
                // Reduce timeout to 3 seconds for even faster feedback
                const timeout = setTimeout(() => {
                    console.error('❌ IndexedDB initialization timed out after 3 seconds');
                    console.log('📂 Switching to localStorage fallback mode...');
                    this.enableLocalStorageFallback();
                    resolve({ fallback: true });
                }, 3000);

                const request = indexedDB.open(this.dbName, this.version);
                
                request.onerror = (event) => {
                    clearTimeout(timeout);
                    console.error('❌ IndexedDB open error:', event.target.error);
                    
                    // Go directly to fallback
                    console.log('📂 Falling back to localStorage mode...');
                    this.enableLocalStorageFallback();
                    resolve({ fallback: true });
                };

                request.onsuccess = (event) => {
                    clearTimeout(timeout);
                    console.log('✅ IndexedDB connection established');
                    this.db = event.target.result;
                    this.isReady = true;
                    
                    // Add error handler for the database
                    this.db.onerror = (error) => {
                        console.error('Database error:', error);
                    };
                    
                    resolve(this.db);
                };
                
                request.onupgradeneeded = (event) => {
                    console.log('🔄 Upgrading IndexedDB schema...');
                    
                    try {
                        const db = event.target.result;
                        
                        // Users store
                        if (!db.objectStoreNames.contains('users')) {
                            console.log('📊 Creating users store...');
                            const userStore = db.createObjectStore('users', { keyPath: 'username' });
                            userStore.createIndex('hasExtendedData', 'hasExtendedData');
                            userStore.createIndex('followerCount', 'followerCount');
                            userStore.createIndex('lastUpdated', 'lastUpdated');
                            userStore.createIndex('status', 'status');
                        } else if (event.oldVersion < 4) {
                            // Upgrade existing users store for v4
                            console.log('📊 Upgrading users store to v4...');
                            const transaction = event.target.transaction;
                            const userStore = transaction.objectStore('users');
                            
                            // Add status index if it doesn't exist
                            if (!userStore.indexNames.contains('status')) {
                                userStore.createIndex('status', 'status');
                                console.log('✅ Added status index to users store');
                            }
                        }
                        
                        // Preferences store
                        if (!db.objectStoreNames.contains('preferences')) {
                            console.log('⚙️ Creating preferences store...');
                            db.createObjectStore('preferences', { keyPath: 'username' });
                        }
                        
                        // Settings store
                        if (!db.objectStoreNames.contains('settings')) {
                            console.log('🔧 Creating settings store...');
                            db.createObjectStore('settings', { keyPath: 'key' });
                        }
                        
                        // Locations store
                        if (!db.objectStoreNames.contains('locations')) {
                            console.log('📍 Creating locations store...');
                            const locationStore = db.createObjectStore('locations', { keyPath: 'id' });
                            locationStore.createIndex('name', 'name');
                            locationStore.createIndex('lastScraped', 'lastScraped');
                        }

                        // Posts store (added in version 3)
                        if (!db.objectStoreNames.contains('posts')) {
                            console.log('📸 Creating posts store...');
                            const postStore = db.createObjectStore('posts', { keyPath: 'id' });
                            postStore.createIndex('username', 'username');
                            postStore.createIndex('timestamp', 'timestamp');
                            postStore.createIndex('postType', 'postType');
                        }

                        console.log('✅ Database schema upgrade completed');
                    } catch (upgradeError) {
                        console.error('❌ Error during database upgrade:', upgradeError);
                        clearTimeout(timeout);
                        
                        // Go directly to fallback on upgrade error
                        console.log('📂 Falling back to localStorage due to upgrade error...');
                        this.enableLocalStorageFallback();
                        resolve({ fallback: true });
                    }
                };

                request.onblocked = (event) => {
                    console.warn('⚠️ IndexedDB upgrade blocked - other tabs may be open');
                    console.log('💡 Close other Instagram tabs and try again');
                    
                    // Go to fallback after a short wait
                    setTimeout(() => {
                        console.log('📂 Blocked too long, switching to localStorage...');
                        clearTimeout(timeout);
                        this.enableLocalStorageFallback();
                        resolve({ fallback: true });
                    }, 2000);
                };

                console.log('⏳ Waiting for IndexedDB to open...');
            });
        }

        // Check if database is blocked by attempting a quick connection
        async checkForBlockedDB() {
            return new Promise((resolve, reject) => {
                const testTimeout = setTimeout(() => {
                    reject(new Error('Database check timeout'));
                }, 1000);

                const request = indexedDB.open(this.dbName, this.version);
                
                request.onsuccess = request.onerror = request.onblocked = () => {
                    clearTimeout(testTimeout);
                    if (request.result) {
                        request.result.close();
                    }
                    resolve();
                };
            });
        }

        // Enable localStorage fallback mode
        enableLocalStorageFallback() {
            console.log('📂 Enabling localStorage fallback mode');
            this.useLocalStorageFallback = true;
            this.isReady = true;
            this.db = { fallback: true };
            
            // Remember that IndexedDB failed for next time
            localStorage.setItem(this.indexedDBFailureFlag, 'true');
        }

        // Reset IndexedDB failure flag to retry on next load
        resetIndexedDBFlag() {
            localStorage.removeItem(this.indexedDBFailureFlag);
            this.shouldSkipIndexedDB = false;
            console.log('✅ IndexedDB failure flag reset - will retry IndexedDB on next load');
            console.log('💡 Reload the manager or restart to attempt IndexedDB again');
        }

        // Wait for database to be ready
        async waitForReady() {
            let attempts = 0;
            while (!this.isReady && attempts < 30) { // Reduced from 50 to 30
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!this.isReady) {
                throw new Error('Database not ready after timeout');
            }
        }

        // LocalStorage fallback methods
        getLocalStorageKey(store) {
            return `igDB_${store}`;
        }

        async saveUser(userData) {
            await this.waitForReady();
            
            if (this.useLocalStorageFallback) {
                const users = JSON.parse(localStorage.getItem(this.getLocalStorageKey('users')) || '{}');
                users[userData.username] = {
                    ...userData,
                    lastUpdated: new Date().toISOString(),
                    hasExtendedData: !!(userData.fullName || userData.biography || userData.followerCount)
                };
                localStorage.setItem(this.getLocalStorageKey('users'), JSON.stringify(users));
                return;
            }
            
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            
            const enrichedUser = {
                ...userData,
                lastUpdated: new Date().toISOString(),
                hasExtendedData: !!(userData.fullName || userData.biography || userData.followerCount)
            };
            
            return store.put(enrichedUser);
        }

        async getAllUsers() {
            await this.waitForReady();
            
            if (this.useLocalStorageFallback) {
                const users = JSON.parse(localStorage.getItem(this.getLocalStorageKey('users')) || '{}');
                return Object.values(users);
            }
            
            const transaction = this.db.transaction(['users'], 'readonly');
            const store = transaction.objectStore('users');
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        }

        async savePreference(username, preference) {
            await this.waitForReady();
            
            if (this.useLocalStorageFallback) {
                const prefs = JSON.parse(localStorage.getItem(this.getLocalStorageKey('preferences')) || '{}');
                prefs[username] = preference;
                localStorage.setItem(this.getLocalStorageKey('preferences'), JSON.stringify(prefs));
                return;
            }
            
            const transaction = this.db.transaction(['preferences'], 'readwrite');
            const store = transaction.objectStore('preferences');
            return store.put({ username, preference, updatedAt: new Date().toISOString() });
        }

        async getAllPreferences() {
            await this.waitForReady();
            
            if (this.useLocalStorageFallback) {
                const prefs = JSON.parse(localStorage.getItem(this.getLocalStorageKey('preferences')) || '{}');
                return Object.entries(prefs).map(([username, preference]) => ({ username, preference }));
            }
            
            const transaction = this.db.transaction(['preferences'], 'readonly');
            const store = transaction.objectStore('preferences');
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        }

        async getPreference(username) {
            await this.waitForReady();
            
            if (this.useLocalStorageFallback) {
                const prefs = JSON.parse(localStorage.getItem(this.getLocalStorageKey('preferences')) || '{}');
                return prefs[username] || 'none';
            }
            
            const transaction = this.db.transaction(['preferences'], 'readonly');
            const store = transaction.objectStore('preferences');
            const result = await new Promise((resolve, reject) => {
                const request = store.get(username);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            return result ? result.preference : 'none';
        }

        async deleteUser(username) {
            await this.waitForReady();
            
            if (this.useLocalStorageFallback) {
                const users = JSON.parse(localStorage.getItem(this.getLocalStorageKey('users')) || '{}');
                delete users[username];
                localStorage.setItem(this.getLocalStorageKey('users'), JSON.stringify(users));
                return;
            }
            
            const transaction = this.db.transaction(['users'], 'readwrite');
            const store = transaction.objectStore('users');
            return store.delete(username);
        }


        async getStats() {
            const [users, preferences] = await Promise.all([
                this.getAllUsers(),
                this.getAllPreferences()
            ]);

            // Count users by status using the new getUserDataStatus function
            const statusCounts = {
                extended: 0,
                basic: 0,
                inaccessible: 0,
                no_data: 0
            };

            users.forEach(user => {
                const status = getUserDataStatus(user);
                if (statusCounts.hasOwnProperty(status.level)) {
                    statusCounts[status.level]++;
                }
            });

            const stats = {
                users: {
                    total: users.length,
                    withExtendedData: statusCounts.extended,
                    basic: statusCounts.basic,
                    inaccessible: statusCounts.inaccessible,
                    no_data: statusCounts.no_data,
                    liked: preferences.filter(p => p.preference === 'like').length,
                    disliked: preferences.filter(p => p.preference === 'dislike').length,
                    messaged: preferences.filter(p => p.preference === 'messaged').length,
                    pending: users.length - preferences.length,
                    averageFollowers: users.length > 0 ? Math.round(users.reduce((sum, u) => sum + (u.followerCount || 0), 0) / users.length) : 0,
                    topFollowers: users.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0)).slice(0, 5)
                },
                posts: { total: 0 },
                database: {
                    mode: this.useLocalStorageFallback ? 'localStorage' : 'IndexedDB',
                    lastUpdated: new Date().toISOString()
                }
            };

            return stats;
        }

        async exportData() {
            const [users, preferences] = await Promise.all([
                this.getAllUsers(),
                this.getAllPreferences()
            ]);

            const exportData = {
                exported: new Date().toISOString(),
                mode: this.useLocalStorageFallback ? 'localStorage' : 'IndexedDB',
                users,
                preferences,
                stats: await this.getStats()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `instagram-data-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            console.log('✅ Data exported successfully');
            return exportData;
        }

        // Simplified methods for fallback mode
        async getAllPosts() {
            return []; // Simplified for fallback
        }

        async getUserPosts(username) {
            return []; // Simplified for fallback
        }

        // Migration method (simplified for fallback mode)
        async migrateFromLocalStorage() {
            console.log('🔄 Migration not needed in localStorage mode');
            return { users: 0, preferences: 0 };
        }
    }

    // Initialize IndexedDB
    async function initializeDB() {
        if (window.igDB) {
            console.log('📊 Database already initialized');
            return window.igDB;
        }

        try {
            console.log('🔄 Initializing database...');
            
            // Check if IndexedDB is supported
            if (!window.indexedDB) {
                console.warn('⚠️ IndexedDB not supported, using localStorage fallback');
                const db = new InstagramDB();
                db.enableLocalStorageFallback();
                window.igDB = db;
                console.log('📂 localStorage mode initialized');
                return db;
            }
            
            console.log('✅ IndexedDB support confirmed');
            
            const db = new InstagramDB();
            console.log('🏗️ Creating database instance...');
            
            const result = await db.init();
            console.log('🔗 Database connection established');
            
            window.igDB = db;
            console.log('🌐 Database attached to window.igDB');
            
            // Check which mode we're in
            if (db.useLocalStorageFallback) {
                console.log('📂 Running in localStorage fallback mode');
                console.log('💡 Data will be stored in browser localStorage instead of IndexedDB');
            } else {
                console.log('🗃️ Running in IndexedDB mode');
            }
            
            console.log('✅ Database initialization completed');
            return db;
        } catch (error) {
            console.error('❌ Failed to initialize database:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // Final fallback
            console.log('📂 Attempting localStorage fallback as last resort...');
            try {
                const db = new InstagramDB();
                db.enableLocalStorageFallback();
                window.igDB = db;
                console.log('✅ localStorage fallback mode activated');
                return db;
            } catch (fallbackError) {
                console.error('❌ Even localStorage fallback failed:', fallbackError);
                throw new Error('Database initialization completely failed');
            }
        }
    }

    // ========================================
    // PART 2: USER DATA MANAGER
    // ========================================

    let managerInstance = null;

    class InstagramUserManager {
        constructor() {
            this.isVisible = false;
            this.users = [];
            this.pendingUsers = [];
            this.likedUsers = [];
            this.dislikedUsers = [];
            this.messagedUsers = [];
            this.searchResults = [];
            this.currentIndex = 0;
            this.currentUser = null;
            this.stats = null;
            this.hotkeysEnabled = false;
            this.browseModes = ['pending', 'liked', 'disliked', 'messaged', 'search'];
            this.currentBrowseMode = 'pending';
            this.userPreferences = {};
            this.preferenceMap = new Map();
            this.currentSearchQuery = '';
        }

        // Initialize the manager
        async init() {
            console.log('🔧 Initializing Profile Review Manager...');
            
            await this.waitForDB();
            console.log('📡 Database connection ready');
            
            await this.loadData();
            console.log('📊 Data loaded successfully');
            
            this.createManagerUI();
            console.log('🎨 UI created');
            
            this.setupHotkeys();
            console.log('⌨️ Hotkeys configured');
            
            await this.showManager();
            console.log('👁️ UI displayed');
            
            console.log('✅ Instagram Profile Review Manager fully loaded!');
        }

        // Wait for IndexedDB to be ready
        async waitForDB() {
            let attempts = 0;
            while (!window.igDB && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!window.igDB) {
                throw new Error('IndexedDB not available. Please ensure the IndexedDB script is loaded first.');
            }
        }

        // Load data from IndexedDB
        async loadData() {
            try {
                this.users = await window.igDB.getAllUsers();
                this.stats = await window.igDB.getStats();
                
                // Load preferences and create preference map
                const preferences = await window.igDB.getAllPreferences();
                this.userPreferences = {};
                preferences.forEach(pref => {
                    this.userPreferences[pref.username] = pref.preference;
                    this.preferenceMap.set(pref.username, pref.preference);
                });
                
                // Categorize users by preference status
                this.pendingUsers = this.users.filter(user => {
                    const isPending = !this.userPreferences[user.username] || this.userPreferences[user.username] === 'none';
                    const hasFullData = user.hasExtendedData || 
                                       (user.recentPosts && user.recentPosts.length > 0) ||
                                       (user.biography && user.biography.length > 0) ||
                                       (user.followerCount && user.followerCount > 0) ||
                                       user.profilePicUrl;
                    return isPending && hasFullData;
                });
                
                this.likedUsers = this.users.filter(user => 
                    this.userPreferences[user.username] === 'like'
                );
                
                this.dislikedUsers = this.users.filter(user => 
                    this.userPreferences[user.username] === 'dislike'
                );
                
                this.messagedUsers = this.users.filter(user => 
                    this.userPreferences[user.username] === 'messaged'
                );
                
                console.log(`📊 Loaded ${this.users.length} total users:`);
                console.log(`   - ${this.pendingUsers.length} pending with full data`);
                console.log(`   - ${this.likedUsers.length} liked profiles`);
                console.log(`   - ${this.dislikedUsers.length} disliked profiles`);
                console.log(`   - ${this.messagedUsers.length} messaged profiles`);
                
                // Set current user based on browse mode
                this.setCurrentUserFromMode();
            } catch (error) {
                console.error('Failed to load data:', error);
                this.users = [];
                this.pendingUsers = [];
                this.likedUsers = [];
                this.dislikedUsers = [];
                this.currentUser = null;
                this.userPreferences = {};
                this.stats = { users: { total: 0, liked: 0, disliked: 0, pending: 0 } };
            }
        }

        // Set current user based on browse mode
        setCurrentUserFromMode() {
            const currentList = this.getCurrentUserList();
            if (currentList.length > 0 && this.currentIndex < currentList.length) {
                this.currentUser = currentList[this.currentIndex];
            } else {
                this.currentUser = null;
                this.currentIndex = 0;
            }
        }

        // Get current user list based on browse mode
        getCurrentUserList() {
            switch (this.currentBrowseMode) {
                case 'liked':
                    return this.likedUsers;
                case 'disliked':
                    return this.dislikedUsers;
                case 'messaged':
                    return this.messagedUsers;
                case 'search':
                    return this.searchResults;
                case 'pending':
                default:
                    return this.pendingUsers;
            }
        }

        cycleBrowseMode() {
            const currentIndex = this.browseModes.indexOf(this.currentBrowseMode);
            const nextIndex = (currentIndex + 1) % this.browseModes.length;
            this.switchBrowseMode(this.browseModes[nextIndex]);
        }

        // Get current user's preference
        getCurrentUserPreference() {
            if (!this.currentUser) return 'none';
            return this.preferenceMap.get(this.currentUser.username) || 'none';
        }

        // Switch browse mode
        switchBrowseMode(newMode) {
            if (!this.browseModes.includes(newMode)) return;
            
            // Clear search when switching away from search mode
            if (this.currentBrowseMode === 'search' && newMode !== 'search') {
                this.currentSearchQuery = '';
                this.searchResults = [];
                
                // Clear search input if it exists
                const searchInput = document.querySelector('#search-input');
                if (searchInput) {
                    searchInput.value = '';
                }
            }
            
            this.currentBrowseMode = newMode;
            this.currentIndex = 0;
            this.setCurrentUserFromMode();
            this.updateUI();
            
            console.log(`🔄 Switched to ${newMode} mode - ${this.getCurrentUserList().length} profiles available`);
        }

        // Create the main manager UI
        createManagerUI() {
            // Remove existing manager if present
            const existing = document.getElementById('ig-profile-manager');
            if (existing) existing.remove();

            const manager = document.createElement('div');
            manager.id = 'ig-profile-manager';
            manager.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                z-index: 999999;
                display: ${this.isVisible ? 'flex' : 'none'};
                flex-direction: column;
                overflow: hidden;
            `;

            manager.innerHTML = this.getManagerHTML();
            document.body.appendChild(manager);

            this.attachEventListeners();
        }

        // Get the main manager HTML
        getManagerHTML() {
            if (!this.currentUser) {
                const currentList = this.getCurrentUserList();
                const modeInfo = {
                    pending: { emoji: '⏳', text: 'pending profiles with full data' },
                    liked: { emoji: '👍', text: 'liked profiles' },
                    disliked: { emoji: '👎', text: 'disliked profiles' },
                    messaged: { emoji: '✉️', text: 'messaged profiles' },
                    search: { emoji: '🔍', text: 'search results' }
                };
                const currentModeInfo = modeInfo[this.currentBrowseMode];

                return `
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px;">
                        <div style="text-align: center; max-width: 600px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                <h2 style="margin: 0; color: #f59e0b; font-size: 20px;">📱 Profile Review Manager</h2>
                                <button id="close-manager" style="background: none; border: none; color: #64748b; font-size: 20px; cursor: pointer; padding: 8px;">✕</button>
                            </div>

                            <!-- Browse Mode Selector -->
                            <div style="display: flex; justify-content: center; gap: 6px; margin-bottom: 12px;">
                                ${this.browseModes.filter(mode => mode !== 'search').map(mode => `
                                    <button class="browse-mode-btn" data-mode="${mode}" style="
                                        padding: 6px 10px;
                                        background: ${this.currentBrowseMode === mode ? '#f59e0b' : '#334155'};
                                        border: none;
                                        border-radius: 5px;
                                        color: white;
                                        cursor: pointer;
                                        font-weight: bold;
                                        font-size: 11px;
                                        transition: all 0.2s ease;
                                    ">
                                        ${mode === 'pending' ? '⏳ Pending' : 
                                          mode === 'liked' ? '👍 Liked' : 
                                          mode === 'disliked' ? '👎 Disliked' : 
                                          '✉️ Messaged'}
                                        (${mode === 'pending' ? this.pendingUsers.length : 
                                           mode === 'liked' ? this.likedUsers.length : 
                                           mode === 'disliked' ? this.dislikedUsers.length : 
                                           this.messagedUsers.length})
                                    </button>
                                `).join('')}
                            </div>
                            
                            <!-- Search Input (Empty State) -->
                            <div style="margin-bottom: 20px;">
                                <div style="position: relative;">
                                    <input 
                                        type="text" 
                                        id="search-input" 
                                        placeholder="🔍 Search by username, name, or bio..." 
                                        value="${this.currentSearchQuery}"
                                        style="
                                            width: 100%;
                                            padding: 12px 15px;
                                            background: rgba(30, 41, 59, 0.8);
                                            border: 2px solid ${this.currentBrowseMode === 'search' ? '#f59e0b' : '#475569'};
                                            border-radius: 8px;
                                            color: white;
                                            font-size: 14px;
                                            font-family: inherit;
                                            outline: none;
                                            transition: all 0.2s ease;
                                            box-sizing: border-box;
                                        "
                                    />
                                    ${this.currentBrowseMode === 'search' && this.currentSearchQuery ? `
                                        <button 
                                            id="clear-search" 
                                            style="
                                                position: absolute;
                                                right: 8px;
                                                top: 50%;
                                                transform: translateY(-50%);
                                                background: #64748b;
                                                border: none;
                                                border-radius: 4px;
                                                color: white;
                                                width: 24px;
                                                height: 24px;
                                                cursor: pointer;
                                                font-size: 12px;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                            "
                                        >✕</button>
                                    ` : ''}
                                </div>
                                ${this.currentBrowseMode === 'search' ? `
                                    <div style="margin-top: 8px; font-size: 12px; color: #94a3b8; text-align: center;">
                                        ${this.searchResults.length > 0 ? 
                                            `Found ${this.searchResults.length} profile${this.searchResults.length === 1 ? '' : 's'} for "${this.currentSearchQuery}"` : 
                                            this.currentSearchQuery ? `No profiles found for "${this.currentSearchQuery}"` : 'Enter a search term to find profiles'
                                        }
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div style="color: #64748b; margin-bottom: 30px;">
                                <div style="font-size: 64px; margin-bottom: 20px;">${currentModeInfo.emoji}</div>
                                <div style="font-size: 24px; margin-bottom: 15px;">
                                    ${this.currentBrowseMode === 'search' ? 
                                        (this.currentSearchQuery ? `No search results for "${this.currentSearchQuery}"` : 'Search for profiles') :
                                        `No more ${currentModeInfo.text}!`
                                    }
                                </div>
                                <div style="font-size: 16px; margin-bottom: 12px;">
                                    ${this.currentBrowseMode === 'search' ? 
                                        (this.currentSearchQuery ? 'Try different search terms or browse other categories' : 'Enter a username, name, or keyword to search') :
                                        this.currentBrowseMode === 'pending' ? 
                                            'No pending profiles with full data to review' : 
                                            `No ${this.currentBrowseMode} profiles to browse`
                                    }
                                </div>
                                <div style="font-size: 14px; color: #64748b;">
                                    ${this.currentBrowseMode === 'search' ? 
                                        'Search across all profiles regardless of their status' :
                                        this.currentBrowseMode === 'pending' ? 
                                            'Profiles need recent posts, bio, or follower data to appear here' :
                                            `Switch to another mode to browse different profiles`
                                    }
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">
                                <div style="background: #334155; padding: 20px; border-radius: 12px; text-align: center;">
                                    <div style="font-size: 32px; font-weight: bold; color: #0ea5e9;">${this.stats.users.total}</div>
                                    <div style="font-size: 14px; color: #94a3b8;">Total</div>
                                </div>
                                <div style="background: #334155; padding: 20px; border-radius: 12px; text-align: center;">
                                    <div style="font-size: 32px; font-weight: bold; color: #10b981;">${this.stats.users.liked}</div>
                                    <div style="font-size: 14px; color: #94a3b8;">Liked</div>
                                </div>
                                <div style="background: #334155; padding: 20px; border-radius: 12px; text-align: center;">
                                    <div style="font-size: 32px; font-weight: bold; color: #ef4444;">${this.stats.users.disliked}</div>
                                    <div style="font-size: 14px; color: #94a3b8;">Disliked</div>
                                </div>
                            </div>
                            
                            <button id="refresh-data" style="padding: 15px 30px; background: #0ea5e9; border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: bold; font-size: 16px;">
                                🔄 Check for New Profiles
                            </button>
                        </div>
                    </div>
                `;
            }

            const user = this.currentUser;
            const currentList = this.getCurrentUserList();
            const progress = currentList.length > 0 ? 
                `${this.currentIndex + 1} of ${currentList.length}` : '0 of 0';
            const currentPreference = this.getCurrentUserPreference();

            return `
                <!-- Header -->
                <div style="background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); border-bottom: 1px solid #334155; padding: 8px 20px; flex-shrink: 0;">
                    <div style="display: flex; justify-content: flex-end; align-items: center;">
                        <button id="close-manager" style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; color: #ef4444; font-size: 16px; cursor: pointer; padding: 6px 12px; border-radius: 6px; font-weight: bold;">✕ Close</button>
                    </div>
                </div>

                <!-- Main Content -->
                <div style="flex: 1; display: flex; gap: 30px; padding: 20px; overflow: hidden;">
                    
                    <!-- Left Panel: User Info + Controls -->
                    <div style="width: 400px; flex-shrink: 0; overflow-y: auto;">
                        
                        <!-- Controls Section -->
                        <div style="background: rgba(52, 65, 85, 0.5); border-radius: 12px; padding: 15px; margin-bottom: 20px; border: 1px solid #475569;">
                            <!-- Search Input -->
                            <div style="margin-bottom: 12px;">
                                <div style="position: relative;">
                                    <input 
                                        type="text" 
                                        id="search-input" 
                                        placeholder="🔍 Search by username, name, or bio..." 
                                        value="${this.currentSearchQuery}"
                                        style="
                                            width: 100%;
                                            padding: 10px 12px;
                                            background: rgba(30, 41, 59, 0.8);
                                            border: 2px solid ${this.currentBrowseMode === 'search' ? '#f59e0b' : '#475569'};
                                            border-radius: 8px;
                                            color: white;
                                            font-size: 14px;
                                            font-family: inherit;
                                            outline: none;
                                            transition: all 0.2s ease;
                                            box-sizing: border-box;
                                        "
                                    />
                                    ${this.currentBrowseMode === 'search' && this.currentSearchQuery ? `
                                        <button 
                                            id="clear-search" 
                                            style="
                                                position: absolute;
                                                right: 8px;
                                                top: 50%;
                                                transform: translateY(-50%);
                                                background: #64748b;
                                                border: none;
                                                border-radius: 4px;
                                                color: white;
                                                width: 24px;
                                                height: 24px;
                                                cursor: pointer;
                                                font-size: 12px;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                            "
                                        >✕</button>
                                    ` : ''}
                                </div>
                                ${this.currentBrowseMode === 'search' ? `
                                    <div style="margin-top: 6px; font-size: 11px; color: #94a3b8; text-align: center;">
                                        ${this.searchResults.length > 0 ? 
                                            `Found ${this.searchResults.length} profile${this.searchResults.length === 1 ? '' : 's'} for "${this.currentSearchQuery}"` : 
                                            this.currentSearchQuery ? `No profiles found for "${this.currentSearchQuery}"` : ''
                                        }
                                    </div>
                                ` : ''}
                            </div>

                            <!-- Browse Mode Selector -->
                            <div style="display: flex; justify-content: center; gap: 6px; margin-bottom: 12px;">
                                ${this.browseModes.filter(mode => mode !== 'search').map(mode => `
                                    <button class="browse-mode-btn" data-mode="${mode}" style="
                                        padding: 6px 10px;
                                        background: ${this.currentBrowseMode === mode ? '#f59e0b' : '#334155'};
                                        border: none;
                                        border-radius: 5px;
                                        color: white;
                                        cursor: pointer;
                                        font-weight: bold;
                                        font-size: 11px;
                                        transition: all 0.2s ease;
                                    ">
                                        ${mode === 'pending' ? '⏳ Pending' : 
                                          mode === 'liked' ? '👍 Liked' : 
                                          mode === 'disliked' ? '👎 Disliked' : 
                                          '✉️ Messaged'}
                                        (${mode === 'pending' ? this.pendingUsers.length : 
                                           mode === 'liked' ? this.likedUsers.length : 
                                           mode === 'disliked' ? this.dislikedUsers.length : 
                                           this.messagedUsers.length})
                                    </button>
                                `).join('')}
                            </div>

                            <!-- Current Mode Display -->
                            ${this.currentBrowseMode === 'search' ? `
                                <div style="text-align: center; margin-bottom: 10px;">
                                    <div style="
                                        display: inline-block;
                                        padding: 4px 10px;
                                        background: rgba(245, 158, 11, 0.2);
                                        border: 1px solid #f59e0b;
                                        border-radius: 12px;
                                        color: #f59e0b;
                                        font-size: 11px;
                                        font-weight: bold;
                                    ">
                                        🔍 Search Mode (${this.searchResults.length} results)
                                    </div>
                                </div>
                            ` : ''}
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                                    <div style="font-size: 11px; color: #cbd5e1;">
                                        Total: <span style="color: #0ea5e9; font-weight: bold;">${this.stats.users.total}</span>
                                    </div>
                                    <div style="font-size: 11px; color: #cbd5e1;">
                                        Liked: <span style="color: #10b981; font-weight: bold;">${this.stats.users.liked}</span>
                                    </div>
                                    <div style="font-size: 11px; color: #cbd5e1;">
                                        Disliked: <span style="color: #ef4444; font-weight: bold;">${this.stats.users.disliked}</span>
                                    </div>
                                    <div style="font-size: 11px; color: #cbd5e1;">
                                        Messaged: <span style="color: #8b5cf6; font-weight: bold;">${this.stats.users.messaged || 0}</span>
                                    </div>
                                    <div style="font-size: 11px; color: #cbd5e1;">
                                        Pending: <span style="color: #f59e0b; font-weight: bold;">${this.pendingUsers.length}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 8px; text-align: center;">
                                Progress: <span style="color: #f59e0b; font-weight: bold;">${progress}</span>
                            </div>
                            
                            <!-- Progress Bar -->
                            <div style="background: #334155; height: 4px; border-radius: 2px; overflow: hidden;">
                                <div style="background: linear-gradient(90deg, #f59e0b, #10b981); height: 100%; width: ${currentList.length > 0 ? ((this.currentIndex + 1) / currentList.length) * 100 : 0}%; transition: width 0.3s ease; box-shadow: 0 0 8px rgba(245, 158, 11, 0.5);"></div>
                            </div>
                        </div>

                        <!-- User Profile Section -->
                        <div style="text-align: center; margin-bottom: 25px;">
                            ${(user.profilePicBase64 || user.profilePicUrl) ? `
                                <div style="
                                    display: inline-block;
                                    border: 3px solid #f59e0b;
                                    border-radius: 8px;
                                    margin: 0 auto 15px auto;
                                    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                                    overflow: hidden;
                                    max-width: 250px;
                                    max-height: 250px;
                                ">
                                    <img src="${user.profilePicBase64 || user.profilePicUrl}" alt="@${user.username}" style="
                                        display: block;
                                        width: auto;
                                        height: auto;
                                        max-width: 100%;
                                        max-height: 100%;
                                        object-fit: contain;
                                    " />
                                </div>
                            ` : `
                                <div style="
                                    width: 120px;
                                    height: 120px;
                                    border-radius: 50%;
                                    background: linear-gradient(45deg, #f59e0b, #10b981);
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: white;
                                    font-weight: bold;
                                    font-size: 40px;
                                    margin: 0 auto 15px auto;
                                    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                                ">
                                    ${user.username.charAt(0).toUpperCase()}
                                </div>
                            `}
                            
                            <h3 style="margin: 0 0 6px 0; color: white; font-size: 28px; font-weight: bold;">@${user.username}</h3>
                            
                            ${user.fullName ? `
                                <div style="color: #94a3b8; font-size: 18px; margin-bottom: 12px; font-weight: 500;">${user.fullName}</div>
                            ` : ''}

                            <!-- Current Preference Status -->
                            ${currentPreference !== 'none' ? `
                                <div style="
                                    display: inline-block;
                                    padding: 6px 12px;
                                    border-radius: 16px;
                                    margin-bottom: 12px;
                                    font-weight: bold;
                                    font-size: 12px;
                                    ${currentPreference === 'like' ? 
                                        'background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #10b981;' :
                                        currentPreference === 'dislike' ?
                                        'background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #ef4444;' :
                                        'background: rgba(139, 92, 246, 0.2); border: 1px solid #8b5cf6; color: #8b5cf6;'
                                    }
                                ">
                                    ${currentPreference === 'like' ? '👍 Previously Liked' : 
                                      currentPreference === 'dislike' ? '👎 Previously Disliked' : 
                                      '✉️ Previously Messaged'}
                                </div>
                            ` : ''}
                            
                            <!-- Detailed Stats -->
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 15px;">
                                ${user.followerCount ? `
                                    <div style="background: rgba(52, 65, 85, 0.8); padding: 12px; border-radius: 10px; text-align: center; border: 1px solid #475569;">
                                        <div style="font-size: 18px; font-weight: bold; color: #0ea5e9;">${this.formatNumber(user.followerCount)}</div>
                                        <div style="font-size: 11px; color: #94a3b8;">Followers</div>
                                    </div>
                                ` : ''}
                                ${user.followingCount ? `
                                    <div style="background: rgba(52, 65, 85, 0.8); padding: 12px; border-radius: 10px; text-align: center; border: 1px solid #475569;">
                                        <div style="font-size: 18px; font-weight: bold; color: #10b981;">${this.formatNumber(user.followingCount)}</div>
                                        <div style="font-size: 11px; color: #94a3b8;">Following</div>
                                    </div>
                                ` : ''}
                                ${user.postCount || (user.recentPosts && user.recentPosts.length) ? `
                                    <div style="background: rgba(52, 65, 85, 0.8); padding: 12px; border-radius: 10px; text-align: center; border: 1px solid #475569;">
                                        <div style="font-size: 18px; font-weight: bold; color: #f59e0b;">${user.postCount || user.recentPosts.length}</div>
                                        <div style="font-size: 11px; color: #94a3b8;">Posts</div>
                                    </div>
                                ` : ''}
                            </div>

                            <!-- Profile Badges -->
                            <div style="display: flex; justify-content: center; gap: 6px; margin-top: 12px; flex-wrap: wrap;">
                                ${user.isVerified ? `
                                    <span style="background: #1d4ed8; color: white; padding: 3px 6px; border-radius: 10px; font-size: 10px; font-weight: bold;">✓ Verified</span>
                                ` : ''}
                                ${user.isPrivate ? `
                                    <span style="background: #dc2626; color: white; padding: 3px 6px; border-radius: 10px; font-size: 10px; font-weight: bold;">🔒 Private</span>
                                ` : ''}
                                ${user.isBusiness ? `
                                    <span style="background: #059669; color: white; padding: 3px 6px; border-radius: 10px; font-size: 10px; font-weight: bold;">🏢 Business</span>
                                ` : ''}
                                ${(() => {
                                    const status = getUserDataStatus(user);
                                    return `<span style="background: ${status.color}; color: white; padding: 3px 6px; border-radius: 10px; font-size: 10px; font-weight: bold;">${status.label}</span>`;
                                })()}
                            </div>
                        </div>

                        ${user.biography ? `
                            <div style="margin-bottom: 20px;">
                                <div style="color: #cbd5e1; font-size: 13px; margin-bottom: 8px; font-weight: 600;">Biography:</div>
                                <div style="color: #e2e8f0; line-height: 1.5; font-size: 14px; background: rgba(52, 65, 85, 0.5); padding: 12px; border-radius: 10px; border: 1px solid #475569;">
                                    ${user.biography.replace(/\n/g, '<br>')}
                                </div>
                            </div>
                        ` : ''}

                        ${user.category ? `
                            <div style="margin-bottom: 20px;">
                                <div style="color: #cbd5e1; font-size: 13px; margin-bottom: 8px; font-weight: 600;">Category:</div>
                                <div style="color: #e2e8f0; font-size: 14px; background: rgba(52, 65, 85, 0.5); padding: 10px 14px; border-radius: 10px; display: inline-block; border: 1px solid #475569;">
                                    ${user.category}
                                </div>
                            </div>
                        ` : ''}

                        ${user.website ? `
                            <div style="margin-bottom: 20px;">
                                <div style="color: #cbd5e1; font-size: 13px; margin-bottom: 8px; font-weight: 600;">Website:</div>
                                <a href="${user.website}" target="_blank" style="color: #0ea5e9; font-size: 14px; text-decoration: none; background: rgba(52, 65, 85, 0.5); padding: 10px 14px; border-radius: 10px; display: inline-block; border: 1px solid #475569;">
                                    🔗 ${user.website}
                                </a>
                            </div>
                        ` : ''}

                        <!-- Action Buttons -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 15px;">
                            <button id="like-btn" style="
                                padding: 14px 8px;
                                background: ${currentPreference === 'like' ? 
                                    'linear-gradient(45deg, #10b981, #059669)' : 
                                    'linear-gradient(45deg, #374151, #4b5563)'
                                };
                                border: ${currentPreference === 'like' ? '2px solid #10b981' : '1px solid #475569'};
                                border-radius: 12px;
                                color: white;
                                font-size: 14px;
                                font-weight: bold;
                                cursor: pointer;
                                transition: all 0.2s ease;
                                box-shadow: ${currentPreference === 'like' ? 
                                    '0 4px 15px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(16, 185, 129, 0.3)' : 
                                    '0 4px 15px rgba(55, 65, 81, 0.4)'
                                };
                                position: relative;
                            ">
                                👍 Like (L/1)
                                ${currentPreference === 'like' ? `
                                    <div style="
                                        position: absolute;
                                        top: -6px;
                                        right: -6px;
                                        background: #10b981;
                                        color: white;
                                        border-radius: 50%;
                                        width: 18px;
                                        height: 18px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        font-size: 9px;
                                        font-weight: bold;
                                        border: 2px solid white;
                                    ">✓</div>
                                ` : ''}
                            </button>
                            <button id="dislike-btn" style="
                                padding: 14px 8px;
                                background: ${currentPreference === 'dislike' ? 
                                    'linear-gradient(45deg, #ef4444, #dc2626)' : 
                                    'linear-gradient(45deg, #374151, #4b5563)'
                                };
                                border: ${currentPreference === 'dislike' ? '2px solid #ef4444' : '1px solid #475569'};
                                border-radius: 12px;
                                color: white;
                                font-size: 14px;
                                font-weight: bold;
                                cursor: pointer;
                                transition: all 0.2s ease;
                                box-shadow: ${currentPreference === 'dislike' ? 
                                    '0 4px 15px rgba(239, 68, 68, 0.4), 0 0 0 1px rgba(239, 68, 68, 0.3)' : 
                                    '0 4px 15px rgba(55, 65, 81, 0.4)'
                                };
                                position: relative;
                            ">
                                👎 Dislike (D/2)
                                ${currentPreference === 'dislike' ? `
                                    <div style="
                                        position: absolute;
                                        top: -6px;
                                        right: -6px;
                                        background: #ef4444;
                                        color: white;
                                        border-radius: 50%;
                                        width: 18px;
                                        height: 18px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        font-size: 9px;
                                        font-weight: bold;
                                        border: 2px solid white;
                                    ">✓</div>
                                ` : ''}
                            </button>
                            <button id="message-btn" style="
                                padding: 14px 8px;
                                background: ${currentPreference === 'messaged' ? 
                                    'linear-gradient(45deg, #8b5cf6, #7c3aed)' : 
                                    'linear-gradient(45deg, #374151, #4b5563)'
                                };
                                border: ${currentPreference === 'messaged' ? '2px solid #8b5cf6' : '1px solid #475569'};
                                border-radius: 12px;
                                color: white;
                                font-size: 14px;
                                font-weight: bold;
                                cursor: pointer;
                                transition: all 0.2s ease;
                                box-shadow: ${currentPreference === 'messaged' ? 
                                    '0 4px 15px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.3)' : 
                                    '0 4px 15px rgba(55, 65, 81, 0.4)'
                                };
                                position: relative;
                            ">
                                ✉️ Message (M/4)
                                ${currentPreference === 'messaged' ? `
                                    <div style="
                                        position: absolute;
                                        top: -6px;
                                        right: -6px;
                                        background: #8b5cf6;
                                        color: white;
                                        border-radius: 50%;
                                        width: 18px;
                                        height: 18px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        font-size: 9px;
                                        font-weight: bold;
                                        border: 2px solid white;
                                    ">✓</div>
                                ` : ''}
                            </button>
                        </div>

                        <!-- Additional Actions (only for non-pending modes) -->
                        ${this.currentBrowseMode !== 'pending' && currentPreference !== 'none' ? `
                            <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 15px;">
                                <button id="remove-preference-btn" style="
                                    padding: 12px;
                                    background: linear-gradient(45deg, #64748b, #475569);
                                    border: none;
                                    border-radius: 8px;
                                    color: white;
                                    font-size: 13px;
                                    font-weight: bold;
                                    cursor: pointer;
                                    transition: all 0.2s ease;
                                    box-shadow: 0 3px 12px rgba(100, 116, 139, 0.4);
                                ">
                                    🔄 Reset to Pending (R)
                                </button>
                            </div>
                        ` : ''}

                        <!-- Secondary Actions -->
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
                            <button id="skip-btn" style="padding: 12px; background: #64748b; border: none; border-radius: 8px; color: white; font-size: 12px; cursor: pointer; font-weight: bold; transition: all 0.2s ease;">
                                ⏭️ Skip (S/3)
                            </button>
                            <button id="profile-btn" style="padding: 12px; background: #0ea5e9; border: none; border-radius: 8px; color: white; font-size: 12px; cursor: pointer; font-weight: bold; transition: all 0.2s ease;">
                                🔗 Profile (P)
                            </button>
                            <button id="prev-btn" style="padding: 12px; background: #6b7280; border: none; border-radius: 8px; color: white; font-size: 12px; cursor: pointer; font-weight: bold; transition: all 0.2s ease;" ${this.currentIndex === 0 ? 'disabled' : ''}>
                                ⬅️ Previous
                            </button>
                        </div>

                        <div style="display: flex; gap: 10px;">
                            <button id="refresh-data" style="flex: 1; padding: 10px; background: #374151; border: none; border-radius: 6px; color: white; font-size: 11px; cursor: pointer; font-weight: bold;">
                                🔄 Refresh
                            </button>
                            <button id="stats-btn" style="flex: 1; padding: 10px; background: #374151; border: none; border-radius: 6px; color: white; font-size: 11px; cursor: pointer; font-weight: bold;">
                                📊 Stats
                            </button>
                        </div>

                        ${user.lastUpdated ? `
                            <div style="margin-top: 15px;">
                                <div style="color: #64748b; font-size: 10px; text-align: center;">
                                    Last updated: ${new Date(user.lastUpdated).toLocaleDateString()} ${new Date(user.lastUpdated).toLocaleTimeString()}
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Right Panel: Recent Posts Grid -->
                    <div style="flex: 1; overflow-y: auto;">
                        ${user.recentPosts && user.recentPosts.length > 0 ? `
                            <div style="margin-bottom: 20px;">
                                <h3 style="color: #cbd5e1; font-size: 20px; margin-bottom: 15px; font-weight: 600;">📷 Recent Posts (${user.recentPosts.length})</h3>
                                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                                    ${user.recentPosts.slice(0, 12).map(post => `
                                        <div style="background: rgba(52, 65, 85, 0.8); border-radius: 10px; overflow: hidden; cursor: pointer; transition: all 0.3s ease; border: 2px solid transparent;" 
                                             onclick="window.open('${post.url || `https://instagram.com/p/${post.shortcode}`}', '_blank')"
                                             onmouseenter="this.style.borderColor='#f59e0b'; this.style.transform='scale(1.02)'"
                                             onmouseleave="this.style.borderColor='transparent'; this.style.transform='scale(1)'">
                                            ${post.thumbnailBase64 || post.thumbnailUrl ? `
                                                <div style="
                                                    width: 100%;
                                                    height: 220px;
                                                    background-image: url('${post.thumbnailBase64 || post.thumbnailUrl}');
                                                    background-size: cover;
                                                    background-position: center;
                                                    position: relative;
                                                ">
                                                    ${post.isVideo ? `
                                                        <div style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.8); color: white; padding: 3px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;">
                                                            🎥 VIDEO
                                                        </div>
                                                    ` : ''}
                                                    ${post.isCarousel ? `
                                                        <div style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.8); color: white; padding: 3px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;">
                                                            📷 ${post.mediaCount || 'MULTI'}
                                                        </div>
                                                    ` : ''}
                                                    ${post.thumbnailBase64 ? `
                                                        <div style="position: absolute; bottom: 6px; left: 6px; background: rgba(16, 185, 129, 0.9); color: white; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: bold;">
                                                            💾 SAVED
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            ` : `
                                                <div style="
                                                    width: 100%;
                                                    height: 220px;
                                                    background: linear-gradient(45deg, #374151, #4b5563);
                                                    display: flex;
                                                    align-items: center;
                                                    justify-content: center;
                                                    color: #9ca3af;
                                                    font-size: 30px;
                                                ">
                                                    📷
                                                </div>
                                            `}
                                            <div style="padding: 10px;">
                                                <div style="color: #94a3b8; margin-bottom: 5px; display: flex; gap: 10px; font-size: 10px;">
                                                    ${post.likeCount ? `<span>❤️ ${this.formatNumber(post.likeCount)}</span>` : ''} 
                                                    ${post.commentCount ? `<span>💬 ${this.formatNumber(post.commentCount)}</span>` : ''}
                                                </div>
                                                ${post.caption ? `
                                                    <div style="color: #e2e8f0; line-height: 1.3; font-size: 11px;">
                                                        ${post.caption.length > 50 ? post.caption.substring(0, 50) + '...' : post.caption}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                                ${user.recentPosts.length > 12 ? `
                                    <div style="text-align: center; margin-top: 15px; font-size: 13px; color: #64748b;">
                                        +${user.recentPosts.length - 12} more posts available on profile
                                    </div>
                                ` : ''}
                            </div>
                        ` : `
                            <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
                                <div style="text-align: center; color: #64748b;">
                                    <div style="font-size: 64px; margin-bottom: 20px;">📷</div>
                                    <div style="font-size: 20px;">No recent posts available</div>
                                </div>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }

        // Attach event listeners
        attachEventListeners() {
            const manager = document.getElementById('ig-profile-manager');
            if (!manager) {
                console.error('❌ Manager element not found');
                return;
            }

            // Close button
            const closeBtn = manager.querySelector('#close-manager');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.hideManager();
                });
            }

            // Browse mode buttons
            const browseModeButtons = manager.querySelectorAll('.browse-mode-btn');
            browseModeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const mode = btn.getAttribute('data-mode');
                    this.switchBrowseMode(mode);
                });
            });

            // Refresh button - works in both states
            const refreshBtn = manager.querySelector('#refresh-data');
            if (refreshBtn) {
                console.log('🔧 Attaching refresh button event listener');
                refreshBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    console.log('🔄 Refresh button clicked - starting data refresh...');
                    
                    // Show loading state
                    const originalText = refreshBtn.textContent;
                    refreshBtn.textContent = '🔄 Loading...';
                    refreshBtn.disabled = true;
                    
                    try {
                        console.log('📊 Loading data from database...');
                        await this.loadData();
                        console.log('🎨 Updating UI...');
                        this.updateUI();
                        console.log('✅ Profile data refreshed successfully');
                        
                        // Show success message briefly
                        refreshBtn.textContent = '✅ Refreshed!';
                        setTimeout(() => {
                            refreshBtn.textContent = originalText;
                        }, 1000);
                        
                    } catch (error) {
                        console.error('❌ Failed to refresh data:', error);
                        refreshBtn.textContent = '❌ Failed';
                        setTimeout(() => {
                            refreshBtn.textContent = originalText;
                        }, 2000);
                    } finally {
                        // Restore button state
                        refreshBtn.disabled = false;
                    }
                });
            } else {
                console.warn('⚠️ Refresh button not found in DOM');
            }

            // Search input event listener
            const searchInput = manager.querySelector('#search-input');
            if (searchInput) {
                console.log('🔧 Attaching search input event listener');
                
                // Handle input events (real-time search)
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value;
                    this.handleSearch(query);
                });
                
                // Handle Enter key for search
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const query = e.target.value;
                        this.handleSearch(query);
                    }
                });
                
                // Focus styling
                searchInput.addEventListener('focus', (e) => {
                    e.target.style.borderColor = '#f59e0b';
                    e.target.style.boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.2)';
                });
                
                searchInput.addEventListener('blur', (e) => {
                    e.target.style.borderColor = this.currentBrowseMode === 'search' ? '#f59e0b' : '#475569';
                    e.target.style.boxShadow = 'none';
                });
            } else {
                console.warn('⚠️ Search input not found in DOM');
            }

            // Clear search button event listener
            const clearSearchBtn = manager.querySelector('#clear-search');
            if (clearSearchBtn) {
                console.log('🔧 Attaching clear search button event listener');
                clearSearchBtn.addEventListener('click', () => {
                    const searchInput = manager.querySelector('#search-input');
                    if (searchInput) {
                        searchInput.value = '';
                        this.handleSearch('');
                        searchInput.focus();
                    }
                });
            }

            // Only attach these if we have a current user (normal state)
            if (this.currentUser) {
                // Like and Dislike buttons (available in all modes)
                const likeBtn = manager.querySelector('#like-btn');
                if (likeBtn) {
                    likeBtn.addEventListener('click', () => {
                        this.handleLike();
                    });
                }

                const dislikeBtn = manager.querySelector('#dislike-btn');
                if (dislikeBtn) {
                    dislikeBtn.addEventListener('click', () => {
                        this.handleDislike();
                    });
                }

                // Remove preference button (only in liked/disliked modes)
                if (this.currentBrowseMode !== 'pending') {
                    const removePreferenceBtn = manager.querySelector('#remove-preference-btn');
                    if (removePreferenceBtn) {
                        removePreferenceBtn.addEventListener('click', () => {
                            this.handleRemovePreference();
                        });
                    }
                }

                // Skip button
                const skipBtn = manager.querySelector('#skip-btn');
                if (skipBtn) {
                    skipBtn.addEventListener('click', () => {
                        this.handleSkip();
                    });
                }

                // Profile button
                const profileBtn = manager.querySelector('#profile-btn');
                if (profileBtn) {
                    profileBtn.addEventListener('click', () => {
                        this.handleProfile();
                    });
                }

                // Previous button
                const prevBtn = manager.querySelector('#prev-btn');
                if (prevBtn) {
                    prevBtn.addEventListener('click', () => {
                        this.previousProfile();
                    });
                }

                // Stats button
                const statsBtn = manager.querySelector('#stats-btn');
                if (statsBtn) {
                    statsBtn.addEventListener('click', () => {
                        this.showStatsModal();
                    });
                }

                // Message button
                const messageBtn = manager.querySelector('#message-btn');
                if (messageBtn) {
                    messageBtn.addEventListener('click', () => {
                        this.handleMessaged();
                    });
                }
            }
        }

        // Handle like button click
        async handleLike() {
            if (!this.currentUser) return;
            
            try {
                await window.igDB.savePreference(this.currentUser.username, 'like');
                console.log(`👍 Liked @${this.currentUser.username}`);
                
                // Update local preference map
                this.userPreferences[this.currentUser.username] = 'like';
                this.preferenceMap.set(this.currentUser.username, 'like');
                
                // Refresh stats from database to get latest counts
                this.stats = await window.igDB.getStats();
                
                // If in pending mode, advance to next profile
                if (this.currentBrowseMode === 'pending') {
                    await this.nextProfile();
                } else {
                    // If in liked/disliked mode, reload data and stay in same mode
                    await this.loadData();
                    this.updateUI();
                }
            } catch (error) {
                console.error('Failed to save like preference:', error);
            }
        }

        // Handle dislike button click
        async handleDislike() {
            if (!this.currentUser) return;
            
            try {
                await window.igDB.savePreference(this.currentUser.username, 'dislike');
                console.log(`👎 Disliked @${this.currentUser.username}`);
                
                // Update local preference map
                this.userPreferences[this.currentUser.username] = 'dislike';
                this.preferenceMap.set(this.currentUser.username, 'dislike');
                
                // Refresh stats from database to get latest counts
                this.stats = await window.igDB.getStats();
                
                // If in pending mode, advance to next profile
                if (this.currentBrowseMode === 'pending') {
                    await this.nextProfile();
                } else {
                    // If in liked/disliked mode, reload data and stay in same mode
                    await this.loadData();
                    this.updateUI();
                }
            } catch (error) {
                console.error('Failed to save dislike preference:', error);
            }
        }

        // Handle message button click
        async handleMessaged() {
            if (!this.currentUser) return;
            
            try {
                await window.igDB.savePreference(this.currentUser.username, 'messaged');
                console.log(`✉️ Marked @${this.currentUser.username} as messaged`);
                
                // Update local preference map
                this.userPreferences[this.currentUser.username] = 'messaged';
                this.preferenceMap.set(this.currentUser.username, 'messaged');
                
                // Refresh stats from database to get latest counts
                this.stats = await window.igDB.getStats();
                
                // If in pending mode, advance to next profile
                if (this.currentBrowseMode === 'pending') {
                    await this.nextProfile();
                } else {
                    // If in liked/disliked/messaged mode, reload data and stay in same mode
                    await this.loadData();
                    this.updateUI();
                }
            } catch (error) {
                console.error('Failed to save messaged preference:', error);
            }
        }

        // Handle change preference (flip like/dislike)
        async handleChangePreference() {
            if (!this.currentUser) return;
            
            try {
                const currentPref = this.getCurrentUserPreference();
                const newPref = currentPref === 'like' ? 'dislike' : 'like';
                
                await window.igDB.savePreference(this.currentUser.username, newPref);
                console.log(`🔄 Changed @${this.currentUser.username} from ${currentPref} to ${newPref}`);
                
                // Update local preference map
                this.userPreferences[this.currentUser.username] = newPref;
                this.preferenceMap.set(this.currentUser.username, newPref);
                
                // Refresh stats from database to get latest counts
                this.stats = await window.igDB.getStats();
                
                // Reload data to update lists
                await this.loadData();
                
                // Switch to the new preference mode
                this.switchBrowseMode(newPref === 'like' ? 'liked' : 'disliked');
                
            } catch (error) {
                console.error('Failed to change preference:', error);
            }
        }

        // Handle remove preference (reset to pending)
        async handleRemovePreference() {
            if (!this.currentUser) return;
            
            try {
                await window.igDB.savePreference(this.currentUser.username, 'none');
                console.log(`🔄 Reset @${this.currentUser.username} to pending`);
                
                // Update local preference map
                this.userPreferences[this.currentUser.username] = 'none';
                this.preferenceMap.set(this.currentUser.username, 'none');
                
                // Refresh stats from database to get latest counts
                this.stats = await window.igDB.getStats();
                
                // Reload data to update lists
                await this.loadData();
                
                // Switch to pending mode to see the profile there
                this.switchBrowseMode('pending');
                
            } catch (error) {
                console.error('Failed to remove preference:', error);
            }
        }

        // Handle skip button click
        handleSkip() {
            this.nextProfile();
        }

        // Handle profile button click
        handleProfile() {
            if (!this.currentUser) return;
            window.open(`https://instagram.com/${this.currentUser.username}`, '_blank');
        }

        // Navigate to next profile
        async nextProfile() {
            const currentList = this.getCurrentUserList();
            
            if (currentList.length === 0) {
                this.currentUser = null;
                this.updateUI();
                return;
            }

            this.currentIndex++;
            
            // If we've reached the end, loop back to the beginning for browsing modes
            if (this.currentIndex >= currentList.length) {
                if (this.currentBrowseMode === 'pending') {
                    // For pending mode, reload data to check for new profiles
                    await this.loadData();
                    this.currentIndex = 0;
                } else {
                    // For liked/disliked modes, loop back to the beginning
                    this.currentIndex = 0;
                }
            }

            // Set current user
            this.setCurrentUserFromMode();
            this.updateUI();
        }

        // Navigate to previous profile
        previousProfile() {
            const currentList = this.getCurrentUserList();
            if (currentList.length === 0) return;

            this.currentIndex = Math.max(0, this.currentIndex - 1);
            this.setCurrentUserFromMode();
            this.updateUI();
        }

        // Update the UI with current profile
        updateUI() {
            const manager = document.getElementById('ig-profile-manager');
            if (manager) {
                manager.innerHTML = this.getManagerHTML();
                this.attachEventListeners();
            }
        }

        // Show manager
        async showManager() {
            try {
                console.log('🔄 Refreshing data before showing...');
                await this.loadData();
                
                const manager = document.getElementById('ig-profile-manager');
                if (manager) {
                    console.log('🎨 Opening manager interface...');
                    manager.style.display = 'flex';
                    this.isVisible = true;
                    
                    // Ensure the manager is visible
                    setTimeout(() => {
                        if (manager.style.display === 'flex') {
                            console.log('✅ Manager interface successfully opened!');
                        } else {
                            console.warn('⚠️ Manager may not be visible properly');
                        }
                    }, 500);
                } else {
                    console.error('❌ Manager UI element not found');
                    throw new Error('Manager UI not created properly');
                }
            } catch (error) {
                console.error('❌ Failed to show manager:', error);
                throw error;
            }
        }

        // Hide manager
        hideManager() {
            const manager = document.getElementById('ig-profile-manager');
            if (manager) {
                manager.style.display = 'none';
                this.isVisible = false;
            }
        }

        // Format numbers
        formatNumber(num) {
            if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            } else if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
            }
            return num.toString();
        }

        // Setup hotkeys
        setupHotkeys() {
            document.addEventListener('keydown', (e) => {
                // Only handle hotkeys when manager is visible and not typing in inputs
                if (!this.isVisible || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                    return;
                }

                switch (e.key.toLowerCase()) {
                    case 'l':
                    case '1':
                        e.preventDefault();
                        if (this.currentUser) {
                            this.handleLike();
                        }
                        break;
                    case 'd':
                    case '2':
                        e.preventDefault();
                        if (this.currentUser) {
                            this.handleDislike();
                        }
                        break;
                    case 'm':
                    case '4':
                        e.preventDefault();
                        if (this.currentUser) {
                            this.handleMessaged();
                        }
                        break;
                    case 'c':
                        e.preventDefault();
                        if (this.currentBrowseMode !== 'pending' && this.currentUser) {
                            this.handleChangePreference();
                        }
                        break;
                    case 'r':
                        e.preventDefault();
                        if (this.currentBrowseMode !== 'pending' && this.currentUser) {
                            this.handleRemovePreference();
                        }
                        break;
                    case 's':
                    case '3':
                        e.preventDefault();
                        this.handleSkip();
                        break;
                    case 'p':
                        e.preventDefault();
                        this.handleProfile();
                        break;
                    case 'arrowleft':
                        e.preventDefault();
                        this.previousProfile();
                        break;
                    case 'arrowright':
                        e.preventDefault();
                        this.nextProfile();
                        break;
                    case 'escape':
                        e.preventDefault();
                        this.hideManager();
                        break;
                    case 'f':
                    case '/':
                        e.preventDefault();
                        // Focus the search input
                        const searchInput = document.querySelector('#search-input');
                        if (searchInput) {
                            searchInput.focus();
                            searchInput.select(); // Select all text if any
                        }
                        break;
                }
            });

            this.hotkeysEnabled = true;
        }

        // Show stats modal
        async showStatsModal() {
            const stats = await window.igDB.getStats();
            
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.8);
                z-index: 9999999;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            `;

            modal.innerHTML = `
                <div style="background: #1e293b; color: white; padding: 25px; border-radius: 10px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="margin: 0; color: #f59e0b; font-size: 18px;">📊 Profile Review Statistics</h3>
                        <button id="close-stats" style="background: none; border: none; color: #64748b; font-size: 18px; cursor: pointer;">✕</button>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
                        <div style="background: #334155; padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #0ea5e9;">${stats.users.total}</div>
                            <div style="font-size: 12px; color: #94a3b8;">Total Profiles</div>
                        </div>
                        <div style="background: #334155; padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #64748b;">${this.pendingUsers.length}</div>
                            <div style="font-size: 12px; color: #94a3b8;">Pending Review</div>
                        </div>
                        <div style="background: #334155; padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #10b981;">${stats.users.liked}</div>
                            <div style="font-size: 12px; color: #94a3b8;">Liked</div>
                        </div>
                        <div style="background: #334155; padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${stats.users.disliked}</div>
                            <div style="font-size: 12px; color: #94a3b8;">Disliked</div>
                        </div>
                        <div style="background: #334155; padding: 15px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${stats.users.messaged || 0}</div>
                            <div style="font-size: 12px; color: #94a3b8;">Messaged</div>
                        </div>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <h4 style="color: #cbd5e1; margin-bottom: 10px;">Review Progress</h4>
                        <div style="background: #334155; padding: 12px; border-radius: 6px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span style="font-size: 12px; color: #94a3b8;">Completion Rate:</span>
                                <span style="font-size: 12px; color: #f59e0b; font-weight: bold;">
                                    ${stats.users.total > 0 ? Math.round(((stats.users.liked + stats.users.disliked) / stats.users.total) * 100) : 0}%
                                </span>
                            </div>
                            <div style="background: #1e293b; height: 6px; border-radius: 3px; overflow: hidden;">
                                <div style="background: #f59e0b; height: 100%; width: ${stats.users.total > 0 ? ((stats.users.liked + stats.users.disliked) / stats.users.total) * 100 : 0}%; transition: width 0.3s ease;"></div>
                            </div>
                        </div>
                    </div>

                    ${this.currentUser ? `
                        <div style="margin-bottom: 15px;">
                            <h4 style="color: #cbd5e1; margin-bottom: 10px;">Current Session</h4>
                            <div style="background: #334155; padding: 12px; border-radius: 6px; font-size: 12px;">
                                <div style="margin-bottom: 5px;">Browse Mode: <span style="color: #f59e0b; font-weight: bold;">${this.currentBrowseMode.charAt(0).toUpperCase() + this.currentBrowseMode.slice(1)}</span></div>
                                <div style="margin-bottom: 5px;">Current Profile: <span style="color: #0ea5e9; font-weight: bold;">@${this.currentUser.username}</span></div>
                                <div style="margin-bottom: 5px;">Position: <span style="color: #f59e0b; font-weight: bold;">${this.currentIndex + 1} of ${this.getCurrentUserList().length}</span></div>
                                <div>Remaining: <span style="color: #64748b; font-weight: bold;">${this.getCurrentUserList().length - this.currentIndex - 1}</span></div>
                                ${this.getCurrentUserPreference() !== 'none' ? `
                                    <div style="margin-top: 5px;">Status: <span style="color: ${this.getCurrentUserPreference() === 'like' ? '#10b981' : '#ef4444'}; font-weight: bold;">${this.getCurrentUserPreference() === 'like' ? '👍 Liked' : '👎 Disliked'}</span></div>
                                ` : ''}
                            </div>
                        </div>
                    ` : `
                        <div style="margin-bottom: 15px;">
                            <h4 style="color: #cbd5e1; margin-bottom: 10px;">Current Session</h4>
                            <div style="background: #334155; padding: 12px; border-radius: 6px; font-size: 12px;">
                                <div style="margin-bottom: 5px;">Browse Mode: <span style="color: #f59e0b; font-weight: bold;">${this.currentBrowseMode.charAt(0).toUpperCase() + this.currentBrowseMode.slice(1)}</span></div>
                                <div>Status: <span style="color: #64748b; font-weight: bold;">No profiles to browse in this mode</span></div>
                            </div>
                        </div>
                    `}

                    <div style="text-align: center; margin-top: 20px;">
                        <button id="close-stats-2" style="padding: 10px 20px; background: #64748b; border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px;">
                            Close
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Close modal events
            modal.querySelector('#close-stats').addEventListener('click', () => modal.remove());
            modal.querySelector('#close-stats-2').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        }

        // Search users by username, full name, or biography
        searchUsers(query) {
            if (!query || query.trim().length === 0) {
                this.searchResults = [];
                this.currentSearchQuery = '';
                return [];
            }
            
            const searchTerm = query.trim().toLowerCase();
            this.currentSearchQuery = searchTerm;
            
            this.searchResults = this.users.filter(user => {
                // Search by username (primary)
                if (user.username && user.username.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                // Search by full name (secondary)
                if (user.fullName && user.fullName.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                // Search by biography (tertiary)
                if (user.biography && user.biography.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                return false;
            });
            
            console.log(`🔍 Search for "${query}" found ${this.searchResults.length} results`);
            return this.searchResults;
        }

        // Handle search input
        handleSearch(query) {
            this.searchUsers(query);
            
            if (this.searchResults.length > 0) {
                // Switch to search mode
                this.currentBrowseMode = 'search';
                this.currentIndex = 0;
                this.setCurrentUserFromMode();
            } else if (query.trim().length === 0) {
                // If search is cleared, go back to pending mode
                this.switchBrowseMode('pending');
                return;
            }
            
            this.updateUI();
        }
    }

    // ========================================
    // USER STATUS HELPER FUNCTIONS
    // ========================================

    // Function to get user data status with new status markers
    function getUserDataStatus(user) {
        // Handle special status cases first
        if (user.status === 'inaccessible') {
            return {
                level: 'inaccessible',
                label: 'Inaccessible',
                color: '#ef4444', // red
                details: 'Profile is private or restricted'
            };
        }
        
        if (user.status === 'no_data') {
            return {
                level: 'no_data',
                label: 'No Data Found',
                color: '#f97316', // orange
                details: 'No extractable data available'
            };
        }
        
        // Check for processed profiles with no data (followerCount: -1)
        if (user.followerCount === -1) {
            return {
                level: 'no_data',
                label: 'No Data Found',
                color: '#f97316', // orange
                details: 'Profile processed but no data extracted'
            };
        }
        
        // Check for extended data
        if (user.hasExtendedData || 
            (user.followerCount !== undefined && user.followerCount >= 0) ||
            user.biography || 
            user.fullName || 
            (user.recentPosts && user.recentPosts.length > 0)) {
            return {
                level: 'extended',
                label: 'Extended Data',
                color: '#22c55e', // green
                details: `${user.followerCount || 0} followers`
            };
        }
        
        // Basic data (username only)
        return {
            level: 'basic',
            label: 'Basic Data',
            color: '#64748b', // gray
            details: 'Username only'
        };
    }

    // ========================================
    // MAIN INITIALIZATION
    // ========================================

    // Main function to load and show the manager
    async function loadUserManager() {
        try {
            console.log('🚀 Starting Instagram User Data Manager...');
            
            // Initialize IndexedDB first
            console.log('⚡ Step 1: Initializing database...');
            await initializeDB();
            
            if (managerInstance) {
                console.log('🔧 Manager already exists, showing existing instance...');
                await managerInstance.showManager();
                console.log('✅ Manager interface opened!');
                return managerInstance;
            }

            console.log('⚡ Step 2: Creating new manager instance...');
            managerInstance = new InstagramUserManager();
            
            console.log('⚡ Step 3: Initializing manager...');
            await managerInstance.init();
            
            console.log('🎉 Instagram User Data Manager ready and interface opened!');
            return managerInstance;
        } catch (error) {
            console.error('❌ Failed to load manager:', error);
            console.error('Error details:', error.message);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }

    // Non-async wrapper for console convenience
    function startManager() {
        console.log('🎯 Initializing Instagram User Data Manager...');
        console.log('⏳ Please wait while we set everything up...');
        
        loadUserManager()
            .then(() => {
                console.log('🎉 SUCCESS: Manager successfully loaded and interface is now open!');
                console.log('📋 Use userManager.hide() to hide or userManager.show() to show again');
            })
            .catch(error => {
                console.error('💥 FAILED to start manager:', error);
                console.error('🔍 Troubleshooting steps:');
                console.error('1. Make sure you\'re on Instagram.com');
                console.error('2. Check if IndexedDB is supported in your browser');
                console.error('3. Try refreshing the page and running the script again');
                console.error('4. Check browser console for additional errors');
            });
            
        // Return a message so the user knows it's processing
        return 'Initializing... check console for progress updates';
    }

    // Expose functions to window for console access
    window.loadUserManager = loadUserManager;
    window.startManager = startManager;
    window.userManager = {
        show: () => managerInstance?.showManager(),
        hide: () => managerInstance?.hideManager(),
        refresh: () => managerInstance?.refreshData(),
        clearSelections: () => {
            if (managerInstance) {
                managerInstance.selectedUsers.clear();
                managerInstance.updateHeader();
            }
        },
        selectAll: () => {
            if (managerInstance) {
                managerInstance.filteredUsers.forEach(user => {
                    managerInstance.selectedUsers.add(user.username);
                });
                managerInstance.updateHeader();
            }
        }
    };
    
    // Debug function to check post data
    window.checkPostData = async function() {
        try {
            if (!window.igDB) {
                console.log('❌ Database not initialized. Run startManager() first.');
                return;
            }
            
            const users = await window.igDB.getAllUsers();
            const userWithPosts = users.find(u => u.recentPosts && u.recentPosts.length > 0);
            
            if (userWithPosts) {
                console.log('📊 Sample user with posts:', userWithPosts.username);
                console.log('📷 Number of recent posts:', userWithPosts.recentPosts.length);
                console.log('🔍 First post data structure:', userWithPosts.recentPosts[0]);
                
                const post = userWithPosts.recentPosts[0];
                console.log('🖼️ Image URL fields check:');
                console.log('  - thumbnailUrl:', post.thumbnailUrl ? '✅ Available' : '❌ Missing');
                console.log('  - displayUrl:', post.displayUrl ? '✅ Available' : '❌ Missing');
                console.log('  - url:', post.url ? '✅ Available' : '❌ Missing');
                
                if (post.thumbnailUrl) {
                    console.log('🎯 Image URL:', post.thumbnailUrl);
                }
                
                console.log('📊 Post stats:');
                console.log('  - likeCount:', post.likeCount || 'N/A');
                console.log('  - commentCount:', post.commentCount || 'N/A');
                console.log('  - isVideo:', post.isVideo || false);
                
            } else {
                console.log('❌ No users found with posts data');
                console.log('ℹ️ Users with extended data:', users.filter(u => u.hasExtendedData).length);
                console.log('ℹ️ Total users:', users.length);
            }
        } catch (error) {
            console.error('❌ Error checking post data:', error);
        }
    };

    // Debug function to test search functionality
    window.testSearch = async function(query) {
        try {
            if (!managerInstance) {
                console.log('❌ Manager not initialized. Run startManager() first.');
                return;
            }
            
            console.log(`🔍 Testing search for: "${query}"`);
            const results = managerInstance.searchUsers(query);
            
            console.log(`📊 Search Results (${results.length} found):`);
            results.slice(0, 10).forEach((user, index) => {
                console.log(`${index + 1}. @${user.username}${user.fullName ? ` (${user.fullName})` : ''}${user.biography ? ` - ${user.biography.substring(0, 50)}...` : ''}`);
            });
            
            if (results.length > 10) {
                console.log(`... and ${results.length - 10} more results`);
            }
            
            return results;
        } catch (error) {
            console.error('❌ Error testing search:', error);
        }
    };

    console.log(`
🔧 Instagram User Data Manager - Console Edition Ready!

📊 MAIN COMMANDS:
• startManager() - Quick start (recommended)
• loadUserManager() - Initialize IndexedDB and open manager (returns Promise)

🔧 MANAGER COMMANDS (after loaded):
• userManager.show() - Show the manager
• userManager.hide() - Hide the manager  
• userManager.refresh() - Refresh data
• userManager.clearSelections() - Clear selected users
• userManager.selectAll() - Select all visible users

🔍 SEARCH COMMANDS:
• testSearch("username") - Test search functionality from console
• Hotkeys in manager: F or / to focus search input

💾 DATABASE COMMANDS:
• igDB.getStats() - Get database statistics
• igDB.exportData() - Export all data
• igDB.importData(data) - Import data
• igDB.searchUsers(query, options) - Search users
• igDB.getUsersByFollowerRange(min, max) - Filter by followers

🔧 INDEXEDDB COMMANDS:
• igDB.resetIndexedDBFlag() - Reset failure flag (retry IndexedDB next load)

🔍 DEBUG COMMANDS:
• checkPostData() - Check what post image data is available
• testSearch(query) - Test search functionality
    `);

})();