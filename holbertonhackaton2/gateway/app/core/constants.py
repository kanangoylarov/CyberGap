# UNSW-NB15 attack categories mapped to integer labels
ATTACK_MAPPING: dict[str, int] = {
    "Normal": 0,
    "Fuzzers": 1,
    "Analysis": 2,
    "Backdoors": 3,
    "DoS": 4,
    "Exploits": 5,
    "Generic": 6,
    "Reconnaissance": 7,
    "Shellcode": 8,
    "Worms": 9,
}

# Reverse mapping: int -> label string
ATTACK_LABELS: dict[int, str] = {v: k for k, v in ATTACK_MAPPING.items()}

# Routing table: attack_type int -> (host, port)
# Normal traffic goes to the real store-backend; attacks go to honeypot services
ATTACK_ROUTES: dict[int, tuple[str, int]] = {
    0: ("store-backend", 8000),        # Normal
    1: ("honeypot-fuzzers", 8000),     # Fuzzers
    2: ("honeypot-analysis", 8000),    # Analysis
    3: ("honeypot-backdoor", 8000),    # Backdoor
    4: ("honeypot-dos", 8000),         # DoS
    5: ("honeypot-exploits", 8000),    # Exploits
    6: ("honeypot-generic", 8000),     # Generic
    7: ("honeypot-recon", 8000),       # Reconnaissance
    8: ("honeypot-shellcode", 8000),   # Shellcode
    9: ("honeypot-worms", 8000),       # Worms
}

# Headers that MUST NOT be forwarded between hops (RFC 2616 Section 13.5.1)
HOP_BY_HOP_HEADERS: frozenset[str] = frozenset({
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
})
