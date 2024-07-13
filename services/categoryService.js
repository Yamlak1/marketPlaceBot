const axios = require("axios");
const config = require("../config/config");
const baseUrl = "http://localhost:3000/api";

const getCategory = async function () {
  try {
    const response = await axios.get(`${baseUrl}/categories`);
    const categories = response.data;
    return categories;
  } catch (error) {
    console.error(`category error ${error}`);
    return [];
  }
};

const getCategoryNameById = async (categoryId) => {
  const categories = await getCategory();
  const category = categories.find(
    (cat) => cat.topic_id === parseInt(categoryId),
  );
  return category ? category.category_name : "Unknown";
};

module.exports = {
  getCategory,
  getCategoryNameById,
};
