/**
 * Student Expense Management System
 * Main Application Logic (Connected to Flask + SQLite Backend)
 * BCA Final Year Project
 */

// Global chart references for proper lifecycle & re-rendering
let monthlyChartInstance = null;
let categoryChartInstance = null;

// Toast Notification Helper
function showToast(message, type = 'info') {
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'success' ? '✓' : (type === 'danger' ? '✕' : 'ℹ');
  toast.innerHTML = `<span><strong>${icon}</strong> ${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// -------------------------------------------------------------
// 1. DASHBOARD PAGE LOGIC
// -------------------------------------------------------------
async function initDashboard() {
  const totalIncomeEl = document.getElementById('dashTotalIncome');
  const totalExpenseEl = document.getElementById('dashTotalExpense');
  const balanceEl = document.getElementById('dashBalance');
  const tableBody = document.getElementById('recentTransactionsBody');

  try {
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">Loading transactions from SQLite database...</td></tr>`;
    }

    // 1. Fetch transactions from Flask backend
    const transactions = await getTransactions();

    // 2. Calculate Totals (Balance = Total Income - Total Expenses)
    const summary = calculateSummary(transactions);

    // 3. Update KPI Stat Cards
    if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(summary.totalIncome);
    if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(summary.totalExpense);
    if (balanceEl) {
      balanceEl.textContent = formatCurrency(summary.balance);
      if (summary.balance < 0) {
        balanceEl.style.color = 'var(--danger)';
      } else {
        balanceEl.style.color = 'var(--primary)';
      }
    }

    // 4. Render Recent 5 Transactions
    renderRecentTransactions(transactions.slice(0, 5));

    // 5. Render Category-wise Expense Breakdown
    renderDashboardCategoryBreakdown(transactions);

    // 6. Render Monthly Expense & Income Chart
    renderDashboardMonthlyChart(transactions);

  } catch (error) {
    console.error('Error loading dashboard data:', error);
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state" style="color: var(--danger);">
            <p><strong>⚠️ Backend Unavailable</strong></p>
            <p style="font-size:0.85rem;">Please ensure the Flask backend is running at <code>http://127.0.0.1:5000</code>.</p>
          </td>
        </tr>
      `;
    }
    showToast('Failed to load transactions from backend server.', 'danger');
  }
}

function renderRecentTransactions(recentList) {
  const tableBody = document.getElementById('recentTransactionsBody');
  if (!tableBody) return;

  if (recentList.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <p>No recent transactions recorded yet.</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = recentList.map(tx => `
    <tr>
      <td><strong>${formatDate(tx.date)}</strong></td>
      <td>${escapeHtml(tx.description || 'No description')}</td>
      <td><span class="badge badge-category">${escapeHtml(tx.category)}</span></td>
      <td>
        <span class="badge ${tx.type === 'income' ? 'badge-income' : 'badge-expense'}">
          ${tx.type === 'income' ? '+ Income' : '- Expense'}
        </span>
      </td>
      <td style="font-weight: 700; color: ${tx.type === 'income' ? 'var(--success)' : 'var(--danger)'}">
        ${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}
      </td>
    </tr>
  `).join('');
}

function renderDashboardCategoryBreakdown(transactions) {
  const container = document.getElementById('dashboardCategoryList');
  if (!container) return;

  const { breakdown, totalExpense } = getExpenseCategoryBreakdown(transactions);
  const categories = Object.keys(breakdown);

  // Category Color Map
  const catColors = {
    'Food': '#f97316',
    'Travel': '#06b6d4',
    'Education': '#4f46e5',
    'Shopping': '#ec4899',
    'Bills': '#8b5cf6',
    'Entertainment': '#10b981',
    'Other': '#64748b'
  };

  if (totalExpense === 0) {
    container.innerHTML = `<p class="text-muted" style="text-align: center; padding: 20px 0;">No expense records found.</p>`;
    return;
  }

  container.innerHTML = categories.map(cat => {
    const amount = breakdown[cat];
    const percentage = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
    const color = catColors[cat] || '#4f46e5';

    return `
      <div class="category-item">
        <div class="cat-header">
          <span class="cat-name">
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${color};"></span>
            ${cat}
          </span>
          <span class="cat-amount">${formatCurrency(amount)} (${percentage}%)</span>
        </div>
        <div class="cat-progress-bg">
          <div class="cat-progress-fill" style="width: ${percentage}%; background-color: ${color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDashboardMonthlyChart(transactions) {
  const chartCanvas = document.getElementById('monthlyExpenseChart');
  if (!chartCanvas) return;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyExpenses = new Array(12).fill(0);
  const monthlyIncomes = new Array(12).fill(0);

  transactions.forEach(tx => {
    if (tx.date) {
      const monthIdx = new Date(tx.date).getMonth();
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'expense') {
        monthlyExpenses[monthIdx] += amount;
      } else if (tx.type === 'income') {
        monthlyIncomes[monthIdx] += amount;
      }
    }
  });

  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  const ctx = chartCanvas.getContext('2d');
  monthlyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Expenses (₹)',
          data: monthlyExpenses,
          backgroundColor: 'rgba(239, 68, 68, 0.85)',
          borderRadius: 6,
          barPercentage: 0.6
        },
        {
          label: 'Income (₹)',
          data: monthlyIncomes,
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderRadius: 6,
          barPercentage: 0.6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ₹${context.raw.toLocaleString('en-IN')}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: function(value) { return '₹' + value; },
            font: { family: "'Plus Jakarta Sans', sans-serif" }
          }
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Plus Jakarta Sans', sans-serif" } }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// 2. ADD TRANSACTION PAGE LOGIC
// -------------------------------------------------------------
function initAddTransaction() {
  const form = document.getElementById('transactionForm');
  const typeRadios = document.querySelectorAll('input[name="transactionType"]');
  const categorySelect = document.getElementById('categorySelect');
  const dateInput = document.getElementById('transactionDate');

  if (!form) return;

  // Set default date to today
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }

  // Update Category Options based on Income / Expense Selection
  function updateCategoryOptions(selectedType) {
    if (!categorySelect) return;
    const catList = CATEGORIES[selectedType] || CATEGORIES.expense;
    categorySelect.innerHTML = catList.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  }

  // Listen to radio changes
  typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateCategoryOptions(e.target.value);
    });
  });

  // Initial populate for checked type
  const initialType = document.querySelector('input[name="transactionType"]:checked')?.value || 'expense';
  updateCategoryOptions(initialType);

  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const selectedType = document.querySelector('input[name="transactionType"]:checked')?.value || '';
    const amountVal = document.getElementById('amountInput').value;
    const amount = parseFloat(amountVal);
    const category = categorySelect.value;
    const description = document.getElementById('descriptionInput').value;
    const date = dateInput.value;

    // 1. Validations
    if (!selectedType || !['income', 'expense'].includes(selectedType)) {
      alert('Please select a valid transaction type (Income or Expense).');
      return;
    }

    if (!amountVal || isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }

    if (!category) {
      alert('Please select a category.');
      return;
    }

    if (!date) {
      alert('Please select a valid date.');
      return;
    }

    // UI Loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="ri-loader-4-line"></i> Saving...';
    }

    try {
      // 2. Send transaction to Flask + SQLite backend
      const result = await addTransaction({
        type: selectedType,
        amount: amount,
        category: category,
        description: description,
        date: date
      });

      if (result.success) {
        showToast('Transaction saved to SQLite database successfully!', 'success');

        // Clear form
        form.reset();
        dateInput.value = new Date().toISOString().split('T')[0];
        document.getElementById('typeExpense').checked = true;
        updateCategoryOptions('expense');

        // Redirect to transaction history
        setTimeout(() => {
          window.location.href = 'transactions.html';
        }, 800);
      } else {
        alert(result.message || 'Failed to save transaction.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="ri-save-line"></i> Save Transaction';
        }
      }
    } catch (error) {
      alert('Error communicating with backend server.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ri-save-line"></i> Save Transaction';
      }
    }
  });
}

