

// imports for bot
import dotenv from 'dotenv';
import telegramBot from 'node-telegram-bot-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from "@google/generative-ai/server";
import axios from 'axios';
import path from 'path'
import fs from 'fs';
import tmp from 'tmp';
import { uploadToPinata, retrieveFromPinata, createPinataUser, getAllEmbeddings, updateFilesToPinata, updateUserDetailsToPinata, queryLastUsedBotTimeFromPinata, retriveTotalChargeFromPinata } from './pinataServices.js';
import os from 'os';
import { askQuestionAboutPDF, processFile, getCohereRAG } from './similarity.js'
import OpenAI from "openai";
import { createOrder } from './coingate.js';

// Access your API key as an environment variable (see "Set up your API key" above)

// const Symbiosis = require("@symbiosis/sdk").default;
// import { Symbiosis } from "symbiosis-js-sdk";

// Assuming you have the package installed
dotenv.config();
//bot token
const TOKEN = process.env.TOKEN;
//open ai api key
const OPEN_API_KEY = process.env.OPEN_API_KEY;
//public base backend url 
const PUBLIC_BACKEND_BASE_URI = process.env.PUBLIC_BACKEND_BASE_URI;
//open ai and gemini config
const openai = new OpenAI({ apiKey: OPEN_API_KEY });
const bot = new telegramBot(TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

// console.log("bot token : ", TOKEN)
// console.log("gemini token : ", process.env.GEMINI_API_KEY)


//user specific AI model storage
//user specific embeddings storage
let userModes = {};
let userEmbeddings = {};
// Storage for previous output (e.g., image URLs or file IDs) per user


// #1 bot on msg
// this function will be called when user sends any message to bot 
bot.on('message', async (msg) => {

    console.log("on msg command ");

    let chatId = msg.chat.id; //chat id
    let telegramUsername = msg.from.username; //telegram username
    let currentTime = new Date(); // current date and time
    let currentMode = userModes[chatId] || 'cohere';  // Default to GPT if not set
    let msg_text = msg.text ? msg.text.trim() : ''; // user entered msg
    let commandParts = msg_text.split(' '); // split the command and arguments
    let command = commandParts[0]; // get the command
    console.log("msg text : ", msg_text)
    let modelName = encodeURIComponent(currentMode); //encode model name

    /* 
     - we are restricting user for entering text more than 100 chars as AI model have 4096 token limits on prompt 
       and if user enters more than 100 chars then bot will return error . below conditions are added for text mode
    */

    if (msg_text.length > 100 && command === '/text') {
        await bot.sendMessage(chatId, "Please enter a query with less than 100 characters.");
        return;
    }
    // console.log("chatid: ", chatId);
    // console.log("user entered msg: ", msg_text);
    // console.log("current mode: ", currentMode);

    let response = null;
    /*
    -  we are checking user hasnot entered any command with msg then only we are allowing to proceed with this if condition. 
    -  below list of commands are /start, /hey, /update, /send, /generate, /trade
    -  if user has entered any command with msg then bot will return error.
    -  if user selects /text mode then bot will ask user to select mode. that is gemini or gpt
    -  if user selects /image mode then bot will ask user to send image
    -  if user selects /docs mode then bot will ask user to send document
    -  default mode is gpt
    -  if user sends msg without any command then simple cohere chat query will be handled

    */
    if (command && command !== '/start' && command !== '/hey' && command !== '/update' && command !== '/send' && command !== '/generate' && command !== '/trade') {
        try {
            switch (command) {
                case '/text':

                    const options = {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: 'Gemini Mode',
                                        callback_data: 'mode_gemini',
                                    },
                                    {
                                        text: 'Cohere Mode',
                                        callback_data: 'mode_cohere',
                                    },
                                ],
                            ],
                        },
                    };

                    await bot.sendMessage(chatId, "select model", options);

                    break;

                case '/image':
                    await bot.sendMessage(chatId, "Please send an image.");
                    break;

                case '/docs':
                    await bot.sendMessage(chatId, "Please send a PDF document.");
                    break;

                default:
                    let encodedMsg = encodeURIComponent(msg_text);

                    let actualLastUsedTime = await queryLastUsedBotTimeFromPinata(telegramUsername);// this is will retrive last used time from pinata
                    // console.log("actual last used time :", actualLastUsedTime);
                    let diffInMinutes;
                    //initially user time will be set to null 
                    if (actualLastUsedTime !== null) {
                        const timeDiff = currentTime.getTime() - new Date(actualLastUsedTime).getTime();


                        diffInMinutes = timeDiff / (1000 * 60);
                    }
                    console.log("diff in min : ", diffInMinutes)
                    //if the inactivity time is less than 1 then user query will be processed by bot in below logic
                    if (diffInMinutes = undefined || diffInMinutes <= 1 || actualLastUsedTime == null) {

                        const fetchModelResponse = await fetch(
                            `${PUBLIC_BACKEND_BASE_URI}/notify-transaction`,
                            //    `http://localhost:3000/notify-transaction`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    transactionId: "transactionHash",
                                    userId: chatId,
                                    status: "status",
                                    msgText: msg_text,
                                    model: modelName,
                                }),
                            },
                        );
                        const response = await fetchModelResponse.json();
                        await updateUserDetailsToPinata(telegramUsername, currentTime, "");

                        // await bot.sendMessage(chatId, response);
                    } else {
                        //else user have to pay for the last used session
                        let totalCharge = await retriveTotalChargeFromPinata(telegramUsername);
                        let url = `https://tano-wallet.vercel.app/?username=${telegramUsername}&charge=${totalCharge}&chat_id=${chatId}`;
                        //   let url = `http://localhost:5173/?username=${telegramUsername}&charge=${totalCharge}`;
                        console.log("pay url : ", url)
                        const options1 = {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: 'Pay',
                                            web_app: { url: url },
                                        },

                                    ]
                                ]
                            }
                        };
                        // console.log("web app url: ", url);
                        await bot.sendMessage(chatId, "Click the button below to pay for the last used session", options1);
                    }


            }


        } catch (error) {
            console.error("Error:", error.message);
            if (error.response && error.response.statusCode === 403) {
                console.log(`Bot was blocked by the user with chatId ${chatId}`);
            } else {
                await bot.sendMessage(chatId, `Error processing your request: ${error.message}`);
            }
        }
    }


    // if (response !== null) {
    //     try {
    //         await bot.sendMessage(chatId, response);
    //     } catch (error) {
    //         console.error("Error:", error.message);
    //         if (error.response && error.response.statusCode === 403) {
    //             console.log(`Bot was blocked by the user with chatId ${chatId}`);
    //         }
    //     }
    // }
});



