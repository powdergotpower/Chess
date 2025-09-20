# main.py
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes
from detect import detect_pieces

BOT_TOKEN = "8396269907:AAH9VURRq33VX_E6-_5_QJKMWpG8nPEeDQY"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Send me a board screenshot and I'll detect pieces!")

async def detect_board(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.photo:
        photo_file = await update.message.photo[-1].get_file()
        file_path = "board.png"
        await photo_file.download_to_drive(file_path)
        await update.message.reply_text("Detecting pieces...")
        
        positions = detect_pieces(file_path)
        reply = "\n".join([f"{k}: {v}" for k, v in positions.items()])
        await update.message.reply_text(reply)
    else:
        await update.message.reply_text("Please send a photo of the board.")

app = ApplicationBuilder().token(BOT_TOKEN).build()
app.add_handler(CommandHandler("start", start))
app.add_handler(MessageHandler(filters.PHOTO, detect_board))

print("Bot started...")
app.run_polling()
