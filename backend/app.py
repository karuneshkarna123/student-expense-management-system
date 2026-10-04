"""
Student Expense Management System - Backend
Flask + SQLite Database, Authentication & Secure Password Hashing
BCA Final Year Project
"""

import os
import re
import sqlite3
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

# 1. Initialize Flask Application
app = Flask(__name__)

# 2. Configure Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, 'database.db')
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))


# 3. Database Connection Helper Function
def get_db_connection():
    """
    Establishes and returns a connection to the SQLite database.
    row_factory allows accessing columns by name like a dictionary.
    """
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# 4. Enable Simple Cross-Origin Resource Sharing (CORS) Headers
@app.after_request
def add_cors_headers(response):
    """
    Adds CORS headers to every response so the frontend HTML/JS
    can communicate smoothly with this Flask backend API.
    """
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    return response


# 5. Database Initialization (Auto-creates tables, hashes passwords & seeds initial data)
def init_db():
    """
    Creates 'users' and 'transactions' tables automatically if they do not exist,
    migrates any plain-text passwords to secure hashes, and seeds initial data.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Enable foreign keys support in SQLite
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    """)

    # 2. Create transactions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)

    # 3. Check if test user already exists
    test_email = 'student@example.com'
    cursor.execute("SELECT id, password FROM users WHERE LOWER(email) = LOWER(?)", (test_email,))
    existing_user = cursor.fetchone()

    if not existing_user:
        # Securely hash the initial test password
        hashed_password = generate_password_hash('student123')
        cursor.execute("""
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
        """, ('Karna', test_email, hashed_password))
        conn.commit()
        user_id = cursor.lastrowid
        print(f"[*] Seeded test user with secure password hash: Karna ({test_email})")
    else:
        user_id = existing_user["id"]
        # Safe migration: if existing user has plain-text password, upgrade to hash
        stored_password = existing_user["password"]
        if not (stored_password.startswith("scrypt:") or stored_password.startswith("pbkdf2:")):
            upgraded_hash = generate_password_hash(stored_password)
            cursor.execute("UPDATE users SET password = ? WHERE id = ?", (upgraded_hash, user_id))
            conn.commit()
            print(f"[*] Migrated plain-text password to secure Werkzeug hash for user: {test_email}")

    # 4. Migrate any other plain-text passwords in users table
    cursor.execute("SELECT id, email, password FROM users")
    all_users = cursor.fetchall()
    for u in all_users:
        raw_pwd = u["password"]
        if not (raw_pwd.startswith("scrypt:") or raw_pwd.startswith("pbkdf2:")):
            secure_hash = generate_password_hash(raw_pwd)
            cursor.execute("UPDATE users SET password = ? WHERE id = ?", (secure_hash, u["id"]))
            conn.commit()
            print(f"[*] Migrated password to secure hash for user ID {u['id']} ({u['email']})")

    # 5. Seed initial transactions for demo student if empty
    cursor.execute("SELECT COUNT(*) as count FROM transactions WHERE user_id = ?", (user_id,))
    tx_count = cursor.fetchone()["count"]
    if tx_count == 0:
        initial_records = [
            (user_id, 'income', 12000.0, 'Monthly Allowance', 'Monthly pocket money from parents', '2026-09-01'),
            (user_id, 'expense', 3500.0, 'Education', 'BCA Semester Exam Fees & Lab Manuals', '2026-09-03'),
            (user_id, 'expense', 1800.0, 'Food', 'Hostel mess fee & college canteen snacks', '2026-09-06'),
            (user_id, 'expense', 650.0, 'Travel', 'Monthly Metro and Bus Student Pass', '2026-09-08'),
            (user_id, 'income', 4000.0, 'Freelance', 'HTML/CSS website design for small shop', '2026-09-12'),
            (user_id, 'expense', 499.0, 'Bills', 'Mobile recharge & high speed internet plan', '2026-09-14'),
            (user_id, 'expense', 850.0, 'Entertainment', 'Weekend movie ticket and snacks with friends', '2026-09-18'),
            (user_id, 'expense', 1200.0, 'Shopping', 'New college backpack and stationery', '2026-09-21'),
            (user_id, 'expense', 450.0, 'Food', 'Group project pizza party', '2026-09-24')
        ]
        cursor.executemany("""
            INSERT INTO transactions (user_id, type, amount, category, description, date)
            VALUES (?, ?, ?, ?, ?, ?)
        """, initial_records)
        conn.commit()
        print(f"[*] Seeded {len(initial_records)} initial transactions for user {user_id}")

    conn.close()


# Run database initialization & migrations on startup
init_db()


