// Handles UI and storage for model API key and model selection

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('container');
    
    // Check if API key exists
    chrome.storage.sync.get(['modelApiKey', 'modelName'], (result) => {
        if (!result.modelApiKey) {
            renderApiKeyForm(container);
        } else {
            renderApiKeyInfo(container, result.modelApiKey, result.modelName);
        }
    });
});

function renderApiKeyForm(container) {
    container.innerHTML = `
        <h2>Setup Model API Key</h2>
        <label for="model-select">Select Model:</label>
        <select id="model-select">
            <option value="gemini-2.5-flask">gemini-2.5-flask</option>
            <option value="gpt-4">GPT-4</option>
            <option value="llama-2">Llama 2</option>
        </select>
        <br><br>
        <label for="api-key">API Key:</label>
        <input type="text" id="api-key" placeholder="Enter your API key" style="width: 250px;" />
        <br><br>
        <button id="save-btn">Save</button>
        <div id="save-status" style="margin-top:10px;color:green;"></div>
    `;
    document.getElementById('save-btn').onclick = () => {
        const apiKey = document.getElementById('api-key').value.trim();
        const modelName = document.getElementById('model-select').value;
        if (!apiKey) {
            document.getElementById('save-status').textContent = 'API key is required!';
            document.getElementById('save-status').style.color = 'red';
            return;
        }
        chrome.storage.sync.set({ modelApiKey: apiKey, modelName: modelName }, () => {
            document.getElementById('save-status').textContent = 'Saved! Redirecting...';
            document.getElementById('save-status').style.color = 'green';
            setTimeout(() => {
                window.location.href = 'popup.html';
            }, 800);
        });
    };
}

function renderApiKeyInfo(container, apiKey, modelName) {
    container.innerHTML = `
        <h2>Model API Key Saved</h2>
        <p><b>Model:</b> ${modelName || 'Not set'}</p>
        <p><b>API Key:</b> <span style="font-family:monospace;">${apiKey.replace(/.(?=.{4})/g, '*')}</span></p>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button id="edit-btn">Edit</button>
            <button id="reset-btn" style="background-color: #dc3545;">Reset</button>
        </div>
        <div id="reset-status" style="margin-top:10px;"></div>
    `;
    document.getElementById('edit-btn').onclick = () => {
        renderApiKeyForm(container);
    };
    
    document.getElementById('reset-btn').onclick = () => {
        const resetStatus = document.getElementById('reset-status');
        if (confirm('Are you sure you want to reset your API key? This will remove the saved key.')) {
            chrome.storage.sync.remove(['modelApiKey', 'modelName'], () => {
                resetStatus.textContent = 'API key reset successfully! Redirecting...';
                resetStatus.style.color = 'green';
                setTimeout(() => {
                    renderApiKeyForm(container);
                }, 1000);
            });
        }
    };
}
