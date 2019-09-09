var admin = require("firebase-admin");
var serviceAccount = require("./service.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://social-ape-53553.firebaseio.com",
  storageBucket: "social-ape-53553.appspot.com"
});
const db = admin.firestore();

module.exports ={admin,db}