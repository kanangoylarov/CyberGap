# AI Classification Service — Complete Implementation Plan

## Overview

This service trains and serves an XGBoost multi-class classifier on the UNSW-NB15 dataset to classify network traffic into 10 attack categories. The serving layer is a FastAPI application that loads pre-trained model artifacts at startup and exposes a `/classify` endpoint for real-time inference.

**Architecture Pattern:** Model -> Repository -> Service -> Controller (Router)

---

## Attack Categories (from UNSW-NB15)

```python
attack_mapping = {
    'Normal': 0, 'Generic': 1, 'Exploits': 2, 'Fuzzers': 3,
    'DoS': 4, 'Reconnaissance': 5, 'Analysis': 6, 'Backdoor': 7,
    'Shellcode': 8, 'Worms': 9
}
```

---

## UNSW-NB15 Feature Set (All 49 features)

| # | Name | Type | Description |
|---|------|------|-------------|
| 1 | srcip | nominal | Source IP address |
| 2 | sport | integer | Source port number |
| 3 | dstip | nominal | Destination IP address |
| 4 | dsport | integer | Destination port number |
| 5 | proto | nominal | Transaction protocol |
| 6 | state | nominal | Protocol state (ACC, CLO, CON, FIN, INT, etc.) |
| 7 | dur | float | Record total duration |
| 8 | sbytes | integer | Source to destination bytes |
| 9 | dbytes | integer | Destination to source bytes |
| 10 | sttl | integer | Source to dest time to live |
| 11 | dttl | integer | Dest to source time to live |
| 12 | sloss | integer | Source packets retransmitted/dropped |
| 13 | dloss | integer | Dest packets retransmitted/dropped |
| 14 | service | nominal | http, ftp, smtp, ssh, dns, ftp-data, irc, (-) |
| 15 | Sload | float | Source bits per second |
| 16 | Dload | float | Destination bits per second |
| 17 | Spkts | integer | Source to dest packet count |
| 18 | Dpkts | integer | Dest to source packet count |
| 19 | swin | integer | Source TCP window advertisement |
| 20 | dwin | integer | Destination TCP window advertisement |
| 21 | stcpb | integer | Source TCP base sequence number |
| 22 | dtcpb | integer | Destination TCP base sequence number |
| 23 | smeansz | integer | Mean flow packet size (src) |
| 24 | dmeansz | integer | Mean flow packet size (dst) |
| 25 | trans_depth | integer | HTTP request/response pipelined depth |
| 26 | res_bdy_len | integer | Actual uncompressed content size from server HTTP |
| 27 | Sjit | float | Source jitter (ms) |
| 28 | Djit | float | Destination jitter (ms) |
| 29 | Stime | timestamp | Record start time |
| 30 | Ltime | timestamp | Record last time |
| 31 | Sintpkt | float | Source interpacket arrival time (ms) |
| 32 | Dintpkt | float | Destination interpacket arrival time (ms) |
| 33 | tcprtt | float | TCP round-trip time (synack + ackdat) |
| 34 | synack | float | Time between SYN and SYN_ACK |
| 35 | ackdat | float | Time between SYN_ACK and ACK |
| 36 | is_sm_ips_ports | binary | 1 if src/dst IP and ports equal |
| 37 | ct_state_ttl | integer | Count per state for TTL range |
| 38 | ct_flw_http_mthd | integer | Count of flows with HTTP methods |
| 39 | is_ftp_login | binary | 1 if FTP login used |
| 40 | ct_ftp_cmd | integer | Count of FTP command flows |
| 41 | ct_srv_src | integer | Connections same service+src in last 100 |
| 42 | ct_srv_dst | integer | Connections same service+dst in last 100 |
| 43 | ct_dst_ltm | integer | Connections same dst in last 100 |
| 44 | ct_src_ltm | integer | Connections same src in last 100 |
| 45 | ct_src_dport_ltm | integer | Connections same src+dst_port in last 100 |
| 46 | ct_dst_sport_ltm | integer | Connections same dst+src_port in last 100 |
| 47 | ct_dst_src_ltm | integer | Connections same src+dst in last 100 |
| 48 | attack_cat | nominal | Attack category (target label) |
| 49 | Label | binary | 0=normal, 1=attack |

---

## Directory Tree

```
ai-classifier/
├── Dockerfile
├── requirements.txt
├── requirements-train.txt
├── train/
│   ├── __init__.py
│   ├── download_dataset.py        # Download UNSW-NB15 CSV files
│   ├── preprocess.py              # Feature engineering, encoding, scaling
│   ├── train_model.py             # XGBoost training with class balancing
│   ├── evaluate.py                # Classification report, confusion matrix
│   └── export_model.py            # Save model + scaler + encoder as joblib
├── models/                        # Trained model artifacts (gitignored, baked into Docker)
│   ├── .gitkeep
│   ├── classifier.joblib          # Trained XGBoost model
│   ├── scaler.joblib              # StandardScaler
│   ├── encoder.joblib             # OneHotEncoder for categorical features
│   └── feature_columns.json       # Ordered list of feature column names after encoding
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app with lifespan (load model at startup)
│   ├── config.py                  # Settings via pydantic-settings
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py             # ClassifyRequest (all 49 features), ClassifyResponse
│   ├── repositories/
│   │   ├── __init__.py
│   │   └── model_repository.py    # Loads and caches model artifacts from disk
│   ├── services/
│   │   ├── __init__.py
│   │   ├── preprocessor_service.py    # Transform raw features -> model-ready feature vector
│   │   └── classifier_service.py      # Run inference, return prediction + confidence
│   ├── controllers/
│   │   ├── __init__.py
│   │   ├── classify_controller.py     # POST /classify endpoint
│   │   └── health_controller.py       # GET /health
│   └── utils/
│       ├── __init__.py
│       └── logging.py
└── tests/
    ├── __init__.py
    ├── test_preprocessor.py
    └── test_classifier.py
```

---

## File-by-File Implementation Specifications

---

### 1. `requirements.txt` (Serving dependencies — used in Dockerfile)

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
xgboost==2.0.3
scikit-learn==1.4.0
numpy==1.26.0
pandas==2.2.0
joblib==1.3.0
pydantic==2.7.0
pydantic-settings==2.3.0
python-json-logger==2.0.7
```

---

### 2. `requirements-train.txt` (Training dependencies — run on developer machine)

```
xgboost==2.0.3
scikit-learn==1.4.0
numpy==1.26.0
pandas==2.2.0
joblib==1.3.0
matplotlib==3.8.0
seaborn==0.13.0
requests==2.31.0
```

---

### 3. `Dockerfile`

```dockerfile
FROM python:3.11-slim AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
COPY models/ ./models/
COPY app/ ./app/
RUN useradd -r appuser && chown -R appuser /app
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Notes:**
- Multi-stage build: first stage installs pip dependencies, second stage copies only the installed packages and application code.
- The `models/` directory containing trained artifacts is baked into the image. These files are produced by the training pipeline and must exist before building the Docker image.
- Runs as non-root `appuser` for security.
- Exposes port 8000 for the FastAPI/Uvicorn server.

---

## Training Pipeline

---

### 4. `train/__init__.py`

Empty file. Makes `train/` a Python package.

```python
# ai-classifier/train/__init__.py
```

---

### 5. `train/download_dataset.py`

**Purpose:** Download the four UNSW-NB15 CSV data files and the features description file from the official UNSW research site. Store them locally under `train/data/`.

