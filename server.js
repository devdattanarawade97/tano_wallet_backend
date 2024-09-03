import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { TONClient } from "ton-client-node-js";
import TonWeb from "tonweb";
//----------------- bot - -------------


import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from "@google/generative-ai/server";

import path from 'path'
dotenv.config();


const OPEN_API_KEY = process.env.OPEN_API_KEY;
const ORBITDB_PATH = process.env.ORBITDB_PATH;
// console.log("open ai api key : ", OPEN_API_KEY);
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: OPEN_API_KEY });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });


//--------------------bot----------

import { updateUserDetailsToPinata } from './pinataServices.js';
import { Cell } from '@ton/core';
const endpointUrl = "https://testnet.toncenter.com/api/v2/jsonRPC"; // Replace with your desired endpoint
const client = new TONClient({ endpoint: endpointUrl });
import cors from 'cors';

dotenv.config();
const app = express();
app.use(express.json());
const TOKEN = process.env.TOKEN;

const previousOutputs = {};


// Middleware
const corsOptions = {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://tano-wallet.vercel.app'], // Allow requests from these origins
    credentials: true, // Allow cookies to be sent with requests
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
};

app.use(cors(corsOptions));

app.post('/notify-transaction', async (req, res) => {

    let response = "";
    const { transactionId, userId, status, msgText, model } = req.body;

    // Optionally, validate the data or process it further
    console.log("server user id : ", userId);
    console.log("server msgText : ", msgText);
    console.log("server model : ", model);
    try {
        // Notify the Telegram bot
        // await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        //     chat_id: userId,
        //     text: `Transaction ${transactionId} is ${status}.`
        // });

        if (model == 'gpt') {

            response = await getChatCompletionGPT(msgText);
            console.log("gpt response : ", response);
            // Get the value of x[y] or create an empty array if it doesn't exist
            let array = previousOutputs[userId] || [];

            // Push something into the array
            array.push(response);
        } else {
            response = await getChatCompletionGemini(msgText);
            console.log("gemini response : ", response);
            let array = previousOutputs[userId] || [];

            // Push something into the array
            array.push(response);
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
        let array = previousOutputs[userId] || [];

        // Push something into the array
        array.push(response);
    } catch (error) {
        console.error("Error sending notification to Telegram bot:", error);
        res.status(500).send({ success: false, message: 'Failed to send notification' });
    }
});
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


app.post('/update-lastused', async (req, res) => {


    const { telegramUserName, chatId } = req.body;
    console.log("server chat id : ", chatId);

    try {
        let lastUsedTime = null;
        await updateUserDetailsToPinata(telegramUserName, lastUsedTime, "");
        await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: `${"payment successfull . retype your query."}`
        });
        res.status(200).send({ success: true, });
    } catch (error) {
        console.error("Error sending confirming tx:", error);
        res.status(500).send({ success: false, message: 'Failed to send notification' });
    }
});




app.post('/send', async (req, res) => {

    let response = "";
    const { userId , senderId} = req.body;
    // console.log("image uri : ", imageUri);
    // Optionally, validate the data or process it further

    try {
        // Notify the Telegram bot
        // await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        //     chat_id: userId,
        //     text: `Transaction ${transactionId} is ${status}.`
        // });
        let arrayOutput = previousOutputs[userId];
        console.log("array output on server: ", arrayOutput);
        let lastMessage 
        if (arrayOutput.length > 0) {
            lastMessage   = arrayOutput[arrayOutput.length - 1];
        }
        console.log("last msg on server : ", lastMessage)
        if (lastMessage) {
            await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
                chat_id: senderId,
                text: `${lastMessage}`
            });
    
            res.status(200).send({ success: true, message: 'Notification sent' });
        } else {
            await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: `msg not found`
            });
    
            res.status(200).send({ success: true, message: 'Notification sent' });
         }
       
    } catch (error) {
        console.error("Error sending notification to Telegram bot:", error);
        res.status(500).send({ success: false, message: 'Failed to send notification' });
    }
});


app.listen(3000, () => {
    console.log('Backend server running on port 3000');
});





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
        console.log("tx : ", transaction)
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

async function getChatCompletionGemini(msg_text) {
    try {


        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = msg_text

        const result = await model.generateContent(prompt);
        console.log("gemini completion : ", result);
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

        console.log("gpt completion : ", completion);
        // console.log(completion.choices[0].message.content);
        const completeResponse = `${completion.choices[0].message.content}`
        let cleanedResponse = completeResponse.replace(/\*\*/g, '');
        return cleanedResponse;


    } catch (error) {
        console.error('Error:', error);
    }
}


async function getFileCompletionGPT(tempFilePath) {
    try {


        const file = await openai.files.create({
            file: fs.createReadStream(tempFilePath),
            purpose: "fine-tune",
        });

        console.log(file);
        return "fine tunned successfully";


    } catch (error) {
        console.error('Error:', error);
    }
}

//



export async function getPreviousOutput() {


    try {
        return previousOutputs;
    } catch (error) {
        console.log("error : ", error.message);
    }
    
}