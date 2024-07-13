const { Telegraf } = require("telegraf");
const commands = require("./util/command");

require("dotenv").config();
const botToken = "process.env.BOT_TOKEN";

const bot = new Telegraf(botToken);

const PORT = process.env.PORT || 3000;

commands.register(bot);

bot.launch();
