### **Project Charter & Implementation Plan: WaveDesigner Greenfield Migration**

**Document Version:** 1.2 (Final for Kickoff)
**Date:** September 14, 2025

#### **1.0 Project Overview**

**1.1 Background:**
The project began with a functional, in-house PyQt5 application for designing soundwave art. While effective for shop use, its architecture is stateful and tightly coupled, making it unsuitable for a modern, scalable web application.

**1.2 Business Goal:**
The primary goal is to create a new "Greenfield" application that enables client participation in the design process via a high-quality, responsive web interface. This system must serve two audiences from a single, unified backend:
1.  **Online Clients:** A curated, easy-to-use web application (embedded in Shopify) for designing their custom art piece.
2.  **Shop Staff:** A powerful, full-featured PyQt desktop application for professional design work and order fulfillment.

**1.3 Guiding Principles (The "Family Business 1.1" Plan):**
*   **KISS (Keep It Simple, Stupid):** The architecture must be manageable by a small team with LLM assistance. We will always choose the simpler, pragmatic solution over complex "enterprise" patterns.
*   **Pragmatic Immutability:** State-describing DTOs are immutable. Large numeric data buffers (e.g., NumPy arrays) are mutable but follow a strict **copy-on-write** policy: functions must not mutate input arrays.
*   **Workflow-Based Services:** The service layer is organized by our business process (e.g., Audio, Composition, Rendering), not abstract technical domains.

---

#### **2.0 Finalized Architecture & Technology Stack**

This stack was chosen for its balance of simplicity, low cost, and professional-grade reliability.

| Component | Technology/Provider | Rationale |
| :--- | :--- | :--- |
| **Backend** | Single FastAPI Monolith | Simplicity of development, testing, and deployment. |
| **Hosting** | Render.com | Managed PaaS, low/predictable cost, automatic deployments. |
| **Database** | PostgreSQL | Managed by Render.com; robust, flexible for future needs. |
| **File Storage** | Amazon S3 | Mature SDKs, reliable, secure presigned URLs. |
| **Stem Separation** | Modal.com (Cloud GPU) | Pay-per-use, fully automated, scalable for Demucs. |
| **Final Renders** | Modal.com (Cloud GPU) | Pay-per-use, fully automated, running a containerized Blender/Cycles process |
| **Web UI**| Embedded Shopify App | Integrates directly with the sales and payment platform. |
| **Web 3D Preview** | Babylon.js | For high-quality, real-time 3D rendering. |
| **Web Audio**| Essentia.js (WASM) | For fast, in-browser audio analysis for the preview. |

---

#### **3.0 Project Status: Accomplishments to Date (Goal 0 COMPLETE)**

The foundational setup of the project is complete.

*   **[✅] Service Accounts:** All necessary accounts have been created and configured:
    *   Shopify (Partner Account)
    *   Render.com (Free Tier)
    *   AWS (Free Tier, S3 Bucket and IAM User created)
    *   Modal.com (Free Credits, CLI Token configured)
*   **[✅] Local Environment:**
    *   A new virtual environment (`venv`) has been created using **Python 3.12**.
    *   A complete, pinned set of all required libraries has been successfully installed from the `requirements/` files.
*   **[✅] Project Structure:** The new directory structure (`config/`, `core/`, `services/`, `adapters/`, `requirements/`) has been created and is ready for code.
*   **[✅] Configuration & Secrets:** The `.env` file has been created, populated with all necessary API keys and the database URL, and added to `.gitignore`.
*   **[✅] Connection Testing:** A `test_connections.py` script was successfully run, verifying that the local environment can correctly authenticate and connect to all external cloud services (PostgreSQL on Render, S3, and Modal).

---

#### **4.0 Detailed Implementation Plan (The Roadmap)**

This is the step-by-step plan for building the application.

