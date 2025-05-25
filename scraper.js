// Instagram location scraper
class InstagramScraper {
    constructor() {
        this.isRunning = false;
        this.currentLocationId = null;
        this.scrapedUsers = 0;
        this.statusCallback = null;
        this.progressCallback = null;
        this.userAddedCallback = null;
    }
    
    // Set callbacks for UI updates
    setCallbacks(statusCallback, progressCallback, userAddedCallback) {
        this.statusCallback = statusCallback;
        this.progressCallback = progressCallback;
        this.userAddedCallback = userAddedCallback;
    }
    
    // Extract location ID from URL
    extractLocationId(url) {
        const match = url.match(/\/locations\/(\d+)/);
        return match ? match[1] : null;
    }
    
    // Update status
    updateStatus(message) {
        if (this.statusCallback) {
            this.statusCallback(message);
        }
        console.log(message);
    }
    
    // Update progress
    updateProgress(value) {
        if (this.progressCallback) {
            this.progressCallback(value);
        }
    }
    
    // Start scraping process
    async startScraping(locationUrl) {
        if (this.isRunning) {
            this.updateStatus('Already running a scraping operation');
            return { success: false, message: 'Already running' };
        }
        
        this.isRunning = true;
        this.scrapedUsers = 0;
        
        try {
            // Extract location ID
            this.currentLocationId = this.extractLocationId(locationUrl);
            
            if (!this.currentLocationId) {
                this.updateStatus('Invalid Instagram location URL');
                this.isRunning = false;
                return { success: false, message: 'Invalid URL' };
            }
            
            this.updateStatus(`Starting to scrape location: ${this.currentLocationId}`);
            
            // Attempt to load data using Instagram's API
            await this.scrapeFromLocationPage(locationUrl);
            
            this.updateStatus(`Scraping completed. Found ${this.scrapedUsers} users.`);
            this.isRunning = false;
            return { 
                success: true, 
                message: 'Scraping completed', 
                users: this.scrapedUsers 
            };
            
        } catch (error) {
            this.updateStatus(`Error during scraping: ${error.message}`);
            console.error('Scraping error:', error);
            this.isRunning = false;
            return { 
                success: false, 
                message: `Error: ${error.message}` 
            };
        }
    }
    
    // Scrape the location page
    async scrapeFromLocationPage(locationUrl) {
        this.updateStatus('Opening location page in a hidden iframe...');
        
        // Create a promise that will resolve when we've processed the page
        return new Promise((resolve, reject) => {
            try {
                // Create a hidden iframe to load the Instagram page
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
                
                // Set a timeout for the whole operation
                const timeout = setTimeout(() => {
                    document.body.removeChild(iframe);
                    reject(new Error('Scraping timed out after 60 seconds'));
                }, 60000);
                
                // Listen for iframe load
                iframe.onload = async () => {
                    try {
                        this.updateStatus('Page loaded, waiting for content...');
                        
                        // Give some time for JavaScript to load content
                        setTimeout(async () => {
                            try {
                                await this.extractUsersFromPage(iframe);
                                
                                // Clean up
                                clearTimeout(timeout);
                                document.body.removeChild(iframe);
                                resolve();
                            } catch (error) {
                                clearTimeout(timeout);
                                document.body.removeChild(iframe);
                                reject(error);
                            }
                        }, 5000);
                    } catch (error) {
                        clearTimeout(timeout);
                        document.body.removeChild(iframe);
                        reject(error);
                    }
                };
                
                // Handle iframe errors
                iframe.onerror = (error) => {
                    clearTimeout(timeout);
                    document.body.removeChild(iframe);
                    reject(new Error(`Failed to load Instagram page: ${error.message}`));
                };
                
                // Load the Instagram URL
                iframe.src = locationUrl;
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    // Extract users from the page
    async extractUsersFromPage(iframe) {
        try {
            const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
            
            this.updateStatus('Analyzing page content...');
            
            // Find article elements which contain posts
            const articles = iframeDocument.querySelectorAll('article');
            
            if (articles.length === 0) {
                // Instagram's structure might have changed, or content not loaded
                this.updateStatus('No posts found. Instagram may require login or its structure has changed.');
                throw new Error('No posts found on the page');
            }
            
            this.updateStatus(`Found ${articles.length} posts, extracting usernames...`);
            
            // Process each article (post)
            for (let i = 0; i < articles.length; i++) {
                const article = articles[i];
                
                // Update progress
                this.updateProgress((i / articles.length) * 100);
                
                // Find username links
                // Instagram structure may change, so we try multiple selectors
                const usernameElements = article.querySelectorAll('a[href^="/"]');
                
                for (const element of usernameElements) {
                    const href = element.getAttribute('href');
                    
                    // Username links typically look like /{username}/
                    if (href && href.match(/^\/[^/]+\/$/) && !href.startsWith('/explore/')) {
                        const username = href.replace(/^\/|\/$|^\/p\//g, '');
                        
                        if (username && username.length > 0 && !username.includes('/')) {
                            // Found a valid username
                            const postUrl = article.querySelector('a[href^="/p/"]')?.getAttribute('href') || '';
                            
                            // Add to database
                            const result = await database.addUser({
                                username,
                                locationId: this.currentLocationId,
                                postUrl: postUrl ? `https://www.instagram.com${postUrl}` : ''
                            });
                            
                            if (result.success) {
                                this.scrapedUsers++;
                                
                                // Notify UI of new user
                                if (this.userAddedCallback) {
                                    this.userAddedCallback(username, this.scrapedUsers);
                                }
                            }
                            
                            // We only need one username per post
                            break;
                        }
                    }
                }
            }
            
            this.updateProgress(100);
            this.updateStatus(`Extracted ${this.scrapedUsers} unique usernames`);
            
        } catch (error) {
            console.error('Error extracting users:', error);
            throw error;
        }
    }
    
    // Stop the scraping process
    stopScraping() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.updateStatus('Scraping stopped by user');
    }
}

// Create and export a singleton instance
const scraper = new InstagramScraper(); 