```python
"""
Download UNSW-NB15 dataset.

Source: https://research.unsw.edu.au/projects/unsw-nb15-dataset
Files downloaded:
  - UNSW-NB15_1.csv
  - UNSW-NB15_2.csv
  - UNSW-NB15_3.csv
  - UNSW-NB15_4.csv
  - UNSW-NB15_features.csv  (feature descriptions / column header reference)

Download destination: train/data/
Total: ~2.5 million records with 49 features across the 4 data files.
"""

import os
import requests
import pandas as pd

# Base URL where the CSV files are hosted.
# NOTE: The actual UNSW-NB15 dataset must be downloaded from the official UNSW page.
# If the direct download links change, update these URLs accordingly.
DATASET_URLS = {
    "UNSW-NB15_1.csv": "https://research.unsw.edu.au/...",
    "UNSW-NB15_2.csv": "https://research.unsw.edu.au/...",
    "UNSW-NB15_3.csv": "https://research.unsw.edu.au/...",
    "UNSW-NB15_4.csv": "https://research.unsw.edu.au/...",
    "UNSW-NB15_features.csv": "https://research.unsw.edu.au/...",
}

# Column names for the main data files. The raw CSV files do NOT have headers;
# column names come from UNSW-NB15_features.csv. We hard-code them here for reliability.
COLUMN_NAMES = [
    'srcip', 'sport', 'dstip', 'dsport', 'proto', 'state', 'dur',
    'sbytes', 'dbytes', 'sttl', 'dttl', 'sloss', 'dloss', 'service',
    'Sload', 'Dload', 'Spkts', 'Dpkts', 'swin', 'dwin', 'stcpb',
    'dtcpb', 'smeansz', 'dmeansz', 'trans_depth', 'res_bdy_len',
    'Sjit', 'Djit', 'Stime', 'Ltime', 'Sintpkt', 'Dintpkt',
    'tcprtt', 'synack', 'ackdat', 'is_sm_ips_ports', 'ct_state_ttl',
    'ct_flw_http_mthd', 'is_ftp_login', 'ct_ftp_cmd', 'ct_srv_src',
    'ct_srv_dst', 'ct_dst_ltm', 'ct_src_ltm', 'ct_src_dport_ltm',
    'ct_dst_sport_ltm', 'ct_dst_src_ltm', 'attack_cat', 'Label'
]


def download_dataset(output_dir: str = "train/data") -> None:
    """
    Download all CSV files from DATASET_URLS into output_dir.

    For each file:
      1. Check if the file already exists in output_dir. If yes, skip it.
      2. If not, download via HTTP GET with stream=True.
      3. Write the response content to disk in chunks of 8192 bytes.
      4. Print progress messages to stdout.

    Args:
        output_dir: Directory to save downloaded files. Created if it does not exist.

    Raises:
        requests.HTTPError: If any download fails with a non-200 status code.
    """
    os.makedirs(output_dir, exist_ok=True)

    for filename, url in DATASET_URLS.items():
        filepath = os.path.join(output_dir, filename)
        if os.path.exists(filepath):
            print(f"[skip] {filename} already exists at {filepath}")
            continue

        print(f"[download] Downloading {filename}...")
        response = requests.get(url, stream=True, timeout=120)
        response.raise_for_status()

        with open(filepath, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        print(f"[done] Saved {filename} ({os.path.getsize(filepath)} bytes)")


def load_dataset(data_dir: str = "train/data") -> pd.DataFrame:
    """
    Load and concatenate all 4 UNSW-NB15 data CSV files into a single DataFrame.

    Steps:
      1. For each file UNSW-NB15_1.csv through UNSW-NB15_4.csv:
         a. Read with pd.read_csv, header=None, names=COLUMN_NAMES, low_memory=False.
         b. Append to a list.
      2. pd.concat all DataFrames, reset_index(drop=True).
      3. Print the shape of the combined DataFrame.
      4. Return the combined DataFrame.

    Args:
        data_dir: Directory containing the downloaded CSV files.

    Returns:
        pd.DataFrame with ~2.5M rows and 49 columns.

    Raises:
        FileNotFoundError: If any of the 4 CSV files are missing.
    """
    dfs = []
    for i in range(1, 5):
        filepath = os.path.join(data_dir, f"UNSW-NB15_{i}.csv")
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Missing dataset file: {filepath}")
        print(f"[load] Reading {filepath}...")
        df = pd.read_csv(filepath, header=None, names=COLUMN_NAMES, low_memory=False)
        dfs.append(df)

    combined = pd.concat(dfs, ignore_index=True)
    print(f"[load] Combined dataset shape: {combined.shape}")
    return combined


if __name__ == "__main__":
    download_dataset()
    df = load_dataset()
    print(df.head())
    print(df['attack_cat'].value_counts())
```

---

### 6. `train/preprocess.py`

**Purpose:** Feature engineering pipeline. Handles missing values, encodes categoricals, scales numerics, extracts target labels, and saves all fitted artifacts to disk for serving.

```python
"""
Feature engineering pipeline for UNSW-NB15 dataset.

Processing steps:
  1. Drop columns not useful for classification:
     - srcip, dstip (IP addresses are nominal, too many unique values)
     - Stime, Ltime (timestamps, not generalizable)
     - Label (we use attack_cat as our target, not the binary Label)

  2. Map attack_cat to integer labels:
     - '' or NaN -> 0 (Normal)
     - 'Generic' -> 1, 'Exploits' -> 2, 'Fuzzers' -> 3, 'DoS' -> 4,
       'Reconnaissance' -> 5, 'Analysis' -> 6, 'Backdoor' -> 7,
       'Shellcode' -> 8, 'Worms' -> 9

  3. Handle missing values:
     - Numeric columns: fill NaN with 0
     - Categorical columns (proto, state, service): fill NaN with '-'

  4. Encode categorical features via OneHotEncoder:
     - proto: ~6 unique values (tcp, udp, arp, ospf, etc.)
     - state: ~10 unique values (FIN, CON, INT, ACC, CLO, etc.)
     - service: ~13 unique values (http, ftp, dns, ssh, smtp, ftp-data, irc, -, etc.)
     - Use handle_unknown='ignore' so unseen categories at inference become all-zeros.
     - Use sparse_output=False for dense arrays.

  5. Scale numeric features via StandardScaler:
     - All remaining numeric columns after dropping IPs, timestamps, Label, attack_cat.

  6. Save artifacts to models/ directory:
     - scaler.joblib (fitted StandardScaler)
     - encoder.joblib (fitted OneHotEncoder)
     - feature_columns.json (ordered list of final column names after encoding)

  7. Train/test split: 80/20, stratified by attack_cat.
"""

import json
import os
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Mapping from attack category string to integer label.
ATTACK_MAPPING = {
    'Normal': 0, 'Generic': 1, 'Exploits': 2, 'Fuzzers': 3,
    'DoS': 4, 'Reconnaissance': 5, 'Analysis': 6, 'Backdoor': 7,
    'Shellcode': 8, 'Worms': 9
}


class DataPreprocessor:
    """
    Encapsulates all preprocessing logic: encoding, scaling, and column ordering.

    Attributes:
        scaler (StandardScaler): Fitted scaler for numeric features.
        encoder (OneHotEncoder): Fitted encoder for categorical features.
        categorical_features (list[str]): Names of categorical columns to encode.
        drop_columns (list[str]): Columns to drop before feature extraction.
        numeric_features (list[str]): Names of numeric columns (populated during fit).
        feature_columns (list[str]): Final ordered column names after encoding+scaling.
    """

    def __init__(self):
        self.scaler = StandardScaler()
        self.encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
        self.categorical_features: list[str] = ['proto', 'state', 'service']
        self.drop_columns: list[str] = ['srcip', 'dstip', 'Stime', 'Ltime', 'Label', 'attack_cat']
        self.numeric_features: list[str] = []  # populated during fit
        self.feature_columns: list[str] = []   # populated during fit

    def fit_transform(self, df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        """
        Fit the scaler and encoder on the provided DataFrame and transform it.

        Steps:
          1. Extract target labels y by mapping the 'attack_cat' column through
             map_attack_category(). NaN or empty strings map to 0 (Normal).
          2. Drop columns listed in self.drop_columns from the DataFrame.
          3. Fill missing values:
             - For each column in self.categorical_features: fillna('-')
             - For all other (numeric) columns: fillna(0)
          4. Identify numeric feature names: all columns not in self.categorical_features.
             Store in self.numeric_features.
          5. Fit and transform categorical features with self.encoder.
             Get encoded column names from encoder.get_feature_names_out().
          6. Fit and transform numeric features with self.scaler.
          7. Concatenate encoded categoricals and scaled numerics horizontally (np.hstack).
          8. Build self.feature_columns as the concatenation of encoded column names
             followed by numeric column names.
          9. Return (X, y) where X is a 2D numpy array of shape (n_samples, n_features)
             and y is a 1D numpy array of integer labels.

        Args:
            df: Raw DataFrame with all 49 UNSW-NB15 columns.

        Returns:
            Tuple of (X, y):
              - X: np.ndarray of shape (n_samples, n_features), dtype float64
              - y: np.ndarray of shape (n_samples,), dtype int64
        """
        # Extract target
        y = df['attack_cat'].apply(self.map_attack_category).values

        # Drop unused columns
        df_features = df.drop(columns=self.drop_columns, errors='ignore')

        # Handle missing values
        for col in self.categorical_features:
            if col in df_features.columns:
                df_features[col] = df_features[col].fillna('-').astype(str).str.strip()

        self.numeric_features = [
            col for col in df_features.columns if col not in self.categorical_features
        ]

        # Fill numeric NaNs
        df_features[self.numeric_features] = df_features[self.numeric_features].fillna(0)

        # Ensure numeric types
        for col in self.numeric_features:
            df_features[col] = pd.to_numeric(df_features[col], errors='coerce').fillna(0)

        # Encode categoricals
        cat_encoded = self.encoder.fit_transform(df_features[self.categorical_features])
        cat_col_names = list(self.encoder.get_feature_names_out(self.categorical_features))

        # Scale numerics
        num_scaled = self.scaler.fit_transform(df_features[self.numeric_features].values)

        # Combine
        X = np.hstack([cat_encoded, num_scaled])
        self.feature_columns = cat_col_names + self.numeric_features

        return X, y

    def transform(self, df: pd.DataFrame) -> np.ndarray:
        """
        Transform a DataFrame using the already-fitted scaler and encoder.

        Steps:
          1. Drop columns in self.drop_columns.
          2. Fill missing values (same logic as fit_transform).
          3. Encode categoricals with self.encoder.transform().
          4. Scale numerics with self.scaler.transform().
          5. Concatenate and return.

        Args:
            df: DataFrame with the same columns as training data (minus target).

        Returns:
            np.ndarray of shape (n_samples, n_features).
        """
        df_features = df.drop(columns=self.drop_columns, errors='ignore')

        for col in self.categorical_features:
            if col in df_features.columns:
                df_features[col] = df_features[col].fillna('-').astype(str).str.strip()

        df_features[self.numeric_features] = df_features[self.numeric_features].fillna(0)

        for col in self.numeric_features:
            df_features[col] = pd.to_numeric(df_features[col], errors='coerce').fillna(0)

        cat_encoded = self.encoder.transform(df_features[self.categorical_features])
        num_scaled = self.scaler.transform(df_features[self.numeric_features].values)

        X = np.hstack([cat_encoded, num_scaled])
        return X

    def save_artifacts(self, output_dir: str = "models") -> None:
        """
        Save the fitted scaler, encoder, and feature column list to disk.

        Files created:
          - {output_dir}/scaler.joblib
          - {output_dir}/encoder.joblib
          - {output_dir}/feature_columns.json

        Args:
            output_dir: Directory to save artifacts. Created if it does not exist.
        """
        os.makedirs(output_dir, exist_ok=True)

        joblib.dump(self.scaler, os.path.join(output_dir, "scaler.joblib"))
        joblib.dump(self.encoder, os.path.join(output_dir, "encoder.joblib"))

        with open(os.path.join(output_dir, "feature_columns.json"), "w") as f:
            json.dump(self.feature_columns, f, indent=2)

        print(f"[save] Artifacts saved to {output_dir}/")

    @staticmethod
    def map_attack_category(attack_cat) -> int:
        """
        Map an attack category string to its integer label.

        Handles:
          - NaN / None -> 0 (Normal)
          - Empty string '' -> 0 (Normal)
          - Whitespace-only strings -> 0 (Normal)
          - Exact match (case-insensitive with strip) against ATTACK_MAPPING keys

        Args:
            attack_cat: The raw attack_cat value from the dataset.

        Returns:
            Integer label 0-9.
        """
        if pd.isna(attack_cat) or str(attack_cat).strip() == '':
            return 0
        cleaned = str(attack_cat).strip()
        # Try exact match first
        if cleaned in ATTACK_MAPPING:
            return ATTACK_MAPPING[cleaned]
        # Try case-insensitive match
        for key, val in ATTACK_MAPPING.items():
            if key.lower() == cleaned.lower():
                return val
        # Unknown category falls back to Normal
        return 0


def split_data(
    X: np.ndarray, y: np.ndarray,
    test_size: float = 0.2, random_state: int = 42
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Stratified train/test split.

    Args:
        X: Feature matrix.
        y: Label vector.
        test_size: Fraction for test set (default 0.2).
        random_state: Random seed for reproducibility.

    Returns:
        (X_train, X_test, y_train, y_test)
    """
    return train_test_split(X, y, test_size=test_size, stratify=y, random_state=random_state)
```

