# Student Expense Management System (SEMS)
> **BCA Final Year Academic Project**  
> Responsive full-stack web application built with **HTML5, CSS3, JavaScript (ES6)**, **Python Flask**, and **SQLite Database**.

---

## 📌 Project Overview
**Student Expense Management System** is a financial tracking web application designed specifically for college students to manage their daily pocket money, monthly allowances, and expenses (food, travel, fees, books, bills, and entertainment).

The project uses a clean REST API backend built with **Flask & SQLite** with secure password hashing (`Werkzeug`), coupled with a pure JavaScript dynamic frontend without heavy external frameworks.

---

## 🏗️ System Architecture

### **Frontend**
- **HTML5** & **CSS3** (Modern layout with CSS Grid/Flexbox and custom theme styling)
- **JavaScript (ES6)** (Async API communication using Fetch API)
- **Chart.js** (Visual financial analytics & category distribution charts)
- **Remix Icon CDN** (UI vector icons)

### **Backend**
- **Python 3**
- **Flask** (RESTful API web framework)
- **Werkzeug Security** (Secure password hashing using `generate_password_hash` & `check_password_hash`)
- **CORS Support** (Cross-Origin Resource Sharing enabled for safe frontend interaction)

### **Database**
- **SQLite3** (`database.db` with user-isolated relational schema)
- Automatic table creation and foreign key data integrity enforcement (`PRAGMA foreign_keys = ON`)

### **Authentication & Ownership Security**
- User registration with email validation and duplicate checking
- Secure hashed password authentication
- Strict user data isolation: all CRUD operations (Create, Read, Update, Delete) enforce user ownership validation on every transaction request

---

## 🗂️ Project Structure

```text
Student Expense Management System/
│
├── index.html              # Login Page
├── register.html           # User Registration Page
├── dashboard.html          # Main Student Dashboard (Metrics, Charts, Recent items)
├── add-transaction.html    # Add Income / Expense Form
├── transactions.html       # Transaction History (Search, Filter, Edit, Delete)
├── reports.html            # Financial Analytics & Visual Reports
│
├── css/
│   └── style.css           # Global modern stylesheet
│
├── js/
│   ├── auth.js             # Authentication & session guards
│   ├── data.js             # API request wrappers & calculations
│   ├── register.js         # Registration logic
│   └── app.js              # DOM handlers & Chart.js rendering
│
├── backend/
│   ├── app.py              # Flask Application & RESTful API Endpoints
│   └── database.db         # SQLite Database
│
├── requirements.txt        # Python package dependencies
├── .gitignore              # Git ignore configuration
└── README.md               # Project documentation
```

---

## 💻 Local Setup & Execution

### 1. Prerequisites
Ensure **Python 3.x** is installed on your computer.

### 2. Install Dependencies
Open your terminal/command prompt in the project root directory and run:
```bash
pip install -r requirements.txt
```

### 3. Start the Flask Backend Server
```bash
python backend/app.py
```
*The server will start at `http://127.0.0.1:5000`.*

### 4. Open Application in Browser
Open your web browser and navigate to:
```text
http://127.0.0.1:5000
```

### 🔑 Demo Login Credentials
- **Email:** `student@example.com`
- **Password:** `student123`

---

## 🚀 Production Deployment

### Gunicorn Command
For production deployment on Linux/Cloud environments:
```bash
gunicorn backend.app:app
```

---

## ⚠️ SQLite Cloud Deployment Warning
> **Note on Database Storage:**  
> SQLite is ideal for local development and academic project demonstrations. However, when deploying to cloud hosting platforms (such as Render, Heroku, or Vercel), the container filesystem may be **ephemeral** (read-only or reset on restart/redeploy), causing SQLite database changes to be lost.  
> 
> For permanent cloud production deployments, migrating to a managed database like **PostgreSQL** or **MySQL** is recommended.

---

## 🎓 Key Features Summary
1. **User Registration & Secure Login:** Password hashing with zero plaintext storage.
2. **Dashboard Overview:** Live calculations of Total Income, Total Expenses, and Net Balance.
3. **Transaction CRUD:** Create, View, Edit, and Delete transactions with real-time balance update.
4. **User Data Ownership:** Data is strictly isolated per user account.
5. **Interactive Reports:** Dynamic bar charts and category distribution doughnut charts.
