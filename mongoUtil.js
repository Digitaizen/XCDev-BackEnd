const MongoClient = require("mongodb").MongoClient;
const url = "mongodb://localhost:27017";

var _db;

module.exports = {
  connectToServer: function(callback) {
    MongoClient.connect(url, { useUnifiedTopology: true }, function(
      err,
      client
    ) {
      console.log("Connected successfully to server");
      _db = client.db("nodeExpressMongo");

      return callback(err);
    });
  },

  getDb: function() {
    return _db;
  }
};
