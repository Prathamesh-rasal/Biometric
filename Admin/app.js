require("dotenv").config();

const express = require('express')
const app = express()
const mongoose = require('mongoose');

const path = require('path')
const ejsMate = require('ejs-mate')
const methodOverride = require("method-override")
const ExpressError = require('./utils/ExpressErrors.js')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const flash = require('connect-flash');
const passport = require('passport')
const LocalStrategy = require('passport-local')
// const wrapAsync = require('./utils/wrapAsync.js')
// const { isLoggedIn , isOwner} = require("./middlewares.js");

const User = require("./models/user");
const Admin = require("./models/admin");
const bcrypt = require("bcrypt");
const { env } = require("process");



app.set('view engine','ejs')
app.set("query parser","extended");
app.set('views',path.join(__dirname,'views'))
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname,'/public')))
app.use(express.urlencoded({extended : true}))
app.use(methodOverride("_method"))
app.use(express.static("public"));
const dbUrl = process.env.MONGO_URI ;

const url = process.env.MONGO_URI;

async function main() {
    await mongoose.connect(url);
    console.log("Connected to Database");
}

main().catch((err) => {
    console.error("MongoDB connection error:", err);
});


const sessionOptions = {
    secret : "ugygjuhykj",
    resave: false,
    saveUninitialized: true,
    cookie : {
        expires : Date.now() + 7 * 24 *60 * 60 * 1000,
        maxAge : 7 * 24 * 60 * 60 * 1000,
        HttpOnly : true
    },
}

app.use(session(sessionOptions))
app.use(flash())
app.use(passport.initialize())
app.use(passport.session())
// passport.use(new LocalStrategy(User.authenticate()))
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

app.use(express.urlencoded({
    extended: true,
    limit: "10mb"
}));

app.use(express.json({
    limit: "10mb"
}));


app.use((req,res,next)=>{
    res.locals.success = req.flash('success')
    res.locals.error = req.flash('error')
    res.locals.adminId = req.session.adminId || null;
    next()
})


app.post("/addUser", async (req, res) => {
    try {
        const {
            username,
            department,
            email,
            contact_number,
            password,
            face_features,
            face_image,
            start_working_time,
            end_working_time
        } = req.body;

        if (!face_features) {
            return res.status(400).send(
                "Please capture your face first."
            );
        }

        const features = JSON.parse(face_features);

        if (
            !Array.isArray(features) ||
            features.length !== 128 ||
            !features.every(
                value => Number.isFinite(value)
            )
        ) {
            return res.status(400).send(
                "Invalid face features."
            );
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).send(
                "Email is already registered."
            );
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = new User({
            username,
            department,
            email,
            contact_number,
            password: hashedPassword,
            face_features: features,
            face_image: face_image || null,
            start_working_time,
            end_working_time
        });

        await newUser.save();
        req.flash("success","User saved successfully!")
        res.redirect("/addUser");
    } catch (error) {
        console.error("Add user error:", error);
        res.status(500).send(
            "Failed to save user. Check server terminal."
        );
    }
});

app.get('/addUser', (req, res) => {
    try {
        if (!req.session.adminId) {
            req.flash("error","Please Signup/login first!")
            return res.redirect("/signup");
        } else{
            res.render("menu/add_user.ejs")
        }
    }
    catch(err){
        console.log(err)
    }
  
})

app.get('/home',(req,res)=>{
    try {
        if (!req.session.adminId) {
            req.flash("error","Please Signup/login first!")
            return res.redirect("/signup");
        } else{
        res.render("menu/home.ejs")
        }
    }
    catch(err){
        console.log(err)
    }
})

app.post('/signup', async (req, res) => {
    try{
        let { username, contact, password } = req.body;
        const existingName = await Admin.findOne({username: username.trim()});
        const existingContact = await Admin.findOne({contact: contact.trim()});
        if (existingName || existingContact) {
            req.flash("error","Admin already exists with this name or contact number!")
            return res.redirect("/signup");
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const newAdmin = new Admin({
            username: username.trim(),
            contact: contact.trim(),
            password: hashedPassword
        })
        await newAdmin.save();
        req.session.adminId = newAdmin._id.toString();
        res.redirect("/home");

    }
    catch(err){
        console.log(err)
    }
    
})

app.get('/logout',(req,res)=>{
    req.session.adminId = null;
    req.flash("success","Logged out successfully!")
    res.redirect("/login");
})

app.get('/about',(req,res)=>{
    try {
        if (!req.session.adminId) {
            req.flash("error","Please Signup/login first!")
            return res.redirect("/signup");
        } else{
        res.render("menu/about.ejs")
        }
    }
    catch(err){
        console.log(err)
    }
})

app.get('/setLocation',(req,res)=>{
    try {
        if (!req.session.adminId) {
            req.flash("error","Please Signup/login first!")
            return res.redirect("/signup");
        } else{
        res.render("menu/setLocation.ejs")
        }
    }
    catch(err){
        console.log(err)
    }
})

app.get('/signup', (req, res) => {
    res.render("users/signup.ejs")
})

app.post('/login', async (req, res) => {
    try{
        let { contact, password } = req.body;

        const checkContact = await Admin.findOne({contact: contact.trim()});
        if (!checkContact) {
            req.flash("error", "Invalid contact number!");
            return res.redirect("/login");
        }

        const checkPassword = await bcrypt.compare(password,checkContact.password);

        if (!checkPassword) {
            req.flash("error", "Invalid password!");
            return res.redirect("/login");
        }

        req.session.adminId = checkContact._id.toString();
        res.redirect("/home");
    }
    catch(err){
        console.log(err)
    }
})

app.get('/login', (req, res) => {
    res.render("users/login.ejs")
})

app.get("/", async(req, res) => {
    try {
        if (!req.session.adminId) {
            req.flash("error","Please Signup/login first!")
            return res.redirect("/signup");
        } 
        res.render("menu/home.ejs")

    }
    catch(err){
        console.log(err)
    }
    
})

app.listen(3000, () => {
  console.log(`app listening on port 3000`)
})