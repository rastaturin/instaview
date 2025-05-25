// Database handler using Dexie.js
class InstagramDatabase {
    constructor() {
        this.db = new Dexie('InstagramLocationDB');
        
        // Define database schema
        this.db.version(1).stores({
            users: '++id, username, locationId, postUrl, timestamp, [locationId+username]'
        });
        
        // Expose the tables
        this.users = this.db.users;
    }
    
    // Add a new username to the database
    async addUser(userData) {
        try {
            // Add timestamp
            userData.timestamp = new Date().toISOString();
            
            // Check if the user already exists for this location
            const existingUser = await this.users
                .where('[locationId+username]')
                .equals([userData.locationId, userData.username])
                .first();
                
            if (!existingUser) {
                // Add the user if they don't exist
                const id = await this.users.add(userData);
                console.log(`Added user ${userData.username} with ID ${id}`);
                return { success: true, id };
            } else {
                console.log(`User ${userData.username} already exists for this location`);
                return { success: false, exists: true };
            }
        } catch (error) {
            console.error('Error adding user to database:', error);
            return { success: false, error };
        }
    }
    
    // Get all users for a specific location
    async getUsersByLocation(locationId) {
        try {
            return await this.users
                .where('locationId')
                .equals(locationId)
                .toArray();
        } catch (error) {
            console.error('Error fetching users by location:', error);
            return [];
        }
    }
    
    // Count users for a specific location
    async countUsersByLocation(locationId) {
        try {
            return await this.users
                .where('locationId')
                .equals(locationId)
                .count();
        } catch (error) {
            console.error('Error counting users by location:', error);
            return 0;
        }
    }
    
    // Clear all data for a specific location
    async clearLocationData(locationId) {
        try {
            const deleteCount = await this.users
                .where('locationId')
                .equals(locationId)
                .delete();
            
            console.log(`Deleted ${deleteCount} users for location ${locationId}`);
            return { success: true, count: deleteCount };
        } catch (error) {
            console.error('Error clearing location data:', error);
            return { success: false, error };
        }
    }
    
    // Export data for a specific location
    async exportLocationData(locationId) {
        try {
            const users = await this.getUsersByLocation(locationId);
            return {
                success: true,
                data: users,
                exportDate: new Date().toISOString(),
                locationId
            };
        } catch (error) {
            console.error('Error exporting location data:', error);
            return { success: false, error };
        }
    }
}

// Create and export a singleton instance
const database = new InstagramDatabase(); 