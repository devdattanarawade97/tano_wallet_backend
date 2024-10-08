import { PinataSDK } from "pinata";
import dotenv from 'dotenv';
import { json } from "stream/consumers";
import { processFile } from './similarity.js'
dotenv.config();


//pinata config
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GETWAY,
});

//this function used for uploadin file to pinata

/*


This JavaScript function, `uploadToPinata`, uploads JSON data to Pinata, a decentralized storage service, using the Pinata SDK. 
It takes two parameters: `fileData` (the data to be uploaded) and `telegramUsername` (used as metadata for the upload). The function logs the upload details and IPFS hash to the console, and catches any errors that occur during the upload process.

*/
export const uploadToPinata = async function (fileData, telegramUsername) {

  let upload;
  try {


    upload = await pinata.upload.json(fileData, {
      metadata: {
        name: telegramUsername
      }
    });

    console.log("pinata file uploaded details :  ", upload);

    let parsedIpfsHash = upload.IpfsHash;
    console.log("ipfs hash : ", parsedIpfsHash);


  } catch (error) {
    console.log(error);
  }


}


//this function used for creating new user if the new user is not available in the db .
//takes param input as telegram username , file name , embeddings , queryprice
//if the user is not available then new user will be created else the existing user will be updated
/*


This is a JavaScript function named `createPinataUser` that creates a new user or updates an existing one on Pinata, a decentralized storage service. It takes four parameters: `telegramUsername`, `fileName`, `fileEmbeddings`, and `queryPrice`. 

Here's a succinct breakdown:

1. It checks if a user with the given `telegramUsername` already exists on Pinata.
2. If the user doesn't exist, it creates a new user object with the provided details and uploads it to Pinata.
3. If the user already exists, it retrieves the user's details, updates the query price and adds a new file embedding, then re-uploads the updated user data to Pinata.

The function uses Pinata's SDK to interact with the service, and it handles errors by logging them to the console. 

Note that this function is referenced in the provided context from `backend/pinataServices.js:createPinataUser`.
*/
export const createPinataUser = async function (telegramUsername, fileName, fileEmbeddings, queryPrice) {



  try {
    //to get the list of files 
    const user = await pinata.listFiles().name(telegramUsername)

    console.log('user with name : ', user);
    
  
    const userObject = {
      userName: telegramUsername,
      embeddings: [
        // {
        //   id: 0,
        //   fileName: '',
        //   embedding:[],
        // }
      ],
      queryPrice: queryPrice ==''? 0 : queryPrice,
      totalCharge: null,
      lastUsed: null,
    }

    if (user.length == 0) {
      //if filename is not equal to !=="" . other file names will be "". and in case of docs will be file name
      if (fileName !== '') {
        let uniqueFileName = `${fileName}_${0}`;
      const newEmbeddingObject = {
        id: 0,
        fileName: uniqueFileName,
        embedding: fileEmbeddings,
      }
      userObject.embeddings.push(newEmbeddingObject);
      }
      console.log("new user before uploading pinata : ", userObject)
      console.log("file name before uploading to pinata : ", `${telegramUsername}.json`)
      //uploading data to pinata 
      await uploadToPinata(userObject, telegramUsername);

    } else {

      //retriving user details from pinata using hash 
      if (fileName !== '') {
        const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);
      console.log("retrived user json : ", userJson)
      let lengthOfFiles = userJson.embeddings.length;
      let uniqueFileName = `${fileName}_${lengthOfFiles + 1}`;

      const newEmbeddingObject = {
        id: lengthOfFiles + 1,
        fileName: uniqueFileName,
        embedding: fileEmbeddings,
      }
      userJson.queryPrice = queryPrice;
      userJson.embeddings.push(newEmbeddingObject);
      console.log("upaded user before uploading pinata : ", userJson)
      await uploadToPinata(userJson, telegramUsername);
      await unpinPinataData(user[0].ipfs_pin_hash);
     }

    }



  } catch (error) {
    console.log(error);
  }


}

