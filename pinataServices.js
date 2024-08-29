import { PinataSDK } from "pinata";
import dotenv from 'dotenv';
import { json } from "stream/consumers";
import { processFile } from './similarity.js'
dotenv.config();

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GETWAY,
});

export const uploadToPinata = async function (fileData, telegramUsername) {

  let upload;
  try {


    upload = await pinata.upload.json(fileData, {
      metadata: {
      name:telegramUsername
    }});

    console.log("pinata file uploaded details :  ", upload);
  
    let parsedIpfsHash = upload.IpfsHash;
    console.log("ipfs hash : ", parsedIpfsHash);

    
  } catch (error) {
    console.log(error);
  }


}


export const createPinataUser = async function (telegramUsername, fileName, fileEmbeddings , queryPrice) {



  try {
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
      queryPrice: queryPrice,
      totalCharge: null,
      lastUsed:null,
    }

    if (user.length == 0) {
      let uniqueFileName = `${fileName}_${0}`;
      const newEmbeddingObject = {
        id: 0,
        fileName: uniqueFileName,
        embedding: fileEmbeddings,
      }
      userObject.embeddings.push(newEmbeddingObject);
      console.log("new user before uploading pinata : ", userObject)
      console.log("file name before uploading to pinata : ", `${telegramUsername}.json`)
      await uploadToPinata(userObject, telegramUsername);

    } else {

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



  } catch (error) {
    console.log(error);
  }


}


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



export const unpinPinataData = async function (ipfsHash) {
  try {
    const unpinnedData = await pinata.unpin([ipfsHash])

    console.log("unpined data : ",unpinnedData )
  } catch (error) {
    console.error("Error retrieving data from Pinata:", error);
    throw error;
  }
}


export const getAllEmbeddings= async function (telegramUsername) {
  
  let allEmbeddings=[];
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




export const updateFilesToPinata= async function (telegramUsername, fileName , pdfBuffer) {
  
  let response;
  
  try {
    const user = await pinata.listFiles().name(telegramUsername)
    console.log('user with name : ', user);
    if (user.length>0) {
      console.log('user found');
      let newEmbeddings = await processFile(pdfBuffer);
    
      const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);
      userJson.embeddings.forEach(element => {
        console.log("actual file name : ", element.fileName);
        console.log("entered file name : ", fileName);
        console.log("entered file name and actual file are equal ?  : ", element.fileName === fileName);
      
        if (element.fileName === fileName) {
          console.log("matching file found");
          element['embedding'] =newEmbeddings;
          
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



export const updateUserDetailsToPinata= async function (telegramUsername,lastUsedTime , dataProvider) {
  let retrivedQueryPrice;
  try {
    const user = await pinata.listFiles().name(telegramUsername)

    console.log('user with name : ', user);
    const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);
    userJson.lastUsed = lastUsedTime;

   
    if (dataProvider !== "") {
      retrivedQueryPrice  = await retriveQueryPriceFromPinata(dataProvider);
    }
    let updatedTotalUsedCharge = userJson.totalCharge==null?0+Number(retrivedQueryPrice):Number(userJson.totalCharge)+Number(retrivedQueryPrice);
    console.log("updated total charge : ", updatedTotalUsedCharge);
    userJson.totalCharge = updatedTotalUsedCharge;
    await uploadToPinata(userJson, telegramUsername);
    await unpinPinataData(user[0].ipfs_pin_hash);
    console.log("user last used time updated to pinata successfully");

  } catch (error) {
    console.log("error while getting all embeddings : ", error.mgessage);
  }
 
}
export const queryLastUsedBotTimeFromPinata= async function (telegramUsername) {
  let lastUsedTime=null;
  try {
    const user = await pinata.listFiles().name(telegramUsername)

    if (user.length > 0) {
      console.log('user with name : ', user);
      const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);
     
      lastUsedTime = userJson.lastUsed;
      console.log("lastUsedTime : ",lastUsedTime);
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
        lastUsed:null,
      }
      await uploadToPinata(userObject, telegramUsername);
     }

  } catch (error) {
    console.log("error while getting last used time : ", error.mgessage);
  }


  return lastUsedTime;
 
}

export const retriveTotalChargeFromPinata= async function (telegramUsername) {
  let totalUsedCharge;
  try {
    const user = await pinata.listFiles().name(telegramUsername)

    console.log('user with name : ', user);
    const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);
   
    totalUsedCharge = userJson.totalCharge;
    console.log("total charge : ",totalUsedCharge);

  } catch (error) {
    console.log("error while getting total charge : ", error.mgessage);
  }


  return Number(totalUsedCharge);
 
}




 


export const retriveQueryPriceFromPinata = async function (telegramUsername) {
  
  let retrivedQueryPrice;
  try {
    const user = await pinata.listFiles().name(telegramUsername)

    console.log('user with name : ', user);
    const userJson = await retrieveFromPinata(user[0].ipfs_pin_hash);
   
    retrivedQueryPrice = userJson.queryPrice;
    console.log("retrived query price : ",retrivedQueryPrice);

  } catch (error) {
    console.log("error while getting total charge : ", error.mgessage);
  }


  return retrivedQueryPrice;
 
}