import pandas as pd
from sklearn.tree import DecisionTreeClassifier
import pickle

# -----------------------------
# STEP 1: Create Sample Dataset
# -----------------------------
data = {
    "age": [25, 60, 45, 30, 70, 10, 50, 80],
    "pain_scale": [3, 9, 6, 2, 10, 4, 7, 8],
    "symptom_code": [1, 2, 3, 1, 2, 3, 2, 1],
    "priority": [3, 1, 2, 3, 1, 2, 2, 1]
}

df = pd.DataFrame(data)

# -----------------------------
# STEP 2: Features & Target
# -----------------------------
X = df[["age", "pain_scale", "symptom_code"]]
y = df["priority"]

# -----------------------------
# STEP 3: Train Model
# -----------------------------
model = DecisionTreeClassifier()
model.fit(X, y)

print("Model trained successfully")

# -----------------------------
# STEP 4: Save Model
# -----------------------------
with open("triage_model.pkl", "wb") as f:
    pickle.dump(model, f)

print("Model saved as triage_model.pkl")