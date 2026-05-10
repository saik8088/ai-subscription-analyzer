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
    const btn = document.getElementById('downloadReportBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
    btn.disabled = true;

    // Fetch latest data to build the report
    Promise.all([fetch('/api/tools'), fetch('/api/budget')])
        .then(async ([toolsRes, budgetRes]) => {
            const tools = await toolsRes.json();
            const budgetData = await budgetRes.json();
            const budget = budgetData.budget || 0;

            // Compute stats
            let totalMonthly = 0, totalYearly = 0;
            tools.forEach(t => { totalMonthly += t.monthly_cost; totalYearly += t.yearly_cost; });
            const budgetRemaining = budget - totalMonthly;
            const potentialSavings = (totalMonthly * 12) - totalYearly;

            let expenseLevel = 'N/A', expenseColor = '#64748b';
            if (budget > 0) {
                const ratio = totalMonthly / budget;
                if (ratio > 0.7)      { expenseLevel = 'High';   expenseColor = '#ef4444'; }
                else if (ratio > 0.3) { expenseLevel = 'Medium'; expenseColor = '#f59e0b'; }
                else                  { expenseLevel = 'Low';    expenseColor = '#10b981'; }
            }

            const now = new Date();
            const dateStr = now.toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' });
            const timeStr = now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

            // Build subscription table rows
            const tableRows = tools.length === 0
                ? `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px;">No subscriptions added yet.</td></tr>`
                : tools.map((t, i) => {
                    const savings = (t.monthly_cost * 12) - t.yearly_cost;
                    const savColor = savings > 0 ? '#10b981' : '#ef4444';
                    return `
                    <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'};">
                        <td style="padding:10px 14px; font-weight:600; color:#1e293b;">${t.tool_name}</td>
                        <td style="padding:10px 14px; text-align:right;">₹${t.monthly_cost.toLocaleString('en-IN')}</td>
                        <td style="padding:10px 14px; text-align:right;">₹${t.yearly_cost.toLocaleString('en-IN')}</td>
                        <td style="padding:10px 14px; color:${savColor}; text-align:right; font-weight:600;">₹${Math.max(0, savings).toLocaleString('en-IN')}</td>
                        <td style="padding:10px 14px; font-size:12px; color:#64748b; max-width:180px;">${t.features}</td>
                    </tr>`;
                }).join('');

            // Build the full report HTML
            const reportHTML = `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1e293b; background: #fff;">

                <!-- HEADER -->
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div>
                        <h1 style="margin:0; font-size:28px; font-weight:800; color:#7c3aed; letter-spacing:-0.5px;">AI SUBSCRIPTION REPORT</h1>
                        <p style="margin:4px 0 0; font-size:13px; color:#64748b;">Official Cost & Expense Analysis</p>
                    </div>
                    <div style="text-align:right; font-size:12px; color:#64748b; line-height:1.8;">
                        <div><strong>Date:</strong> ${dateStr}</div>
                        <div><strong>Time:</strong> ${timeStr}</div>
                    </div>
                </div>
                <hr style="border:none; border-top:3px solid #7c3aed; margin-bottom:28px;">

                <!-- SUMMARY CARDS -->
                <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:32px;">
                    ${[
                        { label:'Total Monthly', value:'₹'+totalMonthly.toLocaleString('en-IN'), color:'#7c3aed' },
                        { label:'Total Yearly',  value:'₹'+totalYearly.toLocaleString('en-IN'),  color:'#3b82f6' },
                        { label:'Expense Level', value:expenseLevel, color:expenseColor },
                        { label:'Budget Remaining', value: budget > 0 ? '₹'+budgetRemaining.toLocaleString('en-IN') : 'No Budget', color: budgetRemaining < 0 ? '#ef4444' : '#10b981' }
                    ].map(c => `
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-top:4px solid ${c.color}; border-radius:10px; padding:16px; text-align:center;">
                            <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">${c.label}</div>
                            <div style="font-size:20px; font-weight:800; color:${c.color};">${c.value}</div>
                        </div>`).join('')}
                </div>

                <!-- SAVINGS HIGHLIGHT -->
                ${potentialSavings > 0 ? `
                <div style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); border:1px solid #bbf7d0; border-left:5px solid #10b981; border-radius:10px; padding:16px 20px; margin-bottom:28px; display:flex; align-items:center; gap:16px;">
                    <div style="font-size:32px;">💡</div>
                    <div>
                        <div style="font-weight:800; color:#15803d; font-size:15px;">Potential Annual Savings</div>
                        <div style="color:#166534; font-size:13px; margin-top:4px;">You could save <strong>₹${potentialSavings.toLocaleString('en-IN')}/year</strong> by switching all subscriptions to yearly billing plans.</div>
                    </div>
                </div>` : ''}

                <!-- SUBSCRIPTIONS TABLE -->
                <div style="margin-bottom:32px;">
                    <h2 style="font-size:16px; font-weight:800; color:#7c3aed; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">
                        Subscription Details (${tools.length} tool${tools.length !== 1 ? 's' : ''})
                    </h2>
                    <table style="width:100%; border-collapse:collapse; font-size:13px;">
                        <thead>
                            <tr style="background:#7c3aed; color:#fff;">
                                <th style="padding:11px 14px; text-align:left; border-radius:6px 0 0 0;">Tool Name</th>
                                <th style="padding:11px 14px; text-align:right;">Monthly Cost</th>
                                <th style="padding:11px 14px; text-align:right;">Yearly Cost</th>
                                <th style="padding:11px 14px; text-align:right;">Yearly Savings</th>
                                <th style="padding:11px 14px; text-align:left; border-radius:0 6px 0 0;">Key Features</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                        <tfoot>
                            <tr style="background:#1e293b; color:#fff; font-weight:700;">
                                <td style="padding:11px 14px;">TOTAL</td>
                                <td style="padding:11px 14px; text-align:right;">₹${totalMonthly.toLocaleString('en-IN')}</td>
                                <td style="padding:11px 14px; text-align:right;">₹${totalYearly.toLocaleString('en-IN')}</td>
                                <td style="padding:11px 14px; text-align:right; color:#10b981;">₹${Math.max(0, potentialSavings).toLocaleString('en-IN')}</td>
                                <td style="padding:11px 14px;"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- EXPENSE ANALYSIS -->
                <div style="margin-bottom:28px;">
                    <h2 style="font-size:16px; font-weight:800; color:#7c3aed; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">Expense Analysis</h2>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
                            <div style="font-size:12px; color:#64748b; font-weight:600; text-transform:uppercase; margin-bottom:6px;">Monthly Budget</div>
                            <div style="font-size:18px; font-weight:800; color:#1e293b;">${budget > 0 ? '₹'+budget.toLocaleString('en-IN') : 'Not Set'}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
                            <div style="font-size:12px; color:#64748b; font-weight:600; text-transform:uppercase; margin-bottom:6px;">Monthly Spend vs Budget</div>
                            <div style="font-size:18px; font-weight:800; color:${budgetRemaining < 0 ? '#ef4444' : '#10b981'};">
                                ${budget > 0 ? Math.round((totalMonthly / budget) * 100) + '% used' : 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- FOOTER -->
                <div style="border-top:1px solid #e2e8f0; margin-top:20px; padding-top:16px; display:flex; justify-content:space-between; font-size:11px; color:#94a3b8;">
                    <span>AI Subscription Cost Analyzer</span>
                    <span>Generated on ${dateStr} at ${timeStr}</span>
                </div>
            </div>`;

            // Generate PDF from the report HTML
            const container = document.createElement('div');
            container.innerHTML = reportHTML;
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            document.body.appendChild(container);

            const opt = {
                margin: [8, 8, 8, 8],
                filename: `AI_Subscription_Report_${now.toISOString().slice(0,10)}.pdf`,
                image: { type: 'jpeg', quality: 0.99 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(container).save()
                .then(() => {
                    document.body.removeChild(container);
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    if(window.showToast) window.showToast("Report downloaded successfully!", "success");
                }).catch(err => {
                    console.error(err);
                    document.body.removeChild(container);
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    if(window.showToast) window.showToast("Failed to generate report", "error");
                });
        })
        .catch(err => {
            console.error(err);
            btn.innerHTML = originalText;
            btn.disabled = false;
            if(window.showToast) window.showToast("Failed to fetch data for report", "error");
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
