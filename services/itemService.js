const axios = require("axios");
const config = require("../config/config");
const { session } = require("telegraf");
// const baseUrl = config.baseUrl;
const baseUrl = "http://localhost:3000/api";

async function saveItem(itemData) {
  try {
    const response = await axios.post(`${baseUrl}/items/save`, itemData);
    console.log(itemData);
    return response.data.itemId;
  } catch (error) {
    console.error("Error saving item:", error);
    throw error;
  }
}

async function saveItemWithUser(itemData) {
  try {
    console.log(session.name);
    const response = await axios.post(
      `${baseUrl}/items/saveWithUser`,
      itemData,
    );
    return response.data.itemId;
  } catch (error) {
    console.error("Error saving item with user:", error);
    throw error;
  }
}

async function getItemDetails(itemId) {
  try {
    const response = await axios.get(`${baseUrl}/items/${itemId}`);
    console.log("Item details response:", response.data);
    if (response.status === 200) {
      return response.data;
    } else {
      throw new Error(`Error: ${response.status} - Item not found`);
    }
  } catch (error) {
    console.error("Error fetching item details:", error);
    throw error;
  }
}

async function itemStatus(itemId) {
  try {
    const response = await axios.get(`${baseUrl}/items/${itemId}/status`);
    if (response.status === 200) {
      return response.data;
    } else {
      const errorData = response.data;
      throw new Error(`Error: ${response.status} - ${errorData.error}`);
    }
  } catch (error) {
    console.error("Error retrieving item status:", error);
    throw error;
  }
}

async function updateItemStatus(itemId) {
  try {
    const response = await axios.put(`${baseUrl}/items/${itemId}/updateStatus`);
    if (response.status === 204) {
      return { success: true, message: "Item status updated successfully." };
    } else {
      const errorData = response.data;
      throw new Error(`Error: ${response.status} - ${errorData.message}`);
    }
  } catch (error) {
    console.error("Error updating item status:", error);
    throw error;
  }
}

async function getOrderdItems(buyerChatId) {
  try {
    const response = await axios.get(`${baseUrl}/orderdItems/${buyerChatId}`);

    if (response.status === 200) {
      console.log(response.data);
      return response.data;
    } else if (response.status === 404) {
      return [];
    } else {
      throw new Error(
        `Failed to get ordered items. Status: ${response.status}`,
      );
    }
  } catch (error) {
    throw new Error(`Failed to get ordered items: ${error.message}`);
  }
}

async function getSoldItems(sellerChatId) {
  try {
    const response = await axios.get(`${baseUrl}/soldItems/${sellerChatId}`);

    if (response.status === 200) {
      return response.data;
    } else if (response.status === 404) {
      return [];
    } else {
      throw new Error(`Failed to get sold items. Status: ${response.status}`);
    }
  } catch (error) {
    throw new Error(`Failed to get sold items: ${error.message}`);
  }
}

module.exports = {
  saveItem,
  saveItemWithUser,
  getItemDetails,
  itemStatus,
  getOrderdItems,
  getSoldItems,
  updateItemStatus,
};
