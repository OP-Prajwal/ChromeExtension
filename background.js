chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(["modelApiKey", "modelName"], (result) => {
        if (!result.modelApiKey || !result.modelName) {
            chrome.tabs.create({ url: "options.html" });
        }
    });
});