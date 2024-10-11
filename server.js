import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { TONClient } from "ton-client-node-js";
import TonWeb from "tonweb";
//----------------- AI imports- -------------


import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from "@google/generative-ai/server";

import path from 'path'
dotenv.config();

//open ai api key
const OPEN_API_KEY = process.env.OPEN_API_KEY;
import { CohereClient } from 'cohere-ai';
//cohere api key
const COHERE_API_KEY = process.env.COHERE_API_KEY;

// console.log("open ai api key : ", OPEN_API_KEY);
import OpenAI from "openai";
import { connectors } from 'cohere-ai/api/index.js';
import { response } from 'express';

// cohere client
const cohere = new CohereClient({
    token: COHERE_API_KEY, // This is your trial API key
});

// console.log("open ai api key : ", OPEN_API_KEY);

const openai = new OpenAI({ apiKey: OPEN_API_KEY });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });


//--------------------AI imports----------

import { updateUserDetailsToPinata } from './pinataServices.js';
import { Cell } from '@ton/core';
const endpointUrl = "https://testnet.toncenter.com/api/v2/jsonRPC"; // Replace with your desired endpoint
const client = new TONClient({ endpoint: endpointUrl });
import cors from 'cors';

//env config
dotenv.config();
// app intialization
const app = express();
app.use(express.json());
const TOKEN = process.env.TOKEN;



// Middleware
const corsOptions = {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://tano-wallet.vercel.app'], // Allow requests from these origins
    credentials: true, // Allow cookies to be sent with requests
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
};

//cors 
app.use(cors(corsOptions));

//this endpoint will get invoked when user does the payment  . this is for the purpose of sending msg to user . msg contains the gpt or gemini based text output
app.post('/notify-transaction', async (req, res) => {

    let response = "";
    const { transactionId, userId, status, msgText, model } = req.body;

    // Optionally, validate the data or process it further
    // console.log("server user id : ", userId);
    // console.log("server msgText : ", msgText);
    // console.log("server model : ", model);
    try {
        // Notify the Telegram bot
        // await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        //     chat_id: userId,
        //     text: `Transaction ${transactionId} is ${status}.`
        // });

        if (model == 'cohere') {

          //  response = await getChatCompletionGPT(msgText); //this is gpt model
            // console.log("gpt response : ", response);

            
            response = await getCohereChat(msgText); // this is cohere  model
            console.log("cohere response : ", response);
        
        } else {
            response = await getChatCompletionGemini(msgText); // this is gemini model
            console.log("gemini response : ", response);
    
        }

        if (response != "") { 

            await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
                chat_id: userId,
                text: `${response}`
            });

        } else {
            await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
                chat_id: userId,
                text: `error in response`
            });
        }

        res.status(200).send({ success: true, message: 'Notification sent' });
    } catch (error) {
        console.error("Error sending notification to Telegram bot:", error);
        res.status(500).send({ success: false, message: 'Failed to send notification' });
    }
});

//this endpoint will get hit when user makes the payment for the uploaded images . currently we are using the gemini only for this .
app.post('/parse-image', async (req, res) => {

    let response = "";
    const { userId, imageUri, imageMimeType } = req.body;
    // console.log("image uri : ", imageUri);
    // Optionally, validate the data or process it further

    try {
        // Notify the Telegram bot
        // await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        //     chat_id: userId,
        //     text: `Transaction ${transactionId} is ${status}.`
        // });



        response = await getImageCompletionGemini(imageUri, imageMimeType);

        await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            chat_id: userId,
            text: `${response}`
        });

        res.status(200).send({ success: true, message: 'Notification sent' });
    
    } catch (error) {
        console.error("Error in parsing image:", error);
        res.status(500).send({ success: false, message: 'Failed to parse image' });
    }
});

//for confirming transaction
app.post('/confirm-transaction', async (req, res) => {

    let response = "";
    const { boc } = req.body;
    // console.log("boc value : ",boc)
    // Optionally, validate the data or process it further

    try {
        // Notify the Telegram bot
        const transactionHash = await extractTransactionHash(boc);
        // console.log("tx hash : ",transactionHash)
        const fullTransaction = await client.getFullTransaction(transactionHash);
        let status = fullTransaction.status;
        // console.log("tx status : ",transactionHash)
        res.status(200).send({ success: true, status: status });
    } catch (error) {
        console.error("Error sending confirming tx:", error);
        res.status(500).send({ success: false, message: 'Failed to send notification' });
    }
});

//we are using this endpoint for the purpose of updating user last used time into db

app.post('/update-lastused', async (req, res) => {


    const { telegramUserName, chatId } = req.body;
    // console.log("server chat id : ", chatId);

    try {
        let lastUsedTime = null;
        await updateUserDetailsToPinata(telegramUserName, lastUsedTime, "");
        await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `${"payment successfull . retype your query."}`
        });
        res.status(200).send({ success: true, });
    } catch (error) {
        console.error("Error in updating last used time :", error);
        res.status(500).send({ success: false, message: 'Failed to send notification' });
    }
});


//we are using this endpoint for generating image

app.post('/generate-image', async (req, res) => {


    const {  chatId , msgText } = req.body;
     console.log("server chat id : ", chatId);
     console.log("server msg text : ", msgText);
    try {

        await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `${"please wait . generating image..."}`
        });
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: msgText,
            n: 1,
            size: "1024x1024",
          });
         const image_url = response.data[0].url;
        
 
      // Corrected: send the photo using 'photo' field, not 'text'
      await axios.post(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
        chat_id: chatId,
        photo: image_url,  // Use 'photo' instead of 'text'
        caption: "generated image"  // You can use 'caption' for any additional text
    });
        res.status(200).send({ success: true, });
    } catch (error) {
        console.error("Error sending image:", error);
        res.status(500).send({ success: false, message: 'Failed to send image' });
    }
});