---

### 7. `train/train_model.py`

**Purpose:** Train the XGBoost multi-class classifier with class balancing and early stopping.

```python
"""
Train XGBoost multi-class classifier on preprocessed UNSW-NB15 data.

Model configuration:
  - objective: 'multi:softprob' (outputs probability distribution over 10 classes)
  - num_class: 10
  - n_estimators: 200 (max boosting rounds)
  - max_depth: 8
  - learning_rate: 0.1
  - subsample: 0.8
  - colsample_bytree: 0.8
  - min_child_weight: 5
  - eval_metric: 'mlogloss'
  - tree_method: 'hist' (fast histogram-based method)
  - use_label_encoder: False

Class balancing:
  - Uses sklearn.utils.class_weight.compute_sample_weight('balanced', y_train)
  - This up-weights rare classes like Worms and Shellcode.
  - Passed as sample_weight to model.fit().

Early stopping:
  - eval_set = [(X_test, y_test)]
  - early_stopping_rounds = 20
  - Training stops if mlogloss on the eval set does not improve for 20 rounds.
"""

import numpy as np
import xgboost as xgb
from sklearn.utils.class_weight import compute_sample_weight

from train.download_dataset import download_dataset, load_dataset
from train.preprocess import DataPreprocessor, split_data
from train.evaluate import evaluate, print_report
from train.export_model import export_model


def train(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray
) -> xgb.XGBClassifier:
    """
    Train an XGBoost multi-class classifier.

    Steps:
      1. Instantiate xgb.XGBClassifier with the configuration listed above.
      2. Compute sample weights via compute_sample_weight('balanced', y_train).
      3. Call model.fit() with:
         - X_train, y_train
         - sample_weight=sample_weights
         - eval_set=[(X_test, y_test)]
         - verbose=True (print eval metric each round)
      4. Print the best iteration number and best score.
      5. Return the trained model.

    Args:
        X_train: Training feature matrix, shape (n_train, n_features).
        y_train: Training labels, shape (n_train,).
        X_test: Test feature matrix, shape (n_test, n_features).
        y_test: Test labels, shape (n_test,).

    Returns:
        Trained xgb.XGBClassifier instance.
    """
    model = xgb.XGBClassifier(
        objective='multi:softprob',
        num_class=10,
        n_estimators=200,
        max_depth=8,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        eval_metric='mlogloss',
        tree_method='hist',
        use_label_encoder=False,
        early_stopping_rounds=20,
        random_state=42,
    )

    sample_weights = compute_sample_weight('balanced', y_train)

    model.fit(
        X_train, y_train,
        sample_weight=sample_weights,
        eval_set=[(X_test, y_test)],
        verbose=True,
    )

    print(f"[train] Best iteration: {model.best_iteration}")
    print(f"[train] Best score: {model.best_score}")

    return model


def main() -> None:
    """
    Full training pipeline:
      1. Download dataset (skip if already present).
      2. Load all 4 CSV files into a single DataFrame.
      3. Initialize DataPreprocessor and fit_transform to get (X, y).
      4. Split into train/test (80/20, stratified).
      5. Train XGBoost model.
      6. Evaluate on test set and print report.
      7. Export model and preprocessing artifacts to models/ directory.

    This function is the entry point when running:
        python -m train.train_model
    """
    # Step 1: Download
    print("=" * 60)
    print("Step 1: Download dataset")
    print("=" * 60)
    download_dataset()

    # Step 2: Load
    print("=" * 60)
    print("Step 2: Load dataset")
    print("=" * 60)
    df = load_dataset()

    # Step 3: Preprocess
    print("=" * 60)
    print("Step 3: Preprocess")
    print("=" * 60)
    preprocessor = DataPreprocessor()
    X, y = preprocessor.fit_transform(df)
    print(f"Feature matrix shape: {X.shape}")
    print(f"Label distribution: {np.bincount(y)}")

    # Step 4: Split
    print("=" * 60)
    print("Step 4: Train/test split")
    print("=" * 60)
    X_train, X_test, y_train, y_test = split_data(X, y)
    print(f"Train: {X_train.shape[0]} samples")
    print(f"Test:  {X_test.shape[0]} samples")

    # Step 5: Train
    print("=" * 60)
    print("Step 5: Train XGBoost model")
    print("=" * 60)
    model = train(X_train, y_train, X_test, y_test)

    # Step 6: Evaluate
    print("=" * 60)
    print("Step 6: Evaluate")
    print("=" * 60)
    label_names = [
        'Normal', 'Generic', 'Exploits', 'Fuzzers', 'DoS',
        'Reconnaissance', 'Analysis', 'Backdoor', 'Shellcode', 'Worms'
    ]
    metrics = evaluate(model, X_test, y_test, label_names)
    print_report(metrics)

    # Step 7: Export
    print("=" * 60)
    print("Step 7: Export model and artifacts")
    print("=" * 60)
    preprocessor.save_artifacts("models")
    export_model(model, "models")

    print("=" * 60)
    print("Training complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
```

