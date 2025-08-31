from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationChain
from langchain.schema import HumanMessage, SystemMessage
import os
import json
import re

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Dictionary to store conversation memory for each tab
tab_memories = {}

def extract_content_from_tabs(selected_tabs):
    """Extract useful context from selected tabs"""
    if not selected_tabs:
        return "No specific tabs are currently selected."
    
    context_parts = []
    for i, tab in enumerate(selected_tabs[:5]):  # Limit to 5 tabs to avoid overwhelming context
        title = tab.get('title', 'Untitled')
        url = tab.get('url', '')
        
        # Extract domain for context
        domain = re.search(r'https?://([^/]+)', url)
        domain_name = domain.group(1) if domain else url
        
        context_parts.append(f"Tab {i+1}: '{title}' from {domain_name}")
    
    return "Currently viewing:\n" + "\n".join(context_parts)

def is_structured_response_needed(message):
    """Determine if the user is asking for structured information"""
    structured_keywords = [
        'summarize', 'summary', 'analyze', 'analysis', 'compare', 'comparison',
        'list', 'points', 'steps', 'recommendations', 'suggestions', 'findings',
        'key points', 'main points', 'overview', 'breakdown', 'explain'
    ]
    
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in structured_keywords)

def format_structured_response(response_text):
    """Try to extract structured information from a natural response"""
    try:
        # Look for numbered or bulleted lists
        lines = response_text.split('\n')
        main_points = []
        suggestions = []
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Check for section headers
            if any(word in line.lower() for word in ['key points', 'main points', 'summary']):
                current_section = 'main_points'
                continue
            elif any(word in line.lower() for word in ['suggestions', 'recommendations', 'advice']):
                current_section = 'suggestions'
                continue
            
            # Extract numbered or bulleted items
            if re.match(r'^\d+\.|\*|-|•', line):
                cleaned_line = re.sub(r'^\d+\.|\*|-|•\s*', '', line)
                if current_section == 'suggestions':
                    suggestions.append(cleaned_line)
                else:
                    main_points.append(cleaned_line)
        
        # If we found structured content, return it
        if main_points or suggestions:
            # Get summary (usually the first paragraph or conclusion)
            summary_match = re.search(r'^([^\.!?]*[\.!?])', response_text.replace('\n', ' '))
            summary = summary_match.group(1) if summary_match else response_text[:200] + "..."
            
            return {
                "type": "structured",
                "main_points": main_points[:5],  # Limit to 5 main points
                "details": {
                    "suggestions": suggestions[:4],  # Limit to 4 suggestions
                    "key_findings": [],
                    "references": []
                },
                "summary": summary.strip()
            }
    except Exception as e:
        print(f"Error formatting structured response: {e}")
    
    return None

@app.route('/chat', methods=['GET'])
def chat():
    try:
        # Get parameters from URL query string
        user_message = request.args.get('message', '')
        selected_tabs = request.args.get('tabs', '[]')
        api_key = request.args.get('api_key', '')
        tab_id = request.args.get('tab_id', '')
        
        if not api_key:
            return jsonify({
                'error': 'API key is required',
                'success': False
            }), 400

        if not user_message:
            return jsonify({
                'error': 'Message is required',
                'success': False
            }), 400

        # Parse the tabs JSON string
        try:
            selected_tabs = json.loads(selected_tabs)
        except json.JSONDecodeError:
            selected_tabs = []
        
        print(f"Message: {user_message}")
        print(f"Selected tabs: {len(selected_tabs)} tabs")
        print(f"Tab ID: {tab_id}")
        
        # Initialize or get existing conversation memory for this tab
        if tab_id not in tab_memories:
            tab_memories[tab_id] = ConversationBufferMemory(return_messages=True)
        
        # Create LangChain components with ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            temperature=0.7,
            google_api_key=api_key
        )
        
        # Get tab context
        tab_context = extract_content_from_tabs(selected_tabs)
        
        # Create system message for natural conversation
        system_prompt = """You are a helpful AI assistant that provides clear, conversational responses. 

Guidelines:
- Be natural and conversational in your responses
- Provide helpful, accurate information
- When asked for summaries or analysis, organize your thoughts clearly
- Use proper paragraphs and formatting for readability
- Be concise but thorough
- If the user is viewing web tabs, you can reference them in context

Keep your responses engaging and human-like while being informative."""

        # Create conversation chain
        conversation = ConversationChain(
            llm=llm,
            memory=tab_memories[tab_id],
            verbose=False
        )
        
        # Format the message with context
        if selected_tabs:
            formatted_message = f"""Context: {tab_context}

User question: {user_message}

Please provide a helpful response based on the context of the tabs the user is currently viewing."""
        else:
            formatted_message = user_message
        
        # Add system context to the conversation
        if not tab_memories[tab_id].chat_memory.messages:
            # First message in conversation, add system context
            tab_memories[tab_id].chat_memory.add_message(SystemMessage(content=system_prompt))
        
        # Get response from LangChain
        response = conversation.predict(input=formatted_message)
        
        print(f"AI Response: {response[:100]}...")  # Debug print (truncated)
        
        # Check if this should be a structured response
        if is_structured_response_needed(user_message):
            structured = format_structured_response(response)
            if structured:
                return jsonify({
                    'response': structured,
                    'success': True
                }), 200
        
        # Return natural response
        return jsonify({
            'response': {
                'type': 'natural',
                'content': response.strip()
            },
            'success': True
        }), 200
        
    except Exception as e:
        print("Error:", str(e))
        import traceback
        traceback.print_exc()
        
        return jsonify({
            'error': f'An error occurred: {str(e)}',
            'success': False
        }), 500

@app.route('/clear-memory', methods=['POST'])
def clear_memory():
    """Endpoint to clear conversation memory for a specific tab"""
    try:
        tab_id = request.json.get('tab_id', '')
        if tab_id in tab_memories:
            del tab_memories[tab_id]
            return jsonify({
                'message': 'Memory cleared successfully',
                'success': True
            }), 200
        else:
            return jsonify({
                'message': 'No memory found for this tab',
                'success': True
            }), 200
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'active_conversations': len(tab_memories)
    }), 200

if __name__ == '__main__':
    print("Starting Flask chatbot server...")
    print("Server will be available at: http://localhost:5000")
    app.run(debug=True, port=5000, host='0.0.0.0')