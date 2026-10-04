/**
 * Student Expense Management System
 * Authentication & Session Module (Connected to Flask + SQLite Backend)
 * BCA Final Year Project
 */

// Backend Flask API Base URL (Safe global configuration)
window.API_BASE_URL = window.API_BASE_URL || 'https://karuneshkarna.pythonanywhere.com';
var API_BASE_URL = window.API_BASE_URL;

// Storage keys for browser session
var AUTH_STATE_KEY = 'isLoggedIn';
var AUTH_USER_KEY = 'student_expense_active_user';

/**
 * Send Login Request to Flask Backend (POST /api/login)
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} { success: boolean, message: string, user?: Object }
 */
async function login(email, password) {
  const cleanEmail = (email || '').trim();
  const cleanPassword = (password || '').trim();

  // 1. Basic Frontend Validation
  if (!cleanEmail || !cleanPassword) {
    return {
      success: false,
      message: 'Please enter both email and password.'
    };
  }

  try {
    // 2. Call Flask Backend API
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: cleanPassword
      })
    });

    const data = await response.json();

    // 3. Handle Successful Login
    if (response.ok && data.status === 'success') {
      // Store login session flag in localStorage
      localStorage.setItem(AUTH_STATE_KEY, 'true');

      // Store authenticated user profile in localStorage (id, name, email)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));

      return {
        success: true,
        message: data.message || 'Login successful!',
        user: data.user
      };
    } else {
      // 4. Handle Invalid Credentials or Validation Error from Server
      return {
        success: false,
        message: data.message || 'Invalid email or password'
      };
    }
  } catch (error) {
    // 5. Handle Network / Backend Offline Error
    console.error('Login API error:', error);
    return {
      success: false,
      message: 'Unable to connect to backend server. Please make sure the Flask server is running at http://127.0.0.1:5000'
    };
  }
}

/**
 * Perform Logout: clears session and returns to login page
 */
function logout() {
  localStorage.removeItem(AUTH_STATE_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  window.location.href = 'index.html';
}

/**
 * Check Authentication status on page load
 * Protects internal pages (dashboard, add-transaction, history, reports) from unauthorized access
 */
function checkAuth() {
  const pathname = window.location.pathname;
  const isLoginPage = pathname.endsWith('index.html') || 
                      pathname.endsWith('/') || 
                      pathname.endsWith('login.html');

  const isLoggedIn = localStorage.getItem(AUTH_STATE_KEY) === 'true';

  // Rule 1: If user is NOT logged in and tries to access internal pages, redirect to login
  if (!isLoggedIn && !isLoginPage) {
    window.location.href = 'index.html';
    return;
  }

  // Rule 2: If user IS already logged in and opens the login page, redirect to dashboard
  if (isLoggedIn && isLoginPage) {
    window.location.href = 'dashboard.html';
    return;
  }

  // Populate authenticated student info in sidebar
  if (isLoggedIn && !isLoginPage) {
    const rawUserData = localStorage.getItem(AUTH_USER_KEY);
    if (rawUserData) {
      try {
        const user = JSON.parse(rawUserData);
        document.querySelectorAll('.user-display-name').forEach(el => {
          el.textContent = user.name || 'Student';
        });
        document.querySelectorAll('.user-display-email').forEach(el => {
          el.textContent = user.email || 'student@example.com';
        });
        document.querySelectorAll('.user-avatar').forEach(el => {
          el.textContent = (user.name || 'S').charAt(0).toUpperCase();
        });
      } catch (e) {
        console.error('Failed to parse user session data', e);
      }
    }
  }
}

/**
 * Mobile responsive sidebar toggle
 */
function setupMobileMenu() {
  const toggleBtn = document.querySelector('.mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target) && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });
  }
}

// Automatically initialize authentication checks and event listeners on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupMobileMenu();

  // Attach logout handler to sidebar logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to log out?')) {
        logout();
      }
    });
  }
});