# 6. Test Endpoint (Backend Health Check)
@app.route('/api/test', methods=['GET'])
def test_api():
    """
    Test endpoint to confirm that Flask is running
    and the SQLite database is reachable.
    """
    try:
        conn = get_db_connection()
        conn.close()
        db_status = "Connected successfully"
    except Exception as e:
        db_status = f"Database error: {str(e)}"

    return jsonify({
        "status": "success",
        "message": "Student Expense Management System backend is running successfully!",
        "database": db_status
    }), 200


# 7. Secure User Login API Endpoint (POST /api/login)
@app.route('/api/login', methods=['POST', 'OPTIONS'])
def login():
    """
    Receives email and password as JSON, verifies credentials against the stored
    Werkzeug password hash in the SQLite users table, and returns a success response.
    """
    # Handle preflight CORS request
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({
                "status": "error",
                "message": "Invalid request payload. JSON format required."
            }), 400

        email = (data.get('email') or '').strip()
        password = (data.get('password') or '').strip()

        # Basic input validation
        if not email or not password:
            return jsonify({
                "status": "error",
                "message": "Email and password are required."
            }), 400

        # Query user from SQLite database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, password FROM users WHERE LOWER(email) = LOWER(?)", (email,))
        user = cursor.fetchone()
        conn.close()

        # Secure password hash verification
        if not user or not check_password_hash(user["password"], password):
            return jsonify({
                "status": "error",
                "message": "Invalid email or password"
            }), 401

        # Return safe user details (NO passwords or password hashes are ever exposed)
        return jsonify({
            "status": "success",
            "message": "Login successful",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"]
            }
        }), 200

    except Exception as e:
        print(f"[ERROR] login: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "An internal server error occurred. Please try again."
        }), 500


# 8. User Registration API Endpoint (POST /api/register)
@app.route('/api/register', methods=['POST', 'OPTIONS'])
def register():
    """
    Receives name, email, and password as JSON.
    Validates input, checks for duplicate email, hashes the password,
    and inserts the new user into the SQLite users table.
    Never stores plain-text passwords.
    """
    # Handle preflight CORS request
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({
                "status": "error",
                "message": "Invalid request payload. JSON format required."
            }), 400

        # Extract and clean input fields
        name     = (data.get('name') or '').strip()
        email    = (data.get('email') or '').strip()
        password = (data.get('password') or '').strip()

        # 1. Validate that all required fields are provided
        if not name or not email or not password:
            return jsonify({
                "status": "error",
                "message": "Name, email, and password are required."
            }), 400

        # 2. Validate email format using a simple regex pattern
        email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_pattern, email):
            return jsonify({
                "status": "error",
                "message": "Please enter a valid email address."
            }), 400

        # 3. Validate minimum password length
        if len(password) < 6:
            return jsonify({
                "status": "error",
                "message": "Password must be at least 6 characters long."
            }), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # 4. Check if the email already exists in the database (case-insensitive)
        cursor.execute(
            "SELECT id FROM users WHERE LOWER(email) = LOWER(?)" ,
            (email,)
        )
        existing_user = cursor.fetchone()

        if existing_user:
            conn.close()
            return jsonify({
                "status": "error",
                "message": "An account with this email already exists."
            }), 409  # 409 Conflict

        # 5. Hash the password using Werkzeug — never store plain-text
        hashed_password = generate_password_hash(password)

        # 6. Insert the new user into the users table
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            (name, email, hashed_password)
        )
        conn.commit()
        new_user_id = cursor.lastrowid
        conn.close()

        print(f"[*] New user registered: {name} ({email}) — ID {new_user_id}")

        return jsonify({
            "status": "success",
            "message": "Registration successful! You can now log in."
        }), 201

    except Exception as e:
        print(f"[ERROR] register: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "An internal server error occurred. Please try again."
        }), 500


