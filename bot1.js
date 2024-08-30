
import dotenv from 'dotenv';
import telegramBot from 'node-telegram-bot-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from "@google/generative-ai/server";
import axios from 'axios';
import path from 'path'
import fs from 'fs';
import tmp from 'tmp';
import { uploadToPinata, retrieveFromPinata, createPinataUser, getAllEmbeddings, updateFilesToPinata, updateUserDetailsToPinata, queryLastUsedBotTimeFromPinata  , retriveTotalChargeFromPinata} from './pinataServices.js';
import os from 'os';
import { askQuestionAboutPDF, processFile } from './similarity.js'

// Access your API key as an environment variable (see "Set up your API key" above)

// const Symbiosis = require("@symbiosis/sdk").default;
// import { Symbiosis } from "symbiosis-js-sdk";
dotenv.config();

const TOKEN = process.env.TOKEN;
const OPEN_API_KEY = process.env.OPEN_API_KEY;

// console.log("open ai api key : ", OPEN_API_KEY);
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: OPEN_API_KEY });
const bot = new telegramBot(TOKEN, { polling: true });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

// console.log("bot token : ", TOKEN)
// console.log("gemini token : ", process.env.GEMINI_API_KEY)



let currentMode = 'gpt';
let allRetrivedEmbeddings;


bot.on('message', async (msg) => {
    console.log("on msg command ")
    let chatId = msg.chat.id;
    let msg_text = msg.text ? msg.text.trim() : '';
    let commandParts = msg_text.split(' ');
    let command = commandParts[0];
    console.log("msg text : ", msg_text)
    let modelName = encodeURIComponent(currentMode);
    if (msg_text.length > 100) {
        await bot.sendMessage(chatId, "please enter query less than 200 chars");
        return;
    }
    // console.log("chatid: ", chatId);
    // console.log("user entered msg: ", msg_text);
    // console.log("current mode: ", currentMode);
    let response = null;

    if (command == '/gemini' || command == '/gpt') {
        response = "Hello! How can I assist you today?";
    } else if (command && command !== '/start' && command !== '/hey' && command !== '/update') {
        try {
            let encodedMsg = encodeURIComponent(msg_text);
             let url = `https://tano-wallet.vercel.app/?chat_id=${chatId}&msg_text=${encodedMsg}&model=${modelName}`;
            //   let url = `http://localhost:5173/?chat_id=${chatId}&msg_text=${encodedMsg}&model=${modelName}`;
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
                    await bot.sendMessage(chatId, `${url}`);
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


bot.onText(/\/gemini/, async (msg) => {
    if (currentMode !== 'gemini') {
        currentMode = 'gemini';

    }
});
bot.onText(/\/gpt/, async (msg) => {
    if (currentMode !== 'gpt') {
        currentMode = 'gpt';

    }

});


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

bot.on('photo', async (msg) => {
    console.log("on photo command ")
    try {
        let chatId = msg.chat.id;
        const photoId = msg.photo[msg.photo.length - 1].file_id;
        const fileLink = await bot.getFileLink(photoId);

        // Download the image to a temporary file
        const imgResponse = await fetch(fileLink);
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

            cleanupCallback()
        });
    } catch (error) {
        console.error("Error while parsing image:", error.message);
        await bot.sendMessage(msg.chat.id, "Failed to parse image.");
    }
});


//
bot.on('document', async (msg) => {

    try {
        if (!msg.document || msg.document.mime_type !== 'application/pdf') {
            console.log('Received message is not a PDF.');
            return;
        }

        let chatId = msg.chat.id;
        let msg_text = msg.text ? msg.text.trim() : '';
        let caption = msg.caption;
        console.log("msg captiopn :  ", caption)
        if (caption && caption.includes('/update')) {
            console.log("on update command ")
            let response;
            try {
                let chatId = msg.chat.id;
                let msg_text = msg.text ? msg.text.trim() : '';
                let username = msg.from.username;
                let fileName = caption.split(" ")[1];
                console.log("user entered file name : ", fileName);
                const documentId = msg.document.file_id;
                const fileLink = await bot.getFileLink(documentId);
                console.log("file link : ", fileLink);

                console.log("user name : ", username);
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
                console.log("file link : ", fileLink);
                let username = msg.from.username;
                console.log("user name : ", username);
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
                    let docEmebeddings = await processFile(pdfBuffer);
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



bot.onText(/\/retrive/, async (msg) => {
    console.log("on retrive command ")
    try {
        let chatId = msg.chat.id;
        let msg_text = msg.text ? msg.text.trim() : '';
        let ipfsHash = msg_text.split(' ')[1];
        console.log("ipfs hash: ", ipfsHash);
        // const pinataResponse = await retrieveFromPinata(ipfsHash);
        // console.log("retrived data : ", pinataResponse);

        // const bufferData=await Buffer.from(await pinataResponse.arrayBuffer())
        //    const tempFilePath = path.join(os.tmpdir(), 'temporary_pdf.pdf');


        // fs.writeFileSync(tempFilePath, bufferData);

        // const text = fs.readFileSync(tempFilePath, 'utf8');
        await bot.sendMessage(chatId, "processing....");
        await processFile(ipfsHash)

        await bot.sendMessage(chatId, "file processed successfully . you can ask questions");
    } catch (error) {

        console.log("error ", error.message)
    }

});



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
        allRetrivedEmbeddings = await getAllEmbeddings(dataProvider)
        console.log("all retrived embeddings : ", allRetrivedEmbeddings);
        if (allRetrivedEmbeddings.length > 0) {
            let actualLastUsedTime = await queryLastUsedBotTimeFromPinata(telegramUsername);
            console.log("actual last used time :", actualLastUsedTime);
            let diffInMinutes;
            if (actualLastUsedTime !== null) {
                const timeDiff =currentTime.getTime()- new Date(actualLastUsedTime).getTime() ;


                diffInMinutes = timeDiff / (1000 * 60);
            }
            console.log("diff in min : ",diffInMinutes )
              if (diffInMinutes <= 1 || actualLastUsedTime == null) {
                const response = await askQuestionAboutPDF(allRetrivedEmbeddings, question)
                await updateUserDetailsToPinata(telegramUsername, currentTime ,dataProvider);
              
                await bot.sendMessage(chatId, response);
            } else {

                let totalCharge = await retriveTotalChargeFromPinata(telegramUsername);
                 let url = `https://tano-wallet.vercel.app/?username=${telegramUsername}&charge=${totalCharge}&chatId=${chatId}`;
                //   let url = `http://localhost:5173/?username=${telegramUsername}&charge=${totalCharge}`;
                  console.log("pay url : ",url)
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






