import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score

# Load scan results (update this file name if needed)
df = pd.read_csv("scan_results.csv")

# Create column if missing
if "is_actual_anomaly" not in df.columns:
    df["is_actual_anomaly"] = None  # Fill manually later if needed

# Drop rows with missing labels
df_clean = df.dropna(subset=["is_actual_anomaly"])

# Convert strings to boolean if needed
df_clean["is_anomaly"] = df_clean["is_anomaly"].astype(bool)
df_clean["is_actual_anomaly"] = df_clean["is_actual_anomaly"].astype(bool)

# Calculate metrics
precision = precision_score(df_clean["is_actual_anomaly"], df_clean["is_anomaly"])
recall = recall_score(df_clean["is_actual_anomaly"], df_clean["is_anomaly"])
f1 = f1_score(df_clean["is_actual_anomaly"], df_clean["is_anomaly"])

print("🧪 Detection Accuracy Metrics:")
print(f"Precision: {precision:.2f}")
print(f"Recall:    {recall:.2f}")
print(f"F1 Score:  {f1:.2f}")

# Optional: Save cleaned data
df_clean.to_csv("scan_results_labeled.csv", index=False)
