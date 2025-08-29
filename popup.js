document.addEventListener('DOMContentLoaded', function() {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const resultsDiv = document.getElementById('results');
  const apiSection = document.getElementById('apiSection');
  const submitBtn = document.getElementById('submitBtn');
  const detectedPoolDiv = document.getElementById('detectedPool');
  const apiStatus = document.getElementById('apiStatus');

  let currentScrapedData = null;

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

  submitBtn.addEventListener('click', async function() {
    if (!currentScrapedData) {
      displayApiStatus('No data to submit. Please scrape the page first.', 'api-error');
      return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      displayApiStatus('Detecting pool and looking up player IDs...', 'api-info');

      // Create game data (this will auto-detect pool and lookup player IDs)
      const { gameData, playerIds, notFound, detectedPool } = await createGameData(currentScrapedData);

      let statusMessage = `Pool: ${detectedPool.name.toUpperCase()}, Found ${playerIds.length} player(s)`;
      if (notFound.length > 0) {
        statusMessage += `, ${notFound.length} not found: ${notFound.join(', ')}`;
      }
      displayApiStatus(statusMessage, 'api-info');

      // Submit to API
      displayApiStatus('Submitting game to API...', 'api-info');
      const result = await submitGame(gameData);

      displayApiStatus('Game submitted successfully!', 'api-success');
      console.log('API Response:', result);

    } catch (error) {
      console.error('API submission error:', error);
      displayApiStatus('Failed to submit: ' + error.message, 'api-error');
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit to API';
    }
  });

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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
