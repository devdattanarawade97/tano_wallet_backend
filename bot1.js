
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
import { askQuestionAboutPDF, processFile, processText } from './similarity.js'
import OpenAI from "openai";
// Access your API key as an environment variable (see "Set up your API key" above)

// const Symbiosis = require("@symbiosis/sdk").default;
// import { Symbiosis } from "symbiosis-js-sdk";
import { YoutubeTranscript } from 'youtube-transcript';

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


//user specific AI model storing
//user specific embeddings storing
let userModes = {};
let userEmbeddings = {};
// Storage for previous output (e.g., image URLs or file IDs) per user


//1 bot on msg 
bot.on('message', async (msg) => {
    console.log("on msg command ")
    let chatId = msg.chat.id;
    let currentMode = userModes[chatId] || 'gpt';  // Default to GPT if not set
    let msg_text = msg.text ? msg.text.trim() : '';
    let commandParts = msg_text.split(' ');
    let command = commandParts[0];
    console.log("msg text : ", msg_text)
    let modelName = encodeURIComponent(currentMode);

    //restricting user for entering text more than 100 chars as AI model prompt have token limits 
    if (msg_text.length > 100 && command === '/text') {
        await bot.sendMessage(chatId, "Please enter a query with less than 100 characters.");
        return;
    }
    // console.log("chatid: ", chatId);
    // console.log("user entered msg: ", msg_text);
    // console.log("current mode: ", currentMode);

    let response = null;
    //we are checking user hasnot entered any command with msg then only we are allowing to proceed with this if 
    if (command && command !== '/start' && command !== '/hey' && command !== '/update' && command !== '/send' && command !== '/generate') {
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
                                        text: 'GPT Mode',
                                        callback_data: 'mode_gpt',
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
                    let url = `https://tano-wallet.vercel.app/?chat_id=${chatId}&msg_text=${encodedMsg}&model=${modelName}`;
                    //  let url = `http://localhost:5173/?chat_id=${chatId}&msg_text=${encodedMsg}&model=${modelName}`;
                    console.log("url : ", url);

                    switch (currentMode.toLowerCase()) {
                        case 'gemini':
                            const options1 = {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            {
                                                text: 'Pay',
                                                web_app: { url: url },
                                                // url: url ,
                                            },

                                        ]
                                    ]
                                }
                            };
                            // console.log("web app url: ", url);
                            // await bot.sendMessage(chatId, `${url}`);
                            await bot.sendMessage(chatId, "Click the button below to pay the nominal gas fee", options1);
                            break;

                        case 'gpt':
                            const options = {
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
                            await bot.sendMessage(chatId, "Click the button below to pay the nominal gas fee", options);
                            break;

                        default:
                            console.warn(`Unknown mode: ${currentMode}`);
                            response = "Select an LLM model";
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


    if (response !== null) {
        try {
            await bot.sendMessage(chatId, response);
        } catch (error) {
            console.error("Error:", error.message);
            if (error.response && error.response.statusCode === 403) {
                console.log(`Bot was blocked by the user with chatId ${chatId}`);
            }
        }
    }
});



//  start command - when user enters /start command then wallet connect and welcome msg will be sent to user 
bot.onText(/\/start/, async (msg) => {
    console.log("on start command ")
    try {

        let chatId = msg.chat.id;
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
            let encodedImageUri = encodeURIComponent(imageUri);
            let encodedImageMime = encodeURIComponent(imageMimeType);
            //creating url for user uploaded image with chatid .once the user does the payment the backend url will get hit for image computation
            let url = `https://tano-wallet.vercel.app/?chat_id=${chatId}&imageUri=${imageUri}&imageMimeType=${imageMimeType}`;
            // let url = `http://localhost:5173/?chat_id=${chatId}&imageUri=${encodedImageUri}&imageMimeType=${encodedImageMime}`;
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
            await bot.sendMessage(chatId, "Click the button below to pay the nominal gas fee", options1);

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



// bot.onText(/\/retrive/, async (msg) => {
//     console.log("on retrive command ")
//     try {
//         let chatId = msg.chat.id;
//         let msg_text = msg.text ? msg.text.trim() : '';
//         let ipfsHash = msg_text.split(' ')[1];
// console.log("ipfs hash: ", ipfsHash);
// const pinataResponse = await retrieveFromPinata(ipfsHash);
// console.log("retrived data : ", pinataResponse);

// const bufferData=await Buffer.from(await pinataResponse.arrayBuffer())
//    const tempFilePath = path.join(os.tmpdir(), 'temporary_pdf.pdf');


// fs.writeFileSync(tempFilePath, bufferData);

// const text = fs.readFileSync(tempFilePath, 'utf8');
//         await bot.sendMessage(chatId, "processing....");
//         await processFile(ipfsHash)

//         await bot.sendMessage(chatId, "file processed successfully . you can ask questions");
//     } catch (error) {

//         console.log("error ", error.message)
//     }

// });


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
        // console.log("all retrived embeddings : ", userEmbeddings[chatId]);
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

                const response = await askQuestionAboutPDF(userEmbeddings[chatId], question)
                await updateUserDetailsToPinata(telegramUsername, currentTime, dataProvider);

                await bot.sendMessage(chatId, response);
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
        userModes[chatId] = 'gemini';  // Store the mode for the specific user
        await bot.sendMessage(chatId, 'You have selected Gemini mode.');
    } else if (data === 'mode_gpt') {
        userModes[chatId] = 'gpt';  // Store the mode for the specific user
        await bot.sendMessage(chatId, 'You have selected GPT mode.');
    }


});



