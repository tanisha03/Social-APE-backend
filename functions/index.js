const functions = require('firebase-functions');
const {db} = require('./util/admin')


const {getAllScreams,postOneScream, getScream, CommentOnScream, likeScream, unlikeScream, deleteScream}=require('./handlers/screams')
const user =require('./handlers/user')
const FBAuth = require('./util/FBauth')

const express = require('express');
const app = express();

const cors=require('cors')
app.use(cors())


app.get('/scream', getAllScreams)
app.post('/scream', FBAuth, postOneScream)
app.get('/scream/:screamId', getScream);
app.post('/scream/:screamId/comment', FBAuth, CommentOnScream)
app.get('/scream/:screamId/like', FBAuth, likeScream)
app.get('/scream/:screamId/unlike', FBAuth, unlikeScream)
app.delete('/scream/:screamId', FBAuth, deleteScream)


app.post('/signup', user.signup)
app.post('/login', user.login)
app.post('/user/image' , FBAuth, user.uploadImage)
app.post('/user', FBAuth, user.addUserDetails)
app.get('/user', FBAuth, user.getAuthenticatedUser)
app.get('/user/:handle', user.getUserDetails)
app.post('/notifications', FBAuth, user.markNotificationsRead)

exports.api = functions.https.onRequest(app);

exports.createNotificationOnLike = functions
  .firestore.document('likes/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().user !== snapshot.data().user
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().user,
            sender: snapshot.data().user,
            type: 'like',
            read: false,
            screamId: doc.id
          });
        }
      })
      .catch((err) => console.error(err));
  });
exports.deleteNotificationOnUnLike = functions
  .firestore.document('likes/{id}')
  .onDelete((snapshot) => { 
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  });
exports.createNotificationOnComment = functions
  .firestore.document('comments/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().user !== snapshot.data().user
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().user,
            sender: snapshot.data().user,
            type: 'comment',
            read: false,
            screamId: doc.id
          });
        }
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

  exports.onUserImageChange = functions
  .firestore.document('/users/{userId}')
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log('image has changed');
      const batch = db.batch();
      return db
        .collection('screams')
        .where('user', '==', change.before.data().user)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const scream = db.doc(`/screams/${doc.id}`);
            batch.update(scream, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onScreamDelete = functions
  .firestore.document('/screams/{screamId}')
  .onDelete((snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db
      .collection('comments')
      .where('screamId', '==', screamId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection('likes')
          .where('screamId', '==', screamId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection('notifications')
          .where('screamId', '==', screamId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });