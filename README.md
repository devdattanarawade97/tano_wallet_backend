### Project Documentation: AI Integration and Secure Document Processing

---

**Project Overview**

This project integrates OpenAI, Google Gemini AI, TON blockchain, and Pinata for secure document processing, embedding generation, and AI-based query resolution. It provides a robust system for handling user transactions, notifying users via Telegram, processing PDF and CSV documents for text extraction, and leveraging AI models for generating responses based on text inputs or images. The project utilizes a microservice architecture, with API endpoints managing transactions, document processing, and embedding queries. Additionally, it includes functionality for extracting transaction details from the TON blockchain and securely interacting with Pinata for document storage.

---

### Key Components and Functionality

#### 1. **AI Model Integrations**

The project integrates two prominent AI models: **OpenAI** and **Google Gemini AI**.

- **OpenAI Integration**:
  - Used for generating embeddings and responding to text queries via GPT-based models.
  - Supports models like `gpt-3.5-turbo` for chat completions and `text-embedding-3-small` for embedding generation.
  
- **Google Gemini AI Integration**:
  - Used for both text and image-based completions.
  - Handles image parsing tasks where users upload images, and Gemini generates descriptive text outputs.

These models are utilized to provide responses to user queries, generate text from images, and extract embeddings for document analysis.

---

#### 2. **Pinata Services Integration**

The project integrates **Pinata** for decentralized storage of documents (PDF and CSV). It allows users to securely upload documents, which are then processed for text extraction and embedding generation. The extracted embeddings are used for efficient querying, enabling the system to provide contextual responses to user queries.

Pinata ensures that the documents are stored securely and can be retrieved when needed.

---

#### 3. **Telegram Bot Integration**

A Telegram bot is integrated for user notifications related to transactions and document processing. Notifications are sent after specific actions such as payments, image parsing, and successful document processing. The bot is used to:
- Notify users about the status of transactions.
- Provide users with AI-generated responses (via OpenAI or Gemini).
- Update users on the success of document or image parsing operations.

The bot interacts with the users by leveraging the `axios` library for sending HTTP requests to the Telegram API.

---

#### 4. **Document Processing**

The system is designed to handle both **PDF** and **CSV** file formats, extracting textual data and converting it into embeddings for further analysis.

- **PDF Extraction**:
  - Uses the `pdfreader` library to extract text from uploaded PDFs. The extracted text is segmented into 2000-character chunks to generate embeddings using OpenAI’s embedding models.
  
- **CSV Extraction**:
  - Uses `xlsx` to parse CSV files, extract data from the spreadsheet, and convert it into text for embedding generation. This text is then analyzed using AI models for querying purposes.

---

#### 5. **Embedding Generation and Text Chunking**

- Documents are split into smaller chunks (typically 2000 characters) to ensure efficient embedding generation.
- The system leverages OpenAI’s embedding models to create vector embeddings, which are then stored in memory for further processing.
- These embeddings are used to calculate **cosine similarity** with user queries, enabling the system to return the most relevant chunks of text in response to a given question.

---

#### 6. **Transaction Management and TON Blockchain**

The project also interacts with the TON blockchain to verify and handle user transactions.

- **Transaction Confirmation**:
  - When a transaction occurs, the system extracts and confirms the transaction details using the TON blockchain.
  - The extracted transaction hash is used to retrieve the full transaction details, such as status and amount.
  
- **Message Broadcasting**:
  - The system communicates transaction statuses to the Telegram bot, notifying users when a transaction is confirmed.

---

### API Endpoints

The project features multiple RESTful API endpoints that handle various user interactions:

1. **`/notify-transaction`**:
   - Triggered when a user completes a transaction.
   - Sends notifications to users with GPT or Gemini-generated messages based on transaction status.
   - Invokes AI-based chat completions to create dynamic responses related to the transaction.
  
2. **`/parse-image`**:
   - Triggered when an image is uploaded by the user.
   - Uses Google Gemini AI to parse the image and generate descriptive text.
   - Sends the generated output back to the user via Telegram.

3. **`/confirm-transaction`**:
   - Confirms the status of a transaction by extracting the transaction hash from the TON blockchain.
   - Retrieves the full transaction details and sends the status back to the user.

4. **`/update-lastused`**:
   - Updates the last active time for a user in Pinata after a successful transaction.
   - Sends a notification to the user confirming that their payment was successful.

---

### Document Embedding and Querying Process

**Step 1: File Upload and Text Extraction**  
When a user uploads a PDF or CSV file, the system processes it by extracting text from the file and generating embeddings for each 2000-character chunk.

**Step 2: Embedding Storage**  
The generated embeddings are stored temporarily in memory (this can be extended to a database for scalability).

**Step 3: User Query and Chunk Retrieval**  
When a user asks a question about the document, the system computes the **cosine similarity** between the query and the document embeddings. It identifies the most relevant chunks and sends them to the GPT model along with the user's question.

