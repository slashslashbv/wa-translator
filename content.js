console.log('WhatsApp Translator content script loaded!');

class WhatsAppTranslator {
  constructor() {
		console.log('WhatsAppTranslator constructor STARTED')
    this.init();
  }

  init() {
    this.waitForWhatsAppLoad();
  }

  waitForWhatsAppLoad() {
    const checkInterval = setInterval(() => {
      const messageContainer = document.getElementById('main');
      if (messageContainer) {
        //clearInterval(checkInterval);
        this.setupMessageObserver();
        this.addTranslateButtons();
        this.setupInputTranslation();
      }
    }, 5000);
  }

  setupMessageObserver() {
		console.log('Setting up message observer...');
    const messageContainer = document.querySelector('[role="application"]');
    if (!messageContainer) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          setTimeout(() => this.addTranslateButtons(), 500);
        }
      });
    });

    observer.observe(messageContainer, {
      childList: true,
      subtree: true
    });
  }

  addTranslateButtons() {
		console.log('Adding translate buttons to messages...');
    const messages = document.querySelectorAll('._amjv')

    messages.forEach((message) => {
      if (message.querySelector('.translate-btn')) return;

      const textElement = message.querySelector('.copyable-text');

			let canTranslate = false;

			try {
				canTranslate = !(!textElement || !textElement.textContent.trim())
			} catch (e) {
				//
			}


			if (!canTranslate) return false;

      const translateBtn = document.createElement('button');
      translateBtn.className = 'translate-btn';
      translateBtn.innerHTML = '🌐';
      translateBtn.title = 'Vertaal bericht';
      translateBtn.style.cssText = `
        position: absolute;
        top: 5px;
        right: -40px;
        background: #25d366;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        cursor: pointer;
        font-size: 12px;
        z-index: 1000;
        opacity: 0.7;
        transition: opacity 0.2s;
      `;

      translateBtn.addEventListener('mouseenter', () => {
        translateBtn.style.opacity = '1';
      });

      translateBtn.addEventListener('mouseleave', () => {
        translateBtn.style.opacity = '0.7';
      });

      translateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.translateMessage(textElement, translateBtn);
      });

      const messageContent = message.querySelector('.copyable-text');
      if (messageContent) {
        messageContent.style.position = 'relative';
        messageContent.appendChild(translateBtn);
      }
    });
  }

  async translateMessage(textElement, button) {
    const originalText = textElement.textContent.trim();
    if (!originalText) return;

    button.innerHTML = '⏳';
    button.disabled = true;

    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        alert('Stel eerst je OpenAI API key in via de extensie popup');
        return;
      }

      const targetLanguage = 'Nederlands'
      console.log('Content: Translating to', targetLanguage);
      const translatedText = await this.callChatGPT(originalText, targetLanguage, apiKey);

      this.showTranslation(textElement, originalText, translatedText);

    } catch (error) {
      console.error('Vertaling mislukt:', error);
      alert('Vertaling mislukt. Controleer je API key en internetverbinding.');
    } finally {
      button.innerHTML = '🌐';
      button.disabled = false;
    }
  }

  parseHTMLToText(html) {
    return html
      .replace(/<p[^>]*>/g, '')  // Verwijder opening <p> tags
      .replace(/<\/p>/g, '\n') // Vervang closing </p> tags door dubbele newlines
      .replace(/<br\s*\/?>/g, '\n') // Vervang <br> tags door enkele newlines
      .replace(/<[^>]+>/g, '')   // Verwijder alle overige HTML tags
      .replace(/\n{3,}/g, '\n\n')  // Vervang 3 of meer newlines door 2 newlines
      .trim();
  }

  async callChatGPT(text, targetLanguage, apiKey) {
    // Use chrome.runtime.sendMessage to call background script
    // This avoids CORS issues
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

  showTranslation(textElement, originalText, translatedText) {
    const existingTranslation = textElement.parentElement.querySelector('.translation-container');
    if (existingTranslation) {
      existingTranslation.remove();
    }

    const translationContainer = document.createElement('div');
    translationContainer.className = 'translation-container';
    translationContainer.style.cssText = `
      margin-top: 8px;
      padding: 8px;
      background: #f0f0f0;
      border-radius: 8px;
      border-left: 3px solid #25d366;
      font-style: italic;
      font-size: 14px;
      color: #333;
    `;

    const translationText = document.createElement('div');
    translationText.innerHTML = `<strong>Vertaling:</strong> ${translatedText}`;

    translationContainer.appendChild(translationText);
    textElement.parentElement.appendChild(translationContainer);
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

  setupInputTranslation() {
    console.log('Setting up input translation...');

    const checkInputInterval = setInterval(() => {
      const footer = document.querySelector('footer');
      const inputWrapper = footer?.querySelector('[contenteditable="true"]')?.parentElement?.parentElement;

      if (inputWrapper && !inputWrapper.querySelector('.input-translate-btn')) {
        clearInterval(checkInputInterval);

        // Create language selector
        const languageSelector = document.createElement('select');
        languageSelector.className = 'input-language-selector';
        languageSelector.style.cssText = `
          position: absolute;
          right: 90px;
          top: 50%;
          transform: translateY(-50%);
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 14px;
          cursor: pointer;
          z-index: 1000;
          display: none;
          width: 130px;
        `;

        const languages = [
          { value: 'Nederlands', label: 'Nederlands' },
          { value: 'Engels', label: 'Engels' },
          { value: 'Duits', label: 'Duits' },
          { value: 'Frans', label: 'Frans' },
          { value: 'Spaans', label: 'Spaans' },
          { value: 'Italiaans', label: 'Italiaans' },
          { value: 'Portugees', label: 'Portugees' },
          { value: 'Pools', label: 'Pools' },
          { value: 'Roemeens', label: 'Roemeens' },
          { value: 'Russisch', label: 'Russisch' },
          { value: 'Turks', label: 'Turks' },
          { value: 'Arabisch', label: 'Arabisch' },
          { value: 'Chinees', label: 'Chinees' },
          { value: 'Japans', label: 'Japans' }
        ];

        languages.forEach(lang => {
          const option = document.createElement('option');
          option.value = lang.value;
          option.textContent = lang.label;
          languageSelector.appendChild(option);
        });

        // Set default to Engels
        languageSelector.value = 'Engels';

        const translateInputBtn = document.createElement('button');
        translateInputBtn.className = 'input-translate-btn';
        translateInputBtn.innerHTML = '🌐';
        translateInputBtn.title = 'Vertaal tekst';
        translateInputBtn.style.cssText = `
          position: absolute;
          right: 50px;
          top: 50%;
          transform: translateY(-50%);
          background: #25d366;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 16px;
          z-index: 1000;
          opacity: 0.7;
          transition: opacity 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        translateInputBtn.addEventListener('mouseenter', () => {
          translateInputBtn.style.opacity = '1';
        });

        translateInputBtn.addEventListener('mouseleave', () => {
          translateInputBtn.style.opacity = '0.7';
        });

        translateInputBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const selectedLanguage = languageSelector.value;
          await this.translateInput(selectedLanguage);
        });

        inputWrapper.style.position = 'relative';
        inputWrapper.appendChild(languageSelector);
        inputWrapper.appendChild(translateInputBtn);

        this.observeInputChanges();
      }
    }, 1000);
  }

  observeInputChanges() {
    const footer = document.querySelector('footer');
    const inputField = footer?.querySelector('[contenteditable="true"]');

    if (!inputField) return;

    const observer = new MutationObserver(() => {
      const translateBtn = footer.querySelector('.input-translate-btn');
      const languageSelector = footer.querySelector('.input-language-selector');
      if (translateBtn && languageSelector) {
        const hasText = inputField.textContent.trim().length > 0;
        translateBtn.style.display = hasText ? 'flex' : 'none';
        languageSelector.style.display = hasText ? 'block' : 'none';
      }
    });

    observer.observe(inputField, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  async translateInput(targetLanguage) {
    const footer = document.querySelector('footer');
    const inputField = footer?.querySelector('[contenteditable="true"]');

		console.log('inputFieldinputFieldinputField', inputField)
    const translateBtn = footer?.querySelector('.input-translate-btn');


		console.log(inputField)
    if (!inputField) return;

    const originalText = inputField.innerHTML.trim();
    if (!originalText) {
			console.log('originalText', originalText)
			return
		};

		console.log(originalText)

    translateBtn.innerHTML = '⏳';
    translateBtn.disabled = true;

    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        alert('Stel eerst je OpenAI API key in via de extensie popup');
        translateBtn.innerHTML = '🌐';
        translateBtn.disabled = false;
        return;
      }

      // Show popup with selected language
      this.showInputTranslationPopup(originalText, targetLanguage, apiKey);

    } catch (error) {
      console.error('Vertaling mislukt:', error);
      alert('Vertaling mislukt. Controleer je API key en internetverbinding.');
    } finally {
      translateBtn.innerHTML = '🌐';
      translateBtn.disabled = false;
    }
  }

  showInputTranslationPopup(originalText, targetLanguage, apiKey) {
    // Remove existing popup if any
    const existingPopup = document.querySelector('.translation-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'translation-popup';
    popup.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 20px;
      width: 350px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Header with close button
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Tekst vertalen';
    title.style.cssText = `
      margin: 0;
      font-size: 16px;
      color: #333;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 24px;
      height: 24px;
    `;
    closeBtn.addEventListener('click', () => popup.remove());

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Language selector
    const languageSection = document.createElement('div');
    languageSection.style.cssText = `
      margin-bottom: 15px;
    `;

    const languageLabel = document.createElement('label');
    languageLabel.textContent = 'Vertaal naar:';
    languageLabel.style.cssText = `
      display: block;
      margin-bottom: 5px;
      font-size: 14px;
      color: #666;
    `;

    const languageSelector = document.createElement('select');
    languageSelector.style.cssText = `
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      color: #000;
    `;

    const languages = [
      { value: 'Engels', label: 'Engels' },
      { value: 'Duits', label: 'Duits' },
      { value: 'Frans', label: 'Frans' },
			{ value: "Bulgaars", label: 'Bulgaars' },
      { value: 'Spaans', label: 'Spaans' },
      { value: 'Italiaans', label: 'Italiaans' },
      { value: 'Portugees', label: 'Portugees' },
      { value: 'Pools', label: 'Pools' },
      { value: 'Roemeens', label: 'Roemeens' },
      { value: 'Russisch', label: 'Russisch' },
      { value: 'Turks', label: 'Turks' },
      { value: 'Arabisch', label: 'Arabisch' },
      { value: 'Chinees', label: 'Chinees' },
      { value: 'Japans', label: 'Japans' }
    ];

    languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang.value;
      option.textContent = lang.label;
      languageSelector.appendChild(option);
    });

    // Set to the selected language from input
    languageSelector.value = targetLanguage;

    languageSection.appendChild(languageLabel);
    languageSection.appendChild(languageSelector);

    // Translation content with loading message
    const translationDiv = document.createElement('div');
    translationDiv.style.cssText = `
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 15px;
      word-wrap: break-word;
      user-select: text;
      cursor: text;
      min-height: 50px;
      color: #000;
      white-space: break-spaces;

    `;
    translationDiv.textContent = 'Bezig met vertalen...';

    // Translate button (hidden initially while translating)
    const translateBtn = document.createElement('button');
    translateBtn.textContent = 'Opnieuw vertalen';
    translateBtn.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #25d366;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 500;
      margin-bottom: 15px;
      display: none;
    `;

    // Copy button (initially hidden)
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Kopieer vertaling';
    copyBtn.style.cssText = `
      width: 100%;
      padding: 10px;
      background: #25d366;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 500;
      display: none;
    `;

    // Handle translation
    translateBtn.addEventListener('click', async () => {
      const targetLanguage = languageSelector.value;
      translateBtn.textContent = 'Bezig met vertalen...';
      translateBtn.disabled = true;

      try {

				console.log(originalText,'originalText')
        // Parse HTML to clean text for translation
        const cleanText = this.parseHTMLToText(originalText);
        const translatedText = await this.callChatGPT(cleanText, targetLanguage, apiKey);

        // Show translation as text
        translationDiv.textContent = translatedText;
        translationDiv.style.display = 'block';

        // Show copy button
        copyBtn.style.display = 'block';

        // Update translate button
        translateBtn.textContent = 'Opnieuw vertalen';
        translateBtn.disabled = false;

        // Copy button functionality
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(translatedText);
            copyBtn.textContent = '✓ Gekopieerd!';
            copyBtn.style.background = '#128C7E';
            setTimeout(() => {
              copyBtn.textContent = 'Kopieer vertaling';
              copyBtn.style.background = '#25d366';
            }, 2000);
          } catch (err) {
            console.error('Kopiëren mislukt:', err);
            alert('Kopiëren mislukt. Selecteer de tekst handmatig.');
          }
        };
      } catch (error) {
        console.error('Vertaling mislukt:', error);
        alert('Vertaling mislukt. Controleer je API key en internetverbinding.');
        translateBtn.textContent = 'Vertaal';
        translateBtn.disabled = false;
      }
    });

    // Original text (collapsible)
    const originalSection = document.createElement('details');
    originalSection.style.cssText = `
      margin-top: 15px;
      font-size: 14px;
      color: #666;
    `;

    const summary = document.createElement('summary');
    summary.textContent = 'Originele tekst';
    summary.style.cssText = `
      cursor: pointer;
      font-weight: 500;
      margin-bottom: 8px;
    `;

    const originalDiv = document.createElement('div');
    originalDiv.style.cssText = `
      background: #f8f9fa;
      border-radius: 8px;
      padding: 12px;
      margin-top: 8px;
      word-wrap: break-word;
      user-select: text;
      cursor: text;
    `;
    originalDiv.innerHTML = originalText;

    originalSection.appendChild(summary);
    originalSection.appendChild(originalDiv);

    // Assemble popup
    popup.appendChild(header);
    popup.appendChild(languageSection);
    popup.appendChild(translationDiv);
    popup.appendChild(translateBtn);
    popup.appendChild(copyBtn);
    popup.appendChild(originalSection);

    // Add to page
    document.body.appendChild(popup);

    // Automatically start translation
    (async () => {
      try {
        // Parse HTML to clean text for translation
        const cleanText = this.parseHTMLToText(originalText);
        const translatedText = await this.callChatGPT(cleanText, targetLanguage, apiKey);

        // Show translation as text
        translationDiv.textContent = translatedText;

        // Show buttons
        translateBtn.style.display = 'block';
        copyBtn.style.display = 'block';

        // Copy button functionality
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(translatedText);
            copyBtn.textContent = '✓ Gekopieerd!';
            copyBtn.style.background = '#128C7E';
            setTimeout(() => {
              copyBtn.textContent = 'Kopieer vertaling';
              copyBtn.style.background = '#25d366';
            }, 2000);
          } catch (err) {
            console.error('Kopiëren mislukt:', err);
            alert('Kopiëren mislukt. Selecteer de tekst handmatig.');
          }
        };
      } catch (error) {
        console.error('Vertaling mislukt:', error);
        translationDiv.textContent = 'Vertaling mislukt. Controleer je API key.';
        translateBtn.style.display = 'block';
        translateBtn.textContent = 'Opnieuw proberen';
      }
    })();

    // Auto-remove after 60 seconds
    setTimeout(() => {
      if (popup.parentElement) {
        popup.remove();
      }
    }, 60000);
  }
}

new WhatsAppTranslator();
