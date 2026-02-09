const Chat = require("../models/Chat");

module.exports = (io) => {
    const chatNamespace = io.of("/chat"); // Use namespace to separate from auction

    chatNamespace.on("connection", (socket) => {
        console.log("User connected to Chat:", socket.id);

        // Join a specific chat room (Chat ID)
        socket.on("joinChat", (chatId) => {
            socket.join(chatId);
            console.log(`Socket ${socket.id} joined Chat ${chatId}`);
        });

        // Send Message
        socket.on("sendMessage", async (data) => {
            try {
                const { chatId, senderId, content, type } = data;

                // 1. Save to DB
                // Use findOneAndUpdate to push message and update lastMessage time
                const chat = await Chat.findByIdAndUpdate(
                    chatId,
                    {
                        $push: {
                            messages: {
                                sender: senderId,
                                content: content,
                                type: type || "text",
                                timestamp: new Date()
                            }
                        },
                        lastMessage: new Date()
                    },
                    { new: true } // Return updated doc
                );

                if (chat) {
                    // Get the message object we just added (last one)
                    const newMessage = chat.messages[chat.messages.length - 1];

                    // 2. Broadcast to Room
                    chatNamespace.to(chatId).emit("newMessage", {
                        chatId,
                        message: newMessage
                    });
                }

            } catch (err) {
                console.error("Error sending message:", err);
                socket.emit("error", "Failed to send message");
            }
        });

        // Mark Messages as Read
        socket.on("markRead", async (data) => {
            try {
                const { chatId, userId } = data; // userId is the reader

                // Mark all messages NOT sent by userId as read
                await Chat.updateOne(
                    { _id: chatId },
                    {
                        $set: { "messages.$[elem].read": true }
                    },
                    {
                        arrayFilters: [{ "elem.sender": { $ne: userId } }]
                    }
                );

                // Notify others in room
                chatNamespace.to(chatId).emit("messagesRead", { chatId, readerId: userId });

            } catch (err) {
                console.error("Error marking read:", err);
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected from Chat:", socket.id);
        });
    });
};
