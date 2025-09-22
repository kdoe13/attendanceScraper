// Secure credential management using Chrome's storage API
// This replaces the insecure config.js approach

class CredentialManager {
  constructor() {
    this.storageKey = 'apiCredentials';
    this.defaultConfig = {
      API_BASE_URL: 'http://localhost:8000/api/v1/',
      API_USERNAME: '',
      API_PASSWORD: ''
    };
  }

  // Save credentials securely to Chrome storage
  async saveCredentials(credentials) {
    try {
      const config = {
        API_BASE_URL: credentials.baseUrl || this.defaultConfig.API_BASE_URL,
        API_USERNAME: credentials.username || '',
        API_PASSWORD: credentials.password || ''
      };

      await chrome.storage.local.set({
        [this.storageKey]: config
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to save credentials:', error);
      return { success: false, error: error.message };
    }
  }

  // Load credentials from Chrome storage
  async loadCredentials() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      
      if (result[this.storageKey]) {
        return {
          success: true,
          credentials: result[this.storageKey]
        };
      } else {
        // Return default config if no credentials stored
        return {
          success: true,
          credentials: this.defaultConfig
        };
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
      return {
        success: false,
        error: error.message,
        credentials: this.defaultConfig
      };
    }
  }

  // Check if credentials are configured
  async areCredentialsConfigured() {
    try {
      const { success, credentials } = await this.loadCredentials();
      
      if (!success) return false;
      
      return !!(credentials.API_USERNAME && credentials.API_PASSWORD);
    } catch (error) {
      console.error('Failed to check credentials:', error);
      return false;
    }
  }

  // Clear all stored credentials
  async clearCredentials() {
    try {
      await chrome.storage.local.remove(this.storageKey);
      return { success: true };
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      return { success: false, error: error.message };
    }
  }

  // Validate credential format
  validateCredentials(credentials) {
    const errors = [];

    if (!credentials.username || credentials.username.trim() === '') {
      errors.push('Username is required');
    }

    if (!credentials.password || credentials.password.trim() === '') {
      errors.push('Password is required');
    }

    if (credentials.baseUrl) {
      try {
        new URL(credentials.baseUrl);
      } catch (error) {
        errors.push('Invalid URL format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Create a global instance
const credentialManager = new CredentialManager();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CredentialManager;
}