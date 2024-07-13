const axios = require("axios");
const config = require("../config/config");
const baseUrl = "http://localhost:3000/api";

async function checkUser(chatId) {
  try {
    const response = await axios.get(`${baseUrl}/users/${chatId}`);
    if (response.status === 200) {
      return response.data.user_id;
    } else if (response.status === 404) {
      return null;
    } else {
      throw new Error("Internal server error");
    }
  } catch (error) {
    console.error("Error checking user registration:", error);
    throw error;
  }
}
async function registerUser(userData) {
  try {
    console.log(userData);
    const response = await axios.post(
      `${baseUrl}/users/registerUser`,
      userData,
    );
    return response.data.userId;
  } catch (error) {
    console.error("Error registering user:", error);
    throw error;
  }
}

module.exports = {
  checkUser,
  registerUser,
};
