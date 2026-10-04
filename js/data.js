/**
 * Student Expense Management System
 * Data Management Module (Connected to Flask + SQLite Backend)
 * BCA Final Year Project
 */

// Backend Flask API Base URL (Safe global configuration)
window.API_BASE_URL = window.API_BASE_URL || 'http://127.0.0.1:5000';
var API_BASE_URL = window.API_BASE_URL;

// Predefined Categories
window.CATEGORIES = window.CATEGORIES || {
  expense: [
    'Food',
    'Travel',
    'Education',
    'Shopping',
    'Bills',
    'Entertainment',
    'Other'
  ],
  income: [
    'Monthly Allowance',
    'Part-time Job',
    'Scholarship',
    'Freelance',
    'Gift',
    'Other'
  ]
};
var CATEGORIES = window.CATEGORIES;

/**
 * Get current logged in user object and ID from localStorage
 * @returns {number|null} user ID
 */
function getCurrentUserId() {
  const rawUser = localStorage.getItem('student_expense_active_user');
  if (rawUser) {
    try {
      const user = JSON.parse(rawUser);
      return user.id || null;
    } catch (e) {
      console.error('Error parsing active user from localStorage:', e);
    }
  }
  return null;
}

/**
 * Fetch all transactions for the currently logged-in user from SQLite
 * @returns {Promise<Array>} List of transactions sorted newest first
 */
async function getTransactions() {
  const userId = getCurrentUserId();
  if (!userId) {
    console.warn('No active user logged in.');
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/transactions/${userId}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Server returned status ${response.status}`);
    }
    const data = await response.json();
    return data.transactions || [];
  } catch (error) {
    console.error('Failed to fetch transactions from backend:', error);
    throw error;
  }
}

/**
 * Save a new transaction to the SQLite database via Flask API
 * @param {Object} transaction - { type, amount, category, description, date }
 * @returns {Promise<Object>} Result with success flag and saved transaction
 */
async function addTransaction(transaction) {
  const userId = getCurrentUserId();
  if (!userId) {
    return {
      success: false,
      message: 'You must be logged in to add a transaction.'
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        type: transaction.type,
        amount: parseFloat(transaction.amount),
        category: transaction.category,
        description: (transaction.description || '').trim(),
        date: transaction.date
      })
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      return {
        success: true,
        message: data.message || 'Transaction created successfully!',
        transaction: data.transaction
      };
    } else {
      return {
        success: false,
        message: data.message || 'Failed to save transaction.'
      };
    }
  } catch (error) {
    console.error('Error adding transaction:', error);
    return {
      success: false,
      message: 'Backend server is unavailable. Please make sure the Flask server is running at http://127.0.0.1:5000'
    };
  }
}

/**
 * Delete a transaction by ID from SQLite database via Flask API
 * @param {number|string} id - Transaction ID
 * @returns {Promise<Object>} Result with success flag and message
 */
async function deleteTransaction(id) {
  const userId = getCurrentUserId();
  if (!userId) {
    return {
      success: false,
      message: 'You must be logged in to delete a transaction.'
    };
  }

  try {
    // Pass user_id as query param so the backend can verify ownership
    const response = await fetch(`${API_BASE_URL}/api/transactions/${id}?user_id=${userId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      return {
        success: true,
        message: data.message || 'Transaction deleted successfully.'
      };
    } else {
      return {
        success: false,
        message: data.message || 'Failed to delete transaction.'
      };
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return {
      success: false,
      message: 'Backend server is unreachable. Please ensure Flask is running.'
    };
  }
}

/**
 * Update an existing transaction in SQLite database via Flask API (PUT)
 * @param {number|string} id - Transaction ID
 * @param {Object} transaction - { type, amount, category, description, date }
 * @returns {Promise<Object>} Result with success flag and updated transaction
 */
async function updateTransaction(id, transaction) {
  const userId = getCurrentUserId();
  if (!userId) {
    return {
      success: false,
      message: 'You must be logged in to edit a transaction.'
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/transactions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      // user_id is included so the backend can verify ownership
      body: JSON.stringify({
        user_id: userId,
        type: transaction.type,
        amount: parseFloat(transaction.amount),
        category: transaction.category,
        description: (transaction.description || '').trim(),
        date: transaction.date
      })
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      return {
        success: true,
        message: data.message || 'Transaction updated successfully!',
        transaction: data.transaction
      };
    } else {
      return {
        success: false,
        message: data.message || 'Failed to update transaction.'
      };
    }
  } catch (error) {
    console.error('Error updating transaction:', error);
    return {
      success: false,
      message: 'Backend server is unavailable. Please ensure Flask is running.'
    };
  }
}

/**
 * Calculate Summary Totals from transaction array: Total Income, Total Expenses, Current Balance
 * Formula: Balance = Total Income - Total Expenses
 * @param {Array} transactions
 * @returns {Object} { totalIncome, totalExpense, balance }
 */
function calculateSummary(transactions = []) {
  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(tx => {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amount;
    } else if (tx.type === 'expense') {
      totalExpense += amount;
    }
  });

  const balance = totalIncome - totalExpense;

  return {
    totalIncome,
    totalExpense,
    balance
  };
}

/**
 * Get category breakdown for expenses from transaction array
 * @param {Array} transactions
 * @returns {Object} { breakdown, totalExpense }
 */
function getExpenseCategoryBreakdown(transactions = []) {
  const breakdown = {};

  // Initialize with 0 for all standard expense categories
  CATEGORIES.expense.forEach(cat => {
    breakdown[cat] = 0;
  });

  let totalExpense = 0;

  transactions.forEach(tx => {
    if (tx.type === 'expense') {
      const cat = tx.category || 'Other';
      const amount = Number(tx.amount) || 0;
      breakdown[cat] = (breakdown[cat] || 0) + amount;
      totalExpense += amount;
    }
  });

  return { breakdown, totalExpense };
}

/**
 * Format number to Indian Currency format (₹X,XXX.XX)
 * @param {number} amount
 */
function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format ISO date string to human readable format (DD Mon YYYY)
 * @param {string} dateString
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
