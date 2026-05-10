document.addEventListener('DOMContentLoaded', () => {
    const subscriptionsList = document.getElementById('subscriptionsList');
    if (subscriptionsList) {
        initDashboard();
    }
});

let currentBudget = 0;
let costChartInstance = null;

function initDashboard() {
    window.showLoader();
    fetchBudget().then(() => fetchSubscriptions()).finally(() => {
        window.hideLoader();
    });

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

    // Download Report Logic
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener('click', downloadPDFReport);
    }
}

function downloadPDFReport() {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent) return;

    // Temporarily change styling for better PDF output if needed
    // (html2pdf handles most things fine)
    
    const opt = {
        margin:       10,
        filename:     'AI_Subscription_Report.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // New Promise-based usage:
    const btn = document.getElementById('downloadReportBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
    btn.disabled = true;

    html2pdf().set(opt).from(reportContent).save().then(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        if(window.showToast) window.showToast("Report downloaded successfully!", "success");
    }).catch(err => {
        console.error(err);
        btn.innerHTML = originalText;
        btn.disabled = false;
        if(window.showToast) window.showToast("Failed to generate report", "error");
    });
}

async function fetchBudget() {
    try {
        const response = await fetch('/api/budget');
        if (response.ok) {
            const data = await response.json();
            currentBudget = data.budget || 0;
            const mb = document.getElementById('monthlyBudget');
            if(mb) mb.value = currentBudget || '';
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
            if(window.showToast) window.showToast("Budget saved successfully!", "success");
            setTimeout(() => {
                btn.textContent = 'Save Budget';
                btn.classList.replace('btn-primary', 'btn-secondary');
            }, 2000);
        } else {
            if(window.showToast) window.showToast("Failed to save budget", "error");
        }
    } catch(e) {
        console.error(e);
        btn.textContent = 'Save Budget';
        if(window.showToast) window.showToast("Network error saving budget", "error");
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
    if(!list) return;
    
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

// Animate numbers counting up
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = '₹' + Math.floor(progress * (end - start) + start).toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function calculateStats(tools) {
    let monthly = 0;
    let yearly = 0;
    
    tools.forEach(t => {
        monthly += t.monthly_cost;
        yearly += t.yearly_cost;
    });

    const potentialSavings = (monthly * 12) - yearly;

    const totalMonthlyEl = document.getElementById('totalMonthly');
    const totalYearlyEl = document.getElementById('totalYearly');
    if(totalMonthlyEl) animateValue(totalMonthlyEl, 0, monthly, 1000);
    if(totalYearlyEl) animateValue(totalYearlyEl, 0, yearly, 1000);
    
    const expenseEl = document.getElementById('expenseLevel');
    if(expenseEl) {
        let level = 'Low';
        let className = 'amount savings-positive';

        if (currentBudget > 0) {
            const ratio = monthly / currentBudget;
            if (ratio > 0.7) {
                level = 'High';
                className = 'amount savings-negative';
            } else if (ratio > 0.3) {
                level = 'Medium';
                className = 'amount';
                expenseEl.style.color = '#fbbf24'; // Medium yellow color
            } else {
                level = 'Low';
                className = 'amount savings-positive';
            }
        } else {
            if (monthly === 0) level = 'None';
            else level = 'No Budget';
            className = 'amount';
        }

        expenseEl.textContent = level;
        expenseEl.className = className;
        if (level !== 'Medium') expenseEl.style.color = '';
    }

    // Budget calculation
    const budgetRemaining = currentBudget - monthly;
    const budgetEl = document.getElementById('budgetRemaining');
    if(budgetEl) {
        animateValue(budgetEl, 0, budgetRemaining, 1000);
        if (budgetRemaining < 0) {
            budgetEl.className = 'amount savings-negative';
        } else {
            budgetEl.className = 'amount savings-positive';
        }
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
    Chart.defaults.font.family = 'Inter';
    
    costChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Cost (Paid Monthly)',
                    data: monthlyCosts,
                    backgroundColor: 'rgba(139, 92, 246, 0.7)', // Purple gradient vibe
                    borderColor: 'rgba(139, 92, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                },
                {
                    label: 'Avg Monthly Cost (Paid Yearly)',
                    data: yearlyCosts,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)', // Emerald
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { callback: function(value) { return '₹' + value; } }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { position: 'top', labels: { color: '#f8fafc', font: { size: 13 } } },
                title: { display: true, text: 'Cost Comparison per Tool (Monthly Eqv.)', color: '#f8fafc', font: { size: 16, weight: 'bold' } },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    padding: 12,
                    cornerRadius: 8,
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    borderWidth: 1
                }
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
            if(window.showToast) window.showToast("Subscription added successfully!", "success");
        } else {
            const err = await response.json();
            if(window.showToast) window.showToast("Error: " + err.error, "error");
        }
    } catch (error) {
        if(window.showToast) window.showToast("Network Error", "error");
    } finally {
        submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Save Subscription';
        submitBtn.disabled = false;
    }
}

window.deleteTool = async function(id) {
    if (!confirm("Are you sure you want to remove this subscription?")) return;

    try {
        const response = await fetch('/api/tools', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool_id: id })
        });

        if (response.ok) {
            fetchSubscriptions();
            if(window.showToast) window.showToast("Subscription deleted.", "success");
        }
    } catch (error) {
        console.error("Error deleting tool:", error);
        if(window.showToast) window.showToast("Error deleting subscription", "error");
    }
}
