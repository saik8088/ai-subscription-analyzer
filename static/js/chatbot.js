document.addEventListener('DOMContentLoaded', () => {
    initChatWidget();
});

function initChatWidget() {
    const chatWidget = document.getElementById('chatWidget');
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    const chatMinimizeIcon = document.getElementById('chatMinimizeIcon');
    const chatCloseIcon = document.getElementById('chatCloseIcon');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');

    if (!chatWidget || !chatToggleBtn) return;

    // Open chat
    chatToggleBtn.addEventListener('click', () => {
        chatWidget.style.display = 'flex';
        chatWidget.classList.remove('minimized');
        chatToggleBtn.style.display = 'none';
        
        // Add a small delay for the animation to trigger smoothly
        setTimeout(() => {
            chatWidget.classList.add('open');
        }, 10);
    });

    // Minimize chat
    chatMinimizeIcon.addEventListener('click', () => {
        chatWidget.classList.add('minimized');
    });

    // Close chat
    chatCloseIcon.addEventListener('click', () => {
        chatWidget.classList.remove('open');
        setTimeout(() => {
            chatWidget.style.display = 'none';
            chatToggleBtn.style.display = 'flex';
        }, 300); // Wait for transition
    });

    // Send Message
    const sendMessage = async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        appendMessage("You", message, "user-message");
        chatInput.value = '';
        
        // Show loading
        const loadingId = "loading-" + Date.now();
        appendMessage("AI", "<i class='fa-solid fa-ellipsis fa-fade'></i>", "ai-message", loadingId);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();
            const loaderEl = document.getElementById(loadingId);
            if(loaderEl) loaderEl.remove(); // Remove loading
            
            if (response.ok) {
                appendMessage("AI", formatAIResponse(data.response), "ai-message");
            } else {
                appendMessage("System Error", data.error, "ai-message");
            }
        } catch (err) {
            const loaderEl = document.getElementById(loadingId);
            if(loaderEl) loaderEl.remove();
            appendMessage("Error", "Failed to connect to the server.", "ai-message");
        }
    };

    if(sendChatBtn) {
        sendChatBtn.addEventListener('click', sendMessage);
    }
    if(chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
}

function appendMessage(sender, text, className, id = null) {
    const chatMessages = document.getElementById('chatMessages');
    if(!chatMessages) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${className}`;
    if (id) msgDiv.id = id;
    
    // Basic markdown formatting for bold and line breaks
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    msgDiv.innerHTML = `<p>${formattedText}</p>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatAIResponse(text) {
    // Basic bold and list item formatting
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/\n\* /g, '<br>• ')
               .replace(/\n- /g, '<br>• ');
}
