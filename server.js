// Backend logic that connects to database and provides
// the API for the frontend

"use strict";

// Pull-in required modules ///////////////////////////////////////////////////
const fs = require("fs");
const express = require("express");
const passport = require("passport");
const bodyParser = require("body-parser");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const keys = require("./config/keys");
const cors = require("cors");
const morganBody = require("morgan-body");

const serverRouter = require("./api/serverRoutes");
const loginRouter = require("./api/loginRoutes");
const bmrRouter = require("./api/bmrRoutes");
const inventoryRouter = require("./api/inventoryRoutes");
const mongoUtil = require("./mongoUtil");

// Declare the globals ////////////////////////////////////////////////////////
const dbName = "dev";
const dbColl_Users = "users";
const portNum = 8080;
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://100.80.149.19",
    "http://100.80.150.91",
  ],
};

// Launch the server ////////////////////////////////////////////////////////////
mongoUtil
  .connectToServer()
  .then((response) => {
    if (response.success) {
      const _db = mongoUtil.getDb();

      // Launch the server //////////////////////////////////////////////////////////
      console.log("Launching the backend server..");

      // Instantiate
      const app = express();
      app.use(cors(corsOptions));

      console.log(`Connected to ${dbName}`);

      // Defining the directory where express will serve the website
      app.use(express.static("public"));

      // Start the server
      app.listen(portNum, () => {
        console.log(`Server started on port ${portNum}`);
      });

      // Default reply for home page
      app.get("/", (req, res) => {
        res.sendFile(__dirname + "/index.html");
      });

      // Define opts for strategy
      const opts = {};
      opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
      opts.secretOrKey = keys.secretOrKey;

      // Define strategy for passport instance
      passport.use(
        new JwtStrategy(opts, (jwt_payload, done) => {
          _db
            .collection(dbColl_Users)
            .findOne({ _id: jwt_payload.id })
            .then((user) => {
              if (user) {
                return done(null, user);
              }
              return done(null, false);
            })
            .catch((err) => console.log(err));
        })
      );

      // Initialize passport instance
      app.use(passport.initialize());

      // Allow parsing of res.body
      app.use(
        bodyParser.urlencoded({
          extended: true,
        })
      );

      app.use(bodyParser.json());

      // Log API responses to access.log
      var accessLogStream = fs.createWriteStream(__dirname + "/access.log", {
        flags: "a",
      });
      morganBody(app, { stream: accessLogStream, noColors: true });

      // Use API routes
      app.use(serverRouter);
      app.use(loginRouter);
      app.use(bmrRouter);
      app.use(inventoryRouter);

      return;
    }
    throw new Error();
  })
  .catch((error) => {
    console.log("Db connection failed with error: ", error.message);
  });
