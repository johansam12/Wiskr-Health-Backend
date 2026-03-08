from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import pymongo
import certifi
import pickle
import numpy as np
import pandas as pd
from datetime import datetime

app = Flask(__name__)
app.secret_key = "super_secret_healthcare_key"

# Enable CORS so React (running on a different port) can talk to Flask safely
CORS(app, supports_credentials=True, origins=[
    "https://wiskr-health-frontend.vercel.app",
    "https://wiskr-health-frontend-7sfjyxwgw-johansam12s-projects.vercel.app",
    "http://localhost:5173"
])

# --- DATABASE CONNECTION ---
def init_connection():
    ATLAS_URI = "mongodb+srv://johansam12:DARK*haunt12@healthanalyzer.u7wiynq.mongodb.net/?appName=HealthAnalyzer"
    LOCAL_URI = "mongodb://localhost:27017/"
    try:
        client = pymongo.MongoClient(ATLAS_URI, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=3000)
        client.server_info()
        return client
    except:
        try:
            client = pymongo.MongoClient(LOCAL_URI, serverSelectionTimeoutMS=2000)
            return client
        except:
            return None

client = init_connection()

# --- LOAD INDEPENDENT AI MODEL ---
try:
    with open('diabetes_model.pkl', 'rb') as f:
        health_model = pickle.load(f)
    with open('scaler.pkl', 'rb') as f:
        health_scaler = pickle.load(f)
    print("✅ Independent AI Model Loaded Successfully!")
except Exception as e:
    print(f"⚠️ Could not load model: {e}")

# --- PURE API ROUTES ---

@app.route("/api/login", methods=["POST"])
def login():
    username = request.json.get("username")
    password = request.json.get("password")
    
    if client:
        users = client["HealthAnalyzer"]["users"]
        user = users.find_one({"username": username})
        
        # Scenario A: The username doesn't exist
        if not user:
            print(f"⚠️ DEBUG: Username '{username}' does not exist in the database!")
            return jsonify({"status": "error", "message": "Username not found"}), 401
        
        # Scenario B: The password doesn't match the hash
        if check_password_hash(user["password"], password):
            session["user"] = username
            print(f"✅ DEBUG: Doctor '{username}' successfully logged in!")
            return jsonify({"status": "success", "username": username})
        else:
            print(f"⚠️ DEBUG: Incorrect password entered for '{username}'!")
            return jsonify({"status": "error", "message": "Incorrect password"}), 401
            
    # Scenario C: The database is disconnected
    print("🚨 DEBUG: Database is offline. Could not check credentials.")
    return jsonify({"status": "error", "message": "Database connection failed"}), 500

@app.route("/api/register", methods=["POST"])
def api_register():
    username = request.json.get("username")
    password = request.json.get("password")
    if client:
        users = client["HealthAnalyzer"]["users"]
        if users.find_one({"username": username}):
            return jsonify({"status": "error", "message": "Doctor already exists"}), 400
        hashed_pw = generate_password_hash(password)
        users.insert_one({"username": username, "password": hashed_pw})
        session["user"] = username
        return jsonify({"status": "success", "username": username})
    return jsonify({"status": "error", "message": "Database offline"}), 500

