document.addEventListener('DOMContentLoaded', function() {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const resultsDiv = document.getElementById('results');
  const apiSection = document.getElementById('apiSection');
  const submitBtn = document.getElementById('submitBtn');
  const detectedPoolDiv = document.getElementById('detectedPool');
  const apiStatus = document.getElementById('apiStatus');
  
  // Game existence elements
  const gameExistsSection = document.getElementById('gameExistsSection');
  const submitSection = document.getElementById('submitSection');
  const existingGameInfo = document.getElementById('existingGameInfo');
  const viewGameBtn = document.getElementById('viewGameBtn');
  const updateGameBtn = document.getElementById('updateGameBtn');
  const createNewGameBtn = document.getElementById('createNewGameBtn');
  
  // Credential management elements
  const credentialSection = document.getElementById('credentialSection');
  const scraperSection = document.getElementById('scraperSection');
  const settingsBtn = document.getElementById('settingsBtn');
  const saveCredentialsBtn = document.getElementById('saveCredentialsBtn');
  const clearCredentialsBtn = document.getElementById('clearCredentialsBtn');
  const backToScraperBtn = document.getElementById('backToScraperBtn');
  const apiUrlInput = document.getElementById('apiUrl');
  const apiUsernameInput = document.getElementById('apiUsername');
  const apiPasswordInput = document.getElementById('apiPassword');
  const credentialStatus = document.getElementById('credentialStatus');

  let currentScrapedData = null;
  let currentGameData = null;
  let isCredentialSectionVisible = false;

  // Initialize the popup
  initializePopup();

  // Initialize popup based on credential status
  async function initializePopup() {
    try {
      const hasCredentials = await credentialManager.areCredentialsConfigured();
      
      if (!hasCredentials) {
        showCredentialSection();
        displayCredentialStatus('Please configure your API credentials to use the scraper.', 'api-info');
      } else {
        // Load existing credentials for editing
        const { success, credentials } = await credentialManager.loadCredentials();
        if (success) {
          apiUrlInput.value = credentials.API_BASE_URL || '';
          apiUsernameInput.value = credentials.API_USERNAME || '';
          // Don't prefill password for security
        }
      }
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      displayCredentialStatus('Error initializing extension. Please try reloading.', 'api-error');
    }
  }

  // Show/hide credential section
  function showCredentialSection() {
    credentialSection.style.display = 'block';
    scraperSection.style.display = 'none';
    isCredentialSectionVisible = true;
  }

  function hideCredentialSection() {
    credentialSection.style.display = 'none';
    scraperSection.style.display = 'block';
    isCredentialSectionVisible = false;
  }

  // Settings button event listener
  settingsBtn.addEventListener('click', function() {
    if (isCredentialSectionVisible) {
      hideCredentialSection();
    } else {
      showCredentialSection();
    }
  });

  // Back to scraper button event listener
  backToScraperBtn.addEventListener('click', function() {
    hideCredentialSection();
  });

  // Save credentials event listener
  saveCredentialsBtn.addEventListener('click', async function() {
    const credentials = {
      baseUrl: apiUrlInput.value.trim(),
      username: apiUsernameInput.value.trim(),
      password: apiPasswordInput.value.trim()
    };

    // Validate credentials
    const validation = credentialManager.validateCredentials(credentials);
    if (!validation.isValid) {
      displayCredentialStatus(`Validation errors: ${validation.errors.join(', ')}`, 'api-error');
      return;
    }

    // Save credentials
    saveCredentialsBtn.disabled = true;
    saveCredentialsBtn.textContent = 'Saving...';

    try {
      const result = await credentialManager.saveCredentials(credentials);
      
      if (result.success) {
        displayCredentialStatus('Credentials saved successfully!', 'api-success');
        // Clear password field for security
        apiPasswordInput.value = '';
        
        // Auto-hide after 2 seconds if this was the initial setup
        const hasCredentials = await credentialManager.areCredentialsConfigured();
        if (hasCredentials) {
          setTimeout(() => {
            hideCredentialSection();
          }, 2000);
        }
      } else {
        displayCredentialStatus(`Failed to save credentials: ${result.error}`, 'api-error');
      }
    } catch (error) {
      displayCredentialStatus(`Error saving credentials: ${error.message}`, 'api-error');
    } finally {
      saveCredentialsBtn.disabled = false;
      saveCredentialsBtn.textContent = 'Save Credentials';
    }
  });

  // Clear credentials event listener
  clearCredentialsBtn.addEventListener('click', async function() {
    if (!confirm('Are you sure you want to clear all stored credentials?')) {
      return;
    }

    clearCredentialsBtn.disabled = true;
    clearCredentialsBtn.textContent = 'Clearing...';

    try {
      const result = await credentialManager.clearCredentials();
      
      if (result.success) {
        displayCredentialStatus('Credentials cleared successfully.', 'api-success');
        // Clear form fields
        apiUrlInput.value = 'http://localhost:8000/api/v1/';
        apiUsernameInput.value = '';
        apiPasswordInput.value = '';
      } else {
        displayCredentialStatus(`Failed to clear credentials: ${result.error}`, 'api-error');
      }
    } catch (error) {
      displayCredentialStatus(`Error clearing credentials: ${error.message}`, 'api-error');
    } finally {
      clearCredentialsBtn.disabled = false;
      clearCredentialsBtn.textContent = 'Clear Credentials';
    }
  });

  scrapeBtn.addEventListener('click', async function() {
    // Disable button while scraping
    scrapeBtn.disabled = true;
    scrapeBtn.textContent = 'Scraping...';

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeElements' });

      // Display results
      displayResults(response);

    } catch (error) {
      displayError('Failed to scrape page: ' + error.message);
    } finally {
      // Re-enable button
      scrapeBtn.disabled = false;
      scrapeBtn.textContent = 'Scrape Page Elements';
    }
  });

  // Handle game submission with existence checking
  submitBtn.addEventListener('click', async function() {
    await handleSubmission('create');
  });

  // View existing game
  viewGameBtn.addEventListener('click', async function() {
    if (currentGameData && currentGameData.existingGame) {
      const { success, credentials } = await credentialManager.loadCredentials();
      if (success) {
        const gameUrl = generateGameUrl(currentGameData.existingGame.id, credentials.API_BASE_URL);
        chrome.tabs.create({ url: gameUrl });
      }
    }
  });

  // Update existing game attendees
  updateGameBtn.addEventListener('click', async function() {
    await handleSubmission('update');
  });

  // Create new game despite existing one
  createNewGameBtn.addEventListener('click', async function() {
    await handleSubmission('force-create');
  });

  // Unified submission handler
  async function handleSubmission(action = 'create') {
    if (!currentScrapedData) {
      displayApiStatus('No data to submit. Please scrape the page first.', 'api-error');
      return;
    }

    const activeBtn = getActiveButton(action);
    
    // Disable active button
    activeBtn.disabled = true;
    const originalText = activeBtn.textContent;
    activeBtn.textContent = getLoadingText(action);

    try {
      displayApiStatus('Detecting pool and looking up player IDs...', 'api-info');

      // Check game existence and prepare data
      currentGameData = await handleGameSubmission(currentScrapedData);

      let statusMessage = `Pool: ${currentGameData.detectedPool.name.toUpperCase()}, Found ${currentGameData.playerIds.length} player(s)`;
      if (currentGameData.notFound.length > 0) {
        statusMessage += `, ${currentGameData.notFound.length} not found: ${currentGameData.notFound.join(', ')}`;
      }
      displayApiStatus(statusMessage, 'api-info');

      // Handle based on action and game existence
      if (action === 'create' && currentGameData.gameExists) {
        // Show game exists options
        showGameExistsSection();
        displayGameExistsInfo();
        return;
      } else if (action === 'update' && currentGameData.gameExists) {
        // Update existing game
        displayApiStatus('Updating existing game attendees...', 'api-info');
        const existingAttendees = currentGameData.existingGame.attendees || [];
        const result = await updateGameAttendees(
          currentGameData.existingGame.id,
          currentGameData.playerIds,
          existingAttendees
        );
        displayApiStatus('Game attendees updated successfully!', 'api-success');
        console.log('Update Response:', result);
      } else {
        // Create new game (either no existing game or force-create)
        // Use createGameData to get proper timing logic
        displayApiStatus('Creating game data with proper timing...', 'api-info');
        const { gameData } = await createGameData(currentScrapedData);
        
        displayApiStatus('Creating new game...', 'api-info');
        const result = await submitGame(gameData);
        displayApiStatus('Game created successfully!', 'api-success');
        console.log('Create Response:', result);
      }

      // Hide game exists section after successful action
      hideGameExistsSection();

    } catch (error) {
      console.error('API submission error:', error);
      displayApiStatus('Failed to submit: ' + error.message, 'api-error');
    } finally {
      // Re-enable button
      activeBtn.disabled = false;
      activeBtn.textContent = originalText;
    }
  }

  // Helper functions
  function getActiveButton(action) {
    switch (action) {
      case 'update': return updateGameBtn;
      case 'force-create': return createNewGameBtn;
      default: return submitBtn;
    }
  }

  function getLoadingText(action) {
    switch (action) {
      case 'update': return 'Updating...';
      case 'force-create': return 'Creating...';
      default: return 'Processing...';
    }
  }

  function showGameExistsSection() {
    gameExistsSection.style.display = 'block';
    submitSection.style.display = 'none';
  }

  function hideGameExistsSection() {
    gameExistsSection.style.display = 'none';
    submitSection.style.display = 'block';
  }

  function displayGameExistsInfo() {
    if (currentGameData && currentGameData.existingGame) {
      const game = currentGameData.existingGame;
      const attendeeCount = game.attendees ? game.attendees.length : 0;
      const gameDate = new Date(game.starttime).toLocaleDateString();
      
      existingGameInfo.innerHTML = `Game on ${gameDate} with ${attendeeCount} attendee(s)<br>Choose an action below:`;
    }
  }

  function displayResults(response) {
    resultsDiv.style.display = 'block';

    if (!response.success) {
      displayError('Scraping failed: ' + (response.error || 'Unknown error'));
      return;
    }

    const data = response.data;

    // Store the scraped data for API submission
    currentScrapedData = data;

    // Try to detect pool from location
    try {
      const detectedPool = detectPoolFromLocation(data.location);
      if (detectedPool) {
        detectedPoolDiv.innerHTML = `<strong>${detectedPool.name.toUpperCase()}</strong> (ID: ${detectedPool.id})`;
        detectedPoolDiv.style.color = '#2e7d32';
      } else {
        detectedPoolDiv.innerHTML = 'Could not detect pool from location';
        detectedPoolDiv.style.color = '#d32f2f';
      }
    } catch (error) {
      detectedPoolDiv.innerHTML = 'Error detecting pool';
      detectedPoolDiv.style.color = '#d32f2f';
    }

    // Show API section if we have valid data
    if (data.attendees.length > 0 || data.location || data.date) {
      apiSection.style.display = 'block';
      // Clear any previous API status
      apiStatus.innerHTML = '';
      apiStatus.className = 'api-status';
    }

    resultsDiv.innerHTML = `
      <div class="result-item">
        <div class="result-label">Location:</div>
        <div class="result-value">${data.location || 'Not found'}</div>
      </div>

      <div class="result-item">
        <div class="result-label">Date:</div>
        <div class="result-value">${data.date || 'Not found'}</div>
      </div>

      <div class="result-item">
        <div class="result-label">Attendee Count:</div>
        <div class="result-value">${data.attendeeCount}</div>
      </div>

      <div class="result-item">
        <div class="result-label">Attendees:</div>
        ${data.attendees.length > 0 ?
          `<ul class="attendees-list">
            ${data.attendees.map(name => `<li>${escapeHtml(name)}</li>`).join('')}
           </ul>` :
          '<div class="result-value">No attendees found</div>'
        }
      </div>

      <div class="result-item">
        <div class="result-label">Scraped At:</div>
        <div class="result-value">${new Date(data.scrapedAt).toLocaleString()}</div>
      </div>

      <div class="result-item">
        <button id="copyBtn" style="width: 100%; padding: 8px; margin-top: 10px; background-color: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Copy JSON to Clipboard
        </button>
      </div>
    `;

    // Add copy functionality
    const copyBtn = document.getElementById('copyBtn');
    copyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy JSON to Clipboard';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
        copyBtn.textContent = 'Copy failed';
      });
    });
  }

  function displayError(message) {
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
  }

  function displayApiStatus(message, className = 'api-info') {
    apiStatus.innerHTML = escapeHtml(message);
    apiStatus.className = `api-status ${className}`;
  }

  function displayCredentialStatus(message, className = 'api-info') {
    credentialStatus.innerHTML = escapeHtml(message);
    credentialStatus.className = `credential-status ${className}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
