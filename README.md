# 💰 Spendora

Spendora is a modern expense management and budgeting web application designed to help users track their spending habits, manage personal finances, and gain insights into their expenses through a simple and intuitive interface.

## 🚀 Live Demo

🌐 Deployed on Vercel

[Visit Spendora](https://spendora-nine.vercel.app/)

---

## 📖 Overview

Managing personal finances can be challenging without proper tracking tools. Spendora provides an easy-to-use platform where users can:

- Track daily expenses
- Categorize transactions
- Monitor spending patterns
- Manage personal budgets
- View financial summaries
- Maintain expense records securely

The application offers a clean user experience while ensuring reliable data storage and retrieval through a MySQL backend.

---

## ✨ Features

### 👤 User Authentication
- Secure user registration and login
- Password hashing for enhanced security
- Session-based authentication

### 💸 Expense Management
- Add new expenses
- Edit existing transactions
- Delete unwanted records
- Categorize expenses

### 📊 Financial Insights
- Expense summaries
- Spending analysis
- Category-wise tracking
- Budget monitoring

### 📱 Responsive Design
- Mobile-friendly interface
- Optimized for desktop and tablet devices
- Clean and modern UI

---

## 🛠️ Tech Stack

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js

### Database
- MySQL

### Deployment
- Vercel

### Security
- bcryptjs (Password Hashing)

---
📌 Future Enhancements
Monthly budget goals
Expense visualization charts
Export reports (PDF/Excel)
Multi-user dashboards
AI-powered spending insights
Email notifications
Dark mode support
## 📂 Project Structure

```text
Spendora/
│
├── public/                 # Frontend assets
│   ├── css/
│   ├── js/
│   ├── images/
│   └── pages/
│
├── db.js                   # MySQL database configuration
├── server.js               # Main Express server
├── setup.sql               # Database schema and initialization
├── vercel.json             # Vercel deployment configuration
├── package.json            # Project metadata and dependencies
├── package-lock.json       # Dependency lock file
├── .gitignore              # Git ignored files
└── README.md               # Project documentation