//on hey command - this command is basically for if someone wants to access his own or others resources . so basicaly he have to type the command like /hey @username query 

bot.onText(/\/generate/, async (msg) => {

    console.log("on create command ")
    let chatId = msg.chat.id;
    let telegramUsername = msg.from.username
    let command = "generate";
    try {

        let msg_text = msg.text ? msg.text.trim() : '';
        let encodedMsg = encodeURIComponent(msg_text);
        let url = `https://tano-wallet.vercel.app/?chat_id=${chatId}&msg_text=${encodedMsg}&command=${command}`;
        //  let url = `http://localhost:5173/?chat_id=${chatId}&msg_text=${encodedMsg}&command=${create}`;
        console.log("url : ", url);
        const options1 = {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: 'Pay',
                            web_app: { url: url },
                            // url: url ,
                        },

                    ]
                ]
            }
        };
        // console.log("web app url: ", url);
        // await bot.sendMessage(chatId, `${url}`);
        await bot.sendMessage(chatId, "Click the button below to pay the nominal gas fee", options1);





    } catch (error) {

        console.log("error ", error.message)
        let errorMessage = "something went wrong while creating image";
        await bot.sendMessage(chatId, errorMessage);
    }
});


// bot.onText(/\/transcript/, async (msg) => {
//     console.log("on transcript command");
//     let chatId = msg.chat.id;
//     let telegramUsername = msg.from.username;
//     let msg_text = msg.text ? msg.text.trim() : '';
//     let queryPrice = msg_text.split(' ')[1];
//     let videoLink = msg_text.split(' ')[2];


//     try {
//         if (!videoLink.includes('https://youtu.be/')) {
//             await bot.sendMessage(chatId, `invalid youtube link`);
//             return;
//         }
//         //https://youtu.be/3_SO0BpPF4Y?si=dCS9c-2ZMUJk8C_s
//         const youtubeUrl = videoLink;

//         // Assuming YoutubeLoader creates a transcript loader from a video URL
//         const loader = YoutubeTranscript.fetchTranscript(youtubeUrl);

//         // Loading the transcript or content related to the video
//         const docs = await loader.load();

//         // Loop through the pages and extract text from each document
//         let fullTranscript = '';
//         docs.forEach((doc) => {
//             console.log("transcript : ", doc.pageContent)
//             fullTranscript += doc.pageContent.replace(/&amp;#39;/g, "'");; // Append each page's text to the full transcript
//         });
//         // console.log("transcript : ",fullTranscript)

//         // Sending the entire transcript to the bot in a message
//         await bot.sendMessage(chatId, `processing transcript....please wait!`);



//         let docEmebeddings = await processText(fullTranscript);
//         //basically firstly we are checking whether user available or not. also if the embeddings not generated properly then we are sending msg like something went wrong

//         if (docEmebeddings.length > 0) {
//             const createNewUser = await createPinataUser(telegramUsername, "abcd", docEmebeddings, queryPrice);


//             await bot.sendMessage(chatId, `A Video Transcript has been received successfully.`);
//         } else {

//             await bot.sendMessage(chatId, `something went wrong`);
//         }


//     } catch (error) {
//         console.log("error", error.message);
//         let errorMessage = "Something went wrong while generating the transcript";
//         await bot.sendMessage(chatId, errorMessage);
//     }
// });
