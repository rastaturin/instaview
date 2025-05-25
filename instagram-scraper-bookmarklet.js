javascript:(function() {
    // Instagram location scraper bookmarklet
    console.log('Instagram Location Scraper starting...');
    
    // Extract location ID from current URL
    const locationId = window.location.pathname.match(/\/locations\/(\d+)/)?.[1];
    if (!locationId) {
        alert('Not a valid Instagram location page. URL should contain /locations/{id}/');
        return;
    }
    
    console.log(`Scraping location ID: ${locationId}`);
    
    // Create UI
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
        width: 300px;
        z-index: 9999;
        box-shadow: 0 0 20px rgba(0, 149, 246, 0.5);
        font-family: Arial, sans-serif;
        font-weight: 400;
    `;
    
    scraperUI.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 10px; color: #0095f6; font-weight: 600;">Instagram Scraper</h3>
        <p id="scraper-status" style="color: #e2e8f0;">Ready to scrape location: ${locationId}</p>
        <div style="margin: 10px 0;">
            <label style="display: flex; align-items: center; margin-bottom: 10px; color: #e2e8f0;">
                <input type="checkbox" id="collect-profile-data" style="margin-right: 8px;">
                Collect profile data (slower but more detailed)
            </label>
            <label style="display: flex; align-items: center; margin-bottom: 10px; color: #e2e8f0;">
                <input type="checkbox" id="debug-mode" style="margin-right: 8px;">
                Debug mode (limit to 1 user, extensive logging)
            </label>
            <button id="start-scraping" style="padding: 8px 12px; background: #0095f6; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px; font-weight: bold;">Start Scraping</button>
            <button id="download-users" style="padding: 8px 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" disabled>Download JSON</button>
        </div>
        <div id="scraper-results" style="margin-top: 10px; font-size: 14px; color: #e2e8f0;">Found 0 users</div>
        <div id="profile-progress" style="margin-top: 5px; font-size: 12px; color: #94a3b8; display: none;">Fetching profile data...</div>
        <button id="close-scraper" style="position: absolute; top: 10px; right: 10px; background: none; border: none; cursor: pointer; font-size: 16px; color: #94a3b8;">✕</button>
    `;
    
    document.body.appendChild(scraperUI);
    
    // UI elements
    const statusElement = document.getElementById('scraper-status');
    const resultsElement = document.getElementById('scraper-results');
    const profileProgressElement = document.getElementById('profile-progress');
    const startButton = document.getElementById('start-scraping');
    const downloadButton = document.getElementById('download-users');
    const closeButton = document.getElementById('close-scraper');
    const collectProfileDataCheckbox = document.getElementById('collect-profile-data');
    const debugModeCheckbox = document.getElementById('debug-mode');
    
    // Close button event
    closeButton.addEventListener('click', () => {
        document.body.removeChild(scraperUI);
    });
    
    // Function to fetch profile data from Instagram
    async function fetchProfileData(username, isDebugMode = false) {
        try {
            const profileUrl = `https://www.instagram.com/${username}/`;
            
            if (isDebugMode) {
                console.log(`🔍 DEBUG: Starting profile data fetch for ${username}`);
                console.log(`📍 DEBUG: Profile URL: ${profileUrl}`);
            }
            
            // Try to fetch the profile page
            const response = await fetch(profileUrl);
            
            if (isDebugMode) {
                console.log(`📡 DEBUG: Response status: ${response.status} ${response.statusText}`);
                console.log(`📡 DEBUG: Response headers:`, {
                    'content-type': response.headers.get('content-type'),
                    'content-length': response.headers.get('content-length'),
                    'cache-control': response.headers.get('cache-control')
                });
            }
            
            if (!response.ok) {
                console.log(`❌ ERROR: Failed to fetch ${profileUrl} - Status: ${response.status}`);
                return null;
            }
            
            const html = await response.text();
            
            if (isDebugMode) {
                console.log(`📄 DEBUG: HTML content length: ${html.length} characters`);
                console.log(`📄 DEBUG: HTML preview (first 500 chars):`, html.substring(0, 500));
                console.log(`📄 DEBUG: HTML preview (contains "profile_pic"): ${html.includes('profile_pic')}`);
                console.log(`📄 DEBUG: HTML preview (contains "_sharedData"): ${html.includes('_sharedData')}`);
                console.log(`📄 DEBUG: HTML preview (contains "scontent"): ${html.includes('scontent')}`);
                console.log(`📄 DEBUG: HTML preview (contains "cdninstagram"): ${html.includes('cdninstagram')}`);
            }
            
            // Create a temporary DOM element to parse the HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            console.log(`Fetching profile data for ${username}...`);
            
            // Look for the script tag containing profile data (try multiple approaches)
            const scripts = tempDiv.querySelectorAll('script');
            let profileData = null;
            
            if (isDebugMode) {
                console.log(`🔍 DEBUG: Found ${scripts.length} script tags`);
            }
            
            // Try to find data in script tags
            for (let scriptIndex = 0; scriptIndex < scripts.length; scriptIndex++) {
                const script = scripts[scriptIndex];
                const text = script.textContent;
                
                if (isDebugMode && scriptIndex < 5) {
                    console.log(`📜 DEBUG: Script ${scriptIndex + 1} length: ${text?.length || 0} chars`);
                    if (text && text.length > 0) {
                        console.log(`📜 DEBUG: Script ${scriptIndex + 1} preview:`, text.substring(0, 200));
                    }
                }
                
                if (text && (text.includes('window._sharedData') || text.includes('"ProfilePage"') || text.includes('"user"'))) {
                    if (isDebugMode) {
                        console.log(`🎯 DEBUG: Found potential data in script ${scriptIndex + 1}`);
                    }
                    
                    try {
                        // Try window._sharedData first
                        let match = text.match(/window\._sharedData\s*=\s*({.*?});/);
                        if (match) {
                            if (isDebugMode) {
                                console.log(`🎯 DEBUG: Found _sharedData match`);
                                console.log(`🎯 DEBUG: _sharedData preview:`, match[1].substring(0, 300));
                            }
                            
                            const sharedData = JSON.parse(match[1]);
                            const userData = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user;
                            
                            if (isDebugMode) {
                                console.log(`🎯 DEBUG: Parsed sharedData structure:`, {
                                    hasEntryData: !!sharedData?.entry_data,
                                    hasProfilePage: !!sharedData?.entry_data?.ProfilePage,
                                    profilePageLength: sharedData?.entry_data?.ProfilePage?.length || 0,
                                    hasGraphql: !!sharedData?.entry_data?.ProfilePage?.[0]?.graphql,
                                    hasUser: !!userData
                                });
                            }
                            
                            if (userData) {
                                profileData = extractUserDataFromSharedData(userData, isDebugMode);
                                console.log(`Found profile data via _sharedData for ${username}`);
                                break;
                            }
                        }
                        
                        // Try to find embedded JSON data
                        const jsonMatches = text.match(/"user":\s*({[^}]+})/g);
                        if (jsonMatches) {
                            if (isDebugMode) {
                                console.log(`🎯 DEBUG: Found ${jsonMatches.length} embedded JSON user matches`);
                            }
                            
                            for (const jsonMatch of jsonMatches) {
                                try {
                                    const userMatch = jsonMatch.match(/"user":\s*({.+})/);
                                    if (userMatch) {
                                        const userData = JSON.parse(userMatch[1]);
                                        if (isDebugMode) {
                                            console.log(`🎯 DEBUG: Parsed user data:`, {
                                                hasUsername: !!userData.username,
                                                username: userData.username,
                                                targetUsername: username,
                                                matches: userData.username === username
                                            });
                                        }
                                        
                                        if (userData.username === username) {
                                            profileData = extractBasicUserData(userData, isDebugMode);
                                            console.log(`Found profile data via embedded JSON for ${username}`);
                                            break;
                                        }
                                    }
                                } catch (e) {
                                    if (isDebugMode) {
                                        console.log(`⚠️ DEBUG: Failed to parse JSON match:`, e);
                                    }
                                }
                            }
                            if (profileData) break;
                        }
                    } catch (e) {
                        console.log(`Failed to parse script data for ${username}:`, e);
                        if (isDebugMode) {
                            console.log(`❌ DEBUG: Script parsing error details:`, e);
                        }
                    }
                }
            }
            
            // Enhanced DOM parsing for posts using the new structure
            if (!profileData || !profileData.recentPosts || profileData.recentPosts.length === 0) {
                console.log(`Trying DOM parsing for posts for ${username}...`);
                
                if (isDebugMode) {
                    console.log(`🔍 DEBUG: Starting DOM parsing for posts`);
                    console.log(`🔍 DEBUG: Current profile data state:`, {
                        hasProfileData: !!profileData,
                        hasRecentPosts: !!(profileData?.recentPosts),
                        recentPostsLength: profileData?.recentPosts?.length || 0
                    });
                    
                    // COMPREHENSIVE IMAGE ANALYSIS - Show ALL images on the page
                    const allImages = tempDiv.querySelectorAll('img');
                    console.log(`🔍 DEBUG: COMPREHENSIVE IMAGE ANALYSIS - Found ${allImages.length} total images on profile page`);
                    
                    if (allImages.length > 0) {
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
                        
                        // Show first few of each type
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
                }
                
                // Look for post images using multiple selectors
                const selectors = [
                    'img[src*="scontent"]',
                    'img[src*="cdninstagram"]', 
                    'img[class*="x5yr21d"]',
                    'img[alt]',
                    'img[src*="instagram"]'
                ];
                
                let postImages = [];
                for (const selector of selectors) {
                    const images = tempDiv.querySelectorAll(selector);
                    if (isDebugMode) {
                        console.log(`🔍 DEBUG: Selector "${selector}" found ${images.length} images`);
                        if (images.length > 0 && images.length <= 3) {
                            // Show details for small sets
                            Array.from(images).forEach((img, idx) => {
                                console.log(`🔍 DEBUG: ${selector} result ${idx + 1}:`, {
                                    src: img.getAttribute('src')?.substring(0, 100) + '...',
                                    alt: img.getAttribute('alt')?.substring(0, 50)
                                });
                            });
                        }
                    }
                    if (images.length > 0) {
                        postImages = images;
                        break;
                    }
                }
                
                // If no images found with specific selectors, try all images
                if (postImages.length === 0) {
                    postImages = tempDiv.querySelectorAll('img');
                    if (isDebugMode) {
                        console.log(`🔍 DEBUG: Fallback: Found ${postImages.length} total images`);
                    }
                }
                
                console.log(`Found ${postImages.length} potential post images`);
                
                if (isDebugMode && postImages.length > 0) {
                    console.log(`🔍 DEBUG: Selected images for processing (first 5):`);
                    for (let i = 0; i < Math.min(5, postImages.length); i++) {
                        const img = postImages[i];
                        console.log(`🔍 DEBUG: Selected Image ${i + 1}:`, {
                            src: img.getAttribute('src'),
                            alt: img.getAttribute('alt'),
                            class: img.getAttribute('class'),
                            parentTagName: img.parentElement?.tagName,
                            hasParentLink: !!img.closest('a[href*="/p/"]'),
                            closestLinkHref: img.closest('a')?.getAttribute('href')
                        });
                    }
                }
                
                const recentPosts = [];
                const processedUrls = new Set(); // Avoid duplicates
                
                for (let i = 0; i < Math.min(12, postImages.length); i++) {
                    const img = postImages[i];
                    const src = img.getAttribute('src');
                    const alt = img.getAttribute('alt') || '';
                    
                    if (isDebugMode && i < 3) {
                        console.log(`🔍 DEBUG: Processing image ${i + 1}:`, {
                            src: src,
                            alt: alt?.substring(0, 100),
                            alreadyProcessed: processedUrls.has(src)
                        });
                    }
                    
                    // Skip if no src or already processed
                    if (!src || processedUrls.has(src)) {
                        if (isDebugMode && i < 3) {
                            console.log(`🔍 DEBUG: Skipping image ${i + 1}: ${!src ? 'no src' : 'already processed'}`);
                        }
                        continue;
                    }
                    processedUrls.add(src);
                    
                    // Skip profile pictures and other non-post images
                    const isProfilePic = src.includes('profile_pic') || alt.includes('profile picture') || 
                        src.includes('150x150') || img.closest('header');
                    
                    if (isProfilePic) {
                        if (isDebugMode && i < 3) {
                            console.log(`🔍 DEBUG: Skipping image ${i + 1}: identified as profile pic`);
                        }
                        continue;
                    }
                    
                    // Extract post ID from ig_cache_key parameter
                    let postId = '';
                    let shortcode = '';
                    
                    // Try to extract from ig_cache_key parameter
                    const cacheKeyMatch = src.match(/ig_cache_key=([^&%]+)/);
                    if (cacheKeyMatch) {
                        try {
                            // Decode the cache key
                            const decoded = decodeURIComponent(cacheKeyMatch[1]);
                            const base64Match = decoded.match(/^([A-Za-z0-9+/=]+)/);
                            if (base64Match) {
                                postId = base64Match[1];
                                // Convert to shortcode (Instagram's base64-like encoding)
                                shortcode = postId.substring(0, 11); // Approximate shortcode length
                                
                                if (isDebugMode && i < 3) {
                                    console.log(`🔍 DEBUG: Extracted from cache key - postId: ${postId}, shortcode: ${shortcode}`);
                                }
                            }
                        } catch (e) {
                            console.log('Failed to decode cache key:', e);
                        }
                    }
                    
                    // If no post ID found, generate one from the image URL
                    if (!postId) {
                        const urlMatch = src.match(/\/([0-9]+)_/);
                        if (urlMatch) {
                            postId = urlMatch[1];
                            shortcode = postId;
                            
                            if (isDebugMode && i < 3) {
                                console.log(`🔍 DEBUG: Extracted from URL pattern - postId: ${postId}`);
                            }
                        } else {
                            postId = `generated_${Date.now()}_${i}`;
                            shortcode = postId;
                            
                            if (isDebugMode && i < 3) {
                                console.log(`🔍 DEBUG: Generated ID - postId: ${postId}`);
                            }
                        }
                    }
                    
                    // Look for parent element that might be clickable (to get post URL)
                    let postUrl = `https://www.instagram.com/p/${shortcode}/`;
                    let parent = img.parentElement;
                    for (let j = 0; j < 5; j++) {
                        if (!parent) break;
                        const link = parent.querySelector('a[href*="/p/"]') || 
                                   (parent.tagName === 'A' && parent.getAttribute('href')?.includes('/p/') ? parent : null);
                        if (link) {
                            const href = link.getAttribute('href');
                            if (href) {
                                postUrl = href.startsWith('http') ? href : `https://www.instagram.com${href}`;
                                const shortcodeMatch = href.match(/\/p\/([^\/]+)/);
                                if (shortcodeMatch) {
                                    shortcode = shortcodeMatch[1];
                                }
                                
                                if (isDebugMode && i < 3) {
                                    console.log(`🔍 DEBUG: Found parent link - postUrl: ${postUrl}, shortcode: ${shortcode}`);
                                }
                                break;
                            }
                        }
                        parent = parent.parentElement;
                    }
                    
                    // Check if this looks like a video (common video indicators)
                    const isVideo = src.includes('video') || alt.toLowerCase().includes('video') ||
                                  img.parentElement?.querySelector('[class*="video"], [data-testid*="video"]') !== null;
                    
                    const post = {
                        id: postId,
                        shortcode: shortcode,
                        url: postUrl,
                        thumbnailUrl: src,
                        caption: alt.length > 300 ? alt.substring(0, 300) + '...' : alt,
                        likeCount: 0, // Not available from DOM parsing
                        commentCount: 0, // Not available from DOM parsing
                        timestamp: new Date().toISOString(), // Use current time as fallback
                        isVideo: isVideo,
                        viewCount: null
                    };
                    
                    recentPosts.push(post);
                    console.log(`Found post: ${shortcode} with caption: ${alt.substring(0, 50)}...`);
                    
                    if (isDebugMode) {
                        console.log(`✅ DEBUG: Added post ${recentPosts.length}:`, post);
                    }
                }
                
                // Initialize or update profile data with posts
                if (!profileData) {
                    profileData = {
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
                        recentPosts: recentPosts
                    };
                } else {
                    profileData.recentPosts = recentPosts;
                }
                
                console.log(`DOM parsing found ${recentPosts.length} posts for ${username}`);
                
                if (isDebugMode) {
                    console.log(`🎯 DEBUG: Final DOM parsing results:`, {
                        totalImagesFound: postImages.length,
                        postsExtracted: recentPosts.length,
                        samplePosts: recentPosts.slice(0, 2)
                    });
                }
            }
            
            // Enhanced meta tag parsing for basic profile info
            if (!profileData || !profileData.biography) {
                if (isDebugMode) {
                    console.log(`🔍 DEBUG: Starting meta tag parsing`);
                }
                
                const metaTags = tempDiv.querySelectorAll('meta');
                let description = '';
                let profilePic = '';
                let title = '';
                
                if (isDebugMode) {
                    console.log(`🔍 DEBUG: Found ${metaTags.length} meta tags`);
                }
                
                metaTags.forEach((meta, index) => {
                    const property = meta.getAttribute('property');
                    const name = meta.getAttribute('name');
                    const content = meta.getAttribute('content');
                    
                    if (isDebugMode && index < 10) {
                        console.log(`🔍 DEBUG: Meta ${index + 1}:`, { property, name, content: content?.substring(0, 100) });
                    }
                    
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
                
                if (isDebugMode) {
                    console.log(`🔍 DEBUG: Meta tag extraction results:`, {
                        title: title,
                        description: description?.substring(0, 100),
                        profilePic: profilePic?.substring(0, 100)
                    });
                }
                
                // Extract follower info from description if available
                const followerMatch = description.match(/(\d+(?:\.\d+)?[KMB]?)\s+Followers/i);
                const followingMatch = description.match(/(\d+(?:\.\d+)?[KMB]?)\s+Following/i);
                const postsMatch = description.match(/(\d+(?:\.\d+)?[KMB]?)\s+Posts/i);
                
                if (!profileData) {
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
                        recentPosts: profileData?.recentPosts || []
                    };
                } else {
                    // Update existing profile data with meta tag info
                    if (!profileData.biography) profileData.biography = description.split(' - ')[0] || '';
                    if (!profileData.profilePicUrl) profileData.profilePicUrl = profilePic;
                    if (!profileData.followerCount && followerMatch) profileData.followerCount = parseCount(followerMatch[1]);
                    if (!profileData.followingCount && followingMatch) profileData.followingCount = parseCount(followingMatch[1]);
                    if (!profileData.postsCount && postsMatch) profileData.postsCount = parseCount(postsMatch[1]);
                }
                
                console.log(`Meta tag parsing completed for ${username}`);
            }
            
            if (isDebugMode) {
                console.log(`🎯 DEBUG: Final profile data for ${username}:`, profileData);
            }
            
            return profileData;
        } catch (error) {
            console.log(`Error fetching profile data for ${username}:`, error);
            if (isDebugMode) {
                console.log(`❌ DEBUG: Full error details for ${username}:`, error);
            }
            return null;
        }
    }
    
    // Helper function to extract user data from _sharedData structure
    function extractUserDataFromSharedData(userData, isDebugMode = false) {
        const recentPosts = [];
        const timelineMedia = userData.edge_owner_to_timeline_media?.edges || [];
        
        // Get up to 6 recent posts
        for (let i = 0; i < Math.min(6, timelineMedia.length); i++) {
            const post = timelineMedia[i].node;
            recentPosts.push({
                id: post.id,
                shortcode: post.shortcode,
                url: `https://www.instagram.com/p/${post.shortcode}/`,
                thumbnailUrl: post.thumbnail_src || post.display_url,
                caption: post.edge_media_to_caption?.edges?.[0]?.node?.text || '',
                likeCount: post.edge_liked_by?.count || 0,
                commentCount: post.edge_media_to_comment?.count || 0,
                timestamp: new Date(post.taken_at_timestamp * 1000).toISOString(),
                isVideo: post.is_video || false,
                viewCount: post.video_view_count || null
            });
        }
        
        return {
            fullName: userData.full_name || '',
            biography: userData.biography || '',
            profilePicUrl: userData.profile_pic_url || userData.profile_pic_url_hd || '',
            followerCount: userData.edge_followed_by?.count || 0,
            followingCount: userData.edge_follow?.count || 0,
            postsCount: userData.edge_owner_to_timeline_media?.count || 0,
            isVerified: userData.is_verified || false,
            isPrivate: userData.is_private || false,
            externalUrl: userData.external_url || '',
            businessCategory: userData.business_category_name || '',
            recentPosts: recentPosts
        };
    }
    
    // Helper function to extract basic user data from embedded JSON
    function extractBasicUserData(userData, isDebugMode = false) {
        return {
            fullName: userData.full_name || '',
            biography: userData.biography || '',
            profilePicUrl: userData.profile_pic_url || '',
            followerCount: userData.follower_count || 0,
            followingCount: userData.following_count || 0,
            postsCount: userData.media_count || 0,
            isVerified: userData.is_verified || false,
            isPrivate: userData.is_private || false,
            externalUrl: userData.external_url || '',
            businessCategory: userData.business_category_name || '',
            recentPosts: [] // Will be filled by DOM parsing
        };
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
    
    // Function to extract username from various Instagram URL formats
    function extractUsername(href) {
        if (!href || typeof href !== 'string') return null;
        
        // Format: /username/p/postID/
        const postMatch = href.match(/^\/([^/]+)\/p\/[^/]+\/?$/);
        if (postMatch && postMatch[1]) return postMatch[1];
        
        // Format: /username/
        const profileMatch = href.match(/^\/([^/]+)\/?$/);
        if (profileMatch && profileMatch[1]) return profileMatch[1];
        
        return null;
    }
    
    // Start scraping function
    startButton.addEventListener('click', async () => {
        statusElement.textContent = 'Scraping in progress...';
        startButton.disabled = true;
        
        // Find post elements - try multiple selectors to increase chances of finding posts
        // Based on the example provided by the user
        const selectors = [
            'a[href*="/p/"]', // Any link with /p/ in href (post links)
            'a._a6hd', // Class from the example
            'a[role="link"][href*="/p/"]', // Links with role="link" and /p/ in href
            'div._aagw', // Another Instagram post class
            'article', // Try original selector as fallback
        ];
        
        // Try each selector until we find posts
        let postElements = [];
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                console.log(`Found ${elements.length} elements with selector: ${selector}`);
                postElements = elements;
                break;
            }
        }
        
        // If we still don't have posts, try a more aggressive approach
        if (postElements.length === 0) {
            console.log('No posts found with primary selectors, trying a generic approach');
            // Look for any links that match the Instagram post pattern
            const allLinks = document.querySelectorAll('a[href^="/"]');
            postElements = Array.from(allLinks).filter(link => {
                const href = link.getAttribute('href');
                return href && href.includes('/p/');
            });
        }
        
        if (postElements.length === 0) {
            statusElement.textContent = 'No posts found. Instagram may have changed their page structure.';
            console.log('DOM Structure:', document.body.innerHTML.substring(0, 1000) + '...');
            startButton.disabled = false;
            return;
        }
        
        resultsElement.textContent = `Found ${postElements.length} posts, extracting usernames...`;
        console.log(`Found ${postElements.length} potential post elements`);
        
        // Object to store unique usernames
        const users = {};
        let usernameCount = 0;
        
        // Process each post element
        for (let i = 0; i < postElements.length; i++) {
            const element = postElements[i];
            resultsElement.textContent = `Processing post ${i+1}/${postElements.length}...`;
            
            // Check if the element itself is a post link
            let href = element.getAttribute('href');
            if (href && href.includes('/p/')) {
                const username = extractUsername(href);
                if (username && !username.includes('explore') && username.length > 0) {
                    // Add to users object
                    if (!users[username]) {
                        users[username] = {
                            username,
                            locationId,
                            postUrl: `https://www.instagram.com${href}`,
                            timestamp: new Date().toISOString()
                        };
                        usernameCount++;
                        console.log(`Found user from element href: @${username}`);
                    }
                    continue; // Move to next element
                }
            }
            
            // If element itself doesn't have username, look at surrounding elements
            // Look for parent elements up to 3 levels up
            let parent = element.parentElement;
            let foundInParents = false;
            
            for (let j = 0; j < 3; j++) {
                if (!parent) break;
                
                // Check for links in this parent
                const links = parent.querySelectorAll('a[href^="/"]');
                for (const link of links) {
                    href = link.getAttribute('href');
                    const username = extractUsername(href);
                    
                    if (username && !username.includes('explore') && username.length > 0) {
                        // Get post URL if available
                        const postUrl = parent.querySelector('a[href*="/p/"]')?.getAttribute('href') || element.getAttribute('href') || '';
                        
                        // Add to users object
                        if (!users[username]) {
                            users[username] = {
                                username,
                                locationId,
                                postUrl: postUrl ? `https://www.instagram.com${postUrl}` : '',
                                timestamp: new Date().toISOString()
                            };
                            usernameCount++;
                            console.log(`Found user from parent: @${username}`);
                        }
                        foundInParents = true;
                        break;
                    }
                }
                
                if (foundInParents) break;
                parent = parent.parentElement;
            }
            
            // Let the UI update
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        // Save to localStorage
        const storageKey = `instagram_users_${locationId}`;
        
        // Collect profile data if requested
        const shouldCollectProfileData = collectProfileDataCheckbox.checked;
        const isDebugMode = debugModeCheckbox.checked;
        
        if (shouldCollectProfileData && usernameCount > 0) {
            statusElement.textContent = 'Collecting profile data...';
            profileProgressElement.style.display = 'block';
            
            const userList = Object.values(users);
            let profileDataCollected = 0;
            
            // Limit to 1 user in debug mode
            const maxUsers = isDebugMode ? 1 : userList.length;
            
            if (isDebugMode) {
                console.log(`🔍 DEBUG MODE: Limited to ${maxUsers} user(s) for testing`);
                console.log(`🔍 DEBUG MODE: Selected user:`, userList[0]);
            }
            
            for (let i = 0; i < maxUsers; i++) {
                const user = userList[i];
                profileProgressElement.textContent = `Fetching profile data: ${i + 1}/${maxUsers} - @${user.username}`;
                
                if (isDebugMode) {
                    console.log(`🔍 DEBUG: Starting profile data collection for user ${i + 1}/${maxUsers}: @${user.username}`);
                }
                
                try {
                    const profileData = await fetchProfileData(user.username, isDebugMode);
                    if (profileData) {
                        // Merge profile data with existing user data
                        Object.assign(user, profileData);
                        profileDataCollected++;
                        console.log(`Collected profile data for @${user.username}`);
                        
                        if (isDebugMode) {
                            console.log(`✅ DEBUG: Successfully collected profile data for @${user.username}:`, profileData);
                        }
                    } else {
                        if (isDebugMode) {
                            console.log(`❌ DEBUG: No profile data returned for @${user.username}`);
                        }
                    }
                } catch (error) {
                    console.log(`Failed to collect profile data for @${user.username}:`, error);
                    if (isDebugMode) {
                        console.log(`❌ DEBUG: Profile data collection error for @${user.username}:`, error);
                    }
                }
                
                // Add a delay to avoid rate limiting (shorter delay in debug mode)
                const delay = isDebugMode ? 500 : 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            profileProgressElement.textContent = `Profile data collected for ${profileDataCollected}/${maxUsers} users`;
            statusElement.textContent = `Scraping complete! Collected profile data for ${profileDataCollected} users.`;
            
            if (isDebugMode) {
                console.log(`🎯 DEBUG: Profile data collection completed. Success rate: ${profileDataCollected}/${maxUsers}`);
            }
        } else {
            profileProgressElement.style.display = 'none';
        }
        
        localStorage.setItem(storageKey, JSON.stringify(Object.values(users)));
        
        // Update UI
        statusElement.textContent = 'Scraping complete!';
        resultsElement.textContent = `Found ${usernameCount} unique users. Data saved to localStorage.`;
        downloadButton.disabled = false;
        startButton.disabled = false;
    });
    
    // Download function
    downloadButton.addEventListener('click', () => {
        const storageKey = `instagram_users_${locationId}`;
        const data = localStorage.getItem(storageKey);
        
        if (!data) {
            statusElement.textContent = 'No data found in localStorage';
            return;
        }
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `instagram_users_${locationId}_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        statusElement.textContent = 'Download complete';
    });
})(); 