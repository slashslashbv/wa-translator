import { describe, test, expect, jest, beforeEach } from '@jest/globals';

describe('Popup Script - Settings Management', () => {
  let mockChrome;
  let mockDocument;
  let apiKeyInput;
  let targetLanguageSelect;
  let customPromptInput;
  let saveBtn;
  let statusDiv;
  let form;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup DOM elements
    apiKeyInput = { value: '', trim: function() { return this.value.trim(); } };
    targetLanguageSelect = { value: 'Dutch' };
    customPromptInput = { value: '', trim: function() { return this.value.trim(); } };
    saveBtn = { disabled: false, textContent: 'Instellingen opslaan' };
    statusDiv = { textContent: '', className: '', style: { display: 'none' } };
    form = { addEventListener: jest.fn() };

    // Mock document
    mockDocument = {
      getElementById: jest.fn((id) => {
        const elements = {
          'apiKey': apiKeyInput,
          'targetLanguage': targetLanguageSelect,
          'customPrompt': customPromptInput,
          'saveBtn': saveBtn,
          'status': statusDiv,
          'settingsForm': form
        };
        return elements[id];
      }),
      addEventListener: jest.fn()
    };
    global.document = mockDocument;

    // Setup chrome mock
    mockChrome = {
      storage: {
        sync: {
          get: jest.fn((keys, callback) => {
            callback({
              openai_api_key: 'sk-test123',
              target_language: 'Dutch',
              custom_prompt: 'Test prompt'
            });
          }),
          set: jest.fn((items, callback) => {
            callback();
          })
        }
      },
      tabs: {
        query: jest.fn((queryInfo, callback) => {
          callback([{ id: 1, url: 'https://web.whatsapp.com' }]);
        }),
        reload: jest.fn((tabId, callback) => {
          if (callback) callback();
        })
      },
      runtime: {
        lastError: null
      }
    };
    global.chrome = mockChrome;
  });

  // Helper functions mimicking popup.js logic
  function loadSettings() {
    chrome.storage.sync.get(['openai_api_key', 'target_language', 'custom_prompt'], function(result) {
      if (result.openai_api_key) {
        apiKeyInput.value = result.openai_api_key;
      }
      if (result.target_language) {
        targetLanguageSelect.value = result.target_language;
      }
      if (result.custom_prompt) {
        customPromptInput.value = result.custom_prompt;
      }
    });
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  function saveSettings() {
    const apiKey = apiKeyInput.value.trim();
    const targetLanguage = targetLanguageSelect.value;
    const customPrompt = customPromptInput.value.trim();

    if (!apiKey) {
      showStatus('Voer een geldige API key in', 'error');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      showStatus('API key moet beginnen met "sk-"', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Opslaan...';

    chrome.storage.sync.set({
      openai_api_key: apiKey,
      target_language: targetLanguage,
      custom_prompt: customPrompt
    }, function() {
      if (chrome.runtime.lastError) {
        showStatus('Fout bij opslaan: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatus('Instellingen succesvol opgeslagen!', 'success');

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0] && tabs[0].url && tabs[0].url.includes('web.whatsapp.com')) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      }

      saveBtn.disabled = false;
      saveBtn.textContent = 'Instellingen opslaan';
    });
  }

  describe('loadSettings', () => {
    test('should load saved settings from storage', () => {
      loadSettings();

      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(
        ['openai_api_key', 'target_language', 'custom_prompt'],
        expect.any(Function)
      );
      expect(apiKeyInput.value).toBe('sk-test123');
      expect(targetLanguageSelect.value).toBe('Dutch');
      expect(customPromptInput.value).toBe('Test prompt');
    });

    test('should handle missing settings gracefully', () => {
      mockChrome.storage.sync.get = jest.fn((keys, callback) => {
        callback({});
      });

      apiKeyInput.value = '';
      targetLanguageSelect.value = 'English';
      customPromptInput.value = '';

      loadSettings();

      // Values should remain unchanged when no data is returned
      expect(apiKeyInput.value).toBe('');
      expect(targetLanguageSelect.value).toBe('English');
      expect(customPromptInput.value).toBe('');
    });

    test('should handle partial settings', () => {
      mockChrome.storage.sync.get = jest.fn((keys, callback) => {
        callback({
          openai_api_key: 'sk-partial123'
        });
      });

      loadSettings();

      expect(apiKeyInput.value).toBe('sk-partial123');
      // Other fields should not be set
    });
  });

  describe('saveSettings', () => {
    test('should save valid settings successfully', () => {
      apiKeyInput.value = 'sk-newkey123';
      targetLanguageSelect.value = 'German';
      customPromptInput.value = 'Custom prompt here';

      saveSettings();

      expect(saveBtn.disabled).toBe(false);
      expect(saveBtn.textContent).toBe('Instellingen opslaan');
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        {
          openai_api_key: 'sk-newkey123',
          target_language: 'German',
          custom_prompt: 'Custom prompt here'
        },
        expect.any(Function)
      );
      expect(statusDiv.textContent).toBe('Instellingen succesvol opgeslagen!');
      expect(statusDiv.className).toBe('status success');
    });

    test('should reject empty API key', () => {
      apiKeyInput.value = '';

      saveSettings();

      expect(mockChrome.storage.sync.set).not.toHaveBeenCalled();
      expect(statusDiv.textContent).toBe('Voer een geldige API key in');
      expect(statusDiv.className).toBe('status error');
    });

    test('should reject API key with only whitespace', () => {
      apiKeyInput.value = '   ';

      saveSettings();

      expect(mockChrome.storage.sync.set).not.toHaveBeenCalled();
      expect(statusDiv.textContent).toBe('Voer een geldige API key in');
      expect(statusDiv.className).toBe('status error');
    });

    test('should reject API key not starting with "sk-"', () => {
      apiKeyInput.value = 'invalid-key-123';

      saveSettings();

      expect(mockChrome.storage.sync.set).not.toHaveBeenCalled();
      expect(statusDiv.textContent).toBe('API key moet beginnen met "sk-"');
      expect(statusDiv.className).toBe('status error');
    });

    test('should trim whitespace from API key', () => {
      apiKeyInput.value = '  sk-trimmed123  ';
      targetLanguageSelect.value = 'French';
      customPromptInput.value = '';

      saveSettings();

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        {
          openai_api_key: 'sk-trimmed123',
          target_language: 'French',
          custom_prompt: ''
        },
        expect.any(Function)
      );
    });

    test('should handle storage errors', () => {
      mockChrome.runtime.lastError = { message: 'Storage quota exceeded' };
      apiKeyInput.value = 'sk-test123';

      saveSettings();

      expect(statusDiv.textContent).toBe('Fout bij opslaan: Storage quota exceeded');
      expect(statusDiv.className).toBe('status error');
      expect(saveBtn.disabled).toBe(false);

      // Clean up
      mockChrome.runtime.lastError = null;
    });

    test('should reload WhatsApp tab after successful save', () => {
      apiKeyInput.value = 'sk-test123';
      targetLanguageSelect.value = 'Spanish';
      customPromptInput.value = 'Test';

      saveSettings();

      expect(mockChrome.tabs.query).toHaveBeenCalledWith(
        { active: true, currentWindow: true },
        expect.any(Function)
      );
      expect(mockChrome.tabs.reload).toHaveBeenCalledWith(1);
    });

    test('should not reload if active tab is not WhatsApp', () => {
      mockChrome.tabs.query = jest.fn((queryInfo, callback) => {
        callback([{ id: 1, url: 'https://google.com' }]);
      });

      apiKeyInput.value = 'sk-test123';

      saveSettings();

      expect(mockChrome.tabs.reload).not.toHaveBeenCalled();
    });

    test('should handle no active tabs', () => {
      mockChrome.tabs.query = jest.fn((queryInfo, callback) => {
        callback([]);
      });

      apiKeyInput.value = 'sk-test123';

      saveSettings();

      expect(mockChrome.tabs.reload).not.toHaveBeenCalled();
    });

    test('should save empty custom prompt', () => {
      apiKeyInput.value = 'sk-test123';
      targetLanguageSelect.value = 'Dutch';
      customPromptInput.value = '';

      saveSettings();

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_prompt: ''
        }),
        expect.any(Function)
      );
    });

    test('should update button text while saving', () => {
      apiKeyInput.value = 'sk-test123';

      // Capture the initial state
      const setCallback = jest.fn();
      mockChrome.storage.sync.set = jest.fn((items, callback) => {
        // At this point button should be disabled
        expect(saveBtn.disabled).toBe(true);
        expect(saveBtn.textContent).toBe('Opslaan...');
        callback();
      });

      saveSettings();

      // After callback, button should be re-enabled
      expect(saveBtn.disabled).toBe(false);
      expect(saveBtn.textContent).toBe('Instellingen opslaan');
    });
  });

  describe('showStatus', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should display success message', () => {
      showStatus('Success!', 'success');

      expect(statusDiv.textContent).toBe('Success!');
      expect(statusDiv.className).toBe('status success');
      expect(statusDiv.style.display).toBe('block');
    });

    test('should display error message', () => {
      showStatus('Error occurred', 'error');

      expect(statusDiv.textContent).toBe('Error occurred');
      expect(statusDiv.className).toBe('status error');
      expect(statusDiv.style.display).toBe('block');
    });

    test('should hide status after 3 seconds', () => {
      showStatus('Test message', 'success');

      expect(statusDiv.style.display).toBe('block');

      jest.advanceTimersByTime(3000);

      expect(statusDiv.style.display).toBe('none');
    });

    test('should not hide status before 3 seconds', () => {
      showStatus('Test message', 'success');

      jest.advanceTimersByTime(2000);

      expect(statusDiv.style.display).toBe('block');
    });
  });
});
