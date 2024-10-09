
import { retrieveFromPinata } from './pinataServices.js';
import fs from 'fs';
import tmp from 'tmp';
import path from 'path'
import os from 'os';
import dotenv from 'dotenv';
import { PdfReader } from 'pdfreader'
import { read } from 'xlsx'
import { CohereClient } from 'cohere-ai';

dotenv.config();
import * as xlsx from 'xlsx';

//import api key 
const OPEN_API_KEY = process.env.OPEN_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

// console.log("open ai api key : ", OPEN_API_KEY);
import OpenAI from "openai";
import { connectors } from 'cohere-ai/api/index.js';
import { response } from 'express';

// cohere client
const cohere = new CohereClient({
    token: COHERE_API_KEY, // This is your trial API key
});

//open ai client
const openai = new OpenAI({ apiKey: OPEN_API_KEY });

//this will generate embeddings for each 2000 chars . firstly docs will be splitted into 2000 chars 
/*
Step 1: Generate embeddings
This JavaScript function, `generateEmbeddings`, takes a text input 
and splits it into chunks of 2000 characters. It then uses the OpenAI API to 
generate embeddings for each chunk, which are vector representations of the text. 
The function returns an array of objects, each containing the original chunk of text and its corresponding embedding.
*/
async function generateEmbeddings(text) {
    const chunks = text.match(/.{1,2000}(\s|$)/g); // Split text into chunks of 2000 characters
    const embeddings = [];

    for (const chunk of chunks) {
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small', // Use the appropriate embedding model
            input: chunk,
            encoding_format: "float",
        });
        console.log("embedding response : ", response)
        embeddings.push({ text: chunk, embedding: response.data[0].embedding });
    }

    return embeddings;
}

// Step 2: Store the embeddings (in memory for simplicity)
let documentEmbeddings = []; // This could be stored in a database for larger documents

/*************  *************/
/**
 * @function processFile
 * @description This function takes a file buffer and docType as input, extracts text from the file, generates embeddings for each 2000 characters, and stores them in memory for later querying.
 * @param {Buffer} bufferData - The raw file data.
 * @param {string} docType - The type of file ('pdf' or 'csv').
 * @returns {Promise<Array<{text: string, embedding: number[]}> >} - A promise that resolves to an array of objects, each containing the text of a chunk and its corresponding embedding.
 * @example
 * const bufferData = fs.readFileSync('example.pdf');
 * const docType = 'pdf';
 * const embeddings = await processFile(bufferData, docType);
 * console.log(embeddings);
 * 

This is a JavaScript function named `processFile` that takes a file buffer and document type as input, extracts the text from the file, generates embeddings (vector representations) for the text, and returns the embeddings. 
The function uses either OpenAI or Cohere embeddings, depending on which line is uncommented.
 */

/******  *******/
export async function processFile(bufferData, docType) {


    try {
        const text = await extractText(bufferData, docType);

        console.log("extracted text : ", text);
        //open ai embeddings
        // documentEmbeddings = await generateEmbeddings(text);
        // cohere embeddings 
        documentEmbeddings = await getCohereEmbeddings(text);

        console.log("Embeddings generated and stored.");

    } catch (error) {
        console.log("error while processing file : ", error.message);

    }
    return documentEmbeddings;
}


// Step 3: Find relevant chunks based on a question
/*


This function finds the top 3 most relevant text chunks from a list of document embeddings based on a given question. It does this by:

1. Generating an embedding for the question using OpenAI's text-embedding model.
2. Calculating the cosine similarity between the question embedding and each document embedding.
3. Sorting the document embeddings by their similarity to the question.
4. Returning the text of the top 3 most similar chunks.

`backend/similarity.js:findRelevantChunks`
*/
async function findRelevantChunks(documentEmbeddings1, question) {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: question,
    });

    const questionEmbedding = response.data[0].embedding;
    const similarities = documentEmbeddings1.map(doc => ({
        text: doc.text,
        similarity: cosineSimilarity(doc.embedding, questionEmbedding),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    console.log("similarities chunk  : ", similarities.slice(0, 3).map(sim => sim.text));
    return similarities.slice(0, 3).map(sim => sim.text); // Return top 3 most similar chunks
}

// Step 4: Query GPT-4 with relevant chunks
/*

This JavaScript function, `askQuestionAboutPDF`, takes in `documentEmbeddings` and a `question` as input. 
It uses the embeddings to find the most relevant chunks of text from a document, combines them with the question, 
and then queries the GPT-3.5-turbo model to generate a response. The function returns the generated response.
*/
export async function askQuestionAboutPDF(documentEmbeddings, question) {
    // await processFile(ipfsHash); // Process the file to generate embeddings
    const relevantChunks = await findRelevantChunks(documentEmbeddings, question);

    // Combine the relevant chunks with the question
    const prompt = relevantChunks.join('\n\n') + `\n\nQuestion: ${question}`;

    // Query GPT-4
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        // model: "gpt-4o",
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            {
                role: "user",
                content: prompt,
            },
        ],
    });

    console.log("Response: ", response.choices[0].message.content);
    return response.choices[0].message.content;
}

// Utility function for cosine similarity
/*
This JavaScript function calculates the cosine similarity between two vectors (`vecA` and `vecB`). Cosine similarity is a measure of similarity between two vectors that measures the cosine of the angle between them.
 The result is a value between -1 (opposite direction) and 1 (same direction), where 0 means the vectors are orthogonal (perpendicular).
*/
function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}


