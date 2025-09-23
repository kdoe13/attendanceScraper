// Content script for scraping page elements
function scrapePageElements() {
  const data = {
    location: null,
    date: null,
    attendees: [],
    scrapedAt: new Date().toISOString(),
    attendeeCount: 0
  };

  try {
    // Get location from "main a" textContent
    const locationElement = document.querySelector('main h1');
    if (locationElement) {
      data.location = locationElement.textContent.trim();
    }

    // Get date from "main div.pt-px" textContent
    const dateElement = document.querySelector('main span.ds2-k14');
    if (dateElement) {
      data.date = dateElement.textContent.trim();
    }

    // Get attendees from "button[data-event-label='attendee-card'] p" textContent
    const attendeeElements = document.querySelectorAll("main h3");
    attendeeElements.forEach((element) => {
      const name = element.textContent.trim();
      if (name) {
        data.attendees.push(name);
      }
    });

    // Set attendee count
    data.attendeeCount = data.attendees.length;

    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: data
    };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeElements') {
    const result = scrapePageElements();
    sendResponse(result);
  }
});

// Also make the function available globally for testing
window.scrapePageElements = scrapePageElements;
