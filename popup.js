document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('settingsForm');
  const apiKeyInput = document.getElementById('apiKey');
  const targetLanguageSelect = document.getElementById('targetLanguage');
  const customPromptInput = document.getElementById('customPrompt');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

	console.log('Popup script loaded');
  loadSettings();

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    saveSettings();
  });

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

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }
});