*   **Goal 1: Local Backend & Core Logic (1-2 weeks)**
    *   **Objective:** Define the data contracts and build the core business logic.
    *   **Tasks:**
        1.  **Define DTOs:** Create `services/dtos.py` with all `CompositionStateDTO` and related data classes.
        2.  **Define Defaults:** Populate `config/default_parameters.json` with all default values from the legacy schema.
        3.  **Build Config Service:** Create `services/config_service.py` to load the initial `CompositionStateDTO`.
        4.  **Migrate Core Math:** Port pure math functions following the strict Test-Driven Development (TDD) process defined in Section 4.1.
        5.  **Build Workflow Services:** Implement the new stateless services (`AudioService`, `CompositionService`, etc.) to operate on the DTOs.
        6.  **Build FastAPI Skeleton:** Create the initial FastAPI app (`api/main.py`) with a test endpoint.

*   **Goal 2: Interactive Browser Preview (1-2 weeks)**
    *   **Objective:** Build the complete customer-facing interactive preview.
    *   **Tasks:**
        1.  Build the Babylon.js 3D scene with your existing hardwood assets.
        2.  Create the **manual audio slicing UI**.
        3.  Integrate **Essentia.js in a Web Worker** to perform in-browser audio binning.
        4.  Write the client-side JavaScript geometry logic to generate the 3D model from the binned audio data.

*   **Goal 3: Connect the Pieces & Deploy (1-2 weeks)**
    *   **Objective:** Deploy a live, functional end-to-end system.
    *   **Tasks:**
        1.  Deploy the FastAPI/Postgres backend to Render.com.
        2.  Implement the S3 **presigned URL** upload flow.
        3.  Implement the automated **Demucs stem separation job on Modal.com**.
        4.  Connect the web client to the deployed API, implementing job submission and status polling.

*   **Goal 4: PyQt Re-wire & Polish (1-2 weeks)**
    *   **Objective:** Update the in-house tool and add final production features.
    *   **Tasks:**
        1.  Modify the PyQt app to use the FastAPI backend for project management.
        2.  **Implement Blender Job on Modal:** Create the Modal.com function that takes project parameters, runs a containerized Blender render, and uploads the result to S3.
        3.  Implement the email notification system in the backend.
        4.  Implement security guardrails (file size/type limits, user authentication).
		
---

#### **4.1 Core Logic Migration & Verification**

The migration of pure mathematical functions from the legacy codebase (Goal 1, Task 4) is a critical-path item that requires rigorous verification to ensure behavioral parity. This process will follow a Test-Driven Development (TDD) approach.

1.  **Golden Master Generation:** Before migration, the legacy application will be used to process a standardized set of inputs. The exact numerical outputs of each core algorithm will be saved to disk. This data serves as the "golden master" benchmark.
2.  **Test-First Development:** For each function to be migrated, a `pytest` unit test will be written first in the new project. This test will compare the output of the (not-yet-migrated) function against the saved golden master data, asserting near-perfect equality.
3.  **Porting & Validation:** The function's logic will then be ported. The migration is only considered complete for that function when its corresponding unit test passes.
4.  **LLM Peer Review:** After tests pass, the ported function and its test will be submitted for an independent peer review by another LLM to catch any subtle logical flaws.

---

#### **5.0 Instructions for Next Session**

**5.1 Information You (the User) Must Provide:**
*   You **do not** need to provide the entire legacy codebase again.
*   You **must** provide the **`self._schema` dictionary** from your old `parameters/parameter_manager.py` file. This is the source of truth for the first coding task.
*   As we complete tasks, you will provide the *newly created files* (e.g., `services/dtos.py`) so we can build upon them.

**5.2 Our First Task (Ticket WD-001):**
Our first action in the next chat will be to execute the following task, which begins **Goal 1**.

*   **Objective:** Create the core data contracts for the entire application.
*   **Input from You:** The legacy `self._schema` dictionary.
*   **Output from the Coder (Claude):**
    1.  The complete contents of the `services/dtos.py` file.
    2.  The complete contents of the `config/default_parameters.json` file.