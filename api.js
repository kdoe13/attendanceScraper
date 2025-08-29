// API configuration and helper functions
// Credentials are loaded from config.js (not committed to git)
if (typeof CONFIG === 'undefined') {
  throw new Error('CONFIG not loaded. Make sure config.js exists and is loaded first.');
}

const API_CONFIG = {
  baseUrl: CONFIG.API_BASE_URL,
  username: CONFIG.API_USERNAME,
  password: CONFIG.API_PASSWORD,
  pools: {
    'carmody': 1,
    'vmac': 2,
    'epic': 3
  }
};

// Create Basic Auth header
function getAuthHeader() {
  const credentials = btoa(`${API_CONFIG.username}:${API_CONFIG.password}`);
  return `Basic ${credentials}`;
}

// Generic API request helper
async function makeAPIRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_CONFIG.baseUrl}${endpoint}`;

  const options = {
    method: method,
    headers: {
      'Authorization': getAuthHeader(),
      'Content-Type': 'application/json',
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

// Search for player by name
async function searchPlayer(playerName) {
  try {
    const response = await makeAPIRequest(`players/?search=${encodeURIComponent(playerName)}`);
    return response;
  } catch (error) {
    console.error(`Error searching for player "${playerName}":`, error);
    return null;
  }
}

// Get player IDs for all attendees
async function getPlayerIds(attendeeNames) {
  const playerIds = [];
  const notFound = [];

  for (const name of attendeeNames) {
    if (!name || name.trim() === '') continue;

    try {
      const playerData = await searchPlayer(name.trim());

      if (playerData && playerData.results && playerData.results.length > 0) {
        // Assuming the API returns results array with player objects containing id
        const playerId = playerData.results[0].id;
        if (playerId) {
          playerIds.push(playerId);
        } else {
          notFound.push(name);
        }
      } else {
        notFound.push(name);
      }
    } catch (error) {
      console.error(`Failed to lookup player "${name}":`, error);
      notFound.push(name);
    }
  }

  return {
    playerIds,
    notFound
  };
}

// Parse date string to YYYY-MM-DD format
function parseDate(dateString) {
  if (!dateString) return null;

  try {
    // Try to parse the date string
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      // If parsing fails, try to extract date components manually
      // This is a fallback for unusual date formats
      console.warn('Could not parse date:', dateString);
      return new Date().toISOString().split('T')[0]; // Return today's date as fallback
    }

    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  } catch (error) {
    console.error('Date parsing error:', error);
    return new Date().toISOString().split('T')[0]; // Return today's date as fallback
  }
}

// Generate random shared time between 60-120 minutes
function generateRandomSharedTime() {
  return Math.floor(Math.random() * (120 - 60 + 1)) + 60;
}

// Auto-detect pool from location data
function detectPoolFromLocation(location) {
  if (!location) return null;

  const locationLower = location.toLowerCase();

  // Check for pool names in the location string
  for (const [poolName, poolId] of Object.entries(API_CONFIG.pools)) {
    if (locationLower.includes(poolName)) {
      return { name: poolName, id: poolId };
    }
  }

  return null;
}

// Create game data for API
async function createGameData(scrapedData) {
  const detectedPool = detectPoolFromLocation(scrapedData.location);

  if (!detectedPool) {
    throw new Error(`Could not detect pool from location: "${scrapedData.location}". Expected one of: ${Object.keys(API_CONFIG.pools).join(', ')}`);
  }

  // Get player IDs for attendees
  const { playerIds, notFound } = await getPlayerIds(scrapedData.attendees);

  // Parse the scraped date
  const parsedDate = parseDate(scrapedData.date);

  const gameData = {
    pool: detectedPool.id,
    starttime: parsedDate,
    endtime: parsedDate, // Using same date for now, could be enhanced later
    shared_time_minutes: generateRandomSharedTime(),
    attendees: playerIds,
    /*
    notes: JSON.stringify({
      location: scrapedData.location,
      originalDate: scrapedData.date,
      scrapedAt: scrapedData.scrapedAt,
      attendeeCount: scrapedData.attendeeCount,
      originalAttendees: scrapedData.attendees,
      playersNotFound: notFound,
      detectedPool: detectedPool.name
    })
    */
  };

  return {
    gameData,
    playerIds,
    notFound,
    detectedPool
  };
}

// Submit game to API
async function submitGame(gameData) {
  return await makeAPIRequest('games/', 'POST', gameData);
}
