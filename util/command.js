const { Telegraf, Markup, session } = require("telegraf");
const LocalSession = require("telegraf-session-local");
const axios = require("axios");
const { checkUser, registerUser } = require("../services/userService");
const {
  saveItem,
  saveItemWithUser,
  getItemDetails,
  itemStatus,
  getOrderdItems,
  getSoldItems,
  updateItemStatus,
} = require("../services/itemService");
const {
  getCategoryNameById,
  getCategory,
} = require("../services/categoryService.js");
// const {
//   generatePaymentURL,
//   getTransactionStatus,
// } = require("../services/transaction");
const { response, text } = require("express");
require("dotenv").config();

function register(bot) {
  const localSession = new LocalSession({ database: "session_db.json" });
  bot.use(localSession.middleware());

  bot.start(async (ctx) => {
    const chatId = ctx.chat.id;
    const startPayload = ctx.startPayload;

    if (startPayload) {
      const itemId = startPayload;

      try {
        const productStatus = await itemStatus(itemId);
        if (productStatus.status == 1) {
          const item = await getItemDetails(itemId);
          const sellerChatId = item.sellerChatId;
          const selectedPicFileId = item.pic_file_id;
          const responseMsg = `Name: ${item.product_name}\nDescription: ${item.description}\nPrice: ${item.price}\nPickup Location: ${item.pickUp_location}`;

          if (sellerChatId != chatId) {
            bot.telegram.sendPhoto(chatId, selectedPicFileId, {
              caption: responseMsg,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Check Availability",
                      callback_data: `checkItem_${itemId}_${ctx.from.id}`,
                    },
                  ],
                ],
              },
            });

            ctx.session.itemId = itemId;
          } else {
            ctx.reply("You cannot buy your own item.");
          }
        } else {
          ctx.reply("Item not available");
        }
      } catch (error) {
        if (error.response && error.response.status === 500) {
          ctx.reply("Error: Item not found");
        } else {
          ctx.reply(`Item not found`);
        }
      }
    } else if (chatId != -1001999940806) {
      ctx.telegram.sendMessage(ctx.chat.id, "DO YOU WANT TO SELL OR BUY?", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "SELL",
                callback_data: "SELL",
              },
              {
                text: "BUY",
                callback_data: "BUY",
              },
            ],
          ],
        },
      });
    }
  });

  bot.command("list_paid_item", async (ctx) => {
    try {
      const buyerChatId = ctx.chat.id;
      console.log(`buyer Chatid  : ${buyerChatId}`);
      const paidItems = await getOrderdItems(buyerChatId);

      if (paidItems.length > 0) {
        for (const item of paidItems) {
          const message = `Description: ${item.Item_list.description}\n Item: ${item.Item_list.product_name}\n Price: ${item.payment_amount}`;
          await ctx.reply(message, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Aprove", callback_data: "Aprove" },
                  { text: "Decline", callback_data: "Decline" },
                ],
              ],
            },
          });
        }
      } else {
        await ctx.reply("No paid items found.");
      }
    } catch (error) {
      console.error(error);
    }
  });

  bot.command("list_items_with_recived_payment", async (ctx) => {
    try {
      const sellerChatId = ctx.chat.id;
      const soldItems = await getSoldItems(sellerChatId);

      console.log(soldItems);

      if (soldItems.length > 0) {
        for (const item of soldItems) {
          const message = `Description: ${item.Item_list.description}\n Item: ${item.Item_list.product_name}\n Price: ${item.payment_amount}`;
          await ctx.reply(message, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Request for aproval", callback_data: "Aprove" }, //For next phase
                ],
              ],
            },
          });
        }
      } else {
        await ctx.reply("No paid items found.");
      }
    } catch (error) {
      console.error(error);
    }
  });

  bot.action(/checkItem_[0-9]+/, async (ctx) => {
    const itemId = ctx.match[0].split("_")[1];
    try {
      const item = await getItemDetails(itemId);
      const sellerChatId = item.sellerChatId;
      await bot.telegram.sendMessage(
        sellerChatId,
        `A user is interested in your item. Do you confirm its availability ${itemId}?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Yes",
                  callback_data: `yes_${itemId}_${ctx.from.id}`,
                },
                {
                  text: "No",
                  callback_data: `no_${itemId}_${ctx.from.id}`,
                },
              ],
            ],
          },
        },
      );
      ctx.session.sellerItemId = itemId;
      ctx.session.sellerChatId = sellerChatId;

      ctx.reply(
        "The seller has been notified. Please wait for their confirmation.",
      );
    } catch (error) {
      console.error("Error:", error);
      ctx.reply("Error: Failed to fetch item details.");
    }
  });

  bot.action(/yes_[0-9]+_([0-9]+)/, async (ctx) => {
    const itemId = ctx.match[0].split("_")[1];

    try {
      const item = await getItemDetails(itemId);
      const sellerChatId = item.sellerChatId;
      const buyerId = ctx.match[1];
      console.log("Buyer ID:", buyerId);
      console.log("seller ID : ", sellerChatId);

      await bot.telegram.sendMessage(
        buyerId,
        "The item is available. Do you want to continue?",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Yes",
                  callback_data: `buyerYes_${ctx.from.id}_${itemId}`,
                },
              ],
            ],
          },
        },
      );
      await ctx.deleteMessage();
    } catch (error) {
      console.error("Error:", error);
      ctx.reply("Error: Failed to process your request.");
    }
  });

  bot.action(/no_[0-9]+_([0-9]+)/, async (ctx) => {
    const itemId = ctx.match[0].split("_")[1];
    const buyerId = ctx.match[1];

    try {
      const item = await getItemDetails(itemId);
      await bot.telegram.sendMessage(buyerId, "The item is not available.");
      await updateItemStatus(itemId);
      delete ctx.session.sellerItemId;
      delete ctx.session.sellerChatId;
      await ctx.deleteMessage();
    } catch (error) {
      console.error("Error:", error);
      ctx.reply("Error: Failed to process your request.");
    }
  });

  bot.action("BUY", async (ctx) => {
    ctx.deleteMessage();

    ctx.reply(
      "If you want to see items for sell tap on this link :\n /// LINK TO GROUP ///",
    );
  });

  bot.action("SELL", async (ctx) => {
    try {
      ctx.deleteMessage();
      const Categories = await getCategory();
      const formattedCategories = [];
      for (let i = 0; i < Categories.length; i += 2) {
        const row = [];
        row.push({
          text: Categories[i].category_name,
          callback_data: Categories[i].topic_id.toString(),
        });
        if (i + 1 < Categories.length) {
          row.push({
            text: Categories[i + 1].category_name,
            callback_data: Categories[i + 1].topic_id.toString(),
          });
        }
        formattedCategories.push(row);
      }

      ctx.telegram.sendMessage(ctx.chat.id, "CHOOSE CATEGORY", {
        reply_markup: {
          inline_keyboard: formattedCategories,
        },
      });
    } catch (error) {
      console.error("error fetching : ", error.message);
    }
  });

  function generateRandomHexString(length) {
    let result = "";
    const characters = "0123456789abcdef";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  bot.action(/buyerYes_[0-9]+_([0-9]+)/, async (ctx) => {
    try {
      const { session } = ctx;
      const chatId = ctx.chat.id;
      const sellerId = ctx.match[0].split("_")[1];
      const user = await checkUser(chatId);
      if (!user) {
        ctx.telegram.sendMessage(ctx.chat.id, "Enter your name:");
        session.step = "waitingBuyersFullName";
      } else {
        try {
          const itemId = ctx.match[1];
          const itemName = await getItemDetails(itemId);

          const amount = itemName.price;
          const reason = `${itemName.product_name} ${itemId}`;
          ctx.reply("Please enter your phone number:");

          ctx.session.paymentData = {
            amount: amount,
            reason: reason,
            successRedirectUrl: "https://test.com/success",
            failureRedirectUrl: "https://test.com/failure",
            notifyUrl: "https://test.com/notify",
            cancelRedirectUrl: "https://test.com/cancel",
            itemId: itemId,
            buyerChatId: chatId,
          };
          ctx.session.step = "waitingForPaymentPhoneNumber";

          await ctx.deleteMessage();
        } catch (error) {
          console.error(error);
        }
      }
    } catch (error) {
      console.error(error);
    }
  });
  bot.action(/^[0-9]+$/, async (ctx) => {
    const { session } = ctx;
    ctx.deleteMessage();
    const categoryId = ctx.match[0];
    session.categoryId = categoryId;
    session.categoryName = getCategoryNameById(categoryId);
    ctx.telegram.sendMessage(ctx.chat.id, "please enter the item name");
    session.step = "WaitingForitemName";
  });

  bot.on("text", async (ctx) => {
    const { text } = ctx.message;
    const { session } = ctx;
    if (session) {
      switch (session.step) {
        case "waitingForPaymentPhoneNumber":
          try {
            const paymentPhoneNumber = ctx.message.text;
            ctx.session.paymentData.phoneNumber = paymentPhoneNumber;

            const {
              amount,
              reason,
              successRedirectUrl,
              failureRedirectUrl,
              notifyUrl,
              phoneNumber,
              cancelRedirectUrl,
              itemId,
              buyerChatId,
            } = ctx.session.paymentData;

            const { url, gatewayTransactionID } = await generatePaymentURL({
              amount,
              reason,
              successRedirectUrl,
              failureRedirectUrl,
              notifyUrl,
              phoneNumber,
              cancelRedirectUrl,
              itemId,
              buyerChatId,
            });

            ctx.reply("Proceed to payment", {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Santim Pay", web_app: { url: `${url}` } }],
                ],
              },
            });
            try {
              let transactionStatus;
              let retries = 0;
              const maxRetries = 10; // Number of times to check the status
              const interval = 2000; // Interval in milliseconds between each check

              while (retries < maxRetries) {
                transactionStatus =
                  await getTransactionStatus(gatewayTransactionID);
                console.log(
                  `Transaction status: ${transactionStatus.transactionStatus}`,
                );

                if (transactionStatus.transactionStatus === "COMPLETED") {
                  // Transaction completed, continue with further functionality
                  const sellerName = transactionStatus.sellerContact.name;
                  console.log(sellerName);
                  const sellerPhone = transactionStatus.sellerContact.phone;
                  console.log(sellerPhone);
                  const itemId = transactionStatus.ItemId;
                  console.log(itemId);

                  // const itemId = ctx.startPayload;
                  const item = await getItemDetails(itemId);
                  const sellerChatId = item.sellerChatId;
                  const buyerChatId = ctx.chat.id;
                  const itemName = item.name;

                  console.log(`Seller Chat Id : ${sellerChatId}`);
                  console.log(`buyer Chat Id : ${buyerChatId}`);

                  await bot.telegram.sendMessage(
                    buyerChatId,
                    `the item has paid for . Seller's name: ${sellerName}, Seller's phone: ${sellerPhone}.`,
                  );
                  await bot.telegram.sendMessage(
                    sellerChatId,
                    `We have received a payment for your item : ${itemName} , please prepare the item and wait for a call`,
                  );
                  await updateItemStatus(itemId);
                  break;
                }
                await new Promise((resolve) => setTimeout(resolve, interval));
                retries++;
              }

              // if (transactionStatus.transactionStatus !== "COMPLETED") {
              //   ctx.reply(
              //     "Transaction did not complete within the specified time.",
              //   );
              // }

              ctx.session.step = null;
            } catch (error) {
              console.error(error);
            }

            ctx.session.step = "waitingForPayment";
          } catch (error) {}
          break;

        case "waitingForPayment":
          console.log("one step");

          break;

        case "WaitingForitemName":
          session.name = text;
          ctx.reply("Write item description");
          session.step = "WaitingForDescription";
          break;
        case "WaitingForDescription":
          session.description = text;
          ctx.reply("send photo");
          session.step = "waitingForitemImage";
          break;
        case "waitingForitemImage":
          ctx.reply("Please send a photo.");
          break;
        case "waitingForLocation":
          session.location = text;
          ctx.reply("Location received. Now enter the item price.");
          session.step = "waitingForitemPrice";
          break;
        case "waitingForLocation":
          ctx.reply("Please enter the item price:");
          session.step = "waitingForitemPrice";
          break;
        case "waitingForitemPrice":
          session.itemPrice = text;
          ctx.reply("choose the currency", {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "BIRR", callback_data: "BIRR" },
                  { text: "USD", callback_data: "USD" },
                ],
              ],
            },
          });
          session.step = "waitingForCurrency";
          break;
        case "waitingFullName":
          session.fullName = text;
          ctx.reply("Enter your Email");
          session.step = "waitingForEmail";
          break;
        case "waitingForEmail":
          session.email = text;
          ctx.reply("Enter your Phone Number");
          session.step = "waitingForPhoneNumber";
          break;
        case "waitingForPhoneNumber":
          session.phoneNumber = text;
          ctx.reply("Do you accept the terms and conditions?", {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Accept", callback_data: "accept" },
                  { text: "Decline", callback_data: "decline" },
                ],
              ],
            },
          });
          session.step = "WaitingForTerms";
          break;
        case "WaitingForConfirmation":
          session.confirmation = text;
          break;
        case "waitingBuyersFullName":
          session.buyerFullName = text;
          ctx.reply("Enter your Email");
          session.step = "waitingForBuyersEmail";
          break;
        case "waitingForBuyersEmail":
          session.buyersEmail = text;
          ctx.reply("Enter your Phone Number");
          session.step = "waitingForBuyersPhoneNumber";
          break;
        case "waitingForBuyersPhoneNumber":
          session.buyersPhoneNumber = text;
          ctx.reply("Do you accept the terms and conditions?", {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Accept", callback_data: "accept" },
                  { text: "Decline", callback_data: "decline" },
                ],
              ],
            },
          });
          session.step = "WaitingForBuyersTerms";
          break;
      }
    }
  });

  bot.action("BUY", async (ctx) => {
    // ctx.deleteMessage();

    ctx.reply(
      "If you want to see items for sell tap on this link :\n /// LINK TO GROUP ///",
    );
  });

  bot.on("photo", async (ctx) => {
    const { session } = ctx;
    try {
      if (session && session.step === "waitingForitemImage") {
        const photo = ctx.message.photo;
        if (photo && photo.length > 0) {
          const imageId = photo[photo.length - 1].file_id;
          session.itemImage = imageId;
          ctx.reply("Please share your location");
          session.step = "waitingForLocation";
        } else {
          console.error("User did not send a photo.");
          ctx.reply("Please send a photo.");
        }
      }
    } catch (error) {
      console.error("Error handling photo:", error);
      ctx.reply("Please send a photo.");
    }
  });

  bot.on("text", async (ctx) => {
    const { session } = ctx;
    if (session.step === "waitingForLocation") {
      // Remove the keyboard with the Share Location button
      ctx.reply("Please enter the item price:", {
        reply_markup: {
          remove_keyboard: true,
        },
      });
      session.step = "waitingForitemPrice";
    }
  });

  bot.on("callback_query", async (ctx) => {
    const chatId = ctx.callbackQuery.from.id;
    const { data } = ctx.callbackQuery;
    const { session } = ctx;

    if (session && session.step === "WaitingForitemCategory") {
      session.itemCategory = data;
    } else if (session && session.step === "waitingForCurrency") {
      // ctx.deleteMessage();
      try {
        const user = await checkUser(chatId);
        if (!user) {
          ctx.reply("Enter your Full Name");
          session.step = "waitingFullName";
        } else {
          const chosenCurrency = ctx.callbackQuery.data;
          session.currency = chosenCurrency;
          ctx.reply(
            `Your inputs:\nName: ${session.name}\nDescription: ${session.description}\nPrice: ${session.itemPrice} ${chosenCurrency}\n\nPlease choose an option: `,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "Confirm", callback_data: "confirm" },
                    { text: "Edit", callback_data: "edit" },
                    { text: "Discard", callback_data: "discard" },
                  ],
                ],
              },
            },
          );
          session.step = "WaitingForConfirmation";
        }
      } catch (error) {
        console.error("Error handling currency selection:", error);
        ctx.reply("An error occurred. Please try again later.");
      }
    } else if (session && session.step === "WaitingForTerms") {
      switch (data) {
        case "accept":
          session.termsAccepted = true;
          ctx.reply("You have accepted the terms and conditions.");
          session.step = "WaitingForConfirmation";
          ctx.reply(
            `Your inputs:\nName: ${session.name}\nCategory: ${session.categoryName} (ID: ${session.categoryId})\nDescription: ${session.description}\nPrice: ${session.itemPrice} ${session.currency}\n\nPlease choose an option: `,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "Confirm", callback_data: "confirm" },
                    { text: "Edit", callback_data: "edit" },
                    { text: "Discard", callback_data: "discard" },
                  ],
                ],
              },
            },
          );
          break;
        case "decline":
          session.termsAccepted = false;
          ctx.reply("You have declined the terms and conditions.");
          ctx.reply("Must accept");
          break;
        default:
          break;
      }
    } else if (session && session.step === "WaitingForBuyersTerms") {
      switch (data) {
        case "accept":
          try {
            session.termsAccepted = true;
            ctx.reply("You have accepted the terms and conditions.");

            const userData = {
              fullName: session.buyerFullName,
              email: session.buyersEmail,
              phone: session.buyersPhoneNumber,
              chatId: ctx.chat.id,
              termsConditions: session.termsAccepted,
            };

            await registerUser(userData);

            ctx.reply(
              "User registered successfully. Proceeding with payment...",
            );

            session.step = "WaitingForBuyersPayment";
          } catch (error) {
            console.error(error);
          }
          break;
        case "decline":
          session.termsAccepted = false;
          ctx.reply("You have declined the terms and conditions.");
          ctx.reply("Must accept");
          break;
        default:
          break;
      }
    } else if (session && session.step === "WaitingForBuyersPayment") {
      try {
        const { session } = ctx;
        const chatId = ctx.chat.id;
        const sellerId = ctx.match[0].split("_")[1];
        const user = await checkUser(chatId);

        if (!user) {
          ctx.telegram.sendMessage(ctx.chat.id, "Enter your name:");
          session.step = "waitingBuyersFullName";
        } else {
          try {
            const itemId = ctx.match[1];
            const itemName = await getItemDetails(itemId);

            const amount = itemName.price;
            const reason = `${itemName.product_name} ${itemId}`;
            ctx.reply("Please enter your phone number:");

            ctx.session.paymentData = {
              amount: amount,
              reason: reason,
              successRedirectUrl: "https://test.com/success",
              failureRedirectUrl: "https://test.com/failure",
              notifyUrl: "https://test.com/notify",
              cancelRedirectUrl: "https://test.com/cancel",
              itemId: itemId,
              buyerChatId: chatId,
            };
            ctx.session.step = "waitingForPaymentPhoneNumber";

            await ctx.deleteMessage();
          } catch (error) {
            console.error(error);
          }
        }
      } catch (error) {
        console.error(error);
      }
    } else if (session && session.step === "WaitingForConfirmation") {
      switch (data) {
        case "confirm":
          try {
            const {
              fullName,
              email,
              phoneNumber,
              itemImage,
              name,
              description,
              itemPrice,
              currency,
              location,
            } = session;
            console.log(location);

            const user = await checkUser(ctx.callbackQuery.from.id);

            if (!user) {
              if (name) {
                const newItemWithUserId = await saveItemWithUser({
                  fullName,
                  email,
                  phone: phoneNumber,
                  chatId: ctx.callbackQuery.from.id,
                  termsConditions: session.termsAccepted,
                  productName: name,
                  picFileId: itemImage,
                  description,
                  price: itemPrice,
                  pickUpLocation: location,
                });

                ctx.reply(
                  `Item "${name}" has been successfully added with ID ${newItemWithUserId}`,
                );

                await senditemToGroup(newItemWithUserId, session);
              }
            } else {
              const newItemId = await saveItem({
                userId: user,
                productName: name,
                picFileId: itemImage,
                description,
                price: itemPrice,
                pickUpLocation: location,
              });

              ctx.reply(
                `Item "${name}" has been successfully added with ID ${newItemId}`,
              );
              await senditemToGroup(newItemId, session);
            }
          } catch (error) {
            console.error("Error saving item:", error);
            ctx.reply(
              "An error occurred while saving the item. Please try again later.",
            );
          }

          ctx.session = null;
          break;

        case "edit":
          ctx.reply("Please enter a name: ");
          session.step = "WaitingForitemName";
          break;
        case "discard":
          delete ctx.session;
          ctx.reply("item discarded");

          break;
        default:
          break;
      }
    }

    async function senditemToGroup(newItemId, session) {
      const botUsername = "https://t.me/YamlakMarketPlaceBot";
      const botLink = `${botUsername}?start=${newItemId}`;
      try {
        let topicMessageId = session.categoryId;
        const caption = `Name: ${session.name}\nDescription: ${session.description}\nPrice: ${session.itemPrice}\nPickup location : ${session.location}`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "Buy now",
                url: botLink,
              },
            ],
          ],
        };

        await bot.telegram.sendPhoto("-1002240099883", session.itemImage, {
          caption: caption,
          reply_markup: JSON.stringify(keyboard),
          reply_to_message_id: topicMessageId,
        });
      } catch (error) {
        console.error("Error sending item details to group:", error);
        throw error;
      }
    }
  });
}

module.exports = { register };