//this will be used for extracting text from the buffer data .
/*
This JavaScript function, `extractText`, takes in `bufferData` and `docType` as input. 
It extracts text from the buffer data based on the document type, which can be either a PDF or an Excel spreadsheet (xlsx). The function uses the `PdfReader` library for PDFs and the `xlsx` library for Excel files. 
It returns the extracted text as a single string.
*/
async function extractText(bufferData, docType) {
    try {

        const text = [];

        if (docType == "application/pdf") {
            await new Promise((resolve, reject) => {
                new PdfReader().parseBuffer(bufferData, function (err, item) {
                    if (err) {
                        reject(err);
                    } else if (!item) {
                        resolve(text.join(' '));
                    } else if (item.text) {
                        text.push(item.text);
                    }
                });
            });
        } else if (docType == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
            // Parse the xlsx buffer
            const workbook = xlsx.read(bufferData, { type: 'buffer' });
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const sheetData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

                // Convert each row to a string and append it to the text array
                sheetData.forEach(row => {
                    text.push(row.join(' '));
                });
            });
        }


        console.log("extracted text : ", text.join(' '))
        return text.join(' ');
    } catch (error) {
        console.error('Error extracting text:', error);
        throw error;
    }
}





/*************   *************/
/**
 * @function getCohereEmbeddings
 * @description This function takes a string, splits it into chunks of 2000 characters, and uses the Cohere AI model to generate embeddings for each chunk.
 * @param {string} texts - The text to be processed.
 * @returns {Promise<Array<{text: string, embedding: number[]}> >} - A promise that resolves to an array of objects, each containing the text of a chunk and its corresponding embedding.
 * @example
 * const texts = "This is a sample text";
 * const embeddings = await getCohereEmbeddings(texts);
 * console.log(embeddings);
 * 

This JavaScript function, `getCohereEmbeddings`, takes a string input, splits it into 2000-character chunks, and uses the Cohere AI model to generate vector embeddings for each chunk. It returns a promise that resolves to an array of objects, each containing the original chunk text and its corresponding embedding.

In other words, it converts text into numerical representations that can be used for various NLP tasks.
 */
/******   *******/
async function getCohereEmbeddings(texts) {
    try {

        const chunks = texts.match(/.{1,2000}(\s|$)/g); // Split text into chunks of 2000 characters
        const embeddings = [];

        for (const chunk of chunks) {
            const response = await cohere.embed({
                model: "embed-english-v3.0",
                texts: [chunk], // Pass the texts as argument
                inputType: "classification",
                truncate: "NONE"
            });
            console.log(`cohere Embeddings: ${JSON.stringify(response.embeddings[0])}`);

            embeddings.push({ text: chunk, embedding: response.embeddings[0] });
        }

        return embeddings;

    } catch (error) {
        console.error("Error fetching  cohere embeddings:", error);
    }
}



// get cohere RAG for search info and relevant documents

/*************  *************/
/**
 * @function getCohereRAG
 * @description This function takes a user query and returns the response from the Cohere RAG model.
 * @param {string} userQuery - The query to be passed to the Cohere RAG model.
 * @param {Array<Object>} documentEmbeddings - An array of objects containing the text and embedding of each chunk of the document.
 * @returns {Promise<string>} - The response from the Cohere RAG model.
 * @example
 * const response = await getCohereRAG(documentEmbeddings, "What is the capital of France?");
 * console.log(response);
 * This code snippet defines a function named `getCohereRAG` in JavaScript. The function takes two parameters: `documentEmbeddings`, which is an array of objects containing text and embeddings, and `userQuery`, which is a string representing a user query. The function is documented using JSDoc comments, indicating that it returns a Promise that resolves to a string, which is the response from the Cohere RAG model.

Inside the function, it first calls the `findRelevantChunks` function to get a list of relevant chunks based on the `documentEmbeddings` and `userQuery`. Then, it makes a chat request to the Cohere RAG model using the `cohere.chat` function, passing the `userQuery` and some options. The response from the chat request is stored in the `webSearchResponse` variable.

Next, it makes a chat stream request to the Cohere RAG model using the `cohere.chatStream` function, passing the `userQuery` and some options. The `documents` option is set to an object containing the first relevant chunk from the previous step and the `webSearchResponse` text.

Inside the loop, it checks if the `chat` object has an `eventType` property equal to "text-generation". If it does, it appends the `chat.text` to the `streamResponse` string.

Finally, it returns the `streamResponse` string. If an error occurs during the execution of the function, it logs the error message to the console.
 */
/****** *******/
export async function getCohereRAG(documentEmbeddings, userQuery) {

    try {
        const relevantChunks = await findRelevantChunks(documentEmbeddings, userQuery);
        const webSearchResponse = await cohere.chat({
            model: "command-r-plus-08-2024",
            message: userQuery,
            promptTruncation: "AUTO",
            connectors: [{ "id": "web-search" }],

        })
        // console.log("web response from cohere : ", webSearchResponse.text);
      
        // for streaming purpose 
        
        //     const stream = await cohere.chatStream({
        //         model: "command-r-plus-08-2024",
        //         message: userQuery,
        //          documents: [{ userdocs: relevantChunks[0], websearch: webSearchResponse.text }],

        //         promptTruncation: "AUTO",
        //     })


        //     let streamResponse = "";
        //     for await (const chat of stream) {
        //         if (chat.eventType === "text-generation") {

        //            streamResponse += chat.text;


        //         }
        //    }
        // console.log("Cohere RAG : ", response);
        //     return streamResponse;


        const resonse = await cohere.chat({
            model: "command-r-plus-08-2024",
            message: userQuery,
            documents: [{ userdocs: relevantChunks[0], websearch: webSearchResponse.text }],

            promptTruncation: "AUTO",
        })
        return response.text;




    } catch (error) {
        console.log("error while getting RAG : ", error.message);
    }



}