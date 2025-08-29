# Page Element Scraper Extension

A Chrome extension that scrapes specific elements from web pages and submits them to a REST API.

## Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd aiScraperExtension
   ```

2. **Configure API credentials**
   ```bash
   cp config.example.js config.js
   ```
   
   Then edit `config.js` with your actual API credentials:
   ```javascript
   const CONFIG = {
     API_BASE_URL: 'http://your-api-url/api/v1/',
     API_USERNAME: 'your_username',
     API_PASSWORD: 'your_password'
   };
   ```

3. **Load the extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this folder

## Features

- **Auto-scraping**: Extracts location, date, and attendees from web pages
- **Pool detection**: Automatically detects pool (carmody/vmac/epic) from location
- **Player lookup**: Searches API for player IDs by name
- **API submission**: Submits game data to REST API with authentication

## Files

- `manifest.json` - Extension configuration
- `content.js` - Page scraping logic
- `popup.html/js` - Extension UI
- `api.js` - API integration
- `config.js` - API credentials (**not committed to git**)
- `config.example.js` - Template for configuration

## API Integration

The extension submits data in this format:
```json
{
  "pool": 1,
  "starttime": "2025-08-27",
  "endtime": "2025-08-27", 
  "shared_time_minutes": 95,
  "attendees": [123, 456],
  "notes": "{\"location\":\"...\",\"detectedPool\":\"carmody\",...}"
}
```

## Security

- API credentials are stored in `config.js` which is ignored by git
- Uses Basic Authentication with configurable credentials
- All requests are made over HTTPS when possible
