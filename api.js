// API configuration and helper functions


const API_CONFIG = {
  baseUrl: null,
  username: null,
  password: null,
  pools: {
    'carmody': 1,
    'vmac': 2,
    'epic': 3
  }
};

// Initialize API config with stored credentials
async function initializeAPIConfig() {
  const { success, credentials } = await credentialManager.loadCredentials();

  if (success) {
    API_CONFIG.baseUrl = credentials.API_BASE_URL;
    API_CONFIG.username = credentials.API_USERNAME;
    API_CONFIG.password = credentials.API_PASSWORD;
  }

  return success;
}

// Create Basic Auth header
function getAuthHeader() {
  if (!API_CONFIG.username || !API_CONFIG.password) {
    throw new Error('API credentials not configured. Please set up your credentials first.');
  }

  const credentials = btoa(`${API_CONFIG.username}:${API_CONFIG.password}`);
  return `Basic ${credentials}`;
}

// Generic API request helper
async function makeAPIRequest(endpoint, method = 'GET', body = null) {
  // Ensure API config is initialized
  if (!API_CONFIG.baseUrl) {
    await initializeAPIConfig();
  }

  if (!API_CONFIG.baseUrl) {
    throw new Error('API base URL not configured. Please set up your credentials first.');
  }

  const url = `${API_CONFIG.baseUrl}${endpoint}`;

  const headers = {
    'Authorization': getAuthHeader(),
    'Content-Type': 'application/json',
  };

  // Add additional headers for write operations to help with CSRF
  if (method !== 'GET') {
    headers['X-Requested-With'] = 'XMLHttpRequest';
    // Try to set origin to the API base URL instead of chrome-extension://
    const baseUrlObj = new URL(API_CONFIG.baseUrl);
    headers['Origin'] = `${baseUrlObj.protocol}//${baseUrlObj.host}`;
  }

  const options = {
    method: method,
    headers: headers
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`Making ${method} request to: ${url}`);
    const response = await fetch(url, options);

    if (!response.ok) {
      // Get more detailed error information
      let errorMessage = `API request failed: ${method} ${url} - ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage += ` - ${errorData.detail}`;
        }
        console.error('API Error Details:', errorData);
      } catch (e) {
        // If we can't parse JSON, use the original error
        console.error('Could not parse error response');
      }
      throw new Error(errorMessage);
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

// Get start and end times based on location and day of week
function getGameTimes(dateString, poolName) {
  console.log('⏰ getGameTimes called with:', { dateString, poolName });
  
  if (!dateString || !poolName) {
    console.log('❌ Missing dateString or poolName');
    return null;
  }

  // Create date object and force it to be interpreted as local date to avoid timezone issues
  const [year, month, day] = dateString.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const poolNameLower = poolName.toLowerCase();
  
  console.log('📊 Day of week:', dayOfWeek, '(0=Sun, 1=Mon, etc.)');
  console.log('🏊 Pool name lower:', poolNameLower);

  // Define the schedule
  const schedule = {
    'carmody': {
      0: { startTime: '14:45', endTime: '16:30' }, // Sunday
      3: { startTime: '18:45', endTime: '20:15' }  // Wednesday
    },
    'vmac': {
      0: { startTime: '09:45', endTime: '11:00' },  // Sunday
      4: { startTime: '20:30', endTime: '22:00' }   // Thursday
    },
    'epic': {
      // Add Epic schedule when you provide it
    }
  };

  const poolSchedule = schedule[poolNameLower];
  if (!poolSchedule) {
    console.warn(`❌ No schedule found for pool: ${poolName}`);
    return null;
  }

  const daySchedule = poolSchedule[dayOfWeek];
  if (!daySchedule) {
    console.warn(`❌ No schedule found for ${poolName} on day ${dayOfWeek} (${date.toLocaleDateString()})`);
    return null;
  }
  
  console.log('✅ Found schedule:', daySchedule);

  // Create full datetime strings
  const startDateTime = `${dateString}T${daySchedule.startTime}:00`;
  const endDateTime = `${dateString}T${daySchedule.endTime}:00`;
  
  console.log('✅ Created datetime strings:', { startDateTime, endDateTime });

  return {
    startTime: startDateTime,
    endTime: endDateTime,
    originalStartTime: daySchedule.startTime,
    originalEndTime: daySchedule.endTime
  };
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
  console.log('🔧 createGameData called with:', scrapedData);
  const detectedPool = detectPoolFromLocation(scrapedData.location);

  if (!detectedPool) {
    throw new Error(`Could not detect pool from location: "${scrapedData.location}". Expected one of: ${Object.keys(API_CONFIG.pools).join(', ')}`);
  }

  // Get player IDs for attendees
  const { playerIds, notFound } = await getPlayerIds(scrapedData.attendees);

  // Parse the scraped date
  const parsedDate = parseDate(scrapedData.date);
  console.log('📅 Parsed date:', parsedDate);
  console.log('🏊 Pool name:', detectedPool.name);

  // Get the correct start and end times for this pool and day
  const gameTimes = getGameTimes(parsedDate, detectedPool.name);
  console.log('⏰ Game times result:', gameTimes);
  
  if (!gameTimes) {
    throw new Error(`No schedule found for ${detectedPool.name} on ${new Date(parsedDate).toLocaleDateString()}. Please check the day and pool combination.`);
  }

  const gameData = {
    pool: detectedPool.id,
    starttime: gameTimes.startTime,
    endtime: gameTimes.endTime,
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

// Check if game already exists for given date and pool
async function checkGameExists(date, poolId) {
  try {
    const response = await makeAPIRequest(`games?starttime__date=${date}&pool=${poolId}`);

    if (response && response.results && response.results.length > 0) {
      // Game exists, return the first matching game
      return {
        exists: true,
        game: response.results[0],
        allGames: response.results // In case there are multiple games on same date/pool
      };
    }

    return {
      exists: false,
      game: null,
      allGames: []
    };
  } catch (error) {
    console.error('Error checking if game exists:', error);
    throw error;
  }
}

// Generate game URL (you can customize this format)
function generateGameUrl(gameId, baseUrl) {
  // Remove '/api/v1/' from base URL and add game path
  const webBaseUrl = baseUrl.replace('/api/v1/', '').replace('/api/v1', '');
  return `${webBaseUrl}/admin/attendance/game/${gameId}/change`;
}

// Update existing game with new attendees
async function updateGameAttendees(gameId, newPlayerIds, existingPlayerIds = []) {
  try {
    // Combine existing and new player IDs, removing duplicates
    const allPlayerIds = [...new Set([...existingPlayerIds, ...newPlayerIds])];

    const updateData = {
      attendees: allPlayerIds
    };

    return await makeAPIRequest(`games/${gameId}/`, 'PATCH', updateData);
  } catch (error) {
    console.error('Error updating game attendees:', error);
    throw error;
  }
}

// Submit game to API (original function)
async function submitGame(gameData) {
  return await makeAPIRequest('games/', 'POST', gameData);
}

// Enhanced game submission with existence checking
async function handleGameSubmission(scrapedData) {
  const detectedPool = detectPoolFromLocation(scrapedData.location);

  if (!detectedPool) {
    throw new Error(`Could not detect pool from location: "${scrapedData.location}". Expected one of: ${Object.keys(API_CONFIG.pools).join(', ')}`);
  }

  // Get player IDs for attendees
  const { playerIds, notFound } = await getPlayerIds(scrapedData.attendees);

  // Parse the scraped date
  const parsedDate = parseDate(scrapedData.date);

  // Check if game already exists
  const gameCheck = await checkGameExists(parsedDate, detectedPool.id);

  return {
    detectedPool,
    playerIds,
    notFound,
    parsedDate,
    gameExists: gameCheck.exists,
    existingGame: gameCheck.game,
    allExistingGames: gameCheck.allGames
  };
}
