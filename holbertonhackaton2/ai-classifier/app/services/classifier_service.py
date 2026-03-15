import time
import pickle
import numpy as np
import pandas as pd

from app.models.schemas import ClassifyRequest, ClassifyResponse

ATTACK_LABELS = {
    0: "Normal",
    1: "Generic",
    2: "Exploits",
    3: "Fuzzers",
    4: "DoS",
    5: "Reconnaissance",
    6: "Analysis",
    7: "Backdoor",
    8: "Shellcode",
    9: "Worms",
}

# Feature columns the XGBoost model expects (order matters)
# These are the columns after dropping 'label' and 'attack_cat' from the dataset
# proto, service, state are already label-encoded integers
FEATURE_COLUMNS = [
    "id", "dur", "proto", "service", "state", "spkts", "dpkts", "sbytes",
    "dbytes", "rate", "sttl", "dttl", "sload", "dload", "sloss", "dloss",
    "sinpkt", "dinpkt", "sjit", "djit", "swin", "stcpb", "dtcpb", "dwin",
    "tcprtt", "synack", "ackdat", "smean", "dmean", "trans_depth",
    "response_body_len", "ct_srv_src", "ct_state_ttl", "ct_dst_ltm",
    "ct_src_dport_ltm", "ct_dst_sport_ltm", "ct_dst_src_ltm",
    "is_ftp_login", "ct_ftp_cmd", "ct_flw_http_mthd", "ct_src_ltm",
    "ct_srv_dst", "is_sm_ips_ports",
]


class ClassifierService:
    """Two-stage classifier: XGBoost (normal vs attack) + Keras (attack type)."""

    def __init__(self):
        self._xgboost = None
        self._scaler = None
        self._encoder = None
        self._classifier = None
        self._le_cat = None

    def load_models(self, models_dir: str = "ml_models") -> None:
        """Load all model artifacts from disk."""
        with open(f"{models_dir}/xgboost_model.pkl", "rb") as f:
            self._xgboost = pickle.load(f)

        with open(f"{models_dir}/scaler.pkl", "rb") as f:
            self._scaler = pickle.load(f)

        with open(f"{models_dir}/le_cat.pkl", "rb") as f:
            self._le_cat = pickle.load(f)

        # Keras models loaded lazily to avoid TF import at module level
        import tensorflow as tf
        self._encoder = tf.keras.models.load_model(f"{models_dir}/encoder.keras")
        self._classifier = tf.keras.models.load_model(f"{models_dir}/classifier.keras")

    def _request_to_features(self, request: ClassifyRequest) -> pd.DataFrame:
        """Map ClassifyRequest fields to the 43-feature DataFrame the model expects."""
        row = {
            "id": 0,
            "dur": request.dur,
            "proto": 0,          # label-encoded; 0=tcp as default
            "service": 0,        # label-encoded; 0=http as default
            "state": 0,          # label-encoded; 0=FIN as default
            "spkts": request.Spkts,
            "dpkts": request.Dpkts,
            "sbytes": request.sbytes,
            "dbytes": request.dbytes,
            "rate": 0.0,
            "sttl": request.sttl,
            "dttl": request.dttl,
            "sload": request.Sload,
            "dload": request.Dload,
            "sloss": request.sloss,
            "dloss": request.dloss,
            "sinpkt": request.Sintpkt,
            "dinpkt": request.Dintpkt,
            "sjit": request.Sjit,
            "djit": request.Djit,
            "swin": request.swin,
            "stcpb": request.stcpb,
            "dtcpb": request.dtcpb,
            "dwin": request.dwin,
            "tcprtt": request.tcprtt,
            "synack": request.synack,
            "ackdat": request.ackdat,
            "smean": request.smeansz,
            "dmean": request.dmeansz,
            "trans_depth": request.trans_depth,
            "response_body_len": request.res_bdy_len,
            "ct_srv_src": request.ct_srv_src,
            "ct_state_ttl": request.ct_state_ttl,
            "ct_dst_ltm": request.ct_dst_ltm,
            "ct_src_dport_ltm": request.ct_src_dport_ltm,
            "ct_dst_sport_ltm": request.ct_dst_sport_ltm,
            "ct_dst_src_ltm": request.ct_dst_src_ltm,
            "is_ftp_login": request.is_ftp_login,
            "ct_ftp_cmd": request.ct_ftp_cmd,
            "ct_flw_http_mthd": request.ct_flw_http_mthd,
            "ct_src_ltm": request.ct_src_ltm,
            "ct_srv_dst": request.ct_srv_dst,
            "is_sm_ips_ports": request.is_sm_ips_ports,
        }
        return pd.DataFrame([row], columns=FEATURE_COLUMNS)

    async def classify(self, request: ClassifyRequest) -> ClassifyResponse:
        start = time.perf_counter()

        features = self._request_to_features(request)

        # Stage 1: XGBoost — is it normal (0) or attack (1)?
        xgb_proba = self._xgboost.predict_proba(features)[0]
        attack_probability = float(xgb_proba[1])  # probability of class 1 (attack)
        xgb_confidence = float(max(xgb_proba))
        is_attack = attack_probability > 0.5

        if not is_attack:
            # Normal traffic — return type 0
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            return ClassifyResponse(
                attack_type=0,
                attack_label="Normal",
                confidence=round(xgb_confidence, 4),
                inference_time_ms=elapsed_ms,
            )

        # Stage 2: It's an attack — determine which type
        # Scale → Autoencoder encode → Keras classify
        features_scaled = self._scaler.transform(features)
        features_encoded = self._encoder.predict(features_scaled, verbose=0)
        probs = self._classifier.predict(features_encoded, verbose=0)

        predicted_idx = int(np.argmax(probs, axis=1)[0])
        confidence = float(np.max(probs))

        # Map classifier output back to original attack type int
        attack_type_original = int(self._le_cat.inverse_transform([predicted_idx])[0])
        attack_label = ATTACK_LABELS.get(attack_type_original, "Unknown")

        # Combine XGBoost confidence with classifier confidence
        combined_confidence = round(xgb_confidence * confidence, 4)

        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

        return ClassifyResponse(
            attack_type=attack_type_original,
            attack_label=attack_label,
            confidence=combined_confidence,
            inference_time_ms=elapsed_ms,
        )