@app.route("/api/predict", methods=["POST"])
def predict():
    try:
        data = request.json
        
        # --- 1. YOUR EXISTING FEATURE EXTRACTION ---
        features = [
            float(data['pregnancies']), float(data['glucose']),
            float(data['blood_pressure']), float(data['skin_thickness']),
            float(data['insulin']), float(data['bmi']),
            float(data['pedigree']), float(data['age'])
        ]

        # --- 2. YOUR EXISTING ML PREDICTION ---
        input_array = np.array([features])
        scaled_features = health_scaler.transform(input_array)
        prediction = health_model.predict(scaled_features)
        risk_code = int(prediction[0])

        # --- 3. THE NEW DIAGNOSTIC ENGINE (Analyzes Causes) ---
        glucose = float(data['glucose'])
        bp = float(data['blood_pressure'])
        bmi = float(data['bmi'])

        causes = []
        recommendations = []
        specialist = "General Physician"

        if glucose > 140:
            causes.append("Elevated Glucose (Hyperglycemia)")
            recommendations.append("Limit sugar intake, monitor fasting glucose.")
            specialist = "Endocrinologist"

        if bp > 90:
            causes.append("High Blood Pressure (Hypertension)")
            recommendations.append("Reduce sodium intake, increase cardiovascular exercise.")
            if specialist == "General Physician":
                specialist = "Cardiologist"

        if bmi > 30:
            causes.append("Obesity-related strain")
            recommendations.append("Consult a dietitian for a structured caloric deficit.")

        # Format the final text based on the ML result
        if risk_code == 1:
            diagnosis_text = "High Risk of Diabetes detected. Recommend medical consultation."
            final_causes = causes if causes else ["Unknown metabolic stress"]
            final_action = recommendations if recommendations else ["Consult doctor for detailed plan."]
        else:
            diagnosis_text = "Low Risk. Vitals appear normal."
            final_causes = ["None"]
            final_action = ["Maintain current healthy lifestyle."]
            specialist = "None needed"

        # --- 4. YOUR UPDATED DATABASE SAVE ---
        if client:
            # This pulls the actual logged-in user, or defaults to "Unknown" if testing
            doctor_name = session.get("user", "Unknown Doctor") 
            
            client["HealthAnalyzer"]["patient_records"].insert_one({
                "doctor_username": doctor_name, 
                "vitals": data,
                "diagnosis": diagnosis_text,
                "risk_code": risk_code,
                "suspected_causes": final_causes,
                "suggested_action": final_action,
                "recommended_specialist": specialist,
                "timestamp": datetime.now()
            })

        # --- 5. RETURN FULL REPORT TO REACT ---
        return jsonify({
            "status": "success",
            "diagnosis": diagnosis_text,
            "risk_code": risk_code,
            "suspected_causes": final_causes,
            "suggested_action": final_action,
            "recommended_specialist": specialist
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400
    
@app.route("/api/predict_batch", methods=["POST"])
def predict_batch():
    try:
        # 1. Check if a file was actually uploaded
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "No file uploaded"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"status": "error", "message": "No file selected"}), 400

        # 2. Read the CSV using Pandas
        df = pd.read_csv(file)
        
        # Standardize column names to lowercase just in case the CSV has weird formatting
        df.columns = [col.lower().strip() for col in df.columns]

        batch_results = []

        # 3. Loop through every single patient in the spreadsheet
        for index, row in df.iterrows():
            
            # Extract features safely (default to 0 if a cell is blank)
            features = [
                float(row.get('pregnancies', 0)), float(row.get('glucose', 0)),
                float(row.get('blood_pressure', 0)), float(row.get('skin_thickness', 0)),
                float(row.get('insulin', 0)), float(row.get('bmi', 0)),
                float(row.get('pedigree', 0)), float(row.get('age', 0))
            ]

            # AI Model Prediction
            input_array = np.array([features])
            scaled_features = health_scaler.transform(input_array)
            prediction = health_model.predict(scaled_features)
            risk_code = int(prediction[0])

            # Triage Logic (same as before, but running on each row)
            glucose = float(row.get('glucose', 0))
            bp = float(row.get('blood_pressure', 0))
            bmi = float(row.get('bmi', 0))

            causes = []
            recommendations = []
            specialist = "General Physician"

            if glucose > 140:
                causes.append("Elevated Glucose (Hyperglycemia)")
                recommendations.append("Limit sugar intake, monitor fasting glucose.")
                specialist = "Endocrinologist"

            if bp > 90:
                causes.append("High Blood Pressure (Hypertension)")
                recommendations.append("Reduce sodium intake.")
                if specialist == "General Physician":
                    specialist = "Cardiologist"

            if bmi > 30:
                causes.append("Obesity-related strain")
                recommendations.append("Consult a dietitian.")

            if risk_code == 1:
                diagnosis_text = "High Risk of Diabetes detected."
                final_causes = causes if causes else ["Unknown metabolic stress"]
                final_action = recommendations if recommendations else ["Consult doctor."]
            else:
                diagnosis_text = "Low Risk. Vitals normal."
                final_causes = ["None"]
                final_action = ["Maintain healthy lifestyle."]
                specialist = "None needed"

            # Package this patient's result and add it to our list
            batch_results.append({
                "patient_id": f"PT-{index + 1000}", # Generates a fake ID like PT-1000, PT-1001
                "vitals": {k: float(v) for k, v in row.items()}, # Convert row to standard dictionary
                "diagnosis": diagnosis_text,
                "risk_code": risk_code,
                "suspected_causes": final_causes,
                "suggested_action": final_action,
                "recommended_specialist": specialist
            })

        # Send the massive array of processed patients back to React!
        return jsonify({"status": "success", "batch_results": batch_results})

    except Exception as e:
        print(f"🚨 BATCH ERROR: {str(e)}")
        return jsonify({"status": "error", "message": f"Failed to process CSV: {str(e)}"}), 500

@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("user", None)
    return jsonify({"status": "success"})

if __name__ == "__main__":
    print("App is running...Hold Ctrl and click http://127.0.0.1:5001 to open in browser.")
    app.run(debug=True, port=5001)