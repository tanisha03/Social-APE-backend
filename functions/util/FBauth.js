const {admin, db} = require('./admin')
module.exports =(req,res,next)=>{
    let idToken;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')){
        idToken=req.headers.authorization.split('Bearer ')[1];
    }
    else{
        console.error('No token found')
        return res.status(403).json({error: 'Unauthorized'})
    }

    admin.auth().verifyIdToken(idToken)
    .then(decodedtoken=>{
        req.user =decodedtoken;
        return db.collection('users')
        .where('userId','==', req.user.uid)
        .limit(1)
        .get();
    })
    .then(data=>{
        req.user.user=data.docs[0].data().user;
        req.user.imageUrl= data.docs[0].data().imageUrl
        return next();
    })
    .catch(err=>{
        console.log('Error while verifying token', err);
        return res.status(403).json(err);
    })
}
