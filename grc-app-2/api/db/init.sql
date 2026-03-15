-- GRC Intelligence Platform - SQLite Schema

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    company TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    standard_name TEXT,
    category TEXT,
    clause_number TEXT,
    question_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES questions(id),
    answer INTEGER NOT NULL,
    comment TEXT,
    file_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id INTEGER REFERENCES audit_responses(id) ON DELETE CASCADE,
    ai_score INTEGER CHECK (ai_score BETWEEN 0 AND 100),
    gap_analysis TEXT,
    recommendation TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_responses_user ON audit_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_responses_question ON audit_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_response ON ai_analysis(response_id);

-- Seed GRC questions (ignore if already exist)
INSERT OR IGNORE INTO questions (id, standard_name, category, clause_number, question_text) VALUES
-- ISO 27001 - Access Control
(1, 'ISO 27001', 'Access Control', 'A.9.1', 'Is there a formal access control policy documented and approved by management?'),
(2, 'ISO 27001', 'Access Control', 'A.9.1.2', 'Are users only provided access to the network and network services they have been specifically authorized to use?'),
(3, 'ISO 27001', 'Access Control', 'A.9.2.1', 'Is there a formal user registration and de-registration process for granting and revoking access?'),
(4, 'ISO 27001', 'Access Control', 'A.9.2.3', 'Is the management of privileged access rights restricted and controlled?'),
(5, 'ISO 27001', 'Access Control', 'A.9.4.1', 'Is access to information and application system functions restricted based on the access control policy?'),
(6, 'ISO 27001', 'Access Control', 'A.9.4.2', 'Is multi-factor authentication (MFA) enforced for all critical systems and remote access?'),
(7, 'ISO 27001', 'Access Control', 'A.9.2.5', 'Are user access rights reviewed at regular intervals (at least annually)?'),

-- ISO 27001 - Information Security Policies
(8, 'ISO 27001', 'Information Security Policies', 'A.5.1', 'Is there a formal information security policy approved by management and communicated to all employees?'),
(9, 'ISO 27001', 'Information Security Policies', 'A.5.1.2', 'Are information security policies reviewed at planned intervals or when significant changes occur?'),
(10, 'ISO 27001', 'Information Security Policies', 'A.6.1.1', 'Are information security roles and responsibilities clearly defined and allocated?'),

-- ISO 27001 - Network Security
(11, 'ISO 27001', 'Network Security', 'A.13.1.1', 'Are networks managed and controlled to protect information in systems and applications?'),
(12, 'ISO 27001', 'Network Security', 'A.13.1.2', 'Are security mechanisms, service levels, and management requirements for all network services identified and included in agreements?'),
(13, 'ISO 27001', 'Network Security', 'A.13.1.3', 'Are groups of information services, users, and information systems segregated on networks?'),
(14, 'ISO 27001', 'Network Security', 'A.13.2.1', 'Are formal transfer policies, procedures, and controls in place to protect the transfer of information?'),

-- ISO 27001 - Incident Management
(15, 'ISO 27001', 'Incident Management', 'A.16.1.1', 'Are management responsibilities and procedures established to ensure quick, effective, and orderly response to security incidents?'),
(16, 'ISO 27001', 'Incident Management', 'A.16.1.2', 'Are information security events reported through appropriate management channels as quickly as possible?'),
(17, 'ISO 27001', 'Incident Management', 'A.16.1.4', 'Are information security events assessed and classified as information security incidents?'),
(18, 'ISO 27001', 'Incident Management', 'A.16.1.5', 'Are information security incidents responded to in accordance with documented procedures?'),

-- ISO 27001 - Business Continuity
(19, 'ISO 27001', 'Business Continuity', 'A.17.1.1', 'Has the organization determined its requirements for information security and business continuity in adverse situations?'),
(20, 'ISO 27001', 'Business Continuity', 'A.17.1.2', 'Has the organization established, documented, and implemented processes and controls to ensure continuity of information security during an adverse situation?'),
(21, 'ISO 27001', 'Business Continuity', 'A.17.1.3', 'Does the organization verify established continuity controls at regular intervals to ensure they are valid and effective?'),

-- ISO 27001 - Cryptography
(22, 'ISO 27001', 'Cryptography', 'A.10.1.1', 'Is there a policy on the use of cryptographic controls for protection of information?'),
(23, 'ISO 27001', 'Cryptography', 'A.10.1.2', 'Is there a policy on the use, protection, and lifetime of cryptographic keys throughout their lifecycle?'),