# 9. Create Transaction API Endpoint (POST /api/transactions)
@app.route('/api/transactions', methods=['POST', 'OPTIONS'])
def create_transaction():
    """
    Receives JSON payload with transaction details, validates inputs,
    inserts the transaction into SQLite, and returns the created record.
    """
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({
                "status": "error",
                "message": "Invalid request payload. JSON format required."
            }), 400

        user_id = data.get('user_id')
        tx_type = (data.get('type') or '').strip().lower()
        amount = data.get('amount')
        category = (data.get('category') or '').strip()
        description = (data.get('description') or '').strip()
        date = (data.get('date') or '').strip()

        # 1. Validate required fields
        if user_id is None:
            return jsonify({"status": "error", "message": "user_id is required."}), 400

        if tx_type not in ['income', 'expense']:
            return jsonify({"status": "error", "message": "type must be either 'income' or 'expense'."}), 400

        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({"status": "error", "message": "amount must be a positive number."}), 400
        except (TypeError, ValueError):
            return jsonify({"status": "error", "message": "amount must be a valid numeric value."}), 400

        if not category:
            return jsonify({"status": "error", "message": "category is required."}), 400

        if not date:
            return jsonify({"status": "error", "message": "date is required."}), 400

        # 2. Verify user existence in database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        user_row = cursor.fetchone()

        if not user_row:
            conn.close()
            return jsonify({"status": "error", "message": f"User with ID {user_id} does not exist."}), 404

        # 3. Insert new transaction
        cursor.execute("""
            INSERT INTO transactions (user_id, type, amount, category, description, date)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, tx_type, amount, category, description, date))
        conn.commit()

        new_transaction_id = cursor.lastrowid

        # 4. Fetch the created transaction to return
        cursor.execute("""
            SELECT id, user_id, type, amount, category, description, date 
            FROM transactions 
            WHERE id = ?
        """, (new_transaction_id,))
        new_row = cursor.fetchone()
        conn.close()

        created_tx = {
            "id": new_row["id"],
            "user_id": new_row["user_id"],
            "type": new_row["type"],
            "amount": new_row["amount"],
            "category": new_row["category"],
            "description": new_row["description"],
            "date": new_row["date"]
        }

        return jsonify({
            "status": "success",
            "message": "Transaction created successfully",
            "transaction": created_tx
        }), 201

    except Exception as e:
        print(f"[ERROR] create_transaction: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "An internal server error occurred. Please try again."
        }), 500


# 9. Get User Transactions API Endpoint (GET /api/transactions/<user_id>)
@app.route('/api/transactions/<int:user_id>', methods=['GET'])
def get_user_transactions(user_id):
    """
    Returns only transactions belonging to the specified user_id,
    sorted newest first (by date descending, then id descending).
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, user_id, type, amount, category, description, date
            FROM transactions
            WHERE user_id = ?
            ORDER BY date DESC, id DESC
        """, (user_id,))
        rows = cursor.fetchall()
        conn.close()

        transactions_list = []
        for row in rows:
            transactions_list.append({
                "id": row["id"],
                "user_id": row["user_id"],
                "type": row["type"],
                "amount": row["amount"],
                "category": row["category"],
                "description": row["description"],
                "date": row["date"]
            })

        return jsonify({
            "status": "success",
            "count": len(transactions_list),
            "transactions": transactions_list
        }), 200

    except Exception as e:
        print(f"[ERROR] get_user_transactions: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "An internal server error occurred. Please try again."
        }), 500


# 10. Delete Transaction API Endpoint (DELETE /api/transactions/<transaction_id>)
@app.route('/api/transactions/<int:transaction_id>', methods=['DELETE', 'OPTIONS'])
def delete_transaction(transaction_id):
    """
    Deletes the specified transaction ONLY if it belongs to the requesting user.
    The caller must supply ?user_id=<id> in the query string so we can verify ownership.
    Returns 403 if the transaction does not belong to the requesting user.
    """
    if request.method == 'OPTIONS':
        return '', 200

    try:
        # Read user_id from query string (e.g. DELETE /api/transactions/5?user_id=2)
        requesting_user_id = request.args.get('user_id', type=int)
        if not requesting_user_id:
            return jsonify({
                "status": "error",
                "message": "user_id is required to delete a transaction."
            }), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if transaction exists
        cursor.execute("SELECT id, user_id FROM transactions WHERE id = ?", (transaction_id,))
        row = cursor.fetchone()

        if not row:
            conn.close()
            return jsonify({
                "status": "error",
                "message": "Transaction not found."
            }), 404

        # OWNERSHIP CHECK: Verify the transaction belongs to the requesting user
        if row["user_id"] != requesting_user_id:
            conn.close()
            return jsonify({
                "status": "error",
                "message": "You do not have permission to delete this transaction."
            }), 403

        # Delete transaction record
        cursor.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        conn.commit()
        conn.close()

        return jsonify({
            "status": "success",
            "message": "Transaction deleted successfully"
        }), 200

    except Exception as e:
        print(f"[ERROR] delete_transaction: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "An internal server error occurred. Please try again."
        }), 500


# 11. Update / Edit Transaction API Endpoint (PUT /api/transactions/<transaction_id>)
@app.route('/api/transactions/<int:transaction_id>', methods=['PUT', 'OPTIONS'])
def update_transaction(transaction_id):
    """
    Receives updated transaction data as JSON, validates inputs,
    verifies ownership (user_id in JSON body must own the transaction),
    and updates the transaction record in the SQLite database.
    """
    if request.method == 'OPTIONS':
        return '', 200

    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({
                "status": "error",
                "message": "Invalid request payload. JSON format required."
            }), 400

        # Extract user_id for ownership verification
        requesting_user_id = data.get('user_id')
        if not requesting_user_id:
            return jsonify({"status": "error", "message": "user_id is required to update a transaction."}), 400
        try:
            requesting_user_id = int(requesting_user_id)
        except (TypeError, ValueError):
            return jsonify({"status": "error", "message": "user_id must be a valid integer."}), 400

        tx_type = (data.get('type') or '').strip().lower()
        amount = data.get('amount')
        category = (data.get('category') or '').strip()
        description = (data.get('description') or '').strip()
        date = (data.get('date') or '').strip()

        # Input Validations
        if tx_type not in ['income', 'expense']:
            return jsonify({"status": "error", "message": "type must be either 'income' or 'expense'."}), 400

        try:
            amount = float(amount)
            if amount <= 0:
                return jsonify({"status": "error", "message": "amount must be a positive number."}), 400
        except (TypeError, ValueError):
            return jsonify({"status": "error", "message": "amount must be a valid numeric value."}), 400

        if not category:
            return jsonify({"status": "error", "message": "category is required."}), 400

        if not date:
            return jsonify({"status": "error", "message": "date is required."}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if transaction exists
        cursor.execute("SELECT id, user_id FROM transactions WHERE id = ?", (transaction_id,))
        existing_tx = cursor.fetchone()

        if not existing_tx:
            conn.close()
            return jsonify({
                "status": "error",
                "message": "Transaction not found."
            }), 404

        # OWNERSHIP CHECK: Verify the transaction belongs to the requesting user
        if existing_tx["user_id"] != requesting_user_id:
            conn.close()
            return jsonify({
                "status": "error",
                "message": "You do not have permission to edit this transaction."
            }), 403

        # Update transaction record
        cursor.execute("""
            UPDATE transactions
            SET type = ?, amount = ?, category = ?, description = ?, date = ?
            WHERE id = ?
        """, (tx_type, amount, category, description, date, transaction_id))
        conn.commit()

        # Fetch updated record
        cursor.execute("""
            SELECT id, user_id, type, amount, category, description, date
            FROM transactions
            WHERE id = ?
        """, (transaction_id,))
        updated_row = cursor.fetchone()
        conn.close()

        updated_tx = {
            "id": updated_row["id"],
            "user_id": updated_row["user_id"],
            "type": updated_row["type"],
            "amount": updated_row["amount"],
            "category": updated_row["category"],
            "description": updated_row["description"],
            "date": updated_row["date"]
        }

        return jsonify({
            "status": "success",
            "message": "Transaction updated successfully",
            "transaction": updated_tx
        }), 200

    except Exception as e:
        print(f"[ERROR] update_transaction: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "An internal server error occurred. Please try again."
        }), 500


# 12. Development-only Endpoint to List Users (Safe information only)
@app.route('/api/users', methods=['GET'])
def get_users():
    """
    Returns only safe public user information (id, name, email) for testing.
    Passwords and password hashes are strictly excluded.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email FROM users")
        rows = cursor.fetchall()
        conn.close()

        users_list = []
        for row in rows:
            users_list.append({
                "id": row["id"],
                "name": row["name"],
                "email": row["email"]
            })

        return jsonify({
            "status": "success",
            "count": len(users_list),
            "users": users_list
        }), 200
    except Exception as e:
        print(f"[ERROR] get_users: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "An internal server error occurred. Please try again."
        }), 500