//  start command - when user enters /start command then wallet connect and welcome msg will be sent to user 
bot.onText(/\/start/, async (msg) => {
    console.log("on start command ")
    try {

        let chatId = msg.chat.id;
        let telegramUsername = msg.from.username;
        //create new user before querying the last used session
        const createNewUser = await createPinataUser(telegramUsername, "", "", "");
        let url = "https://tano-wallet.vercel.app";
        let options = {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Connect Wallet',
                            web_app: { url: url },
                        },

                    ]
                ]
            }
        };

        await bot.sendMessage(chatId, "please connect wallet first", options);
        const welcomeMessage = `Welcome to Tano Bot, ${msg.from.first_name}! 🎉\n\nI am here to help you with your tasks. You can start by typing any message.`;
        await bot.sendMessage(chatId, welcomeMessage);
    } catch (error) {

        console.log("error ", error.message)
    }

});


//when user sends photo to bot 
bot.on('photo', async (msg) => {
    console.log("on photo command ")
    try {
        let chatId = msg.chat.id;
        let telegramUsername = msg.from.username;
        let currentTime = new Date();
        //get the file id for uploaded pdf
        const photoId = msg.photo[msg.photo.length - 1].file_id;
        //getting file link for uploaded pdf 
        const fileLink = await bot.getFileLink(photoId);

        // Download the image to a temporary file
        const imgResponse = await fetch(fileLink);
        //get array buffer for response
        const buffer = await imgResponse.arrayBuffer();

        // Create a temporary file using tmp
        tmp.file({ postfix: '.jpg' }, async (err, path, fd, cleanupCallback) => {
            if (err) {
                console.error("Error creating temporary file:", err);
                return;
            }

            // Write the image data (Buffer) to the temporary file
            await fs.promises.writeFile(path, Buffer.from(buffer));

            // Upload the temporary file to Google AI
            const uploadResult = await fileManager.uploadFile(
                path,
                {
                    mimeType: "image/jpeg",
                    displayName: "Uploaded Image",
                }
            );
            let imageUri = uploadResult.file.uri;
            let imageMimeType = uploadResult.file.mimeType;


            let actualLastUsedTime = await queryLastUsedBotTimeFromPinata(telegramUsername);
            // console.log("actual last used time :", actualLastUsedTime);
            let diffInMinutes;
            //initially user time will be set to null 
            if (actualLastUsedTime !== null) {
                const timeDiff = currentTime.getTime() - new Date(actualLastUsedTime).getTime();


                diffInMinutes = timeDiff / (1000 * 60);
            }
            console.log("diff in min : ", diffInMinutes)
            //if the inactivity time is less than 1 then user will ask question
            if (diffInMinutes = undefined || diffInMinutes <= 1 || actualLastUsedTime == null) {

                const fetchModelResponse = await fetch(
                    `${PUBLIC_BACKEND_BASE_URI}/parse-image`,
                    //  `http://localhost:3000/parse-image`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            userId: chatId,
                            imageUri,
                            imageMimeType,
                        }),
                    },
                );
                const response = await fetchModelResponse.json();
                await updateUserDetailsToPinata(telegramUsername, currentTime, "");

                // await bot.sendMessage(chatId, response);
            } else {
                //else user have to pay for the last used session
                let totalCharge = await retriveTotalChargeFromPinata(telegramUsername);
                let url = `https://tano-wallet.vercel.app/?username=${telegramUsername}&charge=${totalCharge}&chat_id=${chatId}`;
                //   let url = `http://localhost:5173/?username=${telegramUsername}&charge=${totalCharge}`;
                console.log("pay url : ", url)
                const options1 = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Pay',
                                    web_app: { url: url },
                                },

                            ]
                        ]
                    }
                };
                // console.log("web app url: ", url);
                await bot.sendMessage(chatId, "Click the button below to pay for the last used session", options1);
            }


            // Clean up the temporary file
            //cleaning up the temo generated file using below function
            cleanupCallback()
        });
    } catch (error) {
        console.error("Error while parsing image:", error.message);
        await bot.sendMessage(msg.chat.id, "Failed to parse image.");
    }
});


