# Instagram Location Scraper

A browser-based tool to collect Instagram usernames from a specific location page and store them in a local database.

## Features

- Scrapes Instagram location pages to collect usernames of people who posted there
- Stores data in a local browser database (IndexedDB)
- Export collected data as JSON
- Simple and easy-to-use interface

## Usage

1. Open `index.html` in your web browser
2. Enter an Instagram location URL (e.g., `https://www.instagram.com/explore/locations/113299477167515/tatte-bakery-cafe/`)
3. Click "Start Scraping" to begin collecting usernames
4. View collected usernames in the list below
5. Export data as JSON or clear the database using the provided buttons

## Important Notes

- This script requires running in a web browser
- Instagram's website structure may change, which could affect the scraper's functionality
- Some Instagram pages may require login, which this tool doesn't handle
- The tool uses browser storage (IndexedDB), so data is saved locally in your browser
- For heavy usage, consider implementing rate limiting to avoid IP blocking

## Technical Details

- Pure JavaScript implementation
- Uses Dexie.js for IndexedDB management
- Collects usernames by analyzing DOM structure
- No external dependencies beyond Dexie.js

## Limitations

- Instagram's anti-scraping measures may limit effectiveness
- Only collects data from the initially loaded posts (no infinite scroll handling)
- May not work if Instagram significantly changes their page structure
- Does not handle authentication for private or login-required content