---

### 8. `train/evaluate.py`

**Purpose:** Evaluate the trained model on the test set. Produce accuracy, per-class precision/recall/F1, confusion matrix, and per-class sample counts.

```python
"""
Evaluation utilities for the trained XGBoost classifier.

Produces:
  1. Overall accuracy
  2. Classification report (precision, recall, F1 per class)
  3. Confusion matrix (10x10)
  4. Per-class sample counts in the test set

Expected results: ~93-96% overall accuracy.
Worms and Shellcode may have lower recall due to fewer training samples.
"""

import numpy as np
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)


def evaluate(
    model: xgb.XGBClassifier,
    X_test: np.ndarray,
    y_test: np.ndarray,
    label_names: list[str],
) -> dict:
    """
    Run evaluation on the test set and return a metrics dictionary.

    Steps:
      1. model.predict(X_test) -> y_pred (integer predictions).
      2. Compute overall accuracy via accuracy_score(y_test, y_pred).
      3. Generate classification_report as a dict via output_dict=True,
         using target_names=label_names.
      4. Compute confusion_matrix(y_test, y_pred).
      5. Compute per-class sample counts via np.bincount(y_test, minlength=10).
      6. Return dict with keys:
         - 'accuracy': float
         - 'classification_report': dict (from sklearn)
         - 'confusion_matrix': np.ndarray of shape (10, 10)
         - 'class_counts': np.ndarray of shape (10,)
         - 'label_names': list[str]

    Args:
        model: Trained XGBClassifier.
        X_test: Test feature matrix.
        y_test: Test label vector.
        label_names: List of 10 attack category names in order (index 0-9).

    Returns:
        Dictionary containing all evaluation metrics.
    """
    y_pred = model.predict(X_test)

    accuracy = accuracy_score(y_test, y_pred)

    report = classification_report(
        y_test, y_pred,
        target_names=label_names,
        output_dict=True,
        zero_division=0,
    )

    cm = confusion_matrix(y_test, y_pred)

    class_counts = np.bincount(y_test, minlength=10)

    return {
        'accuracy': accuracy,
        'classification_report': report,
        'confusion_matrix': cm,
        'class_counts': class_counts,
        'label_names': label_names,
    }


def print_report(metrics: dict) -> None:
    """
    Pretty-print evaluation results to stdout.

    Output format:
      - Overall accuracy as a percentage.
      - Per-class table with columns: Class, Precision, Recall, F1, Support.
      - Confusion matrix as a formatted grid.
      - Per-class sample count summary.

    Args:
        metrics: Dictionary returned by evaluate().
    """
    print(f"\nOverall Accuracy: {metrics['accuracy']:.4f} ({metrics['accuracy']*100:.2f}%)\n")

    print("Per-Class Metrics:")
    print(f"{'Class':<20} {'Precision':>10} {'Recall':>10} {'F1-Score':>10} {'Support':>10}")
    print("-" * 60)

    report = metrics['classification_report']
    for name in metrics['label_names']:
        if name in report:
            r = report[name]
            print(
                f"{name:<20} {r['precision']:>10.4f} {r['recall']:>10.4f} "
                f"{r['f1-score']:>10.4f} {r['support']:>10.0f}"
            )

    print(f"\n{'Confusion Matrix:'}")
    print(metrics['confusion_matrix'])

    print(f"\n{'Per-Class Sample Counts (test set):'}")
    for i, name in enumerate(metrics['label_names']):
        print(f"  {name}: {metrics['class_counts'][i]}")
```

---

### 9. `train/export_model.py`

**Purpose:** Save the trained XGBoost model to disk as a joblib file.

```python
"""
Export trained model to the models/ directory.

Saves:
  - models/classifier.joblib  (the trained XGBoost model)

Note: The preprocessing artifacts (scaler.joblib, encoder.joblib, feature_columns.json)
are saved separately by DataPreprocessor.save_artifacts(). This module only handles the
model itself.
"""

import os
import joblib
import xgboost as xgb


def export_model(model: xgb.XGBClassifier, output_dir: str = "models") -> None:
    """
    Save the trained XGBoost model to disk.

    Steps:
      1. Create output_dir if it does not exist.
      2. Save model via joblib.dump to {output_dir}/classifier.joblib.
      3. Print confirmation with file size.

    Args:
        model: Trained XGBClassifier instance.
        output_dir: Directory to save the model file.
    """
    os.makedirs(output_dir, exist_ok=True)

    model_path = os.path.join(output_dir, "classifier.joblib")
    joblib.dump(model, model_path)

    size_mb = os.path.getsize(model_path) / (1024 * 1024)
    print(f"[export] Model saved to {model_path} ({size_mb:.2f} MB)")
```

---

## Serving Application

---

### 10. `app/__init__.py`

Empty file. Makes `app/` a Python package.

```python
# ai-classifier/app/__init__.py
```

---

### 11. `app/config.py`

**Purpose:** Application settings using pydantic-settings. Reads from environment variables with sensible defaults.

```python
"""
Application configuration via environment variables.

Environment variables:
  - MODEL_DIR: Path to directory containing model artifacts (default: "models")
  - LOG_LEVEL: Logging level (default: "INFO")
  - APP_HOST: Host to bind the server to (default: "0.0.0.0")
  - APP_PORT: Port to bind the server to (default: 8000)
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Attributes:
        model_dir (str): Path to directory containing classifier.joblib, scaler.joblib,
            encoder.joblib, and feature_columns.json. Default: "models".
        log_level (str): Logging level. One of DEBUG, INFO, WARNING, ERROR. Default: "INFO".
        app_host (str): Host to bind the server. Default: "0.0.0.0".
        app_port (int): Port to bind the server. Default: 8000.
    """

    model_dir: str = "models"
    log_level: str = "INFO"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    class Config:
        env_prefix = ""
        case_sensitive = False


settings = Settings()
```

---

### 12. `app/models/__init__.py`

Empty file.

```python
# ai-classifier/app/models/__init__.py
```

---

### 13. `app/models/schemas.py`

**Purpose:** Pydantic request/response models for the classify endpoint. The request contains all network flow features that the gateway sends. The response contains the predicted class, label, confidence, and inference time.

