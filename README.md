# Aarogya Mitra 🏥
### AI-Powered Digital Healthcare Platform for Rural India

> *"Aarogya Mitra" — Your Health Companion*

Aarogya Mitra is a multilingual, AI-powered digital healthcare platform designed specifically for rural and semi-urban citizens of India. It bridges the gap in healthcare accessibility by providing ABHA-style identity verification, AI-driven symptom analysis, appointment booking, digital health records, and emergency assistance — all optimized for low-bandwidth environments and deployed on local edge servers.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Product Vision](#product-vision)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
  - [Overall Architecture](#overall-architecture)
  - [Edge Server Services](#edge-server-services)
  - [Web Application Architecture](#web-application-architecture)
  - [AI System Architecture](#ai-system-architecture)
  - [Deployment Architecture](#deployment-architecture)
- [Database Design](#database-design)
  - [ER Diagram](#er-diagram)
  - [Schema Overview](#schema-overview)
- [UML Diagrams](#uml-diagrams)
  - [Use Case Diagram](#use-case-diagram)
  - [Component Diagram](#component-diagram)
  - [Sequence Diagram](#sequence-diagram)
- [Product Backlog](#product-backlog)
- [Release Plan / Roadmap](#release-plan--roadmap)
- [Architecture Decisions](#architecture-decisions)
- [Data Exchange Contract](#data-exchange-contract)
- [Non-Functional Requirements](#non-functional-requirements)
- [Technology Stack](#technology-stack)
- [Team & Project Context](#team--project-context)

---

## Project Overview

Aarogya Mitra addresses a critical challenge: millions of rural Indians lack access to timely, affordable healthcare. Long distances to hospitals, language barriers, poor connectivity, and the absence of digital health records make healthcare inaccessible for those who need it most.

This platform provides a unified healthcare gateway combining:
- AI-based health guidance and symptom checking
- Multilingual conversational support
- Doctor and hospital discovery
- Digital health record management
- Emergency assistance
- Offline-capable, edge-deployed architecture

---

## Product Vision

| Dimension | Details |
|-----------|---------|
| **Primary Audience** | Rural and semi-urban citizens of India, patients with limited hospital access |
| **Secondary Audience** | Local healthcare workers, PHCs, government health stakeholders |
| **Core Problem** | Inaccessible healthcare due to distance, language barriers, low connectivity |
| **Core Solution** | Multilingual, AI-powered, offline-capable digital health platform |

### Core Values

| Value | Description |
|-------|-------------|
| **Accessibility** | Healthcare services reachable for rural and underserved populations |
| **Reliability** | Accurate, consistent, and trustworthy health information |
| **Inclusivity** | Multiple Indian languages, low-literacy user interfaces |
| **Security** | Sensitive health data protected through secure digital practices |

### Differentiators

- **Rural-Centric Design** — Optimized for low-bandwidth networks and mobile-first usage
- **Multilingual AI Assistance** — Symptom checker and chatbot tailored for regional Indian languages
- **ABHA-Inspired Identity Mapping** — Aligned with India's national digital health ecosystem
- **Unified Healthcare Gateway** — Records, discovery, guidance, and emergency access in one platform

---

## Key Features

### For Patients
| Feature | Description | Priority |
|---------|-------------|----------|
| ABHA-Style Registration | OTP-based identity verification with ABHA ID mapping | Must Have |
| Multilingual Dashboard | Language-switchable UI with access to all modules | Must Have |
| AI Symptom Checker | Enter symptoms (voice/text) and get AI health guidance | Could Have |
| Multilingual AI Chatbot | Health queries answered in preferred Indian language | Could Have |
| Doctor & Hospital Discovery | Location-based search with specialization filters | Should Have |
| Appointment Booking | Select doctor, date, and time slot | Should Have |
| Emergency Assistance | One-tap emergency access with nearby hospital display | Must Have |
| Digital Health Records | Upload, view, and manage prescriptions and reports | Must Have |

### For Doctors
- View and manage appointments
- Access patient history and health records
- Upload prescriptions and discharge summaries
- Update diagnosis notes

### For Admins
- Manage users, doctors, and hospitals
- Monitor pharmacy inventory
- View system analytics and disease trend data

---

## System Architecture

Aarogya Mitra is built on a **Microservices Architecture** deployed on a local district/hospital edge server, ensuring offline availability and low-latency for rural users.

### Overall Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         WEB APPLICATION                          │
│   Patient Portal │ Doctor Portal │ Admin Dashboard │ Voice/Text  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP Requests
┌──────────────────────────────▼──────────────────────────────────┐
│              LOCAL EDGE SERVER (District / Hospital)             │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ API Gateway │  │ User Mgmt &  │  │  Appointment Service  │   │
│  │             │  │ ABHA Service │  │  (Aarogya Connect)    │   │
│  └──────┬──────┘  └──────────────┘  └──────────────────────┘   │
│         │                                                         │
│  ┌──────▼──────────────────────────────────────────────────┐    │
│  │                     CORE SERVICES                         │    │
│  │  Medical Records │ Hospital & Location │ Analytics       │    │
│  │  Prescription    │ ABHA Integration    │ Aarogya Map     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────┐    ┌────────────────────────────────┐   │
│  │   LOCAL AI ENGINE  │    │        LOCAL DATA STORAGE       │   │
│  │  Multilingual NLP  │    │  Patient DB │ Health Records DB │   │
│  │  Symptom Analysis  │    │  Doctor DB  │ Analytics DB      │   │
│  │  Outbreak Predict  │    │  Pharmacy Inventory DB          │   │
│  │  Demand Forecast   │    └────────────────────────────────┘   │
│  └────────────────────┘                                          │
└──────────────────────────────────┬──────────────────────────────┘
                                   │ Intermittent Sync
                         ┌─────────▼──────────┐
                         │   ABHA / Government │
                         │   Health System     │
                         └─────────────────────┘
```

### Edge Server Services

The edge server exposes services through an **API Layer** consisting of:
1. **API Gateway** — Entry point for all HTTP requests
2. **Request Routing** — Directs traffic to appropriate microservices
3. **Authentication Middleware** — JWT-based session validation

Core services hosted on the edge server:

| Service | Responsibility |
|---------|---------------|
| Medical Records Service | Store, retrieve, and manage health records |
| User Service | Patient, Doctor, Admin profile management |
| Prescription Service | Manage prescriptions linked to consultations |
| Aarogya Connect | Appointment booking and scheduling |
| ABHA Integration Service | Sync with national ABHA digital health system |
| Aarogya Map | Hospital and location discovery |
| Pharmacy Inventory Service | Track medicine stock and availability |
| Analytics Service | Usage analytics and disease trend aggregation |

AI services are accessed via a dedicated **AI Integration Layer**:
- Symptom Analysis
- NLP Interface (Multilingual)
- Prediction Interface (Disease Outbreak, Demand Forecasting)

### Web Application Architecture

The frontend is a **mobile-first, multilingual web application** structured into three portals sharing common frontend components:

**Patient Portal**
- Symptom Entry, Login/ABHA Authentication, Multilingual Voice & Text Input
- Health Records Wallet, Book Appointment, Emergency Request, View Medical Guidance
- Offline Storage & Sync, View Nearby Hospitals, Speech Processing (STT/TTS)

**Doctor Portal**
- Doctor Login, View Patient History, Manage Appointments
- Upload Prescription, Discharge Summary, Update Diagnosis

**Admin Dashboard**
- User Management, Pharmacy Management, Doctor & Hospital Management
- View System Analytics, Disease Trend Monitoring

**Shared Frontend Components**
- Offline Mode Handler
- Local Browser Storage
- API Communication Module → Edge Server

### AI System Architecture

The AI pipeline processes multi-modal inputs through four distinct layers:

```
INPUT SOURCES          INPUT PROCESSING      NLP LAYER
──────────────         ────────────────      ─────────────────
Voice Input       ──►  Speech-to-Text   ──►  Intent Detection
Historical Records──►  Language Detect  ──►  Multilingual NLP
Patient Health Data──► Text Normalize   ──►  Entity Extraction
Text Input                                   (symptoms, duration,
Regional Disease Data                         severity)
Pharmacy Data
                                              │
                                              ▼
                              DECISION LAYER
                              ──────────────────────────────
                              Symptom Analysis Model
                              Risk Classification
                                    │
                           ┌────────┴─────────┐
                           │                  │
                    CONTENT ENGINE      PREDICTIVE ANALYTICS
                    ─────────────       ─────────────────────
                    First Aid Engine    Disease Outbreak Prediction
                    Aarogya Pulse       Medicine Demand Forecasting
                           │
                    OUTPUTS
                    ───────────────────────────
                    Medical Guidance
                    First Aid Instructions
                    Risk Alerts
                    Forecast Reports
```

### Deployment Architecture

```
┌──────────────────────────────────┐
│       User Device (Browser)       │
│  Local Browser Storage           │
│  Web Application (Patient/Doctor/Admin) │
└──────────────────┬───────────────┘
                   │ HTTP Requests
┌──────────────────▼───────────────────────────────────┐
│         District / Hospital Edge Server               │
│                                                        │
│  API Service ──► AI Engine (NLP, Symptom, Prediction) │
│      │                                                 │
│      ├──► Local Database (Read/Write)                 │
│      ├──► Hospital & Location Service                 │
│      ├──► Medical Records Service                     │
│      └──► User & ABHA Management                     │
│                                         Appointment   │
└──────────────────────────────────────────┬────────────┘
                                           │ Sync (when online)
                              ┌────────────▼───────────┐
                              │  External System        │
                              │  (Intermittent Internet) │
                              │  ABHA Gateway           │
                              └─────────────────────────┘
```

> **Offline-First Design:** All core services run locally on the edge server. ABHA synchronization and analytics batch processing occur only when internet connectivity is available.

---

## Database Design

### ER Diagram

The system uses a normalized relational database (SQLite for edge deployment) with the following entity relationships:

```
Patient ──(1:N)──► Appointment ──(1:1)──► Consultation ──(1:1)──► HealthRecord
                        │                       │
                    (N:1)▼                  (1:1)▼
                      Doctor              Prescription
                        │
                    (N:1)▼
                     Hospital ──(1:N)──► PharmacyInventory
                                                │
                                          (1:N)▼
                                        DemandForecast
```

### Schema Overview

#### Patient
| Column | Type | Constraint |
|--------|------|------------|
| PatientID | string | Primary Key |
| Name | string | |
| Age | int | |
| Gender | string | |
| Phone | string | |
| Address | string | |
| ABHA_ID | string | |

#### Doctor
| Column | Type | Constraint |
|--------|------|------------|
| DoctorID | string | Primary Key |
| Name | string | |
| Specialization | string | |
| Experience | int | |
| Phone | string | |
| HospitalID | string | Foreign Key → Hospital |

#### Appointment
| Column | Type | Constraint |
|--------|------|------------|
| AppointmentID | string | Primary Key |
| PatientID | string | Foreign Key → Patient |
| DoctorID | string | Foreign Key → Doctor |
| HospitalID | string | Foreign Key → Hospital |
| Date | timestamp | |
| Time | string | |
| Status | string | |

#### Consultation
| Column | Type | Constraint |
|--------|------|------------|
| ConsultationID | string | Primary Key |
| AppointmentID | string | Foreign Key → Appointment |
| Symptoms | string | |
| Diagnosis | string | |
| Notes | string | |

#### HealthRecord
| Column | Type | Constraint |
|--------|------|------------|
| RecordID | string | Primary Key |
| PatientID | string | Foreign Key → Patient |
| ConsultationID | string | Foreign Key → Consultation |
| Reports | string | |
| TestResults | string | |
| Date | timestamp | |

#### Prescription
| Column | Type | Constraint |
|--------|------|------------|
| PrescriptionID | string | Primary Key |
| ConsultationID | string | Foreign Key → Consultation |
| Medicines | string | |
| Dosage | string | |
| Instructions | string | |

#### Hospital
| Column | Type | Constraint |
|--------|------|------------|
| HospitalID | string | Primary Key |
| Name | string | |
| Location | string | |
| Type | string | |
| Contact | string | |

#### PharmacyInventory
| Column | Type | Constraint |
|--------|------|------------|
| MedicineID | string | Primary Key |
| MedicineName | string | |
| QuantityAvailable | int | |
| HospitalID | string | Foreign Key → Hospital |
| LastUpdated | timestamp | |

#### DiseaseData
| Column | Type | Constraint |
|--------|------|------------|
| EntryID | string | Primary Key |
| Region | string | |
| DiseaseName | string | |
| CaseCount | int | |
| Date | timestamp | |

#### DemandForecast
| Column | Type | Constraint |
|--------|------|------------|
| ForecastID | string | Primary Key |
| MedicineID | string | Foreign Key → PharmacyInventory |
| PredictedDemand | int | |
| Region | string | |
| Date | timestamp | |

---

## UML Diagrams

### Use Case Diagram

Three primary actors interact with the system:

**Patient** — Register/Login, ABHA Verification, Enter Symptoms, Voice/Text Input, Get AI Medical Guidance, Book Appointment, View Nearby Hospitals, Access Health Records, Emergency Request, View Health Content

**Doctor** — View Appointments, Access Patient History, Provide Diagnosis, Upload Prescription

**Admin** — Manage Users, Manage Doctors & Hospitals, View Analytics & Disease Trends

**External Actor** — ABHA System (interacts with ABHA Verification use case)

### Component Diagram

```
Web Application
  ├── Voice/Text Interface
  ├── Admin Dashboard
  ├── Doctor Portal
  └── Patient Portal
         │
         ▼ (via API Gateway)
Edge Server
  ├── Authentication & ABHA Service ──► External: ABHA System
  ├── User Management
  ├── Appointment Service
  ├── Hospital Directory Service
  ├── Medical Records Service
  └── Analytics Service
         │
         ▼
Data Layer
  ├── Patient DB
  ├── Doctor & Hospital DB
  ├── Health Records DB
  ├── Analytics DB
  └── Pharmacy Inventory DB

AI Module
  ├── Outbreak Prediction
  ├── Demand Forecasting
  └── Multilingual NLP
         └── Symptom Analysis
                └── First Aid Recommendation
```

### Sequence Diagram

**Flow: Symptom Submission → Appointment Booking**

```
Patient  Web App   Edge Server   AI Engine   Local DB   Doctor
  │         │           │             │          │         │
  │ Enter   │           │             │          │         │
  │symptoms─►           │             │          │         │
  │         │ Send data─►             │          │         │
  │         │           │ Process ────►          │         │
  │         │           │ symptoms   Read data───►         │
  │         │           │◄─ Diagnosis/Recommendation       │
  │         │◄Med guidance            │          │         │
  │◄Display │           │             │          │         │
  │         │           │             │          │         │
  │ Request appointment─►             │          │         │
  │         │           │ Check availability ────────────► │
  │         │           │◄─ Available slots  ◄─────────── │
  │         │◄ Show slots│             │          │         │
  │◄Display │           │             │          │         │
  │ Select  │           │             │          │         │
  │ slot   ─►           │             │          │         │
  │         │ Confirm   │             │          │         │
  │         │ booking  ─►             │          │         │
  │         │           │ Save appointment──────►│         │
  │         │           │ Notify appointment ─────────────►│
  │         │◄ Booking confirmation   │          │         │
  │◄ Confirm│           │             │          │         │
```

---

## Product Backlog

| ID | Feature | Epic | Priority | Status |
|----|---------|------|----------|--------|
| 1 | ABHA-Style User Registration & Verification | User Authentication & Identity Management | **Must** | Ready for Dev |
| 2 | Multilingual User Dashboard | User Interface & Accessibility | **Must** | To Do |
| 3 | AI-Powered Symptom Checker | AI-Based Healthcare Assistance | Could | To Do |
| 4 | Multilingual AI Chatbot | Conversational Healthcare Support | Could | To Do |
| 5 | Doctor & Hospital Discovery | Healthcare Service Discovery | Should | To Do |
| 6 | Appointment Booking System | Healthcare Appointment Management | Should | Backlog |
| 7 | Emergency Assistance Module | Emergency & Critical Care Support | **Must** | Backlog |
| 8 | Digital Health Records Management | Health Data & Record Management | **Must** | Ready for Dev |

### Acceptance Criteria Highlights

**Feature 1 — ABHA Registration**
- OTP-based mobile number verification (response < 3 seconds)
- Simulated ABHA credential mapping
- Verified fields become non-editable
- Redirect to dashboard post-registration

**Feature 3 — AI Symptom Checker**
- Voice and text symptom input
- Age and gender-aware AI analysis
- Urgency level classification
- Multilingual output (response < 5 seconds)

**Feature 7 — Emergency Assistance**
- Visible on all screens at all times
- Nearby hospitals displayed instantly (< 2 seconds)
- Functions under poor network conditions
- Minimal interaction required

---

## Release Plan / Roadmap

```
Sprint   Week 1    Week 2    Week 3    Week 4    Week 5    Week 6    Week 7    Week 8
────────────────────────────────────────────────────────────────────────────────────
Proposal ██████████████
Feat #1             ████████████████████
Feat #2                       ████████████████████████
Feat #3                                   ████████████████████████████████████████
Feat #4                                             ████████████████████████████
Feat #5  ████████████████████████████
Feat #6
Feat #7
```

| Phase | Scope |
|-------|-------|
| **Proposal** (W1–W2) | Define rural healthcare problem, identify user needs, finalize technology stack |
| **Feature #1** (W2–W4) | Database & ERD design — SQLite schema, normalization, migration scripts |
| **Feature #2** (W3–W5) | Backend implementation — ABHA-style authentication, session handling, CRUD APIs |
| **Feature #3** (W5–W8) | Core functionalities — AI symptom checker, multilingual chatbot, appointments, health records |
| **Feature #4** (W5–W8) | Frontend & UI — Dashboard, multilingual interface, templates |
| **Feature #5** (W1–W4) | Testing, security, documentation, performance enhancements |

---

## Architecture Decisions

### 1. Microservices Architecture
Each service handles one business function (user management, appointments, records, AI) and can be independently deployed, scaled, and maintained. This is particularly suited for gradual rollout across different districts.

### 2. Event-Driven Architecture
Asynchronous event processing enables loose coupling between services:
- Symptom submission → triggers AI analysis
- Appointment booking → updates doctor schedule
- New health record → updates analytics
- Inventory change → triggers demand forecasting

### 3. Edge Deployment (Offline-First)
All core services run on a district or hospital edge server. The system continues operating during internet outages. ABHA synchronization and batch analytics run only when connectivity is available. This design is critical for rural areas with intermittent connectivity.

### 4. Serverless for Background Tasks
Infrequent and background operations (ABHA sync, analytics reporting, batch processing) follow serverless principles to reduce infrastructure overhead and cost.

---

## Data Exchange Contract

### Frequency of Data Exchanges

| Data Type | Frequency |
|-----------|-----------|
| User actions (login, symptoms, booking) | Real-time |
| AI responses | Real-time |
| Appointment & record updates | Immediate |
| Analytics & forecasting | Periodic (hourly/daily) |
| ABHA synchronization | On-demand / when online |
| Inventory updates | Event-based |

### Data Sets Exchanged
- Patient demographic and ABHA information
- Symptom and consultation data
- Medical records and prescriptions
- Appointment schedules
- Doctor and hospital details
- Pharmacy inventory data
- Regional disease statistics
- Analytics and forecast reports

### Mode of Exchanges

| Interaction | Mode |
|-------------|------|
| Web Application ↔ Edge Server | REST APIs (HTTP/HTTPS) |
| Service ↔ Service | Internal APIs / asynchronous events |
| Edge Server ↔ Local Database | Direct database access |
| Edge Server ↔ ABHA System | Secure REST API |
| Analytics / Forecasting | Batch processing |
| Offline Sync | Local browser storage → API sync when online |

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Dashboard load < 2s; API responses < 3s; AI responses < 5s; Emergency response < 2s |
| **Availability** | AI Chatbot available 24/7; Emergency module always accessible |
| **Security** | Encrypted user data storage; Secure session handling; Role-based access control |
| **Scalability** | Concurrent multi-user support; Microservices allow independent scaling |
| **Reliability** | High availability for emergency and core health services |
| **Accessibility** | Mobile-first, responsive design; Works on low-bandwidth networks |
| **Localization** | Multi-language support; Language switching without page reload |
| **Data Integrity** | No double bookings; Record persistence across sessions; Referential integrity in DB |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Web Application (HTML/CSS/JS, Mobile-first responsive) |
| **API Layer** | REST APIs (HTTP/HTTPS), API Gateway |
| **Backend Services** | Microservices architecture |
| **AI Engine** | NLP, Symptom Analysis, Predictive Analytics (ML models) |
| **Speech Processing** | Speech-to-Text / Text-to-Speech (STT/TTS) |
| **Database** | SQLite (local edge deployment) |
| **Authentication** | OTP-based verification, ABHA-style identity mapping, JWT session handling |
| **Offline Sync** | Local Browser Storage + background sync |
| **Deployment** | Local district/hospital edge server |
| **External Integration** | ABHA Gateway (Government Health System) |

---

## Team & Project Context

This project is developed as a **Minor Project** submission, demonstrating the application of software engineering principles including:

- Agile Product Backlog and Sprint Planning
- Architecture Design (Microservices, Event-Driven, Edge Computing)
- UML Modelling (Use Case, Component, Sequence, Deployment Diagrams)
- Database Design and Normalization
- AI/ML System Integration
- Rural-context, accessibility-first product thinking

---

## License

This project is developed for academic purposes. All architecture, diagrams, and documentation are original work by the project team.

---

*Aarogya Mitra — Bridging the healthcare gap, one village at a time.*
