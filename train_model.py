import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import pickle

print("1. Loading Medical Data...")
# Fetching the standard Pima Indians Diabetes dataset
url = "https://raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv"
columns = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness', 'Insulin', 'BMI', 'DiabetesPedigree', 'Age', 'Outcome']
data = pd.DataFrame(pd.read_csv(url, names=columns))

# 'Outcome' is what we want to predict (0 = Negative, 1 = Positive)
X = data.drop('Outcome', axis=1) # The 8 vitals
y = data['Outcome']              # The diagnosis

print("2. Splitting data into Training and Testing sets...")
# We keep 20% of the data hidden to test the AI's accuracy later
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("3. Scaling the Data...")
# Medical numbers have different ranges (e.g., Insulin goes up to 800, Age up to 80). 
# We scale them down so the math works perfectly.
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

print("4. Training the AI Model using Random Forest...")
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train_scaled, y_train)

print("5. Testing the Model...")
predictions = model.predict(X_test_scaled)
accuracy = accuracy_score(y_test, predictions)
print(f"✅ Model trained successfully! Accuracy: {accuracy * 100:.2f}%")

print("6. Saving the Model and Scaler for Flask...")
# We save the trained model
with open('diabetes_model.pkl', 'wb') as f:
    pickle.dump(model, f)

# We MUST save the scaler too, so Flask can scale user input the exact same way
with open('scaler.pkl', 'wb') as f:
    pickle.dump(scaler, f)

print("'diabetes_model.pkl' and 'scaler.pkl' successfully set up.")