//this is for retriving user using ipfs hash . which is unique inside the each user details logs
/*


This JavaScript function, `retrieveFromPinata`, retrieves user data from Pinata, a decentralized storage service, using a unique IPFS hash. 
It attempts to fetch the data, logs the result, and returns the retrieved data. If an error occurs, it logs the error and re-throws it.
*/
export const retrieveFromPinata = async function (ipfsHash) {
  try {
    const retrievedData = await pinata.gateways.get(ipfsHash);

    console.log("retrived data from pinata : ", retrievedData)
    return retrievedData.data;
  } catch (error) {
    console.error("Error retrieving data from Pinata:", error);
    throw error;
  }
}


//this fuction used for deleting the user using ipfs hash 
/*
This code snippet defines an asynchronous function called `unpinPinataData` that takes an `ipfsHash` as an argument. It attempts to delete a user from Pinata, a decentralized storage service, using the provided `ipfsHash`. 

Inside the function, it uses the `pinata.unpin()` method to unpin the data associated with the `ipfsHash`. The result of the unpinning operation is stored in the `unpinnedData` variable. 

The function then logs the `unpinnedData` to the console. If an error occurs during the unpinning process, it logs the error and re-throws it.

In summary, this code snippet provides a way to delete a user from Pinata using their `ipfsHash`.

*/
export const unpinPinataData = async function (ipfsHash) {
  try {
    const unpinnedData = await pinata.unpin([ipfsHash])

    console.log("unpined data : ", unpinnedData)
  } catch (error) {
    console.error("Error retrieving data from Pinata:", error);
    throw error;
  }
}


//this is used for getting all the stored embeddings from pinata using the user name
//each user is uniquely identified using username
/*
This JavaScript code snippet defines an asynchronous function named `getAllEmbeddings` that retrieves all the stored embeddings from the Pinata storage service based on a given `telegramUsername`. The function takes a `telegramUsername` as a parameter and returns an array of embeddings.

Here's a step-by-step explanation of what the code does:

1. It initializes an empty array called `allEmbeddings` to store the retrieved embeddings.
2. It uses the `pinata.listFiles().name(telegramUsername)` method to get a list of files from Pinata that have a name matching the `telegramUsername`.
3. It logs the user with the name to the console.
4. It calls the `retrieveFromPinata` function, passing the IPFS hash of the first file in the list, to retrieve the user's data from Pinata.
5. It iterates over the `embeddings` array in the retrieved user's JSON data and pushes the first element of each embedding array into the `allEmbeddings` array.
6. It logs the retrieved user's JSON data to the console.
7. If any errors occur during the process, it logs the error message to the console.
8. Finally, it returns the `allEmbeddings` array.

Overall, this code snippet provides a way to retrieve all the stored embeddings for a specific user from the Pinata storage service.
*/
export const getAllEmbeddings = async function (telegramUsername) {

  let allEmbeddings = [];
  try {
    const user = await pinata.listFiles().name(telegramUsername)

    console.log('user with name : ', user);
    const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);
    userJson.embeddings.forEach(element => {
      allEmbeddings.push(element.embedding[0])
    });
    console.log("retrived user json : ", userJson)
    

  } catch (error) {
    console.log("error while getting all embeddings : ", error.mgessage);
  }
  return allEmbeddings;
}



