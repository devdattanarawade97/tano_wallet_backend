# Tano Telegram Bot  
**Project Documentation: AI Integration and Secure Document Processing**  

---

## **Workflow Overview**  
The Tano Telegram Bot project is designed to integrate cutting-edge technologies like **OpenAI**, **Google Gemini AI**, **TON Blockchain**, and **Pinata** for secure document processing and AI-driven query resolution. Users can interact via a Telegram bot to upload documents (PDF/CSV), submit queries, or send images, receiving AI-generated responses. Document storage is decentralized via Pinata, and transactions are verified on the TON blockchain. Notifications are sent to users after key events like document processing or payment confirmation.

---

### **Key Components and Functionalities**

---

#### **1. AI Model Integrations**
This system integrates two AI models:

- **OpenAI**:  
   - Uses models like `gpt-3.5-turbo` and `text-embedding-3-small` for generating text embeddings and responding to user queries.  
   - Analyzes document content and answers text-based queries.

- **Google Gemini AI**:  
   - Responsible for parsing image uploads and generating descriptive text.  
   - Supports both image and text completions to enhance query resolution for diverse file types.

---

#### **2. Pinata Services Integration**  
**Pinata** is used for decentralized document storage on IPFS (InterPlanetary File System):  

- **Document Upload**: Securely uploads PDF/CSV files.  
- **IPFS Storage**: Ensures decentralized and secure file storage using IPFS.  
- **JWT Authentication**: For secure interaction with Pinata services.

---

#### **3. Telegram Bot Integration**  
The **Telegram Bot** serves as the primary interaction point for users, handling notifications, document queries, and transaction updates:  

- **Notifications**: Alerts users about transaction status, document processing results, and AI query responses.  
- **User Interactions**: Facilitates document queries and sends AI-generated responses.  
- **Transaction Updates**: Informs users about transaction status updates from the TON blockchain.

---

#### **4. Document Processing**  
The system processes both **PDF** and **CSV** file formats, extracting and chunking text for AI embedding generation:

- **PDF Processing**:  
   - Uses the `pdfreader` library to extract text from uploaded PDF files.  
   - Text chunks of 2000 characters are created for embedding generation.

- **CSV Processing**:  
   - The `xlsx` library parses CSV files and converts tabular data into textual format.  
   - The processed text is divided into chunks for embedding generation.

---

#### **5. Embedding Generation and Text Chunking**  
- **Text Chunking**: The extracted document content is divided into smaller chunks of 2000 characters.  
- **Embedding Generation**: OpenAI models generate vector representations for each chunk.  
- **Cosine Similarity**: When a user submits a query, cosine similarity is calculated between the query embedding and document embeddings to retrieve the most relevant chunks.

---

#### **6. Transaction Management and TON Blockchain**  
The system integrates with the **TON Blockchain** to handle and verify transactions:

- **Transaction Confirmation**: The system retrieves transaction details using the transaction hash, verifying payment status.  
- **Transaction Notifications**: Users are notified via the Telegram bot once a transaction is confirmed.

---

### **API Endpoints**

---

#### **1. /notify-transaction**  
- Notifies users about transaction statuses using GPT or Gemini for message generation.

```bash
curl -X POST http://localhost:3000/notify-transaction \
-H "Content-Type: application/json" \
-d '{
    "transactionId": "12345",
    "userId": "67890",
    "status": "completed",
    "msgText": "Sample message",
    "model": "gpt"
}'
```

#### **2. /parse-image**  
- Processes an uploaded image with Google Gemini and sends a description back to the user.

```bash
curl -X POST http://localhost:3000/parse-image \
-H "Content-Type: application/json" \
-d '{
    "userId": "12345",
    "imageUri": "https://example.com/image.jpg",
    "imageMimeType": "image/jpeg"
}'
```

#### **3. /confirm-transaction**  
- Confirms a transaction on the TON blockchain by parsing the BOC (Bag of Cells).

```bash
curl -X POST http://localhost:3000/confirm-transaction \
-H "Content-Type: application/json" \
-d '{
    "boc": "boc data here"
}'
```

#### **4. /update-lastused**  
- Updates the user's last activity and notifies them via Telegram.

```bash
curl -X POST http://localhost:3000/update-lastused \
-H "Content-Type: application/json" \
-d '{
    "telegramUserName": "john_doe",
    "chatId": "123456789"
}'
```

---

### **Document Embedding and Querying Process**

---

**Step 1: File Upload and Text Extraction**  
Users upload a PDF or CSV file, the system extracts text, chunks it, and generates embeddings.

**Step 2: Embedding Storage**  
Generated embeddings are stored in memory (future iterations may involve database storage for larger documents).

**Step 3: User Query and Chunk Retrieval**  
User submits a query via the Telegram bot, and cosine similarity is used to retrieve relevant text chunks from stored embeddings.

**Step 4: AI Response**  
The retrieved chunks are passed to OpenAI’s GPT model, generating a response, which is sent back to the user via the Telegram bot.

---

### **Bot Commands**

---

1. **/start**: Initializes the bot and prompts the user to connect their wallet.  
2. **/text**: Sends a text query and allows the user to choose between Gemini or GPT modes.  
3. **/image**: Requests image upload, which is processed via Google Gemini AI.  
4. **/docs**: Requests PDF/CSV uploads for document processing and querying.  
5. **/update**: Updates an existing file in Pinata.  
6. **/hey**: Queries a document uploaded by another user, based on available embeddings.

---

### **Error Handling**

---

- **API Errors**: Logged and fallback messages sent to users.  
- **File Processing Errors**: Errors during text extraction are logged for debugging.  
- **AI Model Errors**: Issues during embedding generation or AI completions are handled to maintain stability.

---

### **Environment Variables**

- **TOKEN**: Telegram bot token  
- **PVT_KEY**: Private key for blockchain interactions  
- **OPEN_API_KEY**: OpenAI API key  
- **GEMINI_API_KEY**: Google Gemini API key  
- **PINATA_JWT**: Pinata authentication token  
- **PINATA_GETWAY**: Pinata IPFS gateway  
- **PUBLIC_BACKEND_BASE_URI**: Base URI for backend API  

---

### **Conclusion**

This project merges AI technologies, decentralized storage, and blockchain to deliver secure document processing and intelligent query resolution. With the integration of OpenAI, Google Gemini AI, and the TON blockchain, the Telegram bot facilitates smooth interactions and secure transactions, providing a valuable tool for industries requiring document management and AI insights.