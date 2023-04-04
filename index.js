import express from "express";
import { MongoClient } from "mongodb";
import CORS from "cors";
import nodeMailer from "nodemailer";
import * as dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { auth } from "./Auth/auth.js";

const MONGO_URL = process.env.MONGO_URL;
const client = new MongoClient(MONGO_URL);
await client.connect();
console.log("Mongo is connected");
const app = express();

const PORT = process.env.PORT;
app.use(express.json());
app.use(CORS());

app.post("/", async function (request, response) {
  const data = await request.body;
  const assignTask = await client
    .db("TaskSubmissionPortal")
    .collection("Assign Task")
    .insertMany(data);
  response.send(assignTask);
});


app.get("/", auth, async function (request, response) {
  const assignTask = await client
    .db("TaskSubmissionPortal")
    .collection("Assign Task")
    .find({})
    .toArray();
  response.send(assignTask);
});


app.post("/signupdetails", async function (request, response) {
  const { name, email } = await request.body;
  const userData = await client
    .db("TaskSubmissionPortal")
    .collection("Login Details")
    .findOne({ email: email });

  if (userData) {
    response.status(400).send({ message: "User already exist" });
  } else {
    const number = Math.random();
    const otp = (number * 10000).toFixed(0);
    const storeDetails = await client
      .db("TaskSubmissionPortal")
      .collection("Signup Details")
      .insertOne({
        name: name,
        email: email,
      });

    const result = await client
      .db("TaskSubmissionPortal")
      .collection("verifyEmail")
      .insertOne({
        email: email,
        otp: otp,
      });

    let transporter = nodeMailer.createTransport({
      service: "gmail",
      auth: {
        user: "selvamyoor@gmail.com",
        pass: process.env.APP_PASSWORD,
      },
    });

    let info = {
      from: "selvamyoor@gmail.com",
      to: email,
      subject: "Reset the password",
      text: "Use this code to rest the password " + otp,
    };
    transporter.sendMail(info, (err) => {
      if (err) {
        console.log("error", err);
      } else {
        console.log("email sent successfully");
      }
    });
    response.status(200).send({ message: "OTP sent successfully" });
    setTimeout(async () => {
      const deleteOTP = await client
        .db("TaskSubmissionPortal")
        .collection("verifyEmail")
        .deleteOne({
          email: email,
          otp: otp,
        });
    }, 20000);

  }
});

app.get("/signupdetails", async function (request, response) {
  const getSignUpData = await client
    .db("TaskSubmissionPortal")
    .collection("Signup Details")
    .find({})
    .toArray();
  response.send(getSignUpData);
});

app.post("/verifyOTP", async function (request, response) {
  const { otp } = await request.body;
  const genratedOtp = await client
    .db("TaskSubmissionPortal")
    .collection("verifyEmail")
    .findOne({ otp: otp });
  if (genratedOtp) {
    response.status(200).send({ message: "Sign in page" });
  } else {
    response.status(400).send({ message: "check the otp" });
  }
});

app.get("/studentsdetails", async function (request, response) {
  const signUpDetails = await client
    .db("TaskSubmissionPortal")
    .collection("Student Details")
    .find({})
    .toArray();
  response.send(signUpDetails);
});

async function generateHashedPassword(password) {
  const NO_OF_ROUNDS = 10;
  const salt = await bcrypt.genSalt(NO_OF_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, salt);
  // console.log(salt);
  // console.log(hashedPassword);
  return hashedPassword;
}
app.post("/logindetails", async function (request, response) {
  const { name, email, password } = request.body;
  const userDB = await client
    .db("TaskSubmissionPortal")
    .collection("Login Details")
    .findOne({ email: email });

  const signUpDB = await client
    .db("TaskSubmissionPortal")
    .collection("Signup Details")
    .findOne({ email: email });
  if (userDB) {
    response.status(400).send({ message: "invalid credentials" });
  } else if (signUpDB) {
    const hashedPassword = await generateHashedPassword(password);
    const logInDetails = await client
      .db("TaskSubmissionPortal")
      .collection("Login Details")
      .insertOne({
        name: name,
        email: email,
        password: hashedPassword,
      });
    const deleteSignUpData = await client
      .db("TaskSubmissionPortal")
      .collection("Signup Details")
      .deleteMany({ email: email });
    const studentDetails = await client
      .db("TaskSubmissionPortal")
      .collection("Student Details")
      .insertOne({
        name: name,
        email: email,
      });
    response.status(200).send(logInDetails);
  } else {
    response.status(400).send({ message: "invalid credentials" });
  }
});

app.post("/login", async function (request, response) {
  const { email, password } = await request.body;
  const userInDB = await client
    .db("TaskSubmissionPortal")
    .collection("Login Details")
    .findOne({
      email: email,
    });
  if (userInDB) {
    const storedPassword = userInDB.password;
    const checkPassword = await bcrypt.compare(password, storedPassword);
    if (checkPassword == true) {
      const token = jwt.sign({ id: userInDB.email }, process.env.STUDENT_TOKEN);
      const decodeToken = jwt.decode(token);

      response.status(200).send({
        message: "Logged in Successfully",
        token: token,
        email: decodeToken,
      });
    } else {
      response.status(401).send({ message: "Wrong Password" });
    }
  } else {
    response.status(400).send({ massage: "Invalid credentials" });
  }
});



app.get("/studentdetails/:email", async function (request, response) {
  const { email } = request.params;
  const result = await client
    .db("TaskSubmissionPortal")
    .collection("Student Details")
    .findOne({ email: email });

  response.send(result);
});

app.post("/studentdetails/:email/:task", async function (request, response) {
  const { email, task } = request.params;
  const { github, frontend, backend } = request.body;
  const taskInDB = await client.db("TaskSubmissionPortal").collection(`Task-${email}`).findOne({taskname:task})
  if(taskInDB){
    response.status(401).send({message:"Already submitted"})
  }else{
    const result = await client
    .db("TaskSubmissionPortal")
    .collection(`Task-${email}`)
    .insertOne({
      taskname: task,
      github: github,
      frontend: frontend,
      backend: backend,
    });
    response.send(result)
  }
 
});

app.get("/studentdetails/:email/task", async function (request, response) {
const {email} = request.params;
  const result = await client
    .db("TaskSubmissionPortal")
    .collection(`Task-${email}`)
    .find({}).toArray();
    response.send(result)
});
app.listen(PORT, () => console.log(`The server started in: ${PORT} ✨✨`));
