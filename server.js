require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const authRoute = require('./routes/authRoute')
const userRoute = require("./routes/userRoute")
const taskRoute = require("./routes/taskRoute")
const reportRoute = require("./routes/reportRoute")
const app = express();

app.use(
    cors({
        origin: process.env.CLIENT_URL || "*",
        methods : ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
)


//Middleware
app.use(express.json());


//Connect Database
connectDB();

//Routes
app.use("/api/auth",authRoute)
app.use("/api/users",userRoute)
app.use("/api/tasks",taskRoute)
app.use("/api/reports",reportRoute)

//serve upload folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});