// -------------------------------------------------------------
// 3. TRANSACTION HISTORY PAGE LOGIC
// -------------------------------------------------------------
async function initTransactionHistory() {
  const tableBody = document.getElementById('transactionsTableBody');
  const searchInput = document.getElementById('searchInput');
  const typeFilter = document.getElementById('typeFilter');
  const categoryFilter = document.getElementById('categoryFilter');
  const totalCountEl = document.getElementById('txCount');

  if (!tableBody) return;

  // In-memory transactions cache for smooth filtering
  let allTransactions = [];

  // Populate category filter dropdown
  if (categoryFilter) {
    const allCats = [...CATEGORIES.expense, ...CATEGORIES.income];
    const uniqueCats = [...new Set(allCats)];
    categoryFilter.innerHTML = '<option value="all">All Categories</option>' + 
      uniqueCats.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  }

  function filterAndRender() {
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();
    const selectedType = typeFilter?.value || 'all';
    const selectedCategory = categoryFilter?.value || 'all';

    const filtered = allTransactions.filter(tx => {
      const desc = (tx.description || '').toLowerCase();
      const cat = (tx.category || '').toLowerCase();
      const matchSearch = desc.includes(searchTerm) || cat.includes(searchTerm);
      const matchType = (selectedType === 'all') || (tx.type === selectedType);
      const matchCategory = (selectedCategory === 'all') || (tx.category === selectedCategory);

      return matchSearch && matchType && matchCategory;
    });

    if (totalCountEl) {
      totalCountEl.textContent = `Showing ${filtered.length} of ${allTransactions.length} transactions`;
    }

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <div style="padding: 24px 0;">
              <h4>No transactions found</h4>
              <p>Try clearing filters or add a new transaction.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filtered.map(tx => `
      <tr>
        <td><strong>${formatDate(tx.date)}</strong></td>
        <td>${escapeHtml(tx.description || 'No description')}</td>
        <td><span class="badge badge-category">${escapeHtml(tx.category)}</span></td>
        <td>
          <span class="badge ${tx.type === 'income' ? 'badge-income' : 'badge-expense'}">
            ${tx.type === 'income' ? '+ Income' : '- Expense'}
          </span>
        </td>
        <td style="font-weight: 700; color: ${tx.type === 'income' ? 'var(--success)' : 'var(--danger)'}">
          ${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}
        </td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="handleDeleteTransaction(${tx.id})" title="Delete Transaction">
            🗑 Delete
          </button>
        </td>
      </tr>
    `).join('');
  }

  // Global Delete Handler calling DELETE /api/transactions/<id>
  window.handleDeleteTransaction = async function(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
      const result = await deleteTransaction(id);
      if (result.success) {
        showToast('Transaction deleted successfully.', 'success');
        // Remove locally and refresh the transaction list
        allTransactions = allTransactions.filter(tx => tx.id !== id);
        filterAndRender();
      } else {
        alert(result.message || 'Failed to delete transaction.');
      }
    }
  };

  // Event Listeners for Filters
  if (searchInput) searchInput.addEventListener('input', filterAndRender);
  if (typeFilter) typeFilter.addEventListener('change', filterAndRender);
  if (categoryFilter) categoryFilter.addEventListener('change', filterAndRender);

  // Fetch from Flask Backend
  try {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">Loading transactions from SQLite database...</td></tr>`;
    allTransactions = await getTransactions();
    filterAndRender();
  } catch (error) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state" style="color: var(--danger);">
          <h4>⚠️ Unable to load transactions</h4>
          <p>Please make sure the Flask backend server is running at http://127.0.0.1:5000</p>
        </td>
      </tr>
    `;
    showToast('Failed to connect to backend server.', 'danger');
  }
}

// -------------------------------------------------------------
// 4. REPORTS PAGE LOGIC
// -------------------------------------------------------------
async function initReports() {
  const repIncome = document.getElementById('repTotalIncome');
  const repExpense = document.getElementById('repTotalExpense');
  const repBalance = document.getElementById('repNetSavings');
  const repTxCount = document.getElementById('repTotalTxCount');

  try {
    const transactions = await getTransactions();
    const summary = calculateSummary(transactions);
    const { breakdown, totalExpense } = getExpenseCategoryBreakdown(transactions);

    if (repIncome) repIncome.textContent = formatCurrency(summary.totalIncome);
    if (repExpense) repExpense.textContent = formatCurrency(summary.totalExpense);
    if (repBalance) repBalance.textContent = formatCurrency(summary.balance);
    if (repTxCount) repTxCount.textContent = transactions.length;

    // Render Category Pie Chart
    renderCategoryPieChart(breakdown);

    // Render Monthly Spending Bar Chart
    renderReportsMonthlyChart(transactions);

    // Render Detailed Category Breakdown Table
    renderCategorySummaryTable(breakdown, totalExpense);

  } catch (error) {
    console.error('Failed to load reports data:', error);
    showToast('Failed to load report data from backend.', 'danger');
  }
}

function renderCategoryPieChart(breakdown) {
  const canvas = document.getElementById('reportCategoryPieChart');
  if (!canvas) return;

  const labels = Object.keys(breakdown);
  const dataValues = Object.values(breakdown);
  const backgroundColors = [
    '#f97316', // Food
    '#06b6d4', // Travel
    '#4f46e5', // Education
    '#ec4899', // Shopping
    '#8b5cf6', // Bills
    '#10b981', // Entertainment
    '#64748b'  // Other
  ];

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  categoryChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.raw || 0;
              return `${context.label}: ₹${val.toLocaleString('en-IN')}`;
            }
          }
        }
      }
    }
  });
}

function renderReportsMonthlyChart(transactions) {
  const canvas = document.getElementById('reportMonthlyBarChart');
  if (!canvas) return;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyExpenses = new Array(12).fill(0);
  const monthlyIncomes = new Array(12).fill(0);

  transactions.forEach(tx => {
    if (tx.date) {
      const monthIdx = new Date(tx.date).getMonth();
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'expense') {
        monthlyExpenses[monthIdx] += amount;
      } else if (tx.type === 'income') {
        monthlyIncomes[monthIdx] += amount;
      }
    }
  });

  const ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Total Expenses (₹)',
          data: monthlyExpenses,
          backgroundColor: '#ef4444',
          borderRadius: 6
        },
        {
          label: 'Total Income (₹)',
          data: monthlyIncomes,
          backgroundColor: '#10b981',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, font: { family: "'Plus Jakarta Sans', sans-serif" } }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: function(val) { return '₹' + val; }
          }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderCategorySummaryTable(breakdown, totalExpense) {
  const tbody = document.getElementById('categorySummaryTableBody');
  if (!tbody) return;

  const categories = Object.keys(breakdown);
  
  tbody.innerHTML = categories.map(cat => {
    const amount = breakdown[cat];
    const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0.0';

    return `
      <tr>
        <td><strong>${cat}</strong></td>
        <td>${formatCurrency(amount)}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="cat-progress-bg" style="flex: 1; height: 6px;">
              <div class="cat-progress-fill" style="width: ${percentage}%;"></div>
            </div>
            <span style="font-size: 0.8rem; font-weight: 600;">${percentage}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Utility: Prevent XSS in rendered text
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(match) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return escapeMap[match];
  });
}

// Global Initialization Based on Page
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboardPage')) {
    initDashboard();
  } else if (document.getElementById('addTransactionPage')) {
    initAddTransaction();
  } else if (document.getElementById('transactionsPage')) {
    initTransactionHistory();
  } else if (document.getElementById('reportsPage')) {
    initReports();
  }
});