# 13. Frontend Static Pages and Assets Serving
@app.route('/', methods=['GET'])
def serve_root():
    """Serves the main login page."""
    return send_from_directory(PROJECT_ROOT, 'index.html')


@app.route('/<path:filename>', methods=['GET'])
def serve_frontend_files(filename):
    """
    Serves HTML pages (e.g. dashboard.html, add-transaction.html, transactions.html, reports.html)
    and static assets (css/style.css, js/app.js, etc.).
    """
    file_path = os.path.join(PROJECT_ROOT, filename)
    if os.path.exists(file_path):
        return send_from_directory(PROJECT_ROOT, filename)
    return jsonify({"status": "error", "message": f"Resource '{filename}' not found."}), 404


# 14. Start Flask Server
# Reads PORT and DEBUG from environment variables for deployment flexibility.
# For local development: python backend/app.py  → runs on http://127.0.0.1:5000
# For production (Gunicorn): gunicorn backend.app:app  → Gunicorn controls host/port
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # DEBUG mode is OFF by default. Set environment variable DEBUG=true to enable locally.
    debug_mode = os.environ.get('DEBUG', 'false').lower() == 'true'
    host = '0.0.0.0' if os.environ.get('PORT') else '127.0.0.1'

    print(f"[*] Starting Student Expense Management System")
    print(f"[*] Open Web App:     http://127.0.0.1:{port}")
    print(f"[*] Open Dashboard:   http://127.0.0.1:{port}/dashboard.html")
    print(f"[*] API Health Check: http://127.0.0.1:{port}/api/test")
    print(f"[*] Debug mode: {debug_mode}")
    app.run(host=host, port=port, debug=debug_mode)
