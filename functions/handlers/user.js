const {db, admin} =require('../util/admin')
const config =require('../util/config')
const firebase=require('firebase')
firebase.initializeApp(config)

const {validateSignupData, validateLoginData, reduceUserDetails} = require('../util/validators')

exports.signup = (req,res)=>{
    const newUser={
        email:req.body.email,
        password:req.body.password,
        confirmPassword:req.body.confirmPassword,
        handle:req.body.handle,
    };

    const {valid,errors} = validateSignupData(newUser);
    if(!valid) return res.status(400).json(errors);

    const noImg='no-image.png'
    let token;
    let userId;
    db.doc(`/users/${newUser.handle}`).get()
    .then(doc=>{
        if(doc.exists){
            return res.status(400).json({handle : 'this handle is already taken'})
        }
        else{
          return firebase.auth().createUserWithEmailAndPassword(newUser.email,newUser.password)
        }
    })
    .then(data=>{
        userId = data.user.uid;
        return data.user.getIdToken()
    })
    .then(Idtoken=>{
        token=Idtoken;
        const userCredentials={
            user: newUser.handle,
            email: newUser.email,
            createdAt: new Date().toISOString(),
            imageUrl:`https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
            userId:userId
        };
        return db.doc(`/users/${newUser.handle}`).set(userCredentials)
    })
    .then(()=>{
        return res.status(201).json({token})
    })
    .catch(err=>{
        if(err.code === 'auth/email-already-in-use'){
            return res.status(400).json({email: 'Email already in use'})
        }
        else{
            console.log(err)
            return res.status(500).json({error: 'Something went wrong, please try again'})
        }
    })
}

exports.login = (req,res)=>{
    const user ={
        email: req.body.email,
        password: req.body.password
    };
    const {valid,errors} = validateLoginData(user);
    if(!valid) return res.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(user.email,user.password)
    .then(data=>{
        return data.user.getIdToken();
    })
    .then(token=>{
        return res.json({token});
    })
    .catch(err=>{
        console.log(err)
        if(err.code === 'auth/wrong-password'){
            return res.status(403).json({general:'wrong credentials, try again'})
        }
        else{
            return res.status(500).json({error: err.code})
        }
    })
}

exports.addUserDetails = (req,res) =>{
    let userDetails = reduceUserDetails(req.body);
    db.doc(`/users/${req.user.user}`).update(userDetails)
    .then(()=>{
        return res.json({message: 'Details added successfully'})
    })
    .catch((err)=>{
        return res.status(500).json({error: err})
    })
}

exports.getUserDetails = (req,res) =>{
    let userData={}
    db.doc(`/users/${req.params.handle}`).get()
    .then(doc=>{
        if(doc.exists){
            userData.user = doc.data()
            return db.collection('screams').where('user', '==' , req.params.handle)
            .orderBy('time' , 'desc')
            .get()
        }
        else{
            return res.status(404).json({error: 'User not found'})
        }
    })
    .then(data=>{
        userData.screams=[];
        data.forEach(doc=>{
            userData.screams.push({
                body:doc.data().body,
                time:doc.data().time,
                user:doc.data().user,
                imageUrl:doc.data().imageUrl,
                likeCount:doc.data().likeCount,
                commentCount:doc.data().commentCount,
                screamId:doc.id
            })
        })
        return res.json(userData)
    })
    .catch(err=>{
        return res.status(500).json({error: err})
    })
}

exports.getAuthenticatedUser = (req,res) =>{
    let userData={};
    db.doc(`/users/${req.user.user}`).get()
    .then(doc=>{
        if(doc.exists){
            userData.credentials = doc.data();
            return db.collection('likes').where('userHandle', '==', req.user.user).get()
        }
    })
    .then(data =>{
        userData.likes=[];
        data.forEach(doc=>{
            userData.likes.push(doc.data())
        })
        return db.collection('notifications').where('recipient', '==', req.user.user)
        .orderBy('createdAt', 'desc').limit(10).get()
    })
    .then(data=>{
        userData.notifications=[];
        data.forEach(doc=>{
            userData.notifications.push({
                recipient: doc.data().recipient,
                sender: doc.data().sender,
                time: doc.data().createdAt,
                screamId: doc.data().screamId,
                type: doc.data().type,
                read:doc.data().read,
                notificationId: doc.id
            })
        })
        return res.json(userData)
    })
    .catch(err=>{
        console.log(err)
        return res.status(500).json({error : err.code})
    })
}

exports.uploadImage = (req, res) => {
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
  
    const busboy = new BusBoy({ headers: req.headers });
  
    let imageToBeUploaded = {};
    let imageFileName;
  
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      console.log(fieldname, file, filename, encoding, mimetype);
      if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
        return res.status(400).json({ error: 'Wrong file type submitted' });
      }
      // my.image.png => ['my', 'image', 'png']
      const imageExtension = filename.split('.')[filename.split('.').length - 1];
      // 32756238461724837.png
      imageFileName = `${Math.round(
        Math.random() * 1000000000000
      ).toString()}.${imageExtension}`;
      const filepath = path.join(os.tmpdir(), imageFileName);
      imageToBeUploaded = { filepath, mimetype };
      file.pipe(fs.createWriteStream(filepath));
    });
    busboy.on('finish', () => {
      admin
        .storage()
        .bucket()
        .upload(imageToBeUploaded.filepath, {
          resumable: false,
          metadata: {
            metadata: {
              contentType: imageToBeUploaded.mimetype
            }
          }
        })
        .then(() => {
          const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${
            config.storageBucket
          }/o/${imageFileName}?alt=media`;
          return db.doc(`/users/${req.user.user}`).update({ imageUrl });
        })
        .then(() => {
          return res.json({ message: 'image uploaded successfully' });
        })
        .catch((err) => {
          console.error(err);
          return res.status(500).json({ error: 'something went wrong' });
        });
    });
    busboy.end(req.rawBody);
  };


exports.markNotificationsRead = (req,res)=>{
      let batch= db.batch();
      req.body.forEach(notification =>{
          const noti = db.doc(`/notifications/${notification}`)
          batch.update(noti, {read: true})
      })
      batch.commit()
      .then(()=>{
          return res.json({message: 'Notification marked read'})
      })
      .catch(err=>{
          return res.status(500).json({error: err})
      })
  }