**Step 4: AI Response**  
The GPT model processes the user's question in the context of the relevant chunks and generates a detailed response. This response is then sent back to the user via Telegram.

---

### Error Handling

The system includes robust error handling across various components:
- Errors during API calls to Telegram are logged, and the user is notified if a failure occurs.
- Text extraction errors from PDFs and CSVs are logged to ensure that any issues during file processing are caught and resolved.
- AI model errors, such as issues with generating embeddings or completions, are also logged to provide feedback for debugging and optimization.

---

### Future Improvements

1. **Persistent Embedding Storage**:  
   Currently, embeddings are stored in memory, but this can be enhanced by integrating a persistent database for large document sets.
   
2. **Enhanced AI Model Selection**:  
   The system could be improved by dynamically selecting the best AI model based on the input type (e.g., using a more advanced model for complex questions).
   
3. **User Authentication and Security**:  
   The project could benefit from integrating authentication mechanisms (e.g., OAuth) to ensure secure access to the API endpoints.

4. **Scalability**:  
   The current setup is designed for smaller datasets, but could be scaled to handle larger files and more complex queries.

---

### Conclusion

This project integrates state-of-the-art AI models with blockchain technology and decentralized storage to create a powerful and secure document processing and analysis platform. By utilizing tools like OpenAI, Google Gemini AI, Pinata, and Telegram, it offers a seamless user experience for querying documents and handling transactions. The modular architecture allows for further scalability and customization, making it a versatile solution for various industries requiring secure document handling and AI-driven insights.



TOKEN

Purpose: This token is used for authenticating requests to the Telegram bot API or other integrated services requiring token-based authentication.
Usage: Ensures that all communications between the system and Telegram (or other platforms) are secure and authenticated.
PVT_KEY

Purpose: The private key for accessing and managing transactions on the TON blockchain.
Usage: Used for signing transactions or verifying identities during interactions with the blockchain.
OPEN_API_KEY

Purpose: API key for accessing OpenAI services.
Usage: This key authenticates the system's requests to OpenAI models (e.g., GPT-3.5-Turbo for chat completions and text-embedding models).
GEMINI_API_KEY

Purpose: API key for accessing Google Gemini AI services.
Usage: Used to authenticate and authorize requests when interacting with Google Gemini for tasks such as image parsing and generating text-based completions.
PINATA_JWT

Purpose: JSON Web Token (JWT) for accessing Pinata services.
Usage: Ensures secure access to Pinata’s decentralized storage for uploading, retrieving, and managing documents.
PINATA_GETWAY

Purpose: Gateway URL for accessing files stored in Pinata’s IPFS service.
Usage: Provides a link to retrieve and interact with files stored on the IPFS network via Pinata, allowing seamless integration of document storage and retrieval.
PUBLIC_BACKEND_BASE_URI

Purpose: The base URI for the backend API of the project.
Usage: Used to make API calls to the backend services (e.g., document processing, transaction confirmations, etc.) from the frontend or other services.



flowchart : 

Create a detailed flowchart diagram illustrating the workflow of a decentralized document processing system with integration of multiple APIs, including OpenAI, Google Gemini AI, and Pinata. The flowchart should include the following components and their interactions:**

User Interaction:

User uploads a document (PDF/CSV) via the frontend.
User submits a query or receives notifications through a Telegram bot.
Backend Process:

The uploaded document is sent to the backend API, where it is processed (split into chunks of text for embeddings).
Generate text embeddings using OpenAI API for each chunk.
If the document is an image, use Google Gemini API for image parsing and text generation.
Storage & Retrieval:

The document is uploaded to decentralized storage via Pinata using the provided JWT.
Pinata stores the document and generates an IPFS hash for retrieval.
Backend stores document embeddings in memory (or a database) for query processing.
Querying Documents:

User submits a query through the frontend or Telegram bot.
The query is processed by generating embeddings using OpenAI and comparing them to stored embeddings.
Cosine similarity is calculated between query embeddings and document embeddings.
The top 3 most relevant document chunks are retrieved and combined to form a prompt for OpenAI's GPT model.
Notifications:

The backend sends a confirmation of completed processing or a transaction notification to the user via the Telegram bot.
The result of the document query is also sent to the user via Telegram or displayed on the frontend.
Blockchain Interaction (TON):

When a payment or transaction is made, the backend confirms the transaction status on the TON blockchain using the TONClient.
If confirmed, a message is sent to the user notifying them of the transaction status.
Additional Notes:

Include API calls and interactions with OpenAI, Google Gemini, and Pinata at appropriate stages.
Show the flow of environment variables (TOKEN, OPEN_API_KEY, GEMINI_API_KEY, PINATA_JWT, etc.) used to authenticate these API interactions.