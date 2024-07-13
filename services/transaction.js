// const axios = require("axios");
// const config = require("../config/config");
// const baseUrl = config.baseUrl;
// const secondUrl = config.secondUrl;

// async function generatePaymentURL(transactionData) {
//   try {
//     const response = await axios.post(`${baseUrl}/paymentURL`, transactionData);
//     console.log(response.data);
//     return response.data;
//   } catch (error) {
//     if (error.response) {
//       throw error.response.data;
//     } else {
//       throw error;
//     }
//   }
// }

// async function getTransactionStatus(gatewayTransactionID) {
//   try {
//     const response = await axios.get(
//       `${baseUrl}/transactions/transactionStatusSantimpay/${gatewayTransactionID}`,
//     );
//     console.log(response.data);
//     return response.data;
//   } catch (error) {
//     if (error.response) {
//       if (error.response.status === 404) {
//         throw new Error(`Transaction ID ${gatewayTransactionID} not found.`);
//       } else {
//         throw new Error(`Internal Server Error: ${error.response.data.error}`);
//       }
//     } else {
//       throw new Error(`Request failed: ${error.message}`);
//     }
//   }
// }

// module.exports = { generatePaymentURL, getTransactionStatus };