# 🤖 AI Subscription Cost Analyzer

## 📌 Overview
AI Subscription Cost Analyzer is a web application that helps users track, analyze, and manage their monthly spending on AI tools and subscriptions. It provides a simple dashboard to view costs and make better financial decisions.


## 🚀 Features
- 🔐 User Authentication (Login & Register)
- 📊 Dashboard to track subscription costs
- 💡 Monthly cost analysis
- 🗂️ Organized UI using templates
- ⚡ Fast and lightweight Flask backend


## 🛠️ Tech Stack
- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Python (Flask)
- **Database**: SQLite (`database.db`)
- **Deployment**: Vercel


## 📁 Project Structureai-subscription-analyzer/
│
├── static/
│ ├── css/
│ │ └── style.css
│ └── js/
│ └── app.js
│
├── templates/
│ ├── base.html
│ ├── dashboard.html
│ ├── login.html
│ └── register.html
│
├── app.py
├── database.db
├── requirements.txt
├── vercel.json
├── .env
└── .gitignore




## ⚙️ Installation & Setup

### 1️⃣ Clone the repository
```bash
git clone https://github.com/saik8088/ai-subscription-analyzer.git
cd ai-subscription-analyzer

2️⃣ Create virtual environment
python -m venv venv


3️⃣ Activate environment
Windows:
venv\Scripts\activate

Mac/Linux:
source venv/bin/activate

4️⃣ Install dependencies
pip install -r requirements.txt


5️⃣ Run the application
python app.py

🌐 Live Demo

👉 https://ai-subscription-analyzer-1lid.vercel.app/dashboard
