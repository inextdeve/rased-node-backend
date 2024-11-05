import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import sqlinjection from "sql-injection";
import apiRouter from "./api/routes/api.js";

dotenv.config();

const app = express();

// Define your CORS options (customize to your needs)
const corsOptions = {
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
};

app.use(cors(corsOptions));

app.use(express.json());

app.use("/node/api", apiRouter);

app.use(sqlinjection); // add sql-injection middleware here

app.listen(3003, () => {
  console.log(`Server running on port ${3003}`);
});
