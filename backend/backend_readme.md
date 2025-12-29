# AI-Powered Engineering Report System

## 🏗 System Architecture

This project follows **Clean Architecture** principles to separate business logic from external tools (like OpenAI, Grok, Pinecone, or PostgreSQL). The goal is to create a system that is testable, maintainable, and adaptable to future AI models.

### The 4 Layers

1.  **Domain (`src/domain`)**: The "Soul" of the application. It contains Interfaces and Types (Entities). It has **zero dependencies**. It defines _what_ a `Project`, `Report`, or `KnowledgeItem` is.
2.  **Services (`src/services`)**: The "Brain". It orchestrates logic. It connects the API to the AI, Vector Store, and Database.
3.  **Infrastructure (`src/infrastructure`)**: The "Tools". This is where the actual code for Postgres, Pinecone, and OpenAI lives. These classes _implement_ the Domain interfaces.
4.  **Controllers (`src/controllers`)**: The "Door". The entry point for the REST API. It handles HTTP requests and passes them to the Services.

---

## 🔄 How Data Flows (Request Lifecycles)

### 1. Report Generation Flow

When a user clicks "Generate Report":

1.  **Controller:** `ReportController` delegates to `ReportService`.
2.  **Service:** `ReportService` fetches Project data and calls the `AgentFactory`.
3.  **Factory:** Creates the specific Brain (`GptAgent`) and Eyes (`ImageMode`).
4.  **Workflow:** `ReportGenerationWorkflow` runs the steps: `Collect Data` -> `RAG Lookup` -> `Generate Content` -> `Format`.
5.  **Persistence:** `PostgresReportRepository` saves the JSON result.

### 2. RAG Ingestion Flow (Knowledge System)

When a user uploads a PDF or Docx:

1.  **Service:** `KnowledgeService` extracts raw text using `mammoth` (Word) or `pdf-parse` (PDF).
2.  **Chunking:** The text is split into semantic paragraphs (~1000 chars).
3.  **Embedding:** `OpenAIEmbeddingGenerator` converts text chunks into vector arrays.
4.  **Vector Store:** `PineconeVectorStore` saves the vectors + text metadata.
5.  **Tracking:** `PostgresKnowledgeRepository` tracks the file status (`INDEXED`).

### 3. Chat & Editing Flow

When a user chats or clicks "Accept Suggestion":

1.  **Service:** `ChatService` handles the message loop.
2.  **AI:** `ChatAgent` uses RAG to answer questions or generate `EditSuggestion` JSON.
3.  **Editing:** If the user accepts a suggestion, `ChatService` calls `ReportService.updateSectionContent()` to modify the real report.

---

## 🛠 Design Patterns & Benefits

We use specific Gang of Four (GoF) design patterns to solve architectural problems.

### 1. Strategy Pattern (`src/ai/strategies`)

- **Use Case:** Swapping AI models (`GptAgent`, `GrokAgent`) or Input Modes (`TextOnly`, `ImageAndText`).
- **Benefit:** We can add new models by creating **one new file** without touching existing logic.

### 2. Abstract Factory Pattern (`src/ai/factory`)

- **Use Case:** `AgentFactory` centralizes the creation of complex Agent/Mode combinations.
- **Benefit:** Decouples the Service layer from API key configuration and class instantiation.

### 3. Template Method Pattern (`src/workflows`)

- **Use Case:** `ReportGenerationWorkflow` enforces the sequence: `RAG -> AI -> Format`.
- **Benefit:** Guarantees that no report type can ever skip the security or context retrieval steps.

### 4. Builder Pattern (`src/domain/reports/ReportBuilder.ts`)

- **Use Case:** Constructing the complex `Report` object (Sections, Versioning, Metadata).
- **Benefit:** Provides a readable, fluent API (`builder.setTitle().addSection().build()`) and ensures valid object state.

### Asynchronous Job Flow (Background Processing)

_Solves the "HTTP Timeout" problem for long-running AI tasks (e.g., generating full reports)._

1.  **Producer (The API):** The `ReportController` does **not** call the Service directly. Instead, it calls the `JobQueue` interface to `enqueue` the task.
2.  **Adapter:** The `TriggerJobQueue` adapter receives the request and pushes the event to the **Trigger.dev v3** cloud.
3.  **Response:** The API immediately returns `202 Accepted` to the user, preventing the UI from freezing.
4.  **Consumer (The Worker):** Trigger.dev wakes up a dedicated **Background Worker** (running in a separate process/container).
5.  **Execution:** The Worker resolves the `ReportService` from the Container and executes the logic securely in the background.

---

sequenceDiagram
participant User
participant Controller as 🎮 ReportController
participant Adapter as 🔌 TriggerJobQueue
participant External as ☁️ Trigger.dev Cloud
participant Worker as 👷 Background Worker
participant Service as 🧠 ReportService
participant AI as 🤖 Grok/OpenAI

    Note over Controller, Adapter: "Producer" Phase (Fast)
    User->>Controller: Click "Generate Report"
    Controller->>Adapter: enqueueReportGeneration(id, prompt)
    Note right of Adapter: Adapter implements JobQueue Interface
    Adapter->>External: Send Payload (Task Trigger)
    External-->>Adapter: 200 OK (Queued)
    Adapter-->>Controller: void
    Controller-->>User: 202 Accepted (Instant Response)

    Note over External, AI: "Consumer" Phase (Async / Long-Running)
    External->>Worker: Wake up & Execute Task
    Worker->>Service: generateReport(id, prompt)
    Service->>AI: Generate Content (Takes ~60s)
    AI-->>Service: Content Returned
    Service->>Worker: Task Complete
