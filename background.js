console.log('WhatsApp Translator background script loaded!');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslation(request.text, request.targetLanguage, request.apiKey)
      .then(translation => {
        sendResponse({ success: true, translation });
      })
      .catch(error => {
        console.error('Translation error:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

async function handleTranslation(text, targetLanguage, apiKey) {
  console.log('Background: Translating to', targetLanguage);

  // Get custom prompt from storage
  const storage = await chrome.storage.sync.get(['custom_prompt']);
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

  console.log('Using prompt:', systemPrompt);

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