```python
"""
Pydantic schemas for the classification API.

ClassifyRequest: Contains all UNSW-NB15 network flow features.
  - Fields correspond to the 49 UNSW-NB15 features.
  - srcip, dstip, Stime, Ltime, attack_cat, Label are included for completeness
    but will be dropped during preprocessing.
  - Default values are provided so the gateway can omit fields it does not have.

ClassifyResponse: The classification result.
  - attack_type: Integer class index (0-9).
  - attack_label: Human-readable class name (e.g., 'Normal', 'DoS').
  - confidence: Model's predicted probability for the chosen class (0.0 to 1.0).
  - inference_time_ms: Time taken for preprocessing + inference in milliseconds.
"""

from pydantic import BaseModel, Field


class ClassifyRequest(BaseModel):
    """
    Network flow features from the UNSW-NB15 dataset.

    All fields have default values so the caller can omit any feature.
    Missing features will be filled with reasonable defaults during preprocessing.
    """

    srcip: str = Field(default="", description="Source IP address")
    sport: int = Field(default=0, description="Source port number")
    dstip: str = Field(default="", description="Destination IP address")
    dsport: int = Field(default=0, description="Destination port number")
    proto: str = Field(default="tcp", description="Transaction protocol")
    state: str = Field(default="FIN", description="Protocol state (ACC, CLO, CON, FIN, INT, etc.)")
    dur: float = Field(default=0.0, description="Record total duration")
    sbytes: int = Field(default=0, description="Source to destination bytes")
    dbytes: int = Field(default=0, description="Destination to source bytes")
    sttl: int = Field(default=64, description="Source to dest time to live")
    dttl: int = Field(default=128, description="Dest to source time to live")
    sloss: int = Field(default=0, description="Source packets retransmitted/dropped")
    dloss: int = Field(default=0, description="Dest packets retransmitted/dropped")
    service: str = Field(default="http", description="Service (http, ftp, smtp, ssh, dns, ftp-data, irc, -)")
    Sload: float = Field(default=0.0, description="Source bits per second")
    Dload: float = Field(default=0.0, description="Destination bits per second")
    Spkts: int = Field(default=0, description="Source to dest packet count")
    Dpkts: int = Field(default=0, description="Dest to source packet count")
    swin: int = Field(default=255, description="Source TCP window advertisement")
    dwin: int = Field(default=255, description="Destination TCP window advertisement")
    stcpb: int = Field(default=0, description="Source TCP base sequence number")
    dtcpb: int = Field(default=0, description="Destination TCP base sequence number")
    smeansz: int = Field(default=0, description="Mean flow packet size (src)")
    dmeansz: int = Field(default=0, description="Mean flow packet size (dst)")
    trans_depth: int = Field(default=1, description="HTTP request/response pipelined depth")
    res_bdy_len: int = Field(default=0, description="Actual uncompressed content size from server HTTP")
    Sjit: float = Field(default=0.0, description="Source jitter (ms)")
    Djit: float = Field(default=0.0, description="Destination jitter (ms)")
    Sintpkt: float = Field(default=0.0, description="Source interpacket arrival time (ms)")
    Dintpkt: float = Field(default=0.0, description="Destination interpacket arrival time (ms)")
    tcprtt: float = Field(default=0.0, description="TCP round-trip time (synack + ackdat)")
    synack: float = Field(default=0.0, description="Time between SYN and SYN_ACK")
    ackdat: float = Field(default=0.0, description="Time between SYN_ACK and ACK")
    is_sm_ips_ports: int = Field(default=0, description="1 if src/dst IP and ports equal")
    ct_state_ttl: int = Field(default=0, description="Count per state for TTL range")
    ct_flw_http_mthd: int = Field(default=0, description="Count of flows with HTTP methods")
    is_ftp_login: int = Field(default=0, description="1 if FTP login used")
    ct_ftp_cmd: int = Field(default=0, description="Count of FTP command flows")
    ct_srv_src: int = Field(default=0, description="Connections same service+src in last 100")
    ct_srv_dst: int = Field(default=0, description="Connections same service+dst in last 100")
    ct_dst_ltm: int = Field(default=0, description="Connections same dst in last 100")
    ct_src_ltm: int = Field(default=0, description="Connections same src in last 100")
    ct_src_dport_ltm: int = Field(default=0, description="Connections same src+dst_port in last 100")
    ct_dst_sport_ltm: int = Field(default=0, description="Connections same dst+src_port in last 100")
    ct_dst_src_ltm: int = Field(default=0, description="Connections same src+dst in last 100")

    class Config:
        json_schema_extra = {
            "example": {
                "srcip": "192.168.1.100",
                "sport": 52143,
                "dstip": "10.0.0.1",
                "dsport": 80,
                "proto": "tcp",
                "state": "FIN",
                "dur": 0.121478,
                "sbytes": 528,
                "dbytes": 4096,
                "sttl": 62,
                "dttl": 252,
                "sloss": 0,
                "dloss": 0,
                "service": "http",
                "Sload": 34824.86,
                "Dload": 269952.0,
                "Spkts": 6,
                "Dpkts": 4,
                "swin": 255,
                "dwin": 255,
                "stcpb": 3814419146,
                "dtcpb": 3182567842,
                "smeansz": 88,
                "dmeansz": 1024,
                "trans_depth": 1,
                "res_bdy_len": 3566,
                "Sjit": 10.5,
                "Djit": 5.2,
                "Sintpkt": 24.31,
                "Dintpkt": 30.42,
                "tcprtt": 0.003,
                "synack": 0.001,
                "ackdat": 0.002,
                "is_sm_ips_ports": 0,
                "ct_state_ttl": 2,
                "ct_flw_http_mthd": 1,
                "is_ftp_login": 0,
                "ct_ftp_cmd": 0,
                "ct_srv_src": 5,
                "ct_srv_dst": 3,
                "ct_dst_ltm": 4,
                "ct_src_ltm": 6,
                "ct_src_dport_ltm": 2,
                "ct_dst_sport_ltm": 1,
                "ct_dst_src_ltm": 3,
            }
        }


class ClassifyResponse(BaseModel):
    """
    Classification result returned by the /classify endpoint.

    Attributes:
        attack_type (int): Predicted attack class index (0-9).
        attack_label (str): Human-readable attack label corresponding to attack_type.
        confidence (float): Model's probability for the predicted class (0.0 to 1.0).
        inference_time_ms (float): Total time for preprocessing + inference in milliseconds.
    """

    attack_type: int = Field(description="Predicted class index (0=Normal, 1=Generic, ..., 9=Worms)")
    attack_label: str = Field(description="Human-readable attack category name")
    confidence: float = Field(description="Prediction probability (0.0 to 1.0)")
    inference_time_ms: float = Field(description="Total inference time in milliseconds")

    class Config:
        json_schema_extra = {
            "example": {
                "attack_type": 2,
                "attack_label": "Exploits",
                "confidence": 0.9432,
                "inference_time_ms": 1.23,
            }
        }
```

---

### 14. `app/repositories/__init__.py`

Empty file.

```python
# ai-classifier/app/repositories/__init__.py
```

---

### 15. `app/repositories/model_repository.py`

**Purpose:** Load and cache all model artifacts from disk. Called once at application startup. Provides property-based access to the model, scaler, encoder, and feature column list.

```python
"""
Repository for loading and caching trained model artifacts from disk.

Artifacts loaded:
  - classifier.joblib: Trained XGBoost multi-class classifier.
  - scaler.joblib: Fitted StandardScaler for numeric features.
  - encoder.joblib: Fitted OneHotEncoder for categorical features.
  - feature_columns.json: Ordered list of feature column names after encoding.

All artifacts are loaded once during application startup via load_all().
Subsequent access is via read-only properties.
"""

import json
import os
import logging
from typing import Optional

import joblib
import xgboost as xgb
from sklearn.preprocessing import OneHotEncoder, StandardScaler

logger = logging.getLogger(__name__)


class ModelRepository:
    """
    Loads and caches model artifacts from disk.

    Usage:
        repo = ModelRepository(model_dir="models")
        repo.load_all()
        model = repo.model
        scaler = repo.scaler
        encoder = repo.encoder
        columns = repo.feature_columns
    """

    def __init__(self, model_dir: str = "models"):
        """
        Initialize the repository.

        Args:
            model_dir: Path to directory containing model artifacts.
        """
        self._model_dir = model_dir
        self._model: Optional[xgb.XGBClassifier] = None
        self._scaler: Optional[StandardScaler] = None
        self._encoder: Optional[OneHotEncoder] = None
        self._feature_columns: Optional[list[str]] = None

    def load_all(self) -> None:
        """
        Load all model artifacts from disk into memory.

        Steps:
          1. Load classifier.joblib via joblib.load() -> self._model.
          2. Load scaler.joblib via joblib.load() -> self._scaler.
          3. Load encoder.joblib via joblib.load() -> self._encoder.
          4. Load feature_columns.json via json.load() -> self._feature_columns.
          5. Log a success message with the number of feature columns.

        Raises:
            FileNotFoundError: If any artifact file is missing.
            Exception: If any artifact fails to deserialize.
        """
        model_path = os.path.join(self._model_dir, "classifier.joblib")
        scaler_path = os.path.join(self._model_dir, "scaler.joblib")
        encoder_path = os.path.join(self._model_dir, "encoder.joblib")
        columns_path = os.path.join(self._model_dir, "feature_columns.json")

        # Verify all files exist before loading
        for path in [model_path, scaler_path, encoder_path, columns_path]:
            if not os.path.exists(path):
                raise FileNotFoundError(f"Model artifact not found: {path}")

        logger.info("Loading model artifacts from %s", self._model_dir)

        self._model = joblib.load(model_path)
        logger.info("Loaded classifier model")

        self._scaler = joblib.load(scaler_path)
        logger.info("Loaded scaler")

        self._encoder = joblib.load(encoder_path)
        logger.info("Loaded encoder")

        with open(columns_path, "r") as f:
            self._feature_columns = json.load(f)
        logger.info("Loaded %d feature columns", len(self._feature_columns))

    @property
    def model(self) -> xgb.XGBClassifier:
        """
        Return the loaded XGBoost model.

        Raises:
            RuntimeError: If load_all() has not been called.
        """
        if self._model is None:
            raise RuntimeError("Model not loaded. Call load_all() first.")
        return self._model

    @property
    def scaler(self) -> StandardScaler:
        """
        Return the loaded StandardScaler.

        Raises:
            RuntimeError: If load_all() has not been called.
        """
        if self._scaler is None:
            raise RuntimeError("Scaler not loaded. Call load_all() first.")
        return self._scaler

    @property
    def encoder(self) -> OneHotEncoder:
        """
        Return the loaded OneHotEncoder.

        Raises:
            RuntimeError: If load_all() has not been called.
        """
        if self._encoder is None:
            raise RuntimeError("Encoder not loaded. Call load_all() first.")
        return self._encoder

    @property
    def feature_columns(self) -> list[str]:
        """
        Return the ordered list of feature column names.

        Raises:
            RuntimeError: If load_all() has not been called.
        """
        if self._feature_columns is None:
            raise RuntimeError("Feature columns not loaded. Call load_all() first.")
        return self._feature_columns
```