// when user sends the document to bot with caption that includes price of the each query
//note -   user have to sent price of the query in the caption while uploading each file 
bot.on('document', async (msg) => {


    let docType = msg.document.mime_type;
    console.log("document type : ", docType)
    try {
        // if (!msg.document || msg.document.mime_type !== 'application/pdf' ||msg.document.mime_type!=='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        //     console.log('Received message is not a PDF.');
        //     return;
        // }
        if (!msg.document) {
            console.log('Received message is not a document type.');
            return;
        }
        //chat id - 5831161789
        let chatId = msg.chat.id;
        let msg_text = msg.text ? msg.text.trim() : '';
        //caption text for entering price of the query 
        let caption = msg.caption;
        console.log("msg captiopn :  ", caption)

        //check whether user has entered /update command in the caption or not 
        if (caption && caption.includes('/update')) {

            //when user want to update existing file 
            console.log("on update command ")
            let response;
            try {
                let chatId = msg.chat.id;
                let msg_text = msg.text ? msg.text.trim() : '';
                let username = msg.from.username;
                let fileName = caption.split(" ")[1];
                console.log("user entered file name : ", fileName);
                const documentId = msg.document.file_id;
                //get the file link
                const fileLink = await bot.getFileLink(documentId);
                // console.log("file link : ", fileLink);

                // console.log("user name : ", username);
                // Download the PDF to a temporary file
                const pdfResponse = await fetch(fileLink);
                const pdfBuffer = await pdfResponse.arrayBuffer();

                // Create a temporary file using tmp
                // tmp.file({ postfix: '.pdf' }, async (err, path, fd, cleanupCallback) => {
                //     if (err) {
                //         console.error("Error creating temporary file:", err);
                //         return;
                //     }

                //     await fs.promises.writeFile(path, Buffer.from(pdfBuffer));

                //     const fileData = fs.readFileSync(path);

                //      cleanupCallback();
                // });
                await bot.sendMessage(chatId, `processing document....please wait!`);

                //uploading file data to pinata
                const response = await updateFilesToPinata(username, fileName, pdfBuffer)

                await bot.sendMessage(chatId, response);

            } catch (error) {

                console.log("error ", error.message)

                // await bot.sendMessage(chatId, response);
            }

        } else {
            try {
                console.log("on doc command ")
                const documentId = msg.document.file_id;
                const fileLink = await bot.getFileLink(documentId);
                // console.log("file link : ", fileLink);
                let username = msg.from.username;
                // console.log("user name : ", username);
                // Download the PDF to a temporary file
                const pdfResponse = await fetch(fileLink);
                const pdfBuffer = await pdfResponse.arrayBuffer();

                // Create a temporary file using tmp
                // tmp.file({ postfix: '.pdf' }, async (err, path, fd, cleanupCallback) => {
                //     if (err) {
                //         console.error("Error creating temporary file:", err);
                //         return;
                //     }

                //     await fs.promises.writeFile(path, Buffer.from(pdfBuffer));

                //     const fileData = fs.readFileSync(path);

                //      cleanupCallback();
                // });
                await bot.sendMessage(chatId, `processing document....please wait!`);


                if (caption !== undefined) {
                    //processing file will extract the data and generates the embeddings 
                    let docEmebeddings = await processFile(pdfBuffer, docType);
                    //basically firstly we are checking whether user available or not. also if the embeddings not generated properly then we are sending msg like something went wrong

                    if (docEmebeddings.length > 0) {
                        const createNewUser = await createPinataUser(username, "abcd", docEmebeddings, caption);


                        await bot.sendMessage(chatId, `A PDF document has been received.`);
                    } else {

                        await bot.sendMessage(chatId, `something went wrong`);
                    }
                } else {
                    await bot.sendMessage(chatId, `enter valid query price in caption`);
                }
            } catch (error) {
                console.log("error while on doc command :  ", error.message);
            }
        }
    } catch (error) {
        console.error("Error while processing PDF:", error.message);
        await bot.sendMessage(msg.chat.id, "Failed to process the received document.");
    }
});


