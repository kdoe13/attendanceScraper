document.addEventListener('DOMContentLoaded', function() {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const resultsDiv = document.getElementById('results');

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

  function displayResults(response) {
    resultsDiv.style.display = 'block';

    if (!response.success) {
      displayError('Scraping failed: ' + (response.error || 'Unknown error'));
      return;
    }

    const data = response.data;

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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
