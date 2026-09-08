const dotenv = require("dotenv");
dotenv.config();
const connectDB = require("./config/connectDB");
const express = require("express");
const app = express();
const axios = require('axios');

// all the routes 

const authRoutes = require("./routes/authRoutes");

app.use(express.json());


async function transcribe(req , res){
    const {url , user} = req ;
      try{
        const response = await axios.get(`http://127.0.0.1:8000/api/v1/transcribe/${url}`, {
          user
        });
        console.log(response);
        res.send(response.data);
      }catch(err){
        console.log(err);
        res.send({"msg" : err});
      }
}
app.get("/", (req, res) => {
        return getDATA(req, res);
  // res.send("API Running");
});

// app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 3000 ;
app.listen(PORT , ()=>{
    connectDB();
    console.log(`Server is running on port ${PORT}`);
})