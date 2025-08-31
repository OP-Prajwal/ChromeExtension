// popup.js: Show UI based on whether API key is set

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('popup-container');
    chrome.storage.sync.get(['modelApiKey', 'modelName'], (result) => {
        if (!result.modelApiKey || !result.modelName) {
            container.innerHTML = `
                <div style="padding:16px;">
                    <b>API key or model not set.</b><br>
                    <a href="options.html" target="_blank">Set up now</a>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="padding:16px;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <b>Model:</b> ${result.modelName}<br>
                            <b>API Key:</b> <span style="font-family:monospace;">${result.modelApiKey.replace(/.(?=.{4})/g, '*')}</span>
                        </div>
                        <button id="reset-api-btn" style="background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9em;">Reset API</button>
                    </div>
                    <div id="reset-status" style="color: green; margin-top: 8px; font-size: 0.9em;"></div>
                    <div id="tabs-list" style="margin-top:12px;"></div>
                </div>
            `;
            // Add reset button functionality
            document.getElementById('reset-api-btn').onclick = () => {
                if (confirm('Are you sure you want to reset your API key? This will remove the saved key.')) {
                    chrome.storage.sync.remove(['modelApiKey', 'modelName'], () => {
                        document.getElementById('reset-status').textContent = 'API key reset successfully! Reloading...';
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    });
                }
            };

            // Query and display open tabs
            chrome.tabs.query({}, function(tabs) {
                const tabsList = document.getElementById('tabs-list');
                if (tabs.length === 0) {
                    tabsList.textContent = 'No open tabs found.';
                } else {
                    // Create checkboxes and button
                    let checkHtml = '<b style="font-size:1.1em;">Select Tabs:</b><form id="tab-checkbox-form" style="margin-top:8px;">';
                    tabs.forEach((tab, i) => {
                        checkHtml += `<div style="margin-bottom:6px;">
                            <input type="checkbox" name="tab-checkbox" id="tab-checkbox-${i}" value="${i}">
                            <label for="tab-checkbox-${i}" style="font-size:1.08em;vertical-align:middle;cursor:pointer;">
                                ${tab.title ? tab.title.replace(/</g, '&lt;').replace(/>/g, '&gt;') : tab.url}
                            </label>
                        </div>`;
                    });
                    checkHtml += '</form>';
                    checkHtml += '<button id="go-tab-btn" style="margin-top:8px;font-size:1.08em;">Go</button>';
                    tabsList.innerHTML = checkHtml;
                    document.getElementById('go-tab-btn').onclick = () => {
                        const checkboxes = document.getElementsByName('tab-checkbox');
                        let selectedTabs = [];
                        for (let c of checkboxes) {
                            if (c.checked) {
                                const tab = tabs[Number(c.value)];
                                if (tab && tab.url) {
                                    selectedTabs.push({
                                        url: tab.url,
                                        title: tab.title || ''
                                    });
                                }
                            }
                        }
                        if (selectedTabs.length === 0) return;
                        
                        // Store selected tabs in chrome.storage
                        chrome.storage.local.set({ selectedTabs }, () => {
                            window.open('chatbot.html', '_blank', 
                                'width=400,height=500,resizable=yes,type=popup,status=no,scrollbars=yes');
                            window.close();
                        });
                    };
                }
            });
        }
    });
});