//on hey command - this command is basically for if someone wants to access his own or others resources . so basicaly he have to type the command like /hey @username query 

bot.onText(/\/hey/, async (msg) => {

    console.log("on hey command ")
    let chatId = msg.chat.id;
    let telegramUsername = msg.from.username
    try {

        let msg_text = msg.text ? msg.text.trim() : '';
        let currentTime = new Date();
        let dataProvider = msg_text.split(" ")[1].replace("@", "");
        console.log("data provider name : ", dataProvider)
        console.log("msg ", msg_text)
        const parts = msg_text.split(' ');
        let question = parts.slice(2).join(' ');
        console.log("question : ", question)
        // Retrieve or initialize embeddings for the user
        userEmbeddings[chatId] = await getAllEmbeddings(dataProvider);
        console.log("all retrived embeddings : ", userEmbeddings[chatId]);
        if (userEmbeddings[chatId].length > 0) {
            //firstly we are checking the last used time from the db . if the user inactive for greater than one min then user have to pay for the last used session and as soon as 
            //payments completes the user time will get set to null
            let actualLastUsedTime = await queryLastUsedBotTimeFromPinata(telegramUsername);
            // console.log("actual last used time :", actualLastUsedTime);
            let diffInMinutes;
            //initially user time will be set to null 
            if (actualLastUsedTime !== null) {
                const timeDiff = currentTime.getTime() - new Date(actualLastUsedTime).getTime();


                diffInMinutes = timeDiff / (1000 * 60);
            }
            console.log("diff in min : ", diffInMinutes)
            //if the inactivity time is less than 1 then user will ask question
            if (diffInMinutes <= 1 || actualLastUsedTime == null) {

                //open ai query will be triggered
                // const response = await askQuestionAboutPDF(userEmbeddings[chatId], question)
                // cohere RAG query will be triggered
                const response = await getCohereRAG(userEmbeddings[chatId], question);
                //with stream send response

                await bot.sendMessage(chatId, response);
                await updateUserDetailsToPinata(telegramUsername, currentTime, dataProvider);
                //without streaming send response



            } else {
                //else user have to pay for the last used session
                let totalCharge = await retriveTotalChargeFromPinata(telegramUsername);
                let url = `https://tano-wallet.vercel.app/?username=${telegramUsername}&charge=${totalCharge}&chat_id=${chatId}`;
                //   let url = `http://localhost:5173/?username=${telegramUsername}&charge=${totalCharge}`;
                // console.log("pay url : ", url)
                const options1 = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: 'Pay',
                                    web_app: { url: url },
                                },

                            ]
                        ]
                    }
                };
                // console.log("web app url: ", url);
                await bot.sendMessage(chatId, "Click the button below to pay for the last used session", options1);
            }
        } else {
            await bot.sendMessage(chatId, "This user doesn’t have available data to be queried");
        }

    } catch (error) {

        console.log("error ", error.message)
        let errorMessage = "This user doesn’t have available data to be queried";
        await bot.sendMessage(chatId, errorMessage);
    }
});



