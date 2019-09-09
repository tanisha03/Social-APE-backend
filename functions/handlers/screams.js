const {db} =require('../util/admin')
exports.getAllScreams =(req,res)=>{
    db.collection('screams')
    .orderBy('time','desc')
    .get()
    .then(data=>{
        let arr=[]
        data.forEach(doc=>{
            arr.push({
                id:doc.id,
                user:doc.data().user,
                body:doc.data().body,
                time:doc.data().time,
                commentCount:doc.data().commentCount,
                likeCount:doc.data().likeCount,
                userImage: doc.data().userImage
            })
        })
        return res.json(arr)
    })
    .catch(err=>console.log(err))
}

exports.postOneScream = (req,res)=>{
    const newScream ={
        body:req.body.body,
        user:req.user.user,
        time:new Date().toISOString(),
        userImage:req.user.imageUrl,
        likeCount:0,
        commentCount:0
    };
    db.collection('screams')
    .add(newScream)
    .then(doc=>{
        const resScream = newScream;
        resScream.screamId =doc.id;
        res.json(resScream);
    })
    .catch(err=>{
        console.log(err)
        res.status(500).json({error : 'something went wrong'})
    })
}

exports.getScream = (req,res)=>{
    let screamData={};
    db.doc(`/screams/${req.params.screamId}`).get()
    .then(doc=>{
        if(!doc.exists){
            return res.status(404).json({error: 'Scream not found'})
        }
        screamData= doc.data();
        screamData.screamId=doc.id;
        return db.collection('comments').where('screamId', '==', req.params.screamId).get()
    })
    .then(data=>{
        screamData.comments =[];
        data.forEach(doc=>{
            screamData.comments.push(doc.data())
        })
        return res.json(screamData);
    })
    .catch(err=>{
        console.error(err)
        res.status(500).json({error: err.code})
    })
}

exports.CommentOnScream =(req,res)=>{
    if(req.body.body.trim() === '') return res.status(400).json({error : 'Empty commemt'})

    const newComment={
        body: req.body.body,
        time: new Date().toISOString(),
        screamId: req.params.screamId,
        user: req.user.user,
        userImage:req.user.imageUrl
    }

    db.doc(`/screams/${req.params.screamId}`).get()
    .then(doc=>{
        if(!doc.exists){
            return res.status(404).json({error: 'Scream not found'})
        }
        return doc.ref.update({commentCount : doc.data().commentCount+1})
    })
    .then(()=>{
        return db.collection('comments').add(newComment)
    })
    .then(()=>{
        res.json(newComment)
    })
    .catch(err=>{
        console.log(err)
        res.status(500).json({error: 'Something went wrong'})
    })
}

exports.likeScream  = (req,res) =>{
    const likeDocument = db.collection('likes').where('user', '==', req.user.user)
    .where('screamId', '==', req.params.screamId).limit(1);

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData;
    screamDocument.get()
    .then(doc=>{
        if(doc.exists){
            screamData=doc.data();
            screamData.screamId= doc.id;
            return likeDocument.get();
        }
        else{
            return res.status(404).json({error: 'Document not found'})
        }
    })
    .then(data=>{
        if(data.empty){
            return db.collection('likes').add({
                screamId: req.params.screamId,
                user:req.user.user
            })
            .then(()=>{
                screamData.likeCount++
                return screamDocument.update({likeCount: screamData.likeCount})
            })
            .then(()=>{
                 return res.json(screamData);
            })
        }else{
            return res.status(400).json({error: 'scream already liked'})
        }
    })
    .catch(err=>{
        return res.status(500).json({error: err})
    })
}

exports.unlikeScream = (req,res) =>{
    const likeDocument = db.collection('likes').where('user', '==', req.user.user)
    .where('screamId', '==', req.params.screamId).limit(1);

    const screamDocument = db.doc(`/screams/${req.params.screamId}`);

    let screamData;
    screamDocument.get()
    .then(doc=>{
        if(doc.exists){
            screamData=doc.data();
            screamData.screamId= doc.id;
            return likeDocument.get();
        }
        else{
            return res.status(404).json({error: 'Document not found'})
        }
    })
    .then(data=>{
        if(data.empty){
            return res.status(400).json({error: 'scream not liked'})
        }
            else{
                return db.collection('likes').doc(`${data.docs[0].id}`).delete()
                .then(()=>{
                    screamData.likeCount--;
                    return screamDocument.update({likeCount: screamData.likeCount})
                })
                .then(()=>{
                    res.json(screamData)
                })
            }        
    })
    .catch(err=>{
        return res.status(50.0).json({error: err})
    })
}

exports.deleteScream = (req,res) =>{
    const document = db.doc(`/screams/${req.params.screamId}`)
    document.get()
    .then((doc)=>{
        if(!doc.exists){
            return res.status(404).json({error: 'Scream not found'})
        }
        if(doc.data().userhandle !== req.user.handle){
            return res.status(403).json({error: 'Unauthorized'})
        }
        else{
            return document.delete();
        }
    })
    .then(()=>{
        res.json({message: 'Scream deleted successfully'})
    })
    .catch(err=>{
        return res.status(500).json({error: err})
    })
}