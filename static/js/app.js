document.addEventListener('DOMContentLoaded', () => {
    // 1. Alert Dismissal (for flash messages)
    setTimeout(() => {
        const alerts = document.querySelectorAll('.alert');
        alerts.forEach(alert => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        });
    }, 5000);

    // Only run dashboard logic if we are on the dashboard page
    const subscriptionsList = document.getElementById('subscriptionsList');
    if (subscriptionsList) {
        initDashboard();
        initChatWidget();
    }
});

let currentBudget = 0;
let costChartInstance = null;

function initDashboard() {
    fetchBudget().then(() => fetchSubscriptions());

    const addToolForm = document.getElementById('addToolForm');
    if (addToolForm) {
        addToolForm.addEventListener('submit', handleAddTool);
    }

    // Auto-calculate yearly cost
    const monthlyCostInput = document.getElementById('monthlyCost');
    const yearlyCostInput = document.getElementById('yearlyCost');
    if (monthlyCostInput && yearlyCostInput) {
        monthlyCostInput.addEventListener('input', () => {
            const monthly = parseFloat(monthlyCostInput.value) || 0;
            yearlyCostInput.value = monthly * 12;
        });
    }

    // Budget save logic
    const saveBudgetBtn = document.getElementById('saveBudgetBtn');
    if (saveBudgetBtn) {
        saveBudgetBtn.addEventListener('click', saveBudget);
    }
}

async function fetchBudget() {
    try {
        const response = await fetch('/api/budget');
        if (response.ok) {
            const data = await response.json();
            currentBudget = data.budget || 0;
            document.getElementById('monthlyBudget').value = currentBudget || '';
        }
    } catch(e) { console.error(e); }
}

async function saveBudget() {
    const budgetInput = document.getElementById('monthlyBudget');
    const newBudget = parseFloat(budgetInput.value) || 0;
    const btn = document.getElementById('saveBudgetBtn');
    btn.textContent = 'Saving...';
    
    try {
        const response = await fetch('/api/budget', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({budget: newBudget})
        });
        if (response.ok) {
            currentBudget = newBudget;
            fetchSubscriptions();
            btn.textContent = 'Saved!';
            btn.classList.replace('btn-secondary', 'btn-primary');
            setTimeout(() => {
                btn.textContent = 'Save Budget';
                btn.classList.replace('btn-primary', 'btn-secondary');
            }, 2000);
        }
    } catch(e) {
        console.error(e);
        btn.textContent = 'Save Budget';
    }
}

async function fetchSubscriptions() {
    try {
        const response = await fetch('/api/tools');
        if (!response.ok) throw new Error('Failed to fetch');
        
        const tools = await response.json();
        renderSubscriptions(tools);
        calculateStats(tools);
    } catch (error) {
        console.error("Error fetching subscriptions:", error);
    }
}

function renderSubscriptions(tools) {
    const list = document.getElementById('subscriptionsList');
    list.innerHTML = '';

    if (tools.length === 0) {
        list.innerHTML = `<div class="tool-card glass-panel" style="text-align:center; grid-column: 1 / -1;">
            <p style="color: var(--text-secondary);">No subscriptions added yet. Add one from the sidebar!</p>
        </div>`;
        return;
    }

    tools.forEach(tool => {
        const savings = (tool.monthly_cost * 12) - tool.yearly_cost;
        const card = document.createElement('div');
        card.className = 'tool-card glass-panel';
        card.innerHTML = `
            <div class="tool-card-header">
                <h3>${tool.tool_name}</h3>
                <button class="btn btn-danger btn-sm" onclick="deleteTool(${tool.id})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="tool-price">₹${tool.monthly_cost} <span style="font-size: 0.9rem; color: var(--text-secondary);">/ mo</span></div>
            <div class="tool-price-sub">or ₹${tool.yearly_cost} / yr</div>
            
            <div class="tool-savings">
                Yearly Savings: <span class="${savings > 0 ? 'savings-positive' : 'savings-negative'}">
                    ₹${savings > 0 ? savings : 0}
                </span>
            </div>
            
            <div class="tool-features">
                <strong>Features:</strong><br>
                ${tool.features}
            </div>
        `;
        list.appendChild(card);
    });
}

