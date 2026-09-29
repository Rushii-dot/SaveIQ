from flask import Flask, jsonify, request
from flask_cors import CORS
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
import uuid
import os
from dotenv import load_dotenv
from groq import Groq
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

groq_client = Groq(
    api_key=GROQ_API_KEY
)

app = Flask(__name__)
CORS(app)

# =========================
# GOOGLE SHEETS CONFIG
# =========================

SPREADSHEET_ID = "1ocDIVGRAwDS1IFCkgEpQn6hqvqGpep1IjF2S1T80fT8"
SHEET_NAME = "Goals"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

credentials = Credentials.from_service_account_file(
    "backend/google_credentials.json",
    scopes=SCOPES
)

client = gspread.authorize(credentials)

spreadsheet = client.open_by_key(SPREADSHEET_ID)
sheet = spreadsheet.worksheet(SHEET_NAME)


# =========================
# HOME
# =========================

@app.route("/")
def home():
    return jsonify({
        "success": True,
        "message": "SaveIQ Backend is running 🚀"
    })


# =========================
# API TEST
# =========================

@app.route("/api/test")
def test():
    return jsonify({
        "success": True,
        "message": "API connection successful"
    })


# =========================
# GET ALL GOALS
# =========================

@app.route("/api/goals", methods=["GET"])
def get_goals():

    records = sheet.get_all_records()

    return jsonify({
        "success": True,
        "goals": records
    })


# =========================
# CREATE GOAL
# =========================

@app.route("/api/goals", methods=["POST"])
def add_goal():

    data = request.get_json()

    goal_name = str(data.get("goalName", "")).strip()
    target_amount = float(data.get("targetAmount", 0))
    initial_savings = float(data.get("initialSavings", 0))
    deadline = str(data.get("deadline", "")).strip()
    email = str(data.get("email", "")).strip()
    purpose = str(data.get("purpose", "")).strip()

    # Validation

    if not goal_name:
        return jsonify({
            "success": False,
            "message": "Goal name is required."
        }), 400

    if target_amount <= 0:
        return jsonify({
            "success": False,
            "message": "Target amount must be greater than 0."
        }), 400

    if initial_savings < 0:
        return jsonify({
            "success": False,
            "message": "Initial savings cannot be negative."
        }), 400

    if initial_savings > target_amount:
        return jsonify({
            "success": False,
            "message": "Initial savings cannot be greater than target amount."
        }), 400

    if not deadline:
        return jsonify({
            "success": False,
            "message": "Deadline is required."
        }), 400

    if not email:
        return jsonify({
            "success": False,
            "message": "Email is required."
        }), 400

    # Generate ID

    goal_id = "G-" + str(uuid.uuid4())[:8]

    # Store in Google Sheets

    sheet.append_row([
        goal_id,
        goal_name,
        target_amount,
        initial_savings,
        deadline,
        purpose,
        datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        email,
        False
    ])

    return jsonify({
        "success": True,
        "message": "Goal created successfully.",
        "goalId": goal_id
    })


# =========================
# RUN SERVER
# =========================
# =========================
# UPDATE SAVINGS
# =========================

@app.route("/api/goals/<goal_id>/savings", methods=["PUT"])
def update_savings(goal_id):

    data = request.get_json() or {}

    amount = float(data.get("amount", 0))

    if amount <= 0:
        return jsonify({
            "success": False,
            "message": "Savings amount must be greater than 0."
        }), 400

    records = sheet.get_all_records()

    for index, goal in enumerate(records, start=2):

        if str(goal.get("ID")) == str(goal_id):

            target = float(goal.get("Target Amount", 0))
            current = float(goal.get("Saved Amount", 0))

            new_saved_amount = current + amount

            if new_saved_amount > target:
                return jsonify({
                    "success": False,
                    "message": "Savings cannot exceed target amount."
                }), 400

            # Column 4 = Saved Amount
            sheet.update_cell(index, 4, new_saved_amount)

            return jsonify({
                "success": True,
                "message": "Savings updated successfully.",
                "savedAmount": new_saved_amount
            })

    return jsonify({
        "success": False,
        "message": "Goal not found."
    }), 404
    # =========================
# DELETE GOAL
# =========================

@app.route("/api/goals/<goal_id>", methods=["DELETE"])
def delete_goal(goal_id):

    records = sheet.get_all_records()

    for index, goal in enumerate(records, start=2):

        if str(goal.get("ID")) == str(goal_id):

            sheet.delete_rows(index)

            return jsonify({
                "success": True,
                "message": "Goal deleted successfully."
            })

    return jsonify({
        "success": False,
        "message": "Goal not found."
    }), 404
    # =========================
# AI INSIGHTS
# =========================

@app.route("/api/goals/<goal_id>/ai-insights", methods=["GET"])
def ai_insights(goal_id):

    records = sheet.get_all_records()

    selected_goal = None

    for goal in records:

        if str(goal.get("ID")) == str(goal_id):
            selected_goal = goal
            break

    if not selected_goal:
        return jsonify({
            "success": False,
            "message": "Goal not found."
        }), 404

    goal_name = selected_goal.get("Goal Name", "")
    target = float(selected_goal.get("Target Amount", 0))
    saved = float(selected_goal.get("Saved Amount", 0))
    deadline = selected_goal.get("Deadline", "")
    purpose = selected_goal.get("Purpose", "")

    remaining = max(target - saved, 0)

    prompt = f"""
You are SaveIQ, an AI savings assistant.

Analyze this savings goal:

Goal: {goal_name}
Target Amount: ₹{target}
Current Savings: ₹{saved}
Remaining Amount: ₹{remaining}
Deadline: {deadline}
Purpose: {purpose}

Give concise and practical financial guidance.

Include:
1. Current progress
2. Suggested savings strategy
3. A short motivational tip

Do not recommend loans, investments, or risky financial products.
Keep the response under 150 words.
"""

    try:

        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.4,
            max_tokens=500
        )

        insights = response.choices[0].message.content

        return jsonify({
            "success": True,
            "insights": insights
        })

    except Exception as error:

        print("Groq API Error:", error)

        return jsonify({
            "success": False,
            "message": "Unable to generate AI insights."
        }), 500
if __name__ == "__main__":
    app.run(debug=True, port=5000)