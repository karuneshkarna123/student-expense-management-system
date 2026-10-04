/**
 * register.js
 * Handles the user registration form submission.
 * Sends the new user's data to the Flask backend (POST /api/register).
 * Shows validation errors inline and redirects to login on success.
 * BCA Final Year Academic Project
 */

// Use the same shared API base URL pattern as auth.js and data.js
// This avoids 'const' re-declaration errors when multiple scripts load
window.API_BASE_URL = window.API_BASE_URL || 'https://karuneshkarna.pythonanywhere.com';
var API_BASE_URL = window.API_BASE_URL;

// Simple email format check (same pattern as backend)
function isValidEmail(email) {
  var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

// Show an error message in the red error alert box
function showRegError(message) {
  var errorBox  = document.getElementById('regErrorMessage');
  var errorText = document.getElementById('regErrorText');
  var successBox = document.getElementById('regSuccessMessage');
  successBox.style.display = 'none';
  errorText.textContent = message;
  errorBox.style.display = 'flex';
}

// Show a success message in the green success alert box
function showRegSuccess(message) {
  var errorBox    = document.getElementById('regErrorMessage');
  var successBox  = document.getElementById('regSuccessMessage');
  var successText = document.getElementById('regSuccessText');
  errorBox.style.display = 'none';
  successText.textContent = message;
  successBox.style.display = 'flex';
}

// Hide both alert boxes (used when a new form submit begins)
function hideRegAlerts() {
  document.getElementById('regErrorMessage').style.display = 'none';
  document.getElementById('regSuccessMessage').style.display = 'none';
}

// Main registration form submit handler
document.getElementById('registerForm').addEventListener('submit', async function(e) {
  e.preventDefault(); // Prevent default browser form submission

  var nameInput    = document.getElementById('regName');
  var emailInput   = document.getElementById('regEmail');
  var passInput    = document.getElementById('regPassword');
  var confirmInput = document.getElementById('regConfirmPassword');
  var submitBtn    = document.getElementById('registerBtn');

  var name     = nameInput.value.trim();
  var email    = emailInput.value.trim();
  var password = passInput.value.trim();
  var confirm  = confirmInput.value.trim();

  // Hide any old alerts and set loading state
  hideRegAlerts();
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="ri-loader-4-line"></i> Creating Account...';

  // ---- Frontend Validations ----

  // 1. All fields must be filled
  if (!name || !email || !password || !confirm) {
    showRegError('All fields are required. Please fill in every field.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ri-user-add-line"></i> Create Account';
    return;
  }

  // 2. Email format check
  if (!isValidEmail(email)) {
    showRegError('Please enter a valid email address (e.g. student@example.com).');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ri-user-add-line"></i> Create Account';
    return;
  }

  // 3. Password minimum length
  if (password.length < 6) {
    showRegError('Password must be at least 6 characters long.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ri-user-add-line"></i> Create Account';
    return;
  }

  // 4. Passwords must match
  if (password !== confirm) {
    showRegError('Passwords do not match. Please re-enter your password.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ri-user-add-line"></i> Create Account';
    return;
  }

  // ---- Send Registration Request to Backend ----
  try {
    var response = await fetch(API_BASE_URL + '/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, password: password })
    });

    var result = await response.json();

    if (result.status === 'success') {
      // Show green success message
      showRegSuccess('Account created successfully! Redirecting to login page...');

      // Clear the form fields
      nameInput.value    = '';
      emailInput.value   = '';
      passInput.value    = '';
      confirmInput.value = '';

      // Redirect to login page after 1.5 seconds
      setTimeout(function() {
        window.location.href = 'index.html';
      }, 1500);

    } else {
      // Show the error message returned from the backend
      showRegError(result.message || 'Registration failed. Please try again.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="ri-user-add-line"></i> Create Account';
    }

  } catch (err) {
    // Network / connection error (Flask not running?)
    console.error('Registration error:', err);
    showRegError(
      'Cannot connect to the server. Please make sure the Flask backend is running at ' + API_BASE_URL
    );
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="ri-user-add-line"></i> Create Account';
  }
});
