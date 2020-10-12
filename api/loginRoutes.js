// Imports
const express = require("express");
const router = express.Router();
const mongoUtil = require("../mongoUtil");
const jwt = require("jsonwebtoken");
const keys = require("../config/keys");
const isEmpty = require("is-empty");
const Validator = require("validator");

// Global variables
const dbColl_Users = "users";

/**
 * Determines if username and password fields contain valid/non-empty input
 *
 * @param {JSON} data JSON object containing login info submitted by user
 */
function validateLoginInput(data) {
  let errors = {};

  // Convert empty fields to an empty string so we can use validator functions
  data.username = !isEmpty(data.username) ? data.username : "";
  data.password = !isEmpty(data.password) ? data.password : "";

  // Username checks
  if (Validator.isEmpty(data.username)) {
    errors.message = "Username field is required";
  }

  // Password checks
  if (Validator.isEmpty(data.password)) {
    errors.message = "Password field is required";
  }

  return {
    errors,
    isValid: isEmpty(errors),
  };
}

/**
 * Determines if registration fields contain valid/non-empty input
 *
 * @param {JSON} data JSON object containing registration info submitted by user
 */
function validateRegisterInput(data) {
  let errors = {};

  // Convert empty fields to an empty string so we can use validator functions
  data.name = !isEmpty(data.name) ? data.name : "";
  data.email = !isEmpty(data.email) ? data.email : "";
  data.username = !isEmpty(data.username) ? data.username : "";
  data.password = !isEmpty(data.password) ? data.password : "";

  // Name checks
  if (Validator.isEmpty(data.name)) {
    errors.message = "Name field is required";
  }

  // Email checks
  if (Validator.isEmpty(data.email)) {
    errors.message = "Email field is required";
  } else if (!Validator.isEmail(data.email)) {
    errors.message = "Email is invalid";
  }

  // Username checks
  if (Validator.isEmpty(data.username)) {
    errors.message = "Username field is required";
  }

  // Password checks
  if (Validator.isEmpty(data.password)) {
    errors.message = "Password field is required";
  }

  if (!Validator.isLength(data.password, { min: 6, max: 30 })) {
    errors.message = "Password must be at least 6 characters";
  }

  return {
    errors,
    isValid: isEmpty(errors),
  };
}

// Accept valid login credentials and return a JSON web token
router.post("/login", (req, res) => {
  // Form validation
  const { errors, isValid } = validateLoginInput(req.body);

  // Check validation
  if (!isValid) {
    return res.status(400).json(Object.assign({ success: false }, errors));
  }

  let _db = mongoUtil.getDb();

  // If user exists and password is correct, return a success token
  _db
    .collection(dbColl_Users)
    .findOne({
      username: {
        $regex: new RegExp("^" + req.body.username.toLowerCase() + "$", "i"),
      },
    })
    .then((user) => {
      // Check if user exists
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Username not found",
        });
      }

      // Check password

      if (req.body.password == user.password) {
        // User matched
        // Create JWT Payload
        const payload = {
          id: user.id,
          name: user.name,
        };

        // Sign token
        jwt.sign(
          payload,
          keys.secretOrKey,
          {
            expiresIn: 31556926, // 1 year in seconds
          },
          (err, token) => {
            res.json({
              success: true,
              message: "Login is successful",
              token: "Bearer " + token,
              userInfo: user,
            });
          }
        );
      } else {
        return res
          .status(400)
          .json({ success: false, message: "Password incorrect" });
      }
    });
});

// Add new user credentials to users collection and return credentials as JSON
router.post("/register", async (req, res) => {
  // Form validation
  const { errors, isValid } = validateRegisterInput(req.body);

  // Check validation
  if (!isValid) {
    return res.status(400).json(Object.assign({ success: false }, errors));
  }

  let _db = mongoUtil.getDb();

  try {
    // Check if email is already in use; if not, create new user record in collection
    _db
      .collection(dbColl_Users)
      .findOne({
        email: {
          $regex: new RegExp("^" + req.body.email.toLowerCase() + "$", "i"),
        },
      })
      .then((user) => {
        if (user) {
          return res
            .status(400)
            .json({ success: false, message: "Email already exists" });
        } else {
          _db
            .collection(dbColl_Users)
            .insertOne(
              {
                name: req.body.name,
                email: req.body.email,
                username: req.body.username,
                password: req.body.password,
              },
              { checkKeys: false }
            )
            .then((user) =>
              res.json(
                Object.assign(
                  {
                    success: true,
                    message: "Registration is successful",
                  },
                  user.ops[0]
                )
              )
            )
            .catch((err) => console.log(err));
          console.log("You're registered! Now login");
        }
      });
  } catch {
    console.log("There was an error while registering");
  }
});

// Reset password of user with specified password-reset token
router.post("/reset", async (req, res) => {
  let _db = mongoUtil.getDb();

  _db
    .collection(dbColl_Users)
    .findOne({ username: req.body.username })
    .then((user) => {
      // Check if user exists
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "Username not found" });
      }

      // Check if password is long enough
      if (!Validator.isLength(req.body.password, { min: 6, max: 30 })) {
        return res.status(404).json({
          success: false,
          message: "Password must be at least 6 characters",
        });
      }

      // Check if passwords match
      if (!Validator.equals(req.body.password, req.body.password2)) {
        return res
          .status(404)
          .json({ success: false, message: "Passwords must match" });
      }

      // Update user record with new password
      _db.collection(dbColl_Users).updateOne(
        { username: req.body.username },
        {
          $set: {
            password: req.body.password,
          },
        },
        function (err, results) {
          if (err) {
            res.status(500).json(Object.assign({ success: false }, err));
          } else {
            res.status(200).json(
              Object.assign(
                {
                  success: true,
                  message: "Password successfully reset",
                },
                results
              )
            );
          }
        }
      );
    });
});

module.exports = router;