---

### 16. `app/services/__init__.py`

Empty file.

```python
# ai-classifier/app/services/__init__.py
```

---

### 17. `app/services/preprocessor_service.py`

**Purpose:** Transform a raw `ClassifyRequest` into a model-ready feature vector using the fitted encoder and scaler from the repository. This mirrors the training preprocessing pipeline exactly to ensure consistency.

```python
"""
Preprocessor service for transforming raw network flow features into
a model-ready feature vector.

This service uses the fitted scaler and encoder from the ModelRepository
to transform a single ClassifyRequest into a 1D numpy array that can be
fed directly to the XGBoost model.

The transformation must exactly mirror the training preprocessing pipeline
(train/preprocess.py) to ensure feature alignment.
"""

import logging
from typing import Any

import numpy as np
import pandas as pd

from app.models.schemas import ClassifyRequest
from app.repositories.model_repository import ModelRepository

logger = logging.getLogger(__name__)

# Columns that are dropped during preprocessing (same as training).
DROP_COLUMNS = ['srcip', 'dstip', 'Stime', 'Ltime', 'attack_cat', 'Label']

# Categorical features that are OneHotEncoded (same as training).
CATEGORICAL_FEATURES = ['proto', 'state', 'service']


class PreprocessorService:
    """
    Transform raw ClassifyRequest features into a model-ready feature vector.

    This service bridges the gap between the raw API request and the
    XGBoost model's expected input format.
    """

    def __init__(self, model_repo: ModelRepository):
        """
        Initialize with a reference to the model repository.

        Args:
            model_repo: ModelRepository instance with loaded artifacts.
        """
        self._model_repo = model_repo

    def transform(self, request: ClassifyRequest) -> np.ndarray:
        """
        Transform a single ClassifyRequest into a 1D numpy array.

        Steps:
          1. Convert the ClassifyRequest to a dict, then to a single-row DataFrame.
          2. Drop columns not used by the model: srcip, dstip, Stime, Ltime,
             attack_cat, Label (these may not be present in the request, use errors='ignore').
          3. Separate the DataFrame into categorical and numeric subsets:
             - Categorical: columns in CATEGORICAL_FEATURES (proto, state, service).
             - Numeric: all remaining columns.
          4. Clean categorical values: strip whitespace, fill empty with '-'.
          5. Clean numeric values: convert to float, fill NaN with 0.
          6. OneHotEncode the categorical features using self._model_repo.encoder.transform().
             This produces a 2D array of shape (1, n_encoded_categories).
          7. StandardScale the numeric features using self._model_repo.scaler.transform().
             This produces a 2D array of shape (1, n_numeric_features).
          8. Concatenate encoded categoricals and scaled numerics horizontally.
          9. Verify the resulting feature count matches len(self._model_repo.feature_columns).
             If not, log a warning and pad/truncate as needed.
         10. Return the 1D numpy array (flatten the 2D array).

        Args:
            request: ClassifyRequest with all network flow features.

        Returns:
            np.ndarray of shape (n_features,) ready for model.predict_proba().

        Raises:
            ValueError: If feature transformation produces unexpected dimensions.
        """
        # Step 1: Convert request to DataFrame
        data = request.model_dump()
        df = pd.DataFrame([data])

        # Step 2: Drop unused columns
        df = df.drop(columns=DROP_COLUMNS, errors='ignore')

        # Step 3: Separate features
        cat_cols = [col for col in CATEGORICAL_FEATURES if col in df.columns]
        num_cols = [col for col in df.columns if col not in CATEGORICAL_FEATURES]

        # Step 4: Clean categoricals
        for col in cat_cols:
            df[col] = df[col].fillna('-').astype(str).str.strip()
            # Replace empty strings with '-'
            df[col] = df[col].replace('', '-')

        # Step 5: Clean numerics
        for col in num_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        # Step 6: Encode categoricals
        cat_encoded = self._model_repo.encoder.transform(df[cat_cols])

        # Step 7: Scale numerics
        num_scaled = self._model_repo.scaler.transform(df[num_cols].values)

        # Step 8: Concatenate
        features = np.hstack([cat_encoded, num_scaled])

        # Step 9: Verify feature count
        expected_count = len(self._model_repo.feature_columns)
        actual_count = features.shape[1]

        if actual_count != expected_count:
            logger.warning(
                "Feature count mismatch: expected %d, got %d. "
                "Padding/truncating to match.",
                expected_count, actual_count
            )
            if actual_count < expected_count:
                padding = np.zeros((1, expected_count - actual_count))
                features = np.hstack([features, padding])
            else:
                features = features[:, :expected_count]

        # Step 10: Return 1D array
        return features.flatten()
```

---

### 18. `app/services/classifier_service.py`

**Purpose:** Run inference using the loaded XGBoost model. Accepts a `ClassifyRequest`, preprocesses it, runs `predict_proba`, and returns a `ClassifyResponse` with the predicted class, label, confidence score, and inference time.

```python
"""
Classifier service for running XGBoost inference on preprocessed features.

This is the main service that orchestrates:
  1. Feature preprocessing via PreprocessorService
  2. Model inference via XGBoost predict_proba
  3. Result packaging into ClassifyResponse
"""

import logging
import time

import numpy as np

from app.models.schemas import ClassifyRequest, ClassifyResponse
from app.repositories.model_repository import ModelRepository
from app.services.preprocessor_service import PreprocessorService

logger = logging.getLogger(__name__)

# Reverse mapping from integer label to human-readable attack category name.
ATTACK_LABELS = {
    0: 'Normal',
    1: 'Generic',
    2: 'Exploits',
    3: 'Fuzzers',
    4: 'DoS',
    5: 'Reconnaissance',
    6: 'Analysis',
    7: 'Backdoor',
    8: 'Shellcode',
    9: 'Worms',
}


class ClassifierService:
    """
    Run inference using the loaded XGBoost model.

    Combines preprocessing and model prediction into a single classify() method.
    """

    def __init__(self, model_repo: ModelRepository, preprocessor: PreprocessorService):
        """
        Initialize with model repository and preprocessor service.

        Args:
            model_repo: ModelRepository with loaded model artifacts.
            preprocessor: PreprocessorService for transforming raw features.
        """
        self._model_repo = model_repo
        self._preprocessor = preprocessor

    async def classify(self, request: ClassifyRequest) -> ClassifyResponse:
        """
        Classify a single network flow request.

        Steps:
          1. Record start time via time.perf_counter().
          2. Transform features via self._preprocessor.transform(request).
             Result is a 1D numpy array.
          3. Reshape to 2D array of shape (1, n_features) for predict_proba.
          4. Call self._model_repo.model.predict_proba(features_2d).
             Result is a 2D array of shape (1, 10) — one probability per class.
          5. Extract the probability array for the single sample: probabilities[0].
          6. np.argmax(probabilities) -> predicted_class (int, 0-9).
          7. np.max(probabilities) -> confidence (float, 0.0 to 1.0).
          8. Look up attack_label from ATTACK_LABELS[predicted_class].
          9. Record end time, compute inference_time_ms = (end - start) * 1000.
         10. Log the prediction at INFO level.
         11. Return ClassifyResponse(
                 attack_type=predicted_class,
                 attack_label=attack_label,
                 confidence=round(confidence, 4),
                 inference_time_ms=round(inference_time_ms, 2)
             ).

        Args:
            request: ClassifyRequest with all network flow features.

        Returns:
            ClassifyResponse with prediction result.

        Raises:
            Exception: If preprocessing or inference fails.
        """
        start = time.perf_counter()

        # Transform raw features to model-ready vector
        features = self._preprocessor.transform(request)
        features_2d = features.reshape(1, -1)

        # Run inference
        probabilities = self._model_repo.model.predict_proba(features_2d)
        probs = probabilities[0]  # shape: (10,)

        # Extract prediction
        predicted_class = int(np.argmax(probs))
        confidence = float(np.max(probs))
        attack_label = ATTACK_LABELS.get(predicted_class, "Unknown")

        # Compute timing
        end = time.perf_counter()
        inference_time_ms = (end - start) * 1000

        logger.info(
            "Classified as %s (class=%d, confidence=%.4f, time=%.2fms)",
            attack_label, predicted_class, confidence, inference_time_ms
        )

        return ClassifyResponse(
            attack_type=predicted_class,
            attack_label=attack_label,
            confidence=round(confidence, 4),
            inference_time_ms=round(inference_time_ms, 2),
        )
```

