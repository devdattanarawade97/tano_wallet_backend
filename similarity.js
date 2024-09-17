
import { retrieveFromPinata } from './pinataServices.js';
import fs from 'fs';
import tmp from 'tmp';
import path from 'path'
import os from 'os';
import dotenv from 'dotenv';
import { PdfReader } from 'pdfreader'
import {read} from 'xlsx'
dotenv.config();
import * as xlsx from 'xlsx';

const OPEN_API_KEY = process.env.OPEN_API_KEY;

// console.log("open ai api key : ", OPEN_API_KEY);
import OpenAI from "openai";



const openai = new OpenAI({ apiKey: OPEN_API_KEY });

//this will generate embeddings for each 2000 chars . firstly docs will be splitted into 2000 chars 
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

export async function processFile(bufferData , docType) {


    try {
        const text = await extractText(bufferData, docType);

        console.log("extracted text : ", text);

        documentEmbeddings = await generateEmbeddings(text);
        console.log("Embeddings generated and stored.");

    } catch (error) {
        console.log("error while processing file : ", error.message);

    }
    return documentEmbeddings;
}


// Step 3: Find relevant chunks based on a question
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
    return similarities.slice(0, 3).map(sim => sim.text); // Return top 3 most similar chunks
}

// Step 4: Query GPT-4 with relevant chunks
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
function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((acc, val, i) => acc + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((acc, val) => acc + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((acc, val) => acc + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}


//this will be used for extracting text from the buffer data .
async function extractText(bufferData,docType) {
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



