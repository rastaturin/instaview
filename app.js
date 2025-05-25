// Main application script
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const locationUrlInput = document.getElementById('locationUrl');
    const startScrapingButton = document.getElementById('startScraping');
    const statusText = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const userCountElement = document.getElementById('userCount');
    const userListElement = document.getElementById('userList');
    const exportDataButton = document.getElementById('exportData');
    const clearDataButton = document.getElementById('clearData');
    
    // Current location ID
    let currentLocationId = null;
    
    // Setup scraper callbacks
    scraper.setCallbacks(
        // Status callback
        (message) => {
            statusText.textContent = message;
        },
        // Progress callback
        (value) => {
            progressBar.value = value;
            progressBar.style.display = value > 0 && value < 100 ? 'block' : 'none';
        },
        // User added callback
        (username, count) => {
            userCountElement.textContent = count;
            updateUserList();
        }
    );
    
    // Extract location ID from URL
    function extractLocationId(url) {
        return scraper.extractLocationId(url);
    }
    
    // Start scraping process
    async function startScraping() {
        const locationUrl = locationUrlInput.value.trim();
        
        if (!locationUrl) {
            statusText.textContent = 'Please enter an Instagram location URL';
            return;
        }
        
        // Extract location ID
        currentLocationId = extractLocationId(locationUrl);
        
        if (!currentLocationId) {
            statusText.textContent = 'Invalid Instagram location URL';
            return;
        }
        
        // Clear UI
        userListElement.innerHTML = '';
        userCountElement.textContent = '0';
        progressBar.value = 0;
        progressBar.style.display = 'block';
        
        // Disable buttons during scraping
        startScrapingButton.disabled = true;
        startScrapingButton.textContent = 'Scraping...';
        
        try {
            // Start scraping
            const result = await scraper.startScraping(locationUrl);
            
            if (result.success) {
                await updateUserList();
            }
        } catch (error) {
            console.error('Error during scraping:', error);
            statusText.textContent = `Error: ${error.message}`;
        } finally {
            // Re-enable buttons
            startScrapingButton.disabled = false;
            startScrapingButton.textContent = 'Start Scraping';
            progressBar.style.display = 'none';
        }
    }
    
    // Update the user list display
    async function updateUserList() {
        if (!currentLocationId) return;
        
        try {
            // Get users from database
            const users = await database.getUsersByLocation(currentLocationId);
            
            // Update count
            userCountElement.textContent = users.length;
            
            // Clear existing list
            userListElement.innerHTML = '';
            
            // Add users to list
            users.forEach(user => {
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                
                if (user.postUrl) {
                    userItem.innerHTML = `<a href="${user.postUrl}" target="_blank">@${user.username}</a>`;
                } else {
                    userItem.textContent = `@${user.username}`;
                }
                
                userListElement.appendChild(userItem);
            });
        } catch (error) {
            console.error('Error updating user list:', error);
        }
    }
    
    // Export data to JSON file
    async function exportData() {
        if (!currentLocationId) {
            statusText.textContent = 'No location data to export';
            return;
        }
        
        try {
            const exportData = await database.exportLocationData(currentLocationId);
            
            if (exportData.success) {
                // Create JSON file
                const dataStr = JSON.stringify(exportData.data, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                
                // Create download link
                const exportFileName = `instagram_users_${currentLocationId}_${new Date().toISOString().slice(0,10)}.json`;
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileName);
                linkElement.style.display = 'none';
                
                // Add to document, click and remove
                document.body.appendChild(linkElement);
                linkElement.click();
                document.body.removeChild(linkElement);
                
                statusText.textContent = `Exported ${exportData.data.length} users to ${exportFileName}`;
            }
        } catch (error) {
            console.error('Error exporting data:', error);
            statusText.textContent = `Export error: ${error.message}`;
        }
    }
    
    // Clear database for current location
    async function clearData() {
        if (!currentLocationId) {
            statusText.textContent = 'No location data to clear';
            return;
        }
        
        if (confirm(`Are you sure you want to delete all data for location ${currentLocationId}?`)) {
            try {
                const result = await database.clearLocationData(currentLocationId);
                
                if (result.success) {
                    userListElement.innerHTML = '';
                    userCountElement.textContent = '0';
                    statusText.textContent = `Deleted ${result.count} users from database`;
                }
            } catch (error) {
                console.error('Error clearing data:', error);
                statusText.textContent = `Error clearing data: ${error.message}`;
            }
        }
    }
    
    // Event listeners
    startScrapingButton.addEventListener('click', startScraping);
    exportDataButton.addEventListener('click', exportData);
    clearDataButton.addEventListener('click', clearData);
    
    // Initialize with current URL
    const initialUrl = locationUrlInput.value.trim();
    if (initialUrl) {
        currentLocationId = extractLocationId(initialUrl);
        if (currentLocationId) {
            updateUserList();
        }
    }
}); 