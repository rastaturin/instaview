// ==UserScript==
// @name         Instagram Profile & Location Scraper
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Scrape Instagram profiles and locations with full dynamic content access
// @author       You
// @match        https://www.instagram.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('Instagram Scraper Tampermonkey script loaded');

    // Check if we're on a valid page
    function isValidPage() {
        const path = window.location.pathname;
        return path.includes('/locations/') || path.match(/^\/[^\/]+\/?$/);
    }

    // Extract location ID or username from URL
    function getPageInfo() {
        const path = window.location.pathname;
        const locationMatch = path.match(/\/locations\/(\d+)/);
        const usernameMatch = path.match(/^\/([^\/]+)\/?$/);
        
        if (locationMatch) {
            return { type: 'location', id: locationMatch[1] };
        } else if (usernameMatch && !['explore', 'accounts', 'p'].includes(usernameMatch[1])) {
            return { type: 'profile', username: usernameMatch[1] };
        }
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

    // Create scraper UI
    function createScraperUI(pageInfo) {
        // Remove existing UI if present
        const existingUI = document.getElementById('instagram-scraper-ui');
        if (existingUI) {
            existingUI.remove();
        }

        const scraperUI = document.createElement('div');
        scraperUI.id = 'instagram-scraper-ui';
        scraperUI.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1e293b;
            color: white;
            border: 2px solid #0095f6;
            border-radius: 8px;
            padding: 15px;
            width: 350px;
            z-index: 9999;
            box-shadow: 0 0 20px rgba(0, 149, 246, 0.5);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            max-height: 90vh;
            overflow-y: auto;
        `;

        const pageTitle = pageInfo.type === 'location' 
            ? `Location: ${pageInfo.id}` 
            : `Profile: @${pageInfo.username}`;

        scraperUI.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 10px; color: #0095f6; font-weight: 600;">Instagram Scraper</h3>
            <p id="scraper-status" style="color: #e2e8f0; margin-bottom: 10px;">Ready to scrape ${pageTitle}</p>
            <div style="margin: 10px 0;">
                <label style="display: flex; align-items: center; margin-bottom: 8px; color: #e2e8f0; font-size: 13px;">
                    <input type="checkbox" id="collect-profile-data" style="margin-right: 8px;">
                    Collect detailed profile data
                </label>
                <label style="display: flex; align-items: center; margin-bottom: 8px; color: #e2e8f0; font-size: 13px;">
                    <input type="checkbox" id="debug-mode" style="margin-right: 8px;">
                    Debug mode (extensive logging)
                </label>
                <label style="display: flex; align-items: center; margin-bottom: 8px; color: #e2e8f0; font-size: 13px;">
                    <input type="checkbox" id="wait-for-scroll" checked style="margin-right: 8px;">
                    Auto-scroll to load more content
                </label>
                <div style="display: flex; gap: 5px; margin-top: 10px;">
                    <button id="start-scraping" style="padding: 8px 12px; background: #0095f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; flex: 1;">Start Scraping</button>
                    <button id="download-users" style="padding: 8px 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; flex: 1;" disabled>Download</button>
                </div>
            </div>
            <div id="scraper-results" style="margin-top: 10px; font-size: 13px; color: #e2e8f0;">Found 0 users</div>
            <div id="profile-progress" style="margin-top: 5px; font-size: 12px; color: #94a3b8; display: none;">Fetching profile data...</div>
            <div id="debug-output" style="margin-top: 10px; font-size: 11px; color: #64748b; max-height: 200px; overflow-y: auto; display: none;"></div>
            <button id="close-scraper" style="position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer; font-size: 16px; color: #94a3b8;">✕</button>
        `;

        document.body.appendChild(scraperUI);
        return scraperUI;
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
                const username = postMatch[1];
                const postId = postMatch[2];
                
                if (username && !username.includes('explore') && username.length > 0) {
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
            followerCount: 0,
            followingCount: 0,
            postsCount: 0,
            isVerified: false,
            isPrivate: false,
            externalUrl: '',
            businessCategory: '',
            recentPosts: []
        };

        // Extract from meta tags
        const metaTags = document.querySelectorAll('meta');
        let description = '';
        let profilePic = '';
        let title = '';

        metaTags.forEach(meta => {
            const property = meta.getAttribute('property');
            const content = meta.getAttribute('content');
            
            if (property === 'og:description' && content) {
                description = content;
            }
            if (property === 'og:image' && content) {
                profilePic = content;
            }
            if (property === 'og:title' && content) {
                title = content;
            }
        });

        // Parse follower counts from description
        const followerMatch = description.match(/(\d+(?:\.\d+)?[KMB]?)\s+Followers/i);
        const followingMatch = description.match(/(\d+(?:\.\d+)?[KMB]?)\s+Following/i);
        const postsMatch = description.match(/(\d+(?:\.\d+)?[KMB]?)\s+Posts/i);

        profileData = {
            fullName: title ? title.replace(` (@${username})`, '').replace(` • Instagram`, '') : '',
            biography: description.split(' - ')[0] || '',
            profilePicUrl: profilePic,
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
            posts: profileData.recentPosts.length 
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

    // Main scraping function
    async function startScraping(pageInfo) {
        const statusElement = document.getElementById('scraper-status');
        const resultsElement = document.getElementById('scraper-results');
        const profileProgressElement = document.getElementById('profile-progress');
        const startButton = document.getElementById('start-scraping');
        const downloadButton = document.getElementById('download-users');
        
        const collectProfileData = document.getElementById('collect-profile-data').checked;
        const isDebugMode = document.getElementById('debug-mode').checked;
        const shouldAutoScroll = document.getElementById('wait-for-scroll').checked;

        startButton.disabled = true;
        statusElement.textContent = 'Starting scraping...';
        
        try {
            // Auto-scroll to load more content if enabled
            if (shouldAutoScroll) {
                statusElement.textContent = 'Loading content...';
                await autoScroll(isDebugMode);
            }

            // Wait a moment for content to settle
            await new Promise(resolve => setTimeout(resolve, 1000));

            statusElement.textContent = 'Extracting users...';
            const users = extractPostsFromDOM(pageInfo, isDebugMode);
            const userCount = Object.keys(users).length;

            if (userCount === 0) {
                statusElement.textContent = 'No users found';
                resultsElement.textContent = 'No posts or users detected. Try scrolling or refreshing the page.';
                startButton.disabled = false;
                return;
            }

            resultsElement.textContent = `Found ${userCount} unique users`;
            debugLog(`📊 Total users found: ${userCount}`, null, isDebugMode);

            // Collect detailed profile data if requested
            if (collectProfileData) {
                statusElement.textContent = 'Collecting profile data...';
                profileProgressElement.style.display = 'block';
                
                const userList = Object.values(users);
                let profileDataCollected = 0;

                for (let i = 0; i < userList.length; i++) {
                    const user = userList[i];
                    profileProgressElement.textContent = `Profile data: ${i + 1}/${userList.length} - @${user.username}`;
                    
                    try {
                        // If we're on this user's profile page, get data from current DOM
                        if (pageInfo.type === 'profile' && pageInfo.username === user.username) {
                            const profileData = getProfileDataFromDOM(user.username, isDebugMode);
                            Object.assign(user, profileData);
                            profileDataCollected++;
                        } else {
                            // For other users, we'd need to fetch their profiles
                            // For now, just mark that we tried
                            debugLog(`⏭️ Skipping profile data for @${user.username} (not current profile)`, null, isDebugMode);
                        }
                    } catch (error) {
                        debugLog(`❌ Error collecting profile data for @${user.username}`, error, isDebugMode);
                    }

                    // Small delay to avoid overwhelming the UI
                    if (i % 10 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }

                profileProgressElement.textContent = `Profile data collected for ${profileDataCollected} users`;
                debugLog(`📈 Profile data collection completed: ${profileDataCollected}/${userList.length}`, null, isDebugMode);
            }

            // Save to localStorage
            const storageKey = pageInfo.type === 'location' 
                ? `instagram_users_location_${pageInfo.id}`
                : `instagram_users_profile_${pageInfo.username}`;
            
            localStorage.setItem(storageKey, JSON.stringify(Object.values(users)));
            
            statusElement.textContent = 'Scraping complete!';
            resultsElement.textContent = `Found ${userCount} users. Data saved to localStorage.`;
            downloadButton.disabled = false;
            
            debugLog(`💾 Data saved to localStorage with key: ${storageKey}`, null, isDebugMode);

        } catch (error) {
            statusElement.textContent = 'Error during scraping';
            resultsElement.textContent = `Error: ${error.message}`;
            debugLog(`❌ Scraping error`, error, isDebugMode);
        }

        startButton.disabled = false;
    }

    // Download function
    function downloadData(pageInfo) {
        const storageKey = pageInfo.type === 'location' 
            ? `instagram_users_location_${pageInfo.id}`
            : `instagram_users_profile_${pageInfo.username}`;
        
        const data = localStorage.getItem(storageKey);
        
        if (!data) {
            alert('No data found in localStorage');
            return;
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        
        const filename = pageInfo.type === 'location' 
            ? `instagram_location_${pageInfo.id}_${new Date().toISOString().slice(0,10)}.json`
            : `instagram_profile_${pageInfo.username}_${new Date().toISOString().slice(0,10)}.json`;
        
        downloadAnchorNode.setAttribute("download", filename);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    // Initialize the scraper
    function initScraper() {
        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initScraper);
            return;
        }

        const pageInfo = getPageInfo();
        if (!pageInfo) {
            console.log('Not on a valid Instagram page for scraping');
            return;
        }

        console.log('Instagram Scraper initialized for:', pageInfo);

        // Create UI
        const scraperUI = createScraperUI(pageInfo);

        // Event listeners
        document.getElementById('close-scraper').addEventListener('click', () => {
            scraperUI.remove();
        });

        document.getElementById('start-scraping').addEventListener('click', () => {
            startScraping(pageInfo);
        });

        document.getElementById('download-users').addEventListener('click', () => {
            downloadData(pageInfo);
        });

        // Auto-enable debug mode checkbox handler
        document.getElementById('debug-mode').addEventListener('change', (e) => {
            const debugOutput = document.getElementById('debug-output');
            if (e.target.checked) {
                debugOutput.style.display = 'block';
                debugLog('🔍 Debug mode enabled', null, true);
            } else {
                debugOutput.style.display = 'none';
            }
        });
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

})(); 