//this is used for updating existing files to pinata .
/*


This JavaScript function, `updateFilesToPinata`, updates an existing file on Pinata, a decentralized storage service, for a specific user identified by their `telegramUsername`. It takes three parameters: `telegramUsername`, `fileName`, and `pdfBuffer`. 

Here's a succinct breakdown:

1. It retrieves the user's data from Pinata using `telegramUsername`.
2. If the user exists, it processes the `pdfBuffer` to generate new embeddings.
3. It then updates the user's data by replacing the embeddings of the file with the matching `fileName`.
4. If the file is not found, it returns an error message.
5. Finally, it uploads the updated user data to Pinata and unpins the old data.

The function returns a success or error message as a response. 

This function is referenced in the provided context from `backend/pinataServices.js:updateFilesToPinata`.
*/
export const updateFilesToPinata = async function (telegramUsername, fileName, pdfBuffer) {

  let response;

  try {
    const user = await pinata.listFiles().name(telegramUsername)
    console.log('user with name : ', user);
    if (user.length > 0) {
      console.log('user found');
      let newEmbeddings= await processFile(pdfBuffer);
      const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);
      userJson.embeddings.forEach(element => {
        console.log("actual file name : ", element.fileName);
        console.log("entered file name : ", fileName);
        console.log("entered file name and actual file are equal ?  : ", element.fileName === fileName);

        if (element.fileName === fileName) {
          console.log("matching file found");
          element['embedding'] = newEmbeddings;

        } else {
          response = "file not found!";
        }

      });
      await uploadToPinata(userJson, telegramUsername);
      await unpinPinataData(user[0].ipfs_pin_hash);
      console.log("pinata files updated successfully");
      response = "file updated successfully";
    } else {
      console.log('user not found');
      // await createPinataUser(telegramUsername, fileName, newEmbeddings);
      response = 'user not found. please upload file first';
    }
  } catch (error) {
    console.log("error while updating file : ", error.mgessage);
    response = "error while updating file";
  }

  return response;
}


//this function basically used whenever user queries the total charge and the last used time will be recalculated and updated accordingly for each query to maintain the used session

/**
 * This function is used to update the user details in Pinata. It takes three parameters: `telegramUsername`, `lastUsedTime`, and `dataProvider`. 
 * It retrieves the user's data from Pinata using the `telegramUsername`, updates the `lastUsedTime` and `totalCharge` fields of the user's data, and then 
 * uploads the updated user data to Pinata and unpins the old data. The `dataProvider` parameter is used to fetch the query price from Pinata for the user who 
 * uploaded the PDF, and then this query price is added to the total charge of the user who queried the PDF. If the `dataProvider` parameter is empty, a default 
 * query charge of 0.0001 is added to the total charge of the user who queried the PDF. The function returns a success or error message as a response.
 * 
 * @param {string} telegramUsername - The username of the user to be updated in Pinata.
 * @param {string} lastUsedTime - The last used time of the user to be updated in Pinata.
 * @param {string} dataProvider - The username of the user who uploaded the PDF, used to fetch the query price from Pinata.
 * 
 * 

This is the `updateUserDetailsToPinata` function from your codebase (`backend/pinataServices.js:updateUserDetailsToPinata`). 

It updates a user's details in Pinata, specifically their last used time and total charge. The total charge is updated by adding a query price,
 which is either fetched from Pinata using the `dataProvider` parameter or set to a default value of 0.0001 if `dataProvider` is empty.
 */
export const updateUserDetailsToPinata = async function (telegramUsername, lastUsedTime, dataProvider) {
  let retrivedQueryPrice=0;
  try {
    const user = await pinata.listFiles().name(telegramUsername)

    console.log('user with name : ', user);
    const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);
    userJson.lastUsed = lastUsedTime;

    //data prvoider is basically user who uploaded pdf
    let updatedTotalUsedCharge;
    if (dataProvider !== "") {
      retrivedQueryPrice = await retriveQueryPriceFromPinata(dataProvider);
      updatedTotalUsedCharge = userJson.totalCharge == null ? 0 + Number(retrivedQueryPrice) : Number(userJson.totalCharge) + Number(retrivedQueryPrice);
    } else {
      updatedTotalUsedCharge = userJson.totalCharge == null ? 0 + Number(retrivedQueryPrice)+0.0001 : Number(userJson.totalCharge) + Number(retrivedQueryPrice)+0.0001;
    }
    
    console.log("updated total charge : ", updatedTotalUsedCharge);
    userJson.totalCharge = updatedTotalUsedCharge;
    await uploadToPinata(userJson, telegramUsername);
    await unpinPinataData(user[0].ipfs_pin_hash);
    console.log("user last used time updated to pinata successfully");

  } catch (error) {
    console.log("error while getting all embeddings : ", error.mgessage);
  }

}


//this function is used basically to fetch the last used time from pinata using username

