document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('styleToggle');
    
    // Load initial state
    chrome.storage.local.get(['isEnabled'], function(result) {
        toggle.checked = result.isEnabled || false;
    });

    toggle.addEventListener('change', async function() {
        const isEnabled = toggle.checked;
        
        try {
            // Save state
            await chrome.storage.local.set({ isEnabled: isEnabled });
            
            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab) {
                try {
                    // Try to send message to content script
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'toggleStyle',
                        isEnabled: isEnabled
                    });
                } catch (error) {
                    // If content script isn't loaded, inject it
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['scripts/content.js']
                    });
                    
                    // Try sending message again
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'toggleStyle',
                        isEnabled: isEnabled
                    });
                }
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });
});