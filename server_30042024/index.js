// *******************************************************************************

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
mongoose.set("strictQuery", false);
require("dotenv").config();
const cookieParser = require("cookie-parser");
const cors = require("cors");

const jwt = require("jsonwebtoken"); // Add the jwt package

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000", // Change port number if necessary
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Connect to your MongoDB database
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

// Create a connection to the GridFS stream
const conn = mongoose.connection;
// Create a schema for the leave application data
const leaveApplicationSchema = new mongoose.Schema({
  startingDate: String,
  endingDate: String,
  modeOfLeave: String,
  daysCount: String,
  responsibility: String,
  workResponsibility: String,
  workAlteration: String,
  file: {
    fileId: mongoose.Types.ObjectId,
    filename: String,
  },
});

//Create new user fro admin to the api in the program\
// Create a user schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  company: String,
  emp_id: String,
  designation: String,
  date_of_joining: String,
});
// Create a user model
const User = mongoose.model("User", userSchema);
// Handle the registration endpoint
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, role, company, emp_id, designation, date_of_joining } = req.body;
    console.log(email, password, role, company);
    // Check if the email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Hash the password using MD5
    const hashedPassword = crypto.createHash("md5").update(password).digest("hex");

    // Create a new user with the hashed password
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      company,
      emp_id,
      designation,
      date_of_joining,
    });
    await newUser.save();
    res.json({ message: "Registration successful" });
  } catch (error) {
    res.status(500).json({ message: "An error occurred" });
  }
});
// to fetch the data from frontend use for /api/employeedata/
app.get("/api/employeedata", async (req, res) => {
  try {
    const users = await User.find({});
    res.json({ status: "ok", data: users });

    // console.log(users);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching employee data",
    });
  }
});
//Backend API route for updating data:
// PUT /api/employeedata/:id
app.put("/api/employeedata/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the employee data exists
    const employee = await User.findById(id);
    if (!employee) {
      return res.status(404).json({ message: "Employee data not found" });
    }
    // Update the employee data with the provided ID
    const { role, email, password } = req.body;
    employee.role = role;
    employee.email = email;
    employee.password = password;
    await employee.save();

    res.json({ message: "Employee data updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/employeedata/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the employee data exists
    const employee = await User.find({ _id: id }).select("-password");
    if (!employee) {
      return res.status(404).json({ message: "Employee data not found" });
    }
    res.json({ employee });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
//Backend API route for deleting data:
app.delete("/api/employeedata/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Check if the leave application exists
    const leaveApplication = await User.findById(id);
    if (!leaveApplication) {
      return res.status(404).json({ message: "Leave application not found" });
    }
    // Delete the leave application
    await User.findByIdAndDelete(id);
    res.json({ message: "Leave application deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
app.post("/api/login", async (req, res) => {
  // Retrieve email and password from the request body
  const { email, password } = req.body;
  // Check if email and password are provided
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  try {
    // Perform authentication logic (e.g., check against the database)
    const user = await User.findOne({ email });
    // Check if the user exists and if the passwords match
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    // Hash the provided password using MD5
    const hashedPassword = crypto.createHash("md5").update(password).digest("hex");
    // Compare the hashed password with the stored password
    if (hashedPassword !== user.password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    // Generate a token
    const token = jwt.sign({ email }, "secret_key", { expiresIn: "30d" });
    return res.status(200).json({ token, message: "Logged in Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
// Protected route example
app.get("/api/user", (req, res) => {
  // Verify the token in the Authorization header
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Verify the token
  jwt.verify(token, "secret_key", async (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid token" });
    }
    let decodedEmail = decoded.email;
    console.log(decodedEmail);
    try {
      const user = await User.findOne({ email: decodedEmail }).select("-password");
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      res.status(200).json({ data: user });
    } catch (error) {
      console.log(error);
    }
  });
});

//Middleware for token authentication
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (token == null) {
    return res.sendStatus(401); // Unauthorized
  }
  jwt.verify(token, process.env.SESSION_SECRET, (err, admin) => {
    if (err) {
      return res.sendStatus(403); // Forbidden
    }
    req.admin = admin;
    next();
  });
}

// Define a schema
const userInputSchema = new mongoose.Schema({
  startingDate: Date,
  endingDate: Date,
  daysCount: Number,
  modeOfLeave: String,
  file: String,
  responsibility: String,
  workResponsibility: String,
  workAlteration: Array,
  user_id: String,
  user_email: String,
  user_role: String,
  decision: String,
});

// Create a model based on the schema
const UserInput = mongoose.model("UserInput", userInputSchema);

// 3 step

const tlsOptions = {
  rejectUnauthorized: false, // Set to false to trust the self-signed certificate
};

// Set up Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "Gmail",
  secure: true,
  tls: tlsOptions, // Pass the TLS options

  auth: {
    user: process.env.FROM_EMAIL_ID, // Your email address
    pass: process.env.EMAIL_PASSWD, // Your email password
  },
});

// Route handler for the '/api/userinput' POST request
app.post("/api/userinput", (req, res) => {
  const {
    startingDate,
    endingDate,
    daysCount,
    modeOfLeave,
    file,
    responsibility,
    workResponsibility,
    workAlteration,
    user_id,
    user_email,
    user_role,
  } = req.body;

  // Create a new instance of the UserInput model
  const userInput = new UserInput({
    startingDate,
    endingDate,
    daysCount,
    modeOfLeave,
    file,
    responsibility,
    workResponsibility,
    workAlteration,
    user_id,
    user_email,
    user_role,
    decision: "Pending",
  });

  // Save the userInput to the database
  userInput
    .save()
    .then((item) => {
      // Send leave application email to admin
      const adminEmail = process.env.ADMIN_EMAIL; // Admin's email address
      const subject = "Leave Application";
      const html = `  <table style="border-collapse: collapse; width: 25%; background-color: #C9F6FF;">
      <tr>
          <th colspan="2" style="background-color: #f2f2f2; padding: 10px; animation-name: fade-in; animation-duration: 1s; animation-timing-function: linear; animation-iteration-count: infinite;">New Leave Application</th>
      </tr>
      <tr>
          <td style="border: 1px solid #ccc; padding: 10px;"><strong>Email:</strong></td>
          <td style="border: 1px solid #ccc; padding: 10px;">${user_email}</td>
      </tr>
      <tr>
          <td style="border: 1px solid #ccc; padding: 10px;"><strong>Starting Date:</strong></td>
          <td style="border: 1px solid #ccc; padding: 10px;">${startingDate}</td>
      </tr>
      <tr>
          <td style="border: 1px solid #ccc; padding: 10px;"><strong>Ending Date:</strong></td>
          <td style="border: 1px solid #ccc; padding: 10px;">${endingDate}</td>
      </tr>
      <tr>
          <td style="border: 1px solid #ccc; padding: 10px;"><strong>Days_Count:</strong></td>
          <td style="border: 1px solid #ccc; padding: 10px;">${daysCount}</td>
      </tr>
      <tr>
          <td style="border: 1px solid #ccc; padding: 10px;"><strong>ModeOfLeave:</strong></td>
          <td style="border: 1px solid #ccc; padding: 10px;">${modeOfLeave}</td>
      </tr>
      <tr>
          <td style="border: 1px solid #ccc; padding: 10px;"><strong>File:</strong></td>
          <td style="border: 1px solid #ccc; padding: 10px;">${file}</td>
      </tr>
      <tr>
          <td style="border: 1px solid #ccc; padding: 10px;"><strong>Responsibility:</strong></td>
          <td style="border: 1px solid #ccc; padding: 10px;">${responsibility}</td>
      </tr>
  
      <tr>
      <td style="border: 1px solid #ccc; padding: 10px;"><strong>WorkAlteration:</strong></td>
      <td style="border: 1px solid #ccc; padding: 10px;">${workAlteration}</td>
  </tr>
      <tr>
          <td style="border: 1px solid #ccc; padding: 10px;"><strong>User_role:</strong></td>
          <td style="border: 1px solid #ccc; padding: 10px;">${user_role}</td>
      </tr>
      <tr>
          <td colspan="2" style="text-align: center; padding: 10px; border-radius: 10px;">
              <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
                  <a href='${process.env.API_URL}/leave-response?response=accepted&email=${user_email}&id=${item._id}' style="display: inline-block; margin-right:16px; background-color: #83D475; color: black; padding: 10px; text-decoration: none; width: 100px; animation-name: scale-in; animation-duration: 0.5s; animation-timing-function: ease-in-out;">Accept</a>
                  <a href='${process.env.API_URL}/leave-response?response=rejected&email=${user_email}&id=${item._id}' style="display: inline-block; background-color: #f07470; color: white; padding: 10px; text-decoration: none; width: 100px; animation-name: slide-in; animation-duration: 0.5s; animation-timing-function: ease-in-out;">Reject</a>
              </div>
          </td>
      </tr>
  </table>`;

      // Send leave application email to admin
      const adminMailOptions = {
        from: `Leave Management System <${process.env.FROM_EMAIL_ID}>`, // Your email address
        to: adminEmail,
        subject: subject,
        html: html,
      };

      transporter.sendMail(adminMailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
          res.status(500).send("An error occurred while sending the email.");
        } else {
          console.log("Email sent:", info.response);
          res.json({ message: "User input saved successfully" });
        }
      });
    })
    .catch((error) => {
      console.error("Error saving user input:", error);
      res.status(500).json({ message: "Failed to save user input" });
    });
});

// Endpoint to handle leave application response
app.get("/leave-response", async (req, res) => {
  const { response, email, id } = req.query;

  const leaveApplication = await UserInput.findOne({ _id: id });

  const responseText = response === "accepted" ? "Accepted" : "Rejected";

  if (leaveApplication) {
    leaveApplication.decision = responseText;

    // Update the document
    const result = await leaveApplication.save();

    console.log("Document updated:", result);
  } else {
    console.log("Leave application not found");
  }

  const mailOptions = {
    from: `Leave Management System <${process.env.FROM_EMAIL_ID}>`, // Your email address
    to: email,
    subject: "Leave Application Status",
    html: `<h1>Your leave application has been ${responseText}</h1>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
      res.status(500).send("An error occurred while sending the email.");
    } else {
      console.log("Email sent:", info.response);
      res.send(`Leave application ${responseText}`);
    }
  });
});

app.get("/api/allleaveapplications", async (req, res) => {
  try {
    const allLeaveapplications = await UserInput.find({});
    res.json({ status: "ok", data: allLeaveapplications });
  } catch (error) {
    console.log(error);
  }
});

//to delate on thne particular table id to the node js api

app.delete("/api/allleaveapplications/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the leave application exists
    const leaveApplication = await UserInput.findById(id);
    if (!leaveApplication) {
      return res.status(404).json({ message: "Leave application not found" });
    }

    // Delete the leave application
    await UserInput.findByIdAndDelete(id);

    res.json({ message: "Leave application deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/employeeleaveapplications/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params; // Retrieve the user_id from req.params
    const allLeaveApplications = await UserInput.find({ user_id: user_id });
    res.json({ status: "ok", data: allLeaveApplications });
  } catch (error) {
    console.log(error);
    res.status(500).json({ status: "error", message: "Internal Server Error" });
  }
});

/* -----------------------------------------------------------*/

// // to get send the data in frontend

// // Start the server
app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});