/**
 * This function is used to fetch the last used time from Pinata using the username. It takes one parameter: `telegramUsername`. If the user exists in Pinata, it
 * retrieves the user's data from Pinata using the `telegramUsername`, extracts the `lastUsedTime` field, and returns it. If the user does not exist, it creates a new
 * user object with default values and uploads it to Pinata. The function returns the `lastUsedTime` as a response. If an error occurs, it logs the error message and
 * returns `null`.
 * @param {string} telegramUsername - The username of the user to be queried in Pinata.
 * @returns {string|null} - The last used time of the user, or `null` if an error occurs.
 * 
 * 

This is the `queryLastUsedBotTimeFromPinata` function from your codebase (`backend/pinataServices.js:queryLastUsedBotTimeFromPinata`). 

It fetches the last used time of a user from Pinata using their Telegram username. If the user exists, it retrieves their data and returns the last used time. If the user doesn't exist, it creates a new user 
object with default values and uploads it to Pinata. If an error occurs, it logs the error and returns `null`.
 * 
 */
export const queryLastUsedBotTimeFromPinata = async function (telegramUsername) {
  let lastUsedTime = null;
  try {
    const user = await pinata.listFiles().name(telegramUsername)

    if (user.length > 0) {
      console.log('user with name : ', user);
      const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);

      lastUsedTime = userJson.lastUsed;
      console.log("lastUsedTime : ", lastUsedTime);
    } else {

      const userObject = {
        userName: telegramUsername,
        embeddings: [
          // {
          //   id: 0,
          //   fileName: '',
          //   embedding:[],
          // }
        ],
        queryPrice: null,
        totalCharge: null,
        lastUsed: null,
      }
      await uploadToPinata(userObject, telegramUsername);
    }

  } catch (error) {
    console.log("error while getting last used time : ", error.mgessage);
  }


  return lastUsedTime;

}

//this function is used for retriving user specific total charge 
/*


This is the `retriveTotalChargeFromPinata` function from your codebase (`backend/pinataServices.js:retriveTotalChargeFromPinata`). 

It retrieves a user's total charge from Pinata using their Telegram username. It does this by:

1. Finding the user's data in Pinata using `pinata.listFiles().name(telegramUsername)`.
2. Extracting the user's JSON data from Pinata using `retrieveFromPinata(user[0].ipfs_pin_hash)`.
3. Returning the `totalCharge` field from the user's JSON data as a number.

If an error occurs during this process, it logs the error message and returns `NaN` (Not a Number) because `totalUsedCharge` is not defined in the catch block.
*/
export const retriveTotalChargeFromPinata = async function (telegramUsername) {
  let totalUsedCharge;
  try {
    const user = await pinata.listFiles().name(telegramUsername)

    console.log('user with name : ', user);
    const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);

    totalUsedCharge = userJson.totalCharge;
    console.log("total charge : ", totalUsedCharge);

  } catch (error) {
    console.log("error while getting total charge : ", error.mgessage);
  }


  return Number(totalUsedCharge);

}


//this is for the fetching the user specific query charge set by the user
/*


This JavaScript function, `retriveQueryPriceFromPinata`, retrieves a user's query price from Pinata, a decentralized data storage service, using their Telegram username. It does this by:

1. Finding the user's data in Pinata using `pinata.listFiles().name(telegramUsername)`.
2. Extracting the user's JSON data from Pinata using `retrieveFromPinata(user[0].ipfs_pin_hash)`.
3. Returning the `queryPrice` field from the user's JSON data.

If an error occurs, it logs the error message and returns `undefined` (since `retrivedQueryPrice` is not defined in the catch block).
*/
export const retriveQueryPriceFromPinata = async function (telegramUsername) {

  let retrivedQueryPrice;
  try {
    const user = await pinata.listFiles().name(telegramUsername)

    console.log('user with name : ', user);
    const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);

    retrivedQueryPrice = userJson.queryPrice;
    console.log("retrived query price : ", retrivedQueryPrice);

  } catch (error) {
    console.log("error while getting total charge : ", error.mgessage);
  }


  return retrivedQueryPrice;

}