---

### 19. `app/controllers/__init__.py`

Empty file.

```python
# ai-classifier/app/controllers/__init__.py
```

---

### 20. `app/controllers/classify_controller.py`

**Purpose:** FastAPI router for the POST `/classify` endpoint. Extracts the `ClassifierService` from the application state and delegates to it.

```python
"""
Controller for the /classify endpoint.

Provides a single POST endpoint that accepts a ClassifyRequest body,
runs it through the ClassifierService, and returns a ClassifyResponse.
"""

import logging

from fastapi import APIRouter, Request

from app.models.schemas import ClassifyRequest, ClassifyResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["classify"])


@router.post("/classify", response_model=ClassifyResponse)
async def classify(request_body: ClassifyRequest, request: Request) -> ClassifyResponse:
    """
    Classify a network flow.

    Accepts a JSON body with UNSW-NB15 network flow features.
    Returns the predicted attack type, label, confidence, and inference time.

    The ClassifierService is retrieved from app.state, which is populated
    during application startup (lifespan context manager in main.py).

    Args:
        request_body: ClassifyRequest with network flow features.
        request: FastAPI Request object (used to access app.state).

    Returns:
        ClassifyResponse with classification result.

    Raises:
        HTTPException 500: If classification fails due to model or preprocessing errors.
    """
    classifier_service = request.app.state.classifier
    return await classifier_service.classify(request_body)
```

---

### 21. `app/controllers/health_controller.py`

**Purpose:** Health check endpoint. Returns the service status and whether the model is loaded.

```python
"""
Controller for the /health endpoint.

Provides a GET endpoint for health checks. Used by Docker health checks,
Kubernetes liveness/readiness probes, and load balancers.
"""

import logging

from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(request: Request) -> dict:
    """
    Health check endpoint.

    Returns:
        JSON object with:
          - status: "healthy" if model is loaded, "unhealthy" otherwise.
          - model_loaded: Boolean indicating whether the model repository
            has been initialized.

    This endpoint always returns 200 OK. The caller should inspect the
    'status' field to determine actual health.
    """
    model_loaded = False
    try:
        model_repo = request.app.state.model_repo
        # Attempt to access the model to verify it is loaded
        _ = model_repo.model
        model_loaded = True
    except (AttributeError, RuntimeError):
        model_loaded = False

    status = "healthy" if model_loaded else "unhealthy"

    return {
        "status": status,
        "model_loaded": model_loaded,
        "service": "ai-classifier",
    }
```

---

### 22. `app/utils/__init__.py`

Empty file.

```python
# ai-classifier/app/utils/__init__.py
```

---

### 23. `app/utils/logging.py`

**Purpose:** Configure structured JSON logging for the application using `python-json-logger`.

```python
"""
Logging configuration for the AI Classifier service.

Sets up structured JSON logging via python-json-logger.
All log entries include timestamp, level, logger name, and message.
"""

import logging
import sys

from pythonjsonlogger import jsonlogger

from app.config import settings


def setup_logging() -> None:
    """
    Configure the root logger with a JSON formatter.

    Steps:
      1. Create a StreamHandler writing to sys.stdout.
      2. Create a JsonFormatter with fields: timestamp, level, name, message.
      3. Attach the formatter to the handler.
      4. Configure the root logger with the handler and the log level from settings.
      5. Suppress noisy loggers (uvicorn.access) to WARNING level.
    """
    handler = logging.StreamHandler(sys.stdout)

    formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = []  # Clear any existing handlers
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))

    # Suppress noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
```

---

### 24. `app/main.py`

**Purpose:** FastAPI application entry point. Uses the lifespan context manager to load model artifacts at startup before serving requests. Includes routers for `/classify` and `/health`.

```python
"""
FastAPI application entry point for the AI Classifier service.

Lifespan:
  - On startup: loads model artifacts (classifier, scaler, encoder, feature_columns)
    into app.state via ModelRepository.load_all().
  - Instantiates PreprocessorService and ClassifierService and stores them in app.state.
  - On shutdown: cleanup (no explicit action needed; Python garbage collection handles it).

Routers:
  - /classify (POST): Classify a network flow. See classify_controller.py.
  - /health (GET): Health check. See health_controller.py.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.controllers import classify_controller, health_controller
from app.repositories.model_repository import ModelRepository
from app.services.classifier_service import ClassifierService
from app.services.preprocessor_service import PreprocessorService
from app.utils.logging import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.

    Startup:
      1. Set up structured JSON logging via setup_logging().
      2. Instantiate ModelRepository with model_dir from settings.
      3. Call model_repo.load_all() to load all artifacts into memory.
      4. Instantiate PreprocessorService(model_repo).
      5. Instantiate ClassifierService(model_repo, preprocessor).
      6. Store all three in app.state for access by controllers:
         - app.state.model_repo = model_repo
         - app.state.preprocessor = preprocessor
         - app.state.classifier = classifier_service
      7. Log "AI Classifier ready" at INFO level.

    Shutdown:
      8. Log "AI Classifier shutting down" at INFO level.
      9. yield exits; Python GC cleans up model objects.
    """
    # Startup
    setup_logging()
    logger.info("Starting AI Classifier service...")

    model_repo = ModelRepository(model_dir=settings.model_dir)
    model_repo.load_all()

    preprocessor = PreprocessorService(model_repo)
    classifier_service = ClassifierService(model_repo, preprocessor)

    app.state.model_repo = model_repo
    app.state.preprocessor = preprocessor
    app.state.classifier = classifier_service

    logger.info("AI Classifier ready. Model loaded from %s", settings.model_dir)

    yield

    # Shutdown
    logger.info("AI Classifier shutting down.")


app = FastAPI(
    title="AI Classifier",
    description="XGBoost-based network traffic classifier trained on UNSW-NB15",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(classify_controller.router)
app.include_router(health_controller.router)
```

---

## Tests

---

### 25. `tests/__init__.py`

Empty file.

```python
# ai-classifier/tests/__init__.py
```

---

### 26. `tests/test_preprocessor.py`

**Purpose:** Unit tests for the PreprocessorService. Verifies that raw features are correctly transformed into model-ready vectors.

```python
"""
Unit tests for app.services.preprocessor_service.PreprocessorService.

Tests:
  1. test_transform_returns_correct_shape:
     - Create a mock ModelRepository with a mock encoder, scaler, and feature_columns.
     - Build a ClassifyRequest with default values.
     - Call preprocessor.transform(request).
     - Assert the result is a 1D numpy array with length equal to len(feature_columns).

  2. test_transform_handles_missing_categoricals:
     - Create a ClassifyRequest with proto='', state='', service=''.
     - Verify the preprocessor replaces empty strings with '-'.
     - Verify encoder.transform is called with '-' values.

  3. test_transform_handles_numeric_types:
     - Create a ClassifyRequest with valid numeric values.
     - Verify scaler.transform receives a properly shaped numeric array.
     - Verify no NaN values in the output.

  4. test_transform_unknown_categorical_produces_zeros:
     - Create a ClassifyRequest with proto='unknown_protocol'.
     - Since OneHotEncoder uses handle_unknown='ignore', the encoded output
       for that category should be all zeros.
     - Verify the output does not raise an error.

Mock setup:
  - Use unittest.mock.MagicMock for ModelRepository.
  - Mock encoder.transform to return a known numpy array.
  - Mock scaler.transform to return a known numpy array.
  - Mock feature_columns to return a list of the correct length.
"""

import numpy as np
import pytest
from unittest.mock import MagicMock, patch

from app.models.schemas import ClassifyRequest
from app.services.preprocessor_service import PreprocessorService


@pytest.fixture
def mock_model_repo():
    """Create a mock ModelRepository with realistic return values."""
    repo = MagicMock()

    # Mock encoder: 3 categorical features, assume ~29 one-hot columns total
    mock_encoder = MagicMock()
    mock_encoder.transform.return_value = np.zeros((1, 29))
    repo.encoder = mock_encoder

    # Mock scaler: assume ~38 numeric features
    mock_scaler = MagicMock()
    mock_scaler.transform.return_value = np.zeros((1, 38))
    repo.scaler = mock_scaler

    # Mock feature_columns: total = 29 + 38 = 67
    repo.feature_columns = [f"feature_{i}" for i in range(67)]

    return repo


@pytest.fixture
def preprocessor(mock_model_repo):
    """Create a PreprocessorService with the mock repo."""
    return PreprocessorService(mock_model_repo)


def test_transform_returns_correct_shape(preprocessor, mock_model_repo):
    """Verify transform returns a 1D array with correct length."""
    request = ClassifyRequest()
    result = preprocessor.transform(request)
    assert isinstance(result, np.ndarray)
    assert result.ndim == 1
    assert len(result) == len(mock_model_repo.feature_columns)


def test_transform_handles_missing_categoricals(preprocessor, mock_model_repo):
    """Verify empty categorical strings are replaced with '-'."""
    request = ClassifyRequest(proto="", state="", service="")
    result = preprocessor.transform(request)
    # Should not raise; encoder handles '-' values
    assert isinstance(result, np.ndarray)


def test_transform_handles_numeric_types(preprocessor):
    """Verify numeric values are properly converted."""
    request = ClassifyRequest(sbytes=1024, dbytes=2048, dur=0.5)
    result = preprocessor.transform(request)
    assert not np.any(np.isnan(result))


def test_transform_unknown_categorical_produces_no_error(preprocessor):
    """Verify unknown categorical values do not raise errors."""
    request = ClassifyRequest(proto="unknown_protocol", state="XYZ", service="nonexistent")
    result = preprocessor.transform(request)
    assert isinstance(result, np.ndarray)
```

