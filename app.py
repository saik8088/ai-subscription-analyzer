import os
import sqlite3
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from groq import Groq
from dotenv import load_dotenv

load_dotenv() # Load variables from .env

app = Flask(__name__)
app.secret_key = 'your_super_secret_key_here' # Replace with os.urandom(24) in production

# Database configuration for Vercel (read-only filesystem)
if os.environ.get('VERCEL'):
    DB_NAME = "/tmp/database.db"
else:
    DB_NAME = "database.db"


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            monthly_budget REAL DEFAULT 0
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tool_name TEXT NOT NULL,
            monthly_cost REAL NOT NULL,
            yearly_cost REAL NOT NULL,
            features TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    conn.commit()
    conn.close()

# Initialize DB on startup
with app.app_context():
    init_db()

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('home'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        conn.close()

        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            flash('Login successful!', 'success')
            return redirect(url_for('home'))
        else:
            flash('Invalid email or password.', 'error')

    return render_template('pages/login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        password = request.form['password']
        # Confirm password validation done on frontend

        conn = get_db_connection()
        user_exists = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        
        if user_exists:
            flash('Email already registered.', 'error')
            conn.close()
            return redirect(url_for('register'))

        password_hash = generate_password_hash(password)
        try:
            conn.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
                         (name, email, password_hash))
            conn.commit()
            flash('Registration successful! Please login.', 'success')
            conn.close()
            return redirect(url_for('login'))
        except Exception as e:
            conn.rollback()
            flash('An error occurred. Please try again.', 'error')
            conn.close()

    return render_template('pages/register.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Logged out successfully.', 'info')
    return redirect(url_for('login'))

@app.route('/home')
def home():
    if 'user_id' not in session:
        flash('Please login to access the home page.', 'warning')
        return redirect(url_for('login'))
    return render_template('pages/home.html', user_name=session.get('user_name'))

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        flash('Please login to access the dashboard.', 'warning')
        return redirect(url_for('login'))
    return render_template('pages/dashboard.html', user_name=session.get('user_name'))

# API Endpoints
@app.route('/api/tools', methods=['GET', 'POST', 'DELETE'])
def api_tools():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_id = session['user_id']
    conn = get_db_connection()

    if request.method == 'GET':
        tools = conn.execute('SELECT * FROM subscriptions WHERE user_id = ?', (user_id,)).fetchall()
        tool_list = [dict(row) for row in tools]
        conn.close()
        return jsonify(tool_list)
    
    elif request.method == 'POST':
        data = request.json
        tool_name = data.get('tool_name')
        monthly_cost = data.get('monthly_cost')
        yearly_cost = data.get('yearly_cost')
        features = data.get('features')

        if not tool_name or monthly_cost is None or yearly_cost is None or not features:
            return jsonify({'error': 'Missing required fields'}), 400

        try:
            c = conn.cursor()
            c.execute('''
                INSERT INTO subscriptions (user_id, tool_name, monthly_cost, yearly_cost, features)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, tool_name, float(monthly_cost), float(yearly_cost), features))
            conn.commit()
            new_id = c.lastrowid
            conn.close()
            return jsonify({'message': 'Tool added successfully', 'id': new_id}), 201
        except Exception as e:
            conn.rollback()
            conn.close()
            return jsonify({'error': str(e)}), 500

    elif request.method == 'DELETE':
        data = request.json
        tool_id = data.get('tool_id')
        if not tool_id:
            return jsonify({'error': 'Tool ID required'}), 400
        
        try:
            conn.execute('DELETE FROM subscriptions WHERE id = ? AND user_id = ?', (tool_id, user_id))
            conn.commit()
            conn.close()
            return jsonify({'message': 'Tool deleted successfully'}), 200
        except Exception as e:
            conn.rollback()
            conn.close()
            return jsonify({'error': str(e)}), 500


@app.route('/api/budget', methods=['GET', 'POST'])
def api_budget():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_id = session['user_id']
    conn = get_db_connection()

    if request.method == 'GET':
        user = conn.execute('SELECT monthly_budget FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        return jsonify({'budget': user['monthly_budget'] if user and user['monthly_budget'] else 0})
    
    elif request.method == 'POST':
        data = request.json
        budget = data.get('budget', 0)
        try:
            conn.execute('UPDATE users SET monthly_budget = ? WHERE id = ?', (float(budget), user_id))
            conn.commit()
            conn.close()
            return jsonify({'message': 'Budget updated successfully', 'budget': float(budget)}), 200
        except Exception as e:
            conn.rollback()
            conn.close()
            return jsonify({'error': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def api_chat():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    user_message = data.get('message')
    api_key = os.getenv('GROQ_API_KEY')

    if not api_key:
        return jsonify({'error': 'Groq API key is not configured on the server.'}), 500

    # Retrieve user's configured tools to give context to the chatbot
    user_id = session['user_id']
    conn = get_db_connection()
    tools = conn.execute('SELECT tool_name, monthly_cost, yearly_cost, features FROM subscriptions WHERE user_id = ?', (user_id,)).fetchall()
    conn.close()

    context_str = "User's current AI Subscriptions Context:\n"
    if tools:
        for t in tools:
            savings = (t['monthly_cost'] * 12) - t['yearly_cost']
            context_str += f"- Tool: {t['tool_name']} (Cost: ₹{t['monthly_cost']}/mo or ₹{t['yearly_cost']}/yr, Savings: ₹{savings}/yr). Features: {t['features']}\n"
    else:
        context_str += "No tools added yet.\n"

    system_prompt = f"""You are a professional AI Subscription Cost Analyzer Assistant. 
You offer advice prioritizing monetary savings in Indian Rupees (₹).
{context_str}
Address the user respectfully and provide analytical, data-driven advice about their tech stack or specific questions."""

    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_message,
                }
            ],
            model="llama-3.3-70b-versatile",
        )
        response_text = chat_completion.choices[0].message.content
        return jsonify({'response': response_text})
    except Exception as e:
        return jsonify({'error': f"API Error: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)