// Handle callback query for mode selection
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = msg.chat.id;
    if (data === 'mode_gemini') {
        userModes[chatId] = 'gemini';  // Stores the user specific mode globally
        await bot.sendMessage(chatId, 'You have selected Gemini mode.');
    } else if (data === 'mode_cohere') {
        userModes[chatId] = 'cohere';  // Stores the user specific mode globally
        await bot.sendMessage(chatId, 'You have selected GPT mode.');
    }


});



//on generate command - this command is basically used for generating image 

bot.onText(/\/generate/, async (msg) => {

    console.log("on create command ")
    let chatId = msg.chat.id;
    let telegramUsername = msg.from.username;
    let currentTime = new Date();
    let command = "generate";
    try {

        let msg_text = msg.text ? msg.text.trim() : '';
        let encodedMsg = encodeURIComponent(msg_text);

        let actualLastUsedTime = await queryLastUsedBotTimeFromPinata(telegramUsername);
        // console.log("actual last used time :", actualLastUsedTime);
        let diffInMinutes;
        //initially user time will be set to null 
        if (actualLastUsedTime !== null) {
            const timeDiff = currentTime.getTime() - new Date(actualLastUsedTime).getTime();


            diffInMinutes = timeDiff / (1000 * 60);
        }
        console.log("diff in min : ", diffInMinutes)
        //if the inactivity time is less than 1 then user will ask question
        if (diffInMinutes = undefined || diffInMinutes <= 1 || actualLastUsedTime == null) {

            const imageResponse = await fetch(
                `${PUBLIC_BACKEND_BASE_URI}/generate-image`,
                //  `http://localhost:3000/generate-image`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({

                        chatId: chatId,
                        msgText: msg_text,
                    }),
                },
            );
            const response = await imageResponse.json();
            await updateUserDetailsToPinata(telegramUsername, currentTime, "");

            // await bot.sendMessage(chatId, response);
        } else {
            //else user have to pay for the last used session
            let totalCharge = await retriveTotalChargeFromPinata(telegramUsername);
            let url = `https://tano-wallet.vercel.app/?username=${telegramUsername}&charge=${totalCharge}&chat_id=${chatId}`;
            //   let url = `http://localhost:5173/?username=${telegramUsername}&charge=${totalCharge}`;
            // console.log("pay url : ", url)
            const options1 = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: 'Pay',
                                web_app: { url: url },
                            },

                        ]
                    ]
                }
            };
            // console.log("web app url: ", url);
            await bot.sendMessage(chatId, "Click the button below to pay for the last used session", options1);
        }



    } catch (error) {

        console.log("error ", error.message)
        let errorMessage = "something went wrong while creating image";
        await bot.sendMessage(chatId, errorMessage);
    }
});


//for trade command
bot.onText(/\/trade/, async (msg) => {

    console.log("on trade command ")
    let chatId = msg.chat.id;

    try {

        let msg_text = msg.text ? msg.text.trim() : '';

        let url = `https://tano-wallet.vercel.app/`;
        //  let url = `http://localhost:5173/`;
        console.log("url : ", url);
        const options1 = {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Trade',
                            web_app: { url: url },
                            // url: url ,
                        },

                    ]
                ]
            }
        };

        // console.log("web app url: ", url);
        // await bot.sendMessage(chatId, `${url}`);
        await bot.sendMessage(chatId, "Click the button below to trade", options1);


    } catch (error) {

        console.log("error ", error.message)
        let errorMessage = "something went wrong while trade";
        await bot.sendMessage(chatId, errorMessage);
    }
});