---

### 27. `tests/test_classifier.py`

**Purpose:** Unit tests for the ClassifierService. Verifies end-to-end classification flow with mocked dependencies.

```python
"""
Unit tests for app.services.classifier_service.ClassifierService.

Tests:
  1. test_classify_returns_valid_response:
     - Mock ModelRepository and PreprocessorService.
     - Mock model.predict_proba to return a known probability distribution.
     - Call classifier_service.classify(request).
     - Assert the response has correct attack_type (argmax of probabilities).
     - Assert confidence equals the max probability.
     - Assert attack_label matches ATTACK_LABELS[attack_type].
     - Assert inference_time_ms is a positive float.

  2. test_classify_normal_traffic:
     - Mock predict_proba to return highest probability for class 0 (Normal).
     - Verify response.attack_type == 0 and response.attack_label == 'Normal'.

  3. test_classify_attack_traffic:
     - Mock predict_proba to return highest probability for class 4 (DoS).
     - Verify response.attack_type == 4 and response.attack_label == 'DoS'.

  4. test_classify_inference_time_is_positive:
     - Run a classification and verify inference_time_ms > 0.

Mock setup:
  - Use unittest.mock.MagicMock for ModelRepository.
  - Use unittest.mock.MagicMock for PreprocessorService.
  - Mock preprocessor.transform to return a numpy array of zeros.
  - Mock model.predict_proba to return a crafted probability array.
"""

import numpy as np
import pytest
from unittest.mock import MagicMock, AsyncMock

from app.models.schemas import ClassifyRequest, ClassifyResponse
from app.services.classifier_service import ClassifierService, ATTACK_LABELS


@pytest.fixture
def mock_model_repo():
    """Create a mock ModelRepository."""
    repo = MagicMock()
    mock_model = MagicMock()
    repo.model = mock_model
    return repo


@pytest.fixture
def mock_preprocessor():
    """Create a mock PreprocessorService."""
    preprocessor = MagicMock()
    preprocessor.transform.return_value = np.zeros(67)
    return preprocessor


@pytest.fixture
def classifier_service(mock_model_repo, mock_preprocessor):
    """Create a ClassifierService with mock dependencies."""
    return ClassifierService(mock_model_repo, mock_preprocessor)


@pytest.mark.asyncio
async def test_classify_returns_valid_response(classifier_service, mock_model_repo):
    """Verify classify returns a properly structured ClassifyResponse."""
    # Class 2 (Exploits) has highest probability
    probs = np.array([[0.05, 0.05, 0.6, 0.05, 0.05, 0.05, 0.05, 0.05, 0.025, 0.025]])
    mock_model_repo.model.predict_proba.return_value = probs

    request = ClassifyRequest()
    response = await classifier_service.classify(request)

    assert isinstance(response, ClassifyResponse)
    assert response.attack_type == 2
    assert response.attack_label == "Exploits"
    assert response.confidence == 0.6
    assert response.inference_time_ms > 0


@pytest.mark.asyncio
async def test_classify_normal_traffic(classifier_service, mock_model_repo):
    """Verify Normal traffic is correctly classified."""
    probs = np.array([[0.9, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.02, 0.01]])
    mock_model_repo.model.predict_proba.return_value = probs

    request = ClassifyRequest()
    response = await classifier_service.classify(request)

    assert response.attack_type == 0
    assert response.attack_label == "Normal"


@pytest.mark.asyncio
async def test_classify_attack_traffic(classifier_service, mock_model_repo):
    """Verify DoS attack traffic is correctly classified."""
    probs = np.array([[0.02, 0.02, 0.02, 0.02, 0.8, 0.02, 0.02, 0.02, 0.02, 0.04]])
    mock_model_repo.model.predict_proba.return_value = probs

    request = ClassifyRequest()
    response = await classifier_service.classify(request)

    assert response.attack_type == 4
    assert response.attack_label == "DoS"


@pytest.mark.asyncio
async def test_classify_inference_time_is_positive(classifier_service, mock_model_repo):
    """Verify inference time is measured and positive."""
    probs = np.array([[0.1] * 10])
    mock_model_repo.model.predict_proba.return_value = probs

    request = ClassifyRequest()
    response = await classifier_service.classify(request)

    assert response.inference_time_ms > 0
```

---

### 28. `models/.gitkeep`

Empty file to ensure the `models/` directory is tracked by Git even when model artifacts (which are gitignored) are not present.

```
```

---

## Key Implementation Notes

### Feature Alignment Between Training and Serving

The most critical correctness requirement is that the serving preprocessor (`app/services/preprocessor_service.py`) produces feature vectors in the exact same order and scale as the training preprocessor (`train/preprocess.py`). This is ensured by:

1. **Shared artifacts:** The encoder, scaler, and feature_columns list are fitted during training and saved to `models/`. The serving code loads these same artifacts.
2. **Same column drop list:** Both training and serving drop `srcip`, `dstip`, `Stime`, `Ltime`, `Label`, `attack_cat`.
3. **Same categorical feature list:** Both use `['proto', 'state', 'service']`.
4. **Same concatenation order:** Both concatenate encoded categoricals first, then scaled numerics.
5. **`feature_columns.json` verification:** The serving preprocessor checks that its output length matches the saved column list.

### Class Imbalance Handling

The UNSW-NB15 dataset has significant class imbalance:
- Normal: ~93,000 samples
- Generic: ~215,000 samples
- Exploits: ~44,000 samples
- Fuzzers: ~24,000 samples
- DoS: ~16,000 samples
- Reconnaissance: ~13,000 samples
- Analysis: ~2,600 samples
- Backdoor: ~2,300 samples
- Shellcode: ~1,500 samples
- Worms: ~174 samples

This is handled via `compute_sample_weight('balanced', y_train)` which assigns higher weights to rare classes. The XGBoost model uses these weights during training to avoid being biased toward dominant classes.

### Inference Performance

- Single-sample inference through XGBoost `predict_proba` typically takes <5ms on CPU.
- The preprocessor (pandas DataFrame creation, encoder/scaler transform) adds ~1-2ms.
- Total end-to-end latency per request: ~2-7ms.
- The model is loaded once at startup and kept in memory, so there is no per-request I/O.

### Docker Build Workflow

1. Run the training pipeline on a developer machine:
   ```bash
   pip install -r requirements-train.txt
   python -m train.train_model
   ```
2. Verify that `models/` contains: `classifier.joblib`, `scaler.joblib`, `encoder.joblib`, `feature_columns.json`.
3. Build the Docker image:
   ```bash
   docker build -t ai-classifier .
   ```
4. Run the container:
   ```bash
   docker run -p 8000:8000 ai-classifier
   ```

### API Usage Example

```bash
curl -X POST http://localhost:8000/classify \
  -H "Content-Type: application/json" \
  -d '{
    "proto": "tcp",
    "state": "FIN",
    "dur": 0.121478,
    "sbytes": 528,
    "dbytes": 4096,
    "sttl": 62,
    "dttl": 252,
    "service": "http",
    "Sload": 34824.86,
    "Dload": 269952.0,
    "Spkts": 6,
    "Dpkts": 4,
    "swin": 255,
    "dwin": 255,
    "tcprtt": 0.003,
    "synack": 0.001,
    "ackdat": 0.002,
    "ct_srv_src": 5,
    "ct_srv_dst": 3,
    "ct_dst_ltm": 4,
    "ct_src_ltm": 6
  }'
```

Expected response:
```json
{
  "attack_type": 0,
  "attack_label": "Normal",
  "confidence": 0.9432,
  "inference_time_ms": 2.15
}
```
