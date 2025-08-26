// Background script for the Chrome extension
// This handles any background tasks and communication between components

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Page Element Scraper extension installed');
});

// Handle any runtime messages if needed in the future
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Currently not handling any background messages
  // This can be extended for future functionality
  return false;
});
