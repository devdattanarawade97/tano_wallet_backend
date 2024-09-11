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

        if (model == 'gpt') {

            response = await getChatCompletionGPT(msgText);
            // console.log("gpt response : ", response);
        
        } else {
            response = await getChatCompletionGemini(msgText);
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
        let array = previousOutputs[userId] || [];

        // Push something into the array
        array.push(response);
    } catch (error) {
        console.error("Error in parsing image:", error);
        res.status(500).send({ success: false, message: 'Failed to parse image' });
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
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: msgText,
            n: 1,
            size: "1024x1024",
          });
          image_url = response.data[0].url;
        
 
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

