import numpy as np
from sklearn.neural_network import MLPRegressor
import joblib

# 1. Training Data (Features: Distance, Quality, Price)
# Distance (lower is better), Quality (higher is better), Price (lower is better)
X = np.array([
    [2.0, 4.8, 100],  # Excellent supplier, close, cheap
    [45.0, 3.0, 500], # Far, lower quality, expensive
    [10.0, 4.0, 200], # Average
    [5.0, 2.0, 150],  # Close but bad quality
    [50.0, 5.0, 120]  # Far but high quality and cheap
])

# 2. Target Scores (0 to 100) - What we want the AI to learn
y = np.array([95, 10, 60, 40, 75])

# 3. Initialize the MLP Neural Network
# We use 2 hidden layers with 5 neurons each
mlp = MLPRegressor(hidden_layer_sizes=(5, 5), max_iter=2000, random_state=1)

# 4. Train the "Brain"
print("Training the Neural Network...")
mlp.fit(X, y)

# 5. Save the trained model to a file
joblib.dump(mlp, "procurement_model.pkl")
print("Neural Network Model saved as procurement_model.pkl")


# Test the AI with a hypothetical new supplier
# [Distance=12km, Quality=4.5, Price=180]
test_supplier = np.array([[12.0, 4.5, 180]])
prediction = mlp.predict(test_supplier)

print(f"Predicted Score for new supplier: {prediction[0]:.2f}")