const { Telegraf } = require("telegraf");
const commands = require("./util/command");

require("dotenv").config();
const botToken = "7319418843:AAGEyYUrKe1nRfu5sJIr-PXF-NGM8mZpH28";

const bot = new Telegraf(botToken);

const PORT = process.env.PORT || 3000;

commands.register(bot);

bot.launch();