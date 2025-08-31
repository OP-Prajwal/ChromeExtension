// Enhanced chatbot UI logic with improved API integration and response handling
const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
let selectedTabs = [];
let apiKey = '';

// Get selected tabs and API key from storage when chat opens
chrome.storage.sync.get(['modelApiKey'], (result) => {
    apiKey = result.modelApiKey || '';
});

chrome.storage.local.get(['selectedTabs'], (result) => {
    selectedTabs = result.selectedTabs || [];
    console.log('Retrieved tabs from storage:', selectedTabs);
    if (selectedTabs.length > 0) {
        appendMessage(`I'm ready to help you with your selected tabs:\n${selectedTabs.map(tab => '• ' + tab.title).join('\n')}`, 'bot');
    }
});

// Helper function to clean markdown formatting
function cleanMarkdown(text) {
    if (!text || typeof text !== 'string') return text;
    
    return text
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/`([^`]+)`/g, '$1') // Remove inline code formatting
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
        .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
        .replace(/#{1,6}\s*/g, '') // Remove headers
        .trim();
}

// Helper function to safely get nested object values
function safeGet(obj, path, defaultValue = '') {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : defaultValue;
    }, obj);
}

// Helper function to validate and structure response data
function validateResponse(data) {
    console.log('Raw response data:', data);
    
    // If it's a simple string response
    if (typeof data === 'string') {
        return { type: 'natural', content: data };
    }
    
    // If it's already a structured object
    if (data && typeof data === 'object') {
        // Check if it's a natural response format
        if (data.type === 'natural' && data.content) {
            return { type: 'natural', content: data.content };
        }
        
        // Check if it has structured format
        if (data.type === 'structured' || data.main_points || data.details || data.summary) {
            return { type: 'structured', content: data };
        }
        
        // Check if content is wrapped
        if (data.content && typeof data.content === 'string') {
            return { type: 'natural', content: data.content };
        }
        
        // Legacy: Check if it's wrapped in another object
        if (data.response && typeof data.response === 'object') {
            return validateResponse(data.response);
        }
        
        // Fallback: treat as natural text
        return { type: 'natural', content: JSON.stringify(data, null, 2) };
    }
    
    return { type: 'natural', content: 'No response received' };
}

function appendMessage(content, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg ' + sender;

    if (sender === 'user') {
        msgDiv.textContent = content;
    } else {
        const validatedResponse = validateResponse(content);
        
        if (validatedResponse.type === 'structured') {
            renderStructuredResponse(msgDiv, validatedResponse.content);
        } else {
            // Natural response - preserve line breaks and formatting
            const naturalContent = cleanMarkdown(validatedResponse.content);
            msgDiv.innerHTML = naturalContent.replace(/\n/g, '<br>');
            msgDiv.classList.add('natural-response');
        }
    }

    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function renderStructuredResponse(msgDiv, response) {
    let html = '';
    
    try {
        // Main Points Section
        const mainPoints = safeGet(response, 'main_points', []);
        if (Array.isArray(mainPoints) && mainPoints.length > 0) {
            html += '<div class="response-section main-points">';
            html += '<h3>📌 Key Points</h3><ul>';
            mainPoints.forEach(point => {
                const cleanPoint = cleanMarkdown(point);
                if (cleanPoint) {
                    html += `<li>${cleanPoint}</li>`;
                }
            });
            html += '</ul></div>';
        }

        // Details Section
        const details = safeGet(response, 'details', {});
        if (details && typeof details === 'object') {
            
            // Key Findings
            const keyFindings = safeGet(details, 'key_findings', []);
            if (Array.isArray(keyFindings) && keyFindings.length > 0) {
                html += '<div class="response-section findings">';
                html += '<h3>🔍 Key Findings</h3><ul>';
                keyFindings.forEach(finding => {
                    const cleanFinding = cleanMarkdown(finding);
                    if (cleanFinding) {
                        html += `<li>${cleanFinding}</li>`;
                    }
                });
                html += '</ul></div>';
            }

            // Suggestions
            const suggestions = safeGet(details, 'suggestions', []);
            if (Array.isArray(suggestions) && suggestions.length > 0) {
                html += '<div class="response-section suggestions">';
                html += '<h3>💡 Suggestions</h3><ul>';
                suggestions.forEach(suggestion => {
                    const cleanSuggestion = cleanMarkdown(suggestion);
                    if (cleanSuggestion) {
                        html += `<li>${cleanSuggestion}</li>`;
                    }
                });
                html += '</ul></div>';
            }

            // References
            const references = safeGet(details, 'references', []);
            if (Array.isArray(references) && references.length > 0) {
                html += '<div class="response-section references">';
                html += '<h3>🔗 References</h3><ul>';
                references.forEach(reference => {
                    const cleanRef = cleanMarkdown(reference);
                    if (cleanRef) {
                        // Check if it's a URL
                        if (cleanRef.match(/^https?:\/\//)) {
                            html += `<li><a href="${cleanRef}" target="_blank" rel="noopener">${cleanRef}</a></li>`;
                        } else {
                            html += `<li>${cleanRef}</li>`;
                        }
                    }
                });
                html += '</ul></div>';
            }
            
            // Additional details (catch-all for other properties)
            Object.keys(details).forEach(key => {
                if (!['key_findings', 'suggestions', 'references'].includes(key)) {
                    const value = details[key];
                    if (Array.isArray(value) && value.length > 0) {
                        const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        html += `<div class="response-section ${key}">`;
                        html += `<h3>📋 ${title}</h3><ul>`;
                        value.forEach(item => {
                            const cleanItem = cleanMarkdown(item);
                            if (cleanItem) {
                                html += `<li>${cleanItem}</li>`;
                            }
                        });
                        html += '</ul></div>';
                    }
                }
            });
        }

        // Summary Section
        const summary = safeGet(response, 'summary', '');
        if (summary && typeof summary === 'string') {
            const cleanSummary = cleanMarkdown(summary);
            if (cleanSummary) {
                html += '<div class="response-section summary">';
                html += '<h3>📝 Summary</h3>';
                html += `<p>${cleanSummary}</p></div>`;
            }
        }

        // If no structured content was found, display as plain text
        if (!html.trim()) {
            msgDiv.textContent = cleanMarkdown(JSON.stringify(response, null, 2));
        } else {
            msgDiv.innerHTML = html;
        }
        
    } catch (error) {
        console.error('Error rendering structured response:', error);
        msgDiv.textContent = 'Error displaying response. Raw data: ' + JSON.stringify(response);
    }
}

// Generate a unique ID for this chat session
const chatSessionId = Date.now().toString();

sendBtn.onclick = async () => {
    const text = userInput.value.trim();
    if (!text) return;
    
    appendMessage(text, 'user');
    userInput.value = '';
    
    // Show typing indicator
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'msg bot typing-indicator';
    loadingMsg.innerHTML = '<span>Thinking</span><span class="dots"><span>.</span><span>.</span><span>.</span></span>';
    messagesDiv.appendChild(loadingMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    try {
        // Prepare query parameters
        const queryParams = new URLSearchParams({
            message: text,
            tabs: JSON.stringify(selectedTabs),
            api_key: apiKey,
            tab_id: chatSessionId
        });
        
        console.log('Sending to backend with session:', chatSessionId);
        console.log('Query params:', queryParams.toString());
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(`http://localhost:5000/chat?${queryParams.toString()}`, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Backend response:', data);
        
        // Remove loading indicator
        if (messagesDiv.contains(loadingMsg)) {
            messagesDiv.removeChild(loadingMsg);
        }
        
        if (data.success) {
            appendMessage(data.response, 'bot');
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
        
    } catch (error) {
        console.error('Chat error:', error);
        
        // Remove loading indicator if still present
        if (messagesDiv.contains(loadingMsg)) {
            messagesDiv.removeChild(loadingMsg);
        }
        
        let errorMessage = 'Sorry, there was an error: ';
        
        if (error.name === 'AbortError') {
            errorMessage += 'Request timed out. Please try again.';
        } else if (error.message.includes('fetch')) {
            errorMessage += 'Could not connect to the server. Please check if the backend is running.';
        } else {
            errorMessage += error.message;
        }
        
        appendMessage(errorMessage, 'bot');
    }
};

// Enhanced keyboard handling
userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

// Auto-resize textarea
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Focus input on load
window.addEventListener('load', () => {
    userInput.focus();
});

// Debug function to test response structure
window.testResponse = function(mockResponse) {
    console.log('Testing response structure:', mockResponse);
    appendMessage(mockResponse, 'bot');
};