app.listen(3000, () => {
    console.log('Backend server running on port 3000');
});





/************* *************/
/**
 * Extracts a transaction hash from a BOC (Bag of Cells) representation.
 * @param {Uint8Array} boc - BOC representation of a transaction.
 * @returns {Promise<string>} - Transaction hash as a hexadecimal string.
 * @throws {Error} - If the BOC is invalid or does not contain a transaction cell.
 * 
 * 

This is a JavaScript function named `extractTransactionHash` that takes a BOC (Bag of Cells) representation of a transaction as input and returns a promise that resolves to the transaction hash as a hexadecimal string. 

The function uses the `TonWeb` library to parse the BOC and extract the transaction hash. If the BOC is invalid or does not contain a transaction cell, the function throws an error. 

The function also includes commented-out code that shows alternative ways to achieve the same result using different libraries (`ton-sdk` and `@ton/core`).
 */
/******  *******/
async function extractTransactionHash(boc) {
    try {
        const tonWeb = new TonWeb();
        const cells = tonWeb.boc.Cell.fromBoc(boc);
        if (cells.length === 0) {
            throw new Error('Invalid BOC: No cells found');
        }
        const cell = cells[0];
        // Check if the cell is a transaction
        if (!cell.isTransaction()) {
            throw new Error('Invalid BOC: Expected a transaction cell');
        }
        const transaction = cell.beginParse();
        // console.log("tx : ", transaction)
        const hash = await transaction.loadHash();


        //using ton -sdk 
        // const cell = await Cell.fromBoc(boc);
        // const transaction = await client.boc.parseMessage(cell);
        // // https://go.getblock.io/eb69bcd2dc7a4298b23b88f262598692
        // const hash = transaction.hash;
        // return hash.toString();

        //--------using @ton/core
        // const cell = await Cell.fromBoc(boc);
        // const transaction = await client.boc.parseMessage(cell);
        // console.log("extracted tx hash : ", transaction);
        // return transaction.hash.toString();





    } catch (error) {
        console.log("error in extracting tx hash ", error)
    }
}


//this is for the chat completion using gemini
/*
This code snippet defines an asynchronous function called `getChatCompletionGemini` that takes a `msg_text` parameter. 
Inside the function, it uses the `genAI` object to retrieve a generative model with the name "gemini-1.5-flash". 
It then generates content using the model and the `msg_text` as the prompt. The generated content is stored in the `result` variable. 
The function then extracts the response from the `result` and converts it to plain text. Finally, it removes any occurrences of "**" from the response and returns the cleaned response.

*/
async function getChatCompletionGemini(msg_text) {
    try {


        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = msg_text

        const result = await model.generateContent(prompt);
        // console.log("gemini completion : ", result);
        const response = await result.response;
        const text = response.text();
        // console.log(text);
        const completeResponse = `${text}`
        let cleanedResponse = completeResponse.replace(/\*\*/g, '');
        return cleanedResponse;
    } catch (error) {
        console.error('Error:', error);
    }
}


//this is for the image completion using gemini
/*


This JavaScript function, `getImageCompletionGemini`, generates a text description of an image using the Gemini model. 
It takes an image's URI and MIME type as input, passes them to the model, and returns the generated text description. 
If an error occurs, it logs the error to the console.
*/
async function getImageCompletionGemini(imageUri, imageMimeType) {

    try {
        // Generate a text description of the image using Gemini
        const imageResponse = await model.generateContent([
            "Tell me about this image.",
            {
                fileData: {
                    fileUri: imageUri,
                    mimeType: imageMimeType,
                },
            },
        ]);

        // Send the generated text description back to the user
        return imageResponse.response.text();
    } catch (error) {
        console.log("error while image completion");
    }
}


//this if for the text completion using gpt
/*

This JavaScript function, `getChatCompletionGPT`, generates a text response using the GPT-3.5-turbo model.
 It takes a `msg_text` parameter, passes it to the model as a user message, and returns the generated response after removing any double asterisks (`**`).
*/
async function getChatCompletionGPT(msg_text) {
    try {


        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            // model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                {
                    role: "user",
                    content: msg_text,
                },
            ],
        });

        // console.log("gpt completion : ", completion);
        // console.log(completion.choices[0].message.content);
        const completeResponse = `${completion.choices[0].message.content}`
        let cleanedResponse = completeResponse.replace(/\*\*/g, '');
        return cleanedResponse;


    } catch (error) {
        console.error('Error:', error);
    }
}



// get cohere RAG for search info and relevant documents

/**************************/
/**
 * @function getCohereChat
 * @description This function takes a user query and returns the response from the Cohere RAG model.
 * @param {string} userQuery - The query to be passed to the Cohere RAG model.
 * @returns {Promise<string>} - The response from the Cohere RAG model.
 * @example
 * const response = await getCohereChat("What is the capital of France?");
 * console.log(response);
 * 

This JavaScript function, `getCohereChat`, sends a user query to the Cohere RAG model and returns the response as a string.
 It uses the `cohere.chat` method to make a request to the model with the provided query and options, and logs any errors that occur.
 The function is asynchronous and returns a Promise that resolves to the response text.
 */
/****** *******/
export async function getCohereChat(userQuery ) {

    try {
      
        const webSearchResponse = await cohere.chat({
            model: "command-r-plus-08-2024",
            message: userQuery,
            promptTruncation: "AUTO",
            connectors: [{ "id": "web-search" }],

        })
    
           console.log("Cohere RAG : ", webSearchResponse);

         return webSearchResponse.text;



    } catch (error) {
        console.log("error while getting cohere chat : ", error.message);
    }



}