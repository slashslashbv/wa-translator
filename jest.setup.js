import { jest } from '@jest/globals';

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn((message, callback) => {
      if (callback) callback({ translatedText: 'Mocked translation' });
      return Promise.resolve({ translatedText: 'Mocked translation' });
    }),
    onMessage: {
      addListener: jest.fn()
    },
    lastError: null
  },
  storage: {
    sync: {
      get: jest.fn((keys, callback) => {
        const mockData = {
          openai_api_key: 'sk-test123',
          target_language: 'Dutch',
          custom_prompt: 'Translate the following text to {targetLanguage}:'
        };
        if (callback) callback(mockData);
        return Promise.resolve(mockData);
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      })
    }
  },
  tabs: {
    query: jest.fn((queryInfo, callback) => {
      const mockTabs = [{ id: 1, url: 'https://web.whatsapp.com' }];
      if (callback) callback(mockTabs);
      return Promise.resolve(mockTabs);
    }),
    reload: jest.fn((tabId, callback) => {
      if (callback) callback();
      return Promise.resolve();
    })
  }
};

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      choices: [{
        message: {
          content: 'Mocked translation'
        }
      }]
    })
  })
);
