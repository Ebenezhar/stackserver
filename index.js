const express = require('express');
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
const app = express();
const cors = require('cors');
const bcryptjs = require('bcryptjs');
app.use(express.json());
app.use(cors({ orgin: '*' }))
const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
const dotenv = require('dotenv').config();
const URL = process.env.DB;
const jwt = require('jsonwebtoken');
const EmailSyntax = require('email-syntax').EmailSyntax;
const rn = require('random-number');
const options = {
    min: 1000,
    max: 9999,
    integer: true
}
const nodemailer = require("nodemailer");

//1 Authenticate
let authenticate = function (req, res, next) {
    if (req.headers.authorization) {
        const verify = jwt.verify(req.headers.authorization, "process.env.SECRET_KEY");
        if (verify) {
            req.userid = verify._id;
            req.name = verify.name;
            next();
        } else {
            res.status(401).json({ message: 'Unauthorized' })
        }
    } else {
        res.status(401).json({ message: 'Unauthorized' })
    }
}

//1 register
app.post('/register', async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        const salt = await bcryptjs.genSalt(10);
        const hash = await bcryptjs.hash(req.body.password1, salt);
        req.body.password1 = hash;
        delete req.body.password2;
        await db.collection('users').insertOne(req.body);
        await connection.close();
        res.json({ message: "User created registered successfully" })
    } catch (error) {
        console.log(error);
    }
})

//3 Login
app.post('/login', async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        const user = await db.collection('users').findOne({ username: req.body.username });
        if (user) {
            const match = await bcryptjs.compare(req.body.password, user.password1);
            if (match) {
                const token = jwt.sign({ _id: user._id, name: user.username }, "process.env.SECRET_KEY",);
                res.status(200).json({
                    message: 'Successfully Logged in',
                    token: token,
                    name: user.username
                })
            } else {
                res.json({ message: 'Password Incorrect' });
            }
        }
        else {
            res.json({ message: 'User not found' })
        }
    } catch (error) {
        console.log(error);
    }
})

//4 Ask Question
app.post('/Askquestion', authenticate, async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        req.body.userid = mongodb.ObjectId(req.userid)
        req.body.username = req.name;
        req.body.view = 0;
        const user = await db.collection('questions').insertOne(req.body);
        res.json({ message: "Question is created successfully" })

    } catch (error) {
        console.log(error);
    }
})

//5 get questions

app.get("/questions", async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        const questions = await db.collection('questions').find().toArray();
        await connection.close();
        res.status(200).json(questions);
    } catch (error) {
        console.log(error);
    }
})

//6 Add view
app.put('/increaseview/:id', authenticate, async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        delete req.body._id;
        await db.collection('questions').updateOne({ _id: mongodb.ObjectId(req.params.id) }, { $set: req.body });
        await connection.close();
        res.json({ message: "Successfully updated" })
    } catch (error) {
        console.log(error);
    }
})

//6 Post Answer
app.post('/postAnswer/:id', authenticate, async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        req.body.userid = mongodb.ObjectId(req.userid)
        req.body.username = req.name;
        req.body.votes = 0;
        req.body.quesid = mongodb.ObjectId(req.params.id);
        await db.collection('answers').insertOne(req.body);
        res.json({ message: "Answer updated successfully" })

    } catch (error) {
        console.log(error);
    }
})

//7 get Answers

app.get("/answers/:id", async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        const answers = await db.collection('answers').find({ quesid: mongodb.ObjectId(req.params.id) }).sort({ votes: -1 }).toArray();
        await connection.close();
        res.status(200).json(answers);
    } catch (error) {
        console.log(error);
    }
})

//8 Add Votes
app.put('/addvotes/:id', authenticate, async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        req.body.quesid = mongodb.ObjectId(req.body.quesid)
        delete req.body._id;
        await db.collection('answers')
            .updateOne({ _id: mongodb.ObjectId(req.params.id) }, { $set: req.body });
        await connection.close();
        res.json({ message: "Successfully Voted" })
    } catch (error) {
        console.log(error);
    }
})


//9 get question
app.get("/question/:id", async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        const question = await db.collection('questions').findOne({ _id: mongodb.ObjectId(req.params.id) });
        await connection.close();
        res.status(200).json(question);
    } catch (error) {
        console.log(error);
    }
})

//10 verification mail
app.post('/sendmail', async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        const user = await db.collection('users').findOne({ email: req.body.email });
        if (user) {
            let randomnum = rn(options);
            console.log("body", req.body.email);
            await db.collection('users').updateOne({ email: req.body.email }, { $set: { rnum: randomnum } });
            var transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: "ebenezharselvakumar@gmail.com", 
                    pass: "ipvpumhyvehscfff",
                }
            });

            var mailOptions = {
                from: 'ebenezharselvakumar@gmail.com',
                to: `${req.body.email}`, 
                subject: 'User verification',
                text: `${randomnum}`,
                //html: `<h2>Password : ${req.body.Password}</h2>`
            };

            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                    res.json({
                        message: "Error"
                    })
                } else {
                    console.log('Email sent: ' + info.response);
                    res.json({
                        message: "Email sent"
                    })
                }
            });
        }
        else {
            res.status(400).json({ message:'User not found' })
        }
    }
    catch (error) {
        console.log(error);
    }
})

//11 User Details
app.get("/userProfile", authenticate, async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        const userDet = await db.collection('users').findOne({ _id: mongodb.ObjectId(req.userid) });
        await connection.close();
        res.status(200).json(userDet);
    } catch (error) {
        console.log(error);
    }
})

//11 keyword search
app.get("/questions/:key", authenticate, async function (req, res) {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        const questions = await db.collection('questions').find({ topic: req.params.key }).toArray();
        await connection.close();
        res.status(200).json(questions);
    } catch (error) {
        console.log(error);
    }
})

//12 verify 

app.post("/verify", async (req, res) => {
    try {
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        const user = await db.collection('users').findOne({ email :req.body.email });
        await connection.close();
        if(user.rnum === req.body.vercode){
            res.status(200).json(user)
        }
        else{
            res.status(400).json({message:"Invalid Verification Code"})
        }
    } catch (error) {
        console.log(error);
    }
})


//13 update password
app.post('/changepassword/:id', async function (req, res) {
    try {
        console.log(req.params.id);
        const connection = await mongoClient.connect(URL);
        const db = connection.db('stackclone');
        const salt = await bcryptjs.genSalt(10);
        const hash = await bcryptjs.hash(req.body.password1, salt);
        req.body.password1 = hash;
        delete req.body.password2;
        await db.collection('users').updateOne({ email: req.params.id }, { $set: req.body });;
        await connection.close();
        res.json({ message: "Password updated successfully" })
    } catch (error) {
        console.log(error);
    }
})


app.listen(process.env.PORT || 3001)