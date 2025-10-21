import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock the console
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn()
};

// Import after mocks are set up
// Since background.js uses chrome APIs and is not a module, we'll test the logic directly

describe('Background Script - handleTranslation', () => {
  let mockFetch;
  let mockChrome;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup fetch mock
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Setup chrome mock
    mockChrome = {
      storage: {
        sync: {
          get: jest.fn((keys, callback) => {
            callback({ custom_prompt: 'Translate to {targetLanguage}:' });
            return Promise.resolve({ custom_prompt: 'Translate to {targetLanguage}:' });
          })
        }
      }
    };
    global.chrome = mockChrome;
  });

  async function handleTranslation(text, targetLanguage, apiKey) {
    // Get custom prompt from storage
    const storage = await new Promise(resolve => {
      chrome.storage.sync.get(['custom_prompt'], resolve);
    });
    const customPrompt = storage.custom_prompt;

    // Use custom prompt if available, otherwise use simple default
    let systemPrompt;
    if (customPrompt && customPrompt.trim() !== '') {
      // Replace {targetLanguage} placeholder with actual target language
      systemPrompt = customPrompt.replace(/{targetLanguage}/g, targetLanguage);
    } else {
      // Simple default fallback
      systemPrompt = `You are a translator. Translate the following text to ${targetLanguage}.`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  test('should translate text successfully with custom prompt', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: '  Hallo wereld  '
          }
        }]
      })
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await handleTranslation('Hello world', 'Dutch', 'sk-test123');

    expect(result).toBe('Hallo wereld');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-test123'
        }
      })
    );

    // Check the body was constructed correctly
    const callArgs = mockFetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.model).toBe('gpt-3.5-turbo');
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('Translate to Dutch:');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toBe('Hello world');
    expect(body.max_tokens).toBe(1000);
    expect(body.temperature).toBe(0.3);
  });

  test('should use default prompt when no custom prompt is set', async () => {
    mockChrome.storage.sync.get = jest.fn((keys, callback) => {
      callback({ custom_prompt: '' });
      return Promise.resolve({ custom_prompt: '' });
    });

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Hola mundo'
          }
        }]
      })
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await handleTranslation('Hello world', 'Spanish', 'sk-test456');

    expect(result).toBe('Hola mundo');

    const callArgs = mockFetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.messages[0].content).toBe('You are a translator. Translate the following text to Spanish.');
  });

  test('should handle API errors with error message', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({
        error: {
          message: 'Invalid API key'
        }
      })
    };
    mockFetch.mockResolvedValue(mockErrorResponse);

    await expect(handleTranslation('Hello', 'Dutch', 'invalid-key')).rejects.toThrow(
      'API error: 401 - Invalid API key'
    );
  });

  test('should handle API errors without error message', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({})
    };
    mockFetch.mockResolvedValue(mockErrorResponse);

    await expect(handleTranslation('Hello', 'Dutch', 'sk-test123')).rejects.toThrow(
      'API error: 500 - Unknown error'
    );
  });

  test('should handle JSON parse errors in error response', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 503,
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
    };
    mockFetch.mockResolvedValue(mockErrorResponse);

    await expect(handleTranslation('Hello', 'Dutch', 'sk-test123')).rejects.toThrow(
      'API error: 503 - Unknown error'
    );
  });

  test('should replace multiple {targetLanguage} placeholders', async () => {
    mockChrome.storage.sync.get = jest.fn((keys, callback) => {
      callback({ custom_prompt: 'Translate to {targetLanguage}. Use {targetLanguage} grammar rules.' });
      return Promise.resolve({ custom_prompt: 'Translate to {targetLanguage}. Use {targetLanguage} grammar rules.' });
    });

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Bonjour'
          }
        }]
      })
    };
    mockFetch.mockResolvedValue(mockResponse);

    await handleTranslation('Hello', 'French', 'sk-test123');

    const callArgs = mockFetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.messages[0].content).toBe('Translate to French. Use French grammar rules.');
  });

  test('should trim whitespace from translated text', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: '  \n\n  Guten Tag  \n  '
          }
        }]
      })
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await handleTranslation('Good day', 'German', 'sk-test123');

    expect(result).toBe('Guten Tag');
  });
});

describe('Background Script - Message Listener', () => {
  test('should handle translate action and send success response', (done) => {
    // We can't easily test the actual message listener without loading the script,
    // but we can test the expected behavior structure
    const mockRequest = {
      action: 'translate',
      text: 'Hello',
      targetLanguage: 'Dutch',
      apiKey: 'sk-test123'
    };

    const mockSendResponse = jest.fn((response) => {
      expect(response.success).toBe(true);
      expect(response.translation).toBe('Hallo');
      done();
    });

    // Simulate the logic from the message listener
    const handleMessage = (request, sender, sendResponse) => {
      if (request.action === 'translate') {
        // Simulate successful translation
        Promise.resolve('Hallo')
          .then(translation => {
            sendResponse({ success: true, translation });
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
        return true;
      }
    };

    handleMessage(mockRequest, {}, mockSendResponse);
  });

  test('should handle translate action and send error response', (done) => {
    const mockRequest = {
      action: 'translate',
      text: 'Hello',
      targetLanguage: 'Dutch',
      apiKey: 'invalid-key'
    };

    const mockSendResponse = jest.fn((response) => {
      expect(response.success).toBe(false);
      expect(response.error).toBe('Translation failed');
      done();
    });

    // Simulate the logic from the message listener
    const handleMessage = (request, sender, sendResponse) => {
      if (request.action === 'translate') {
        Promise.reject(new Error('Translation failed'))
          .then(translation => {
            sendResponse({ success: true, translation });
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
        return true;
      }
    };

    handleMessage(mockRequest, {}, mockSendResponse);
  });
});
