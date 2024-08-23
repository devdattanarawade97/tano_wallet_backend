
import dotenv from 'dotenv';
import telegramBot from 'node-telegram-bot-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from "@google/generative-ai/server";
import axios from 'axios';
import path from 'path'
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
// console.log("bot token : ", TOKEN)
// console.log("gemini token : ", process.env.GEMINI_API_KEY)



let currentMode = 'gpt';
    
bot.on('message', async (msg) => {
    let chatId = msg.chat.id;
    let msg_text = msg.text ? msg.text.trim() : '';
    let modelName = encodeURIComponent(currentMode);
    console.log("chatid: ", chatId);
    console.log("user entered msg: ", msg_text);
    console.log("current mode: ", currentMode);
    let response = null;

    if (msg_text == '/gemini' || msg_text == '/gpt') {
        response = "Hello! How can I assist you today?";
    } else if (msg_text&&msg_text!=='/start') {
        try {
            let encodedMsg = encodeURIComponent(msg_text);
            let url = `https://tano-wallet.vercel.app/?chat_id=${chatId}&msg_text=${encodedMsg}&model=${modelName}`;

            switch (currentMode.toLowerCase()) {
                case 'gemini':
                    const options1 = {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: 'Mobile Pay',
                                        web_app: { url: url },
                                    },
                                    {
                                        text: 'Web Pay',
                                        url: url,
                                    },
                                ]
                            ]
                        }
                    };
                    console.log("web app url: ", url);
                    await bot.sendMessage(chatId, "Click the button below to pay the nominal gas fee", options1);
                    break;

                case 'gpt':
                    const options = {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: 'Mobile Pay',
                                        web_app: { url: url },
                                    },
                                    {
                                        text: 'Web Pay',
                                        url: url,
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
        await bot.sendMessage(msg.chat.id, "Switched to Gemini");
    } else {
        await bot.sendMessage(msg.chat.id, "Already in Gemini mode");
    }
   
});
bot.onText(/\/gpt/, async (msg) => {
    if (currentMode !== 'gpt') {
        currentMode = 'gpt';
        await bot.sendMessage(msg.chat.id, "Switched to GPT");
    } else {
        await bot.sendMessage(msg.chat.id, "Already in GPT mode");
    }
   
});


bot.onText(/\/start/, async (msg) => {
   
        await bot.sendMessage(msg.chat.id, "Welcome to Tano Bot");
   
});








