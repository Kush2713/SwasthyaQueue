from flask import Flask, request, jsonify
import pickle
import pandas as pd

app = Flask(__name__)

# -----------------------------
# Load trained model
# -----------------------------
with open("triage_model.pkl", "rb") as f:
    model = pickle.load(f)

# -----------------------------
# Home route (test)
# -----------------------------
@app.route("/")
def home():
    return "ML API Running..."

# -----------------------------
# Prediction route
# -----------------------------
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json

        age = data["age"]
        pain_scale = data["pain_scale"]
        symptom_code = data["symptom_code"]

        input_data = pd.DataFrame(
            [[age, pain_scale, symptom_code]],
            columns=["age", "pain_scale", "symptom_code"]
        )

        prediction = model.predict(input_data)

        return jsonify({
            "priority": int(prediction[0])
        })

    except Exception as e:
        return jsonify({"error": str(e)})

# -----------------------------
# Run server
# -----------------------------
if __name__ == "__main__":
    app.run(port=5001, debug=True)