-- ISO 27001 - Physical Security
(24, 'ISO 27001', 'Physical Security', 'A.11.1.1', 'Are security perimeters defined and used to protect areas containing sensitive information and information processing facilities?'),
(25, 'ISO 27001', 'Physical Security', 'A.11.1.2', 'Are secure areas protected by appropriate entry controls to ensure only authorized personnel are allowed access?'),
(26, 'ISO 27001', 'Physical Security', 'A.11.2.1', 'Is equipment sited and protected to reduce risks from environmental threats and unauthorized access?'),

-- ISO 27001 - HR Security
(27, 'ISO 27001', 'HR Security', 'A.7.1.1', 'Are background verification checks carried out on all candidates for employment?'),
(28, 'ISO 27001', 'HR Security', 'A.7.2.1', 'Does management require all employees and contractors to apply information security in accordance with established policies?'),
(29, 'ISO 27001', 'HR Security', 'A.7.2.2', 'Do all employees receive appropriate security awareness education and training, and regular updates on organizational policies?'),
(30, 'ISO 27001', 'HR Security', 'A.7.3.1', 'Are information security responsibilities and duties that remain valid after termination or change of employment defined, communicated, and enforced?'),

-- ISO 27001 - Asset Management
(31, 'ISO 27001', 'Asset Management', 'A.8.1.1', 'Are assets associated with information and information processing facilities identified and an inventory maintained?'),
(32, 'ISO 27001', 'Asset Management', 'A.8.1.3', 'Are rules for the acceptable use of information and assets associated with information processing facilities identified, documented, and implemented?'),
(33, 'ISO 27001', 'Asset Management', 'A.8.2.1', 'Is information classified in terms of legal requirements, value, criticality, and sensitivity to unauthorized disclosure or modification?'),

-- NIST - Risk Assessment
(34, 'NIST', 'Risk Assessment', 'ID.RA-1', 'Are asset vulnerabilities identified and documented?'),
(35, 'NIST', 'Risk Assessment', 'ID.RA-2', 'Is cyber threat intelligence received from information sharing forums and sources?'),
(36, 'NIST', 'Risk Assessment', 'ID.RA-3', 'Are threats (both internal and external) identified and documented?'),
(37, 'NIST', 'Risk Assessment', 'ID.RA-5', 'Are threats, vulnerabilities, likelihoods, and impacts used to determine risk?'),
(38, 'NIST', 'Risk Assessment', 'ID.RA-6', 'Are risk responses identified and prioritized?'),

-- NIST - Data Protection
(39, 'NIST', 'Data Protection', 'PR.DS-1', 'Is data-at-rest protected with encryption or other appropriate controls?'),
(40, 'NIST', 'Data Protection', 'PR.DS-2', 'Is data-in-transit protected with encryption or other appropriate controls?'),
(41, 'NIST', 'Data Protection', 'PR.DS-3', 'Are assets formally managed throughout removal, transfers, and disposition?'),
(42, 'NIST', 'Data Protection', 'PR.DS-5', 'Are protections against data leaks implemented (DLP solutions)?'),

-- NIST - Monitoring & Detection
(43, 'NIST', 'Monitoring & Detection', 'DE.CM-1', 'Is the network monitored to detect potential cybersecurity events?'),
(44, 'NIST', 'Monitoring & Detection', 'DE.CM-3', 'Is personnel activity monitored to detect potential cybersecurity events?'),
(45, 'NIST', 'Monitoring & Detection', 'DE.CM-4', 'Is malicious code detected?'),
(46, 'NIST', 'Monitoring & Detection', 'DE.CM-7', 'Is monitoring for unauthorized personnel, connections, devices, and software performed?'),
(47, 'NIST', 'Monitoring & Detection', 'DE.AE-2', 'Are detected events analyzed to understand attack targets and methods?'),

-- NIST - Recovery
(48, 'NIST', 'Recovery Planning', 'RC.RP-1', 'Is a recovery plan executed during or after a cybersecurity incident?'),
(49, 'NIST', 'Recovery Planning', 'RC.IM-1', 'Are recovery plans updated incorporating lessons learned?'),
(50, 'NIST', 'Recovery Planning', 'RC.CO-1', 'Are public relations activities managed during and after recovery?');
