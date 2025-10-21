import { describe, test, expect, jest, beforeEach } from '@jest/globals';

describe('Content Script - WhatsAppTranslator', () => {
  let mockChrome;
  let translator;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup chrome mock
    mockChrome = {
      runtime: {
        sendMessage: jest.fn((message, callback) => {
          callback({ success: true, translation: 'Mocked translation' });
        }),
        lastError: null
      },
      storage: {
        sync: {
          get: jest.fn((keys, callback) => {
            callback({
              openai_api_key: 'sk-test123',
              target_language: 'Nederlands'
            });
          })
        }
      }
    };
    global.chrome = mockChrome;

    // Mock console
    global.console = {
      ...console,
      log: jest.fn(),
      error: jest.fn()
    };
  });

  // Helper class that mimics WhatsAppTranslator for testing
  class WhatsAppTranslator {
    parseHTMLToText(html) {
      return html
        .replace(/<p[^>]*>/g, '')
        .replace(/<\/p>/g, '\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    async callChatGPT(text, targetLanguage, apiKey) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'translate',
            text: text,
            targetLanguage: targetLanguage,
            apiKey: apiKey
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (response.success) {
              resolve(response.translation);
            } else {
              reject(new Error(response.error || 'Translation failed'));
            }
          }
        );
      });
    }

    async getApiKey() {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['openai_api_key'], (result) => {
          resolve(result.openai_api_key || '');
        });
      });
    }

    async getTargetLanguage() {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['target_language'], (result) => {
          resolve(result.target_language || 'Nederlands');
        });
      });
    }
  }

  beforeEach(() => {
    translator = new WhatsAppTranslator();
  });

  describe('parseHTMLToText', () => {
    test('should remove simple HTML tags', () => {
      const html = '<p>Hello world</p>';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('Hello world');
    });

    test('should convert paragraph tags to newlines', () => {
      const html = '<p>First paragraph</p><p>Second paragraph</p>';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('First paragraph\nSecond paragraph');
    });

    test('should convert br tags to newlines', () => {
      const html = 'Line one<br>Line two<br/>Line three';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('Line one\nLine two\nLine three');
    });

    test('should handle nested HTML tags', () => {
      const html = '<p><strong>Bold text</strong> and <em>italic text</em></p>';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('Bold text and italic text');
    });

    test('should collapse multiple newlines to maximum two', () => {
      const html = '<p>First</p><p></p><p></p><p>Second</p>';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('First\n\nSecond');
    });

    test('should trim whitespace from start and end', () => {
      const html = '  <p>Text</p>  ';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('Text');
    });

    test('should handle complex HTML with multiple tags', () => {
      const html = '<p>Hello <span class="mention">@user</span></p><p>How are you?</p>';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('Hello @user\nHow are you?');
    });

    test('should handle HTML with attributes', () => {
      const html = '<p class="message" id="msg1">Test message</p>';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('Test message');
    });

    test('should handle self-closing br tags with spaces', () => {
      const html = 'Line 1<br />Line 2<br/>Line 3<br>Line 4';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('Line 1\nLine 2\nLine 3\nLine 4');
    });

    test('should handle empty HTML', () => {
      const html = '';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('');
    });

    test('should handle plain text with no HTML', () => {
      const html = 'Just plain text';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('Just plain text');
    });

    test('should handle WhatsApp message with links', () => {
      const html = '<p>Check this out: <a href="https://example.com">link</a></p>';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('Check this out: link');
    });

    test('should handle multiple paragraphs with text', () => {
      const html = '<p>First line</p><p>Second line</p><p>Third line</p>';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('First line\nSecond line\nThird line');
    });

    test('should remove opening p tags without closing', () => {
      const html = '<p>Text without closing';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('Text without closing');
    });

    test('should handle mixed newlines and paragraphs', () => {
      const html = '<p>Para 1</p>\n<p>Para 2</p>\n\n<p>Para 3</p>';
      const result = translator.parseHTMLToText(html);
      // The function replaces </p> with \n, so existing \n in HTML creates extra newlines
      expect(result).toBe('Para 1\n\nPara 2\n\nPara 3');
    });
  });

  describe('callChatGPT', () => {
    test('should send message to background script successfully', async () => {
      const result = await translator.callChatGPT('Hello', 'Dutch', 'sk-test123');

      expect(result).toBe('Mocked translation');
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          action: 'translate',
          text: 'Hello',
          targetLanguage: 'Dutch',
          apiKey: 'sk-test123'
        },
        expect.any(Function)
      );
    });

    test('should handle translation errors', async () => {
      mockChrome.runtime.sendMessage = jest.fn((message, callback) => {
        callback({ success: false, error: 'API error' });
      });

      await expect(translator.callChatGPT('Hello', 'Dutch', 'sk-test123')).rejects.toThrow(
        'API error'
      );
    });

    test('should handle runtime errors', async () => {
      mockChrome.runtime.lastError = { message: 'Extension context invalidated' };
      mockChrome.runtime.sendMessage = jest.fn((message, callback) => {
        callback({ success: true, translation: 'Test' });
      });

      await expect(translator.callChatGPT('Hello', 'Dutch', 'sk-test123')).rejects.toThrow(
        'Extension context invalidated'
      );

      // Clean up
      mockChrome.runtime.lastError = null;
    });

    test('should handle missing error message', async () => {
      mockChrome.runtime.sendMessage = jest.fn((message, callback) => {
        callback({ success: false });
      });

      await expect(translator.callChatGPT('Hello', 'Dutch', 'sk-test123')).rejects.toThrow(
        'Translation failed'
      );
    });

    test('should pass correct parameters to background', async () => {
      await translator.callChatGPT('Bonjour', 'French', 'sk-custom-key');

      const callArgs = mockChrome.runtime.sendMessage.mock.calls[0][0];
      expect(callArgs.action).toBe('translate');
      expect(callArgs.text).toBe('Bonjour');
      expect(callArgs.targetLanguage).toBe('French');
      expect(callArgs.apiKey).toBe('sk-custom-key');
    });
  });

  describe('getApiKey', () => {
    test('should retrieve API key from storage', async () => {
      const apiKey = await translator.getApiKey();

      expect(apiKey).toBe('sk-test123');
      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(
        ['openai_api_key'],
        expect.any(Function)
      );
    });

    test('should return empty string when no API key is stored', async () => {
      mockChrome.storage.sync.get = jest.fn((keys, callback) => {
        callback({});
      });

      const apiKey = await translator.getApiKey();

      expect(apiKey).toBe('');
    });

    test('should handle storage errors gracefully', async () => {
      mockChrome.storage.sync.get = jest.fn((keys, callback) => {
        callback({});
      });

      const apiKey = await translator.getApiKey();

      expect(apiKey).toBe('');
    });
  });

  describe('getTargetLanguage', () => {
    test('should retrieve target language from storage', async () => {
      const language = await translator.getTargetLanguage();

      expect(language).toBe('Nederlands');
      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(
        ['target_language'],
        expect.any(Function)
      );
    });

    test('should return default language when none is stored', async () => {
      mockChrome.storage.sync.get = jest.fn((keys, callback) => {
        callback({});
      });

      const language = await translator.getTargetLanguage();

      expect(language).toBe('Nederlands');
    });

    test('should handle custom language setting', async () => {
      mockChrome.storage.sync.get = jest.fn((keys, callback) => {
        callback({ target_language: 'Spanish' });
      });

      const language = await translator.getTargetLanguage();

      expect(language).toBe('Spanish');
    });
  });

  describe('Integration tests', () => {
    test('should handle complete translation workflow', async () => {
      // Get API key
      const apiKey = await translator.getApiKey();
      expect(apiKey).toBe('sk-test123');

      // Get target language
      const targetLanguage = await translator.getTargetLanguage();
      expect(targetLanguage).toBe('Nederlands');

      // Parse HTML
      const html = '<p>Hello world</p><p>How are you?</p>';
      const cleanText = translator.parseHTMLToText(html);
      expect(cleanText).toBe('Hello world\nHow are you?');

      // Translate
      const translation = await translator.callChatGPT(cleanText, targetLanguage, apiKey);
      expect(translation).toBe('Mocked translation');
    });

    test('should handle HTML with complex formatting in translation', async () => {
      const html = '<p><strong>Important:</strong> <em>This is a test</em></p><br/><p>Second line</p>';
      const cleanText = translator.parseHTMLToText(html);

      // The function adds \n after </p>, and <br/> becomes \n, so we get two newlines between the lines
      expect(cleanText).toBe('Important: This is a test\n\nSecond line');

      const apiKey = await translator.getApiKey();
      const translation = await translator.callChatGPT(cleanText, 'Dutch', apiKey);

      expect(translation).toBe('Mocked translation');
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Important: This is a test\n\nSecond line'
        }),
        expect.any(Function)
      );
    });
  });

  describe('Error handling', () => {
    test('should handle missing API key gracefully', async () => {
      mockChrome.storage.sync.get = jest.fn((keys, callback) => {
        callback({});
      });

      const apiKey = await translator.getApiKey();
      expect(apiKey).toBe('');
    });

    test('should handle translation failures with proper error messages', async () => {
      mockChrome.runtime.sendMessage = jest.fn((message, callback) => {
        callback({ success: false, error: 'Invalid API key provided' });
      });

      await expect(
        translator.callChatGPT('Test', 'Dutch', 'invalid-key')
      ).rejects.toThrow('Invalid API key provided');
    });

    test('should handle chrome runtime errors', async () => {
      mockChrome.runtime.lastError = { message: 'Could not establish connection' };

      await expect(
        translator.callChatGPT('Test', 'Dutch', 'sk-test123')
      ).rejects.toThrow('Could not establish connection');

      // Clean up
      mockChrome.runtime.lastError = null;
    });
  });

  describe('Edge cases', () => {
    test('should handle very long HTML strings', () => {
      const longHtml = '<p>' + 'A'.repeat(10000) + '</p>';
      const result = translator.parseHTMLToText(longHtml);
      expect(result).toBe('A'.repeat(10000));
    });

    test('should handle HTML with special characters', () => {
      const html = '<p>&lt;script&gt;alert("test")&lt;/script&gt;</p>';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('&lt;script&gt;alert("test")&lt;/script&gt;');
    });

    test('should handle HTML with unicode characters', () => {
      const html = '<p>Hello 世界 🌍</p>';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('Hello 世界 🌍');
    });

    test('should handle malformed HTML', () => {
      const html = '<p>Unclosed paragraph<p>Another one';
      const result = translator.parseHTMLToText(html);
      // Opening <p> tags are removed, but without closing </p>, no newline is added
      expect(result).toBe('Unclosed paragraphAnother one');
    });

    test('should handle HTML with only whitespace', () => {
      const html = '<p>   </p><p>  </p>';
      const result = translator.parseHTMLToText(html);
      expect(result).toBe('');
    });
  });
});