function calculateStats(tools) {
    let monthly = 0;
    let yearly = 0;
    
    tools.forEach(t => {
        monthly += t.monthly_cost;
        yearly += t.yearly_cost;
    });

    const potentialSavings = (monthly * 12) - yearly;

    document.getElementById('totalMonthly').textContent = `₹${monthly.toLocaleString()}`;
    document.getElementById('totalYearly').textContent = `₹${yearly.toLocaleString()}`;
    
    const savingsEl = document.getElementById('totalSavings');
    savingsEl.textContent = `₹${Math.max(0, potentialSavings).toLocaleString()}`;
    
    if (potentialSavings > 0) {
        savingsEl.className = 'amount savings-positive';
    } else {
        savingsEl.className = 'amount savings-negative';
    }

    // Budget calculation
    const budgetRemaining = currentBudget - monthly;
    const budgetEl = document.getElementById('budgetRemaining');
    budgetEl.textContent = `₹${budgetRemaining.toLocaleString()}`;
    if (budgetRemaining < 0) {
        budgetEl.className = 'amount savings-negative';
    } else {
        budgetEl.className = 'amount savings-positive';
    }

    // Update Chart
    renderChart(tools);
}

function renderChart(tools) {
    const ctx = document.getElementById('costChart');
    if (!ctx) return;

    const labels = tools.map(t => t.tool_name);
    const monthlyCosts = tools.map(t => t.monthly_cost);
    const yearlyCosts = tools.map(t => +(t.yearly_cost / 12).toFixed(2)); // Average monthly cost if paid yearly

    if (costChartInstance) {
        costChartInstance.destroy();
    }

    Chart.defaults.color = '#94a3b8';
    costChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Cost (Paid Monthly)',
                    data: monthlyCosts,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Avg Monthly Cost (Paid Yearly)',
                    data: yearlyCosts,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { callback: function(value) { return '₹' + value; } }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'top', labels: { color: '#f8fafc' } },
                title: { display: true, text: 'Cost Comparison per Tool (Monthly Eqv.)', color: '#f8fafc', font: { size: 16 } }
            }
        }
    });
}

async function handleAddTool(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;

    const toolData = {
        tool_name: document.getElementById('toolName').value,
        monthly_cost: document.getElementById('monthlyCost').value,
        yearly_cost: document.getElementById('yearlyCost').value,
        features: document.getElementById('features').value
    };

    try {
        const response = await fetch('/api/tools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toolData)
        });

        if (response.ok) {
            e.target.reset();
            fetchSubscriptions(); // Refresh list
        } else {
            const err = await response.json();
            alert("Error: " + err.error);
        }
    } catch (error) {
        alert("Network Error");
    } finally {
        submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Save Subscription';
        submitBtn.disabled = false;
    }
}

async function deleteTool(id) {
    if (!confirm("Are you sure you want to remove this subscription?")) return;

    try {
        const response = await fetch('/api/tools', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool_id: id })
        });

        if (response.ok) {
            fetchSubscriptions();
        }
    } catch (error) {
        console.error("Error deleting tool:", error);
    }
}

/* Chat Widget Logic */
function initChatWidget() {
    const chatWidget = document.getElementById('chatWidget');
    const chatHeader = document.getElementById('chatHeader');
    const chatToggleIcon = document.getElementById('chatToggleIcon');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    
    // Toggle Chat
    chatHeader.addEventListener('click', () => {
        chatWidget.classList.toggle('collapsed');
        if (chatWidget.classList.contains('collapsed')) {
            chatToggleIcon.classList.replace('fa-chevron-down', 'fa-chevron-up');
        } else {
            chatToggleIcon.classList.replace('fa-chevron-up', 'fa-chevron-down');
        }
    });

    // Start collapsed
    chatWidget.classList.add('collapsed');

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
            document.getElementById(loadingId).remove(); // Remove loading
            
            if (response.ok) {
                appendMessage("AI", formatAIResponse(data.response), "ai-message");
            } else {
                appendMessage("System Error", data.error, "ai-message");
            }
        } catch (err) {
            document.getElementById(loadingId).remove();
            appendMessage("Error", "Failed to connect to the server.", "ai-message");
        }
    };

    sendChatBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

function appendMessage(sender, text, className, id = null) {
    const chatMessages = document.getElementById('chatMessages');
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
