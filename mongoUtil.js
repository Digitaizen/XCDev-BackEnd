const MongoClient = require("mongodb").MongoClient;
const url = "mongodb://localhost:27017";
const dbName = "root";

var _db;

module.exports = {
  connectToServer: function () {
    return new Promise((resolve, reject) => {
      MongoClient.connect(
        url,
        { useUnifiedTopology: true, poolSize: 10 },
        function (err, client) {
          if (err) {
            reject({ success: false, message: err });
          } else {
            _db = client.db(dbName);
            resolve({ success: true, message: "Successfully connected to db" });
          }
        }
      );
    });
  },

  getDb: function () {
    return _db;
  },
};
