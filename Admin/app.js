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


const User = require("./models/user");
const Admin = require("./models/admin");
const Attendance = require("./models/attendance");
const bcrypt = require("bcrypt");
const { env } = require("process");


const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");


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
            adminId: req.session.adminId,
            username,
            department,
            email,
            contact_number,
            password: hashedPassword,
            face_features: features,
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

app.post('/setLocation',async(req,res)=>{
    try{
        if (!req.session.adminId) {
            return res.redirect("/login");
        }
        let { latitude, longitude, radius } = req.body;
        latitude = Number(latitude);
        longitude = Number(longitude);
        radius = Number(radius);

        const admin = await Admin.findByIdAndUpdate(req.session.adminId,{
            $set: {
            "campusLocation.latitude": latitude,
            "campusLocation.longitude": longitude,
            "campusLocation.radius": radius
            }
        },
        { new: true, runValidators: true }
        );

        if (!admin) {
        return res.redirect("/login");
        }

        req.flash("success", "Location updated successfully!");
        res.redirect("/setLocation");
        }
    catch(err){
        console.log(err)
    }
})

app.get('/setLocation',async (req,res)=>{
    try {
        if (!req.session.adminId) {
            req.flash("error","Please Signup/login first!")
            return res.redirect("/signup");
        } else{
            const admin = await Admin.findById(req.session.adminId);
            if (!admin) {
                return res.redirect("/login");
            }
            
            res.render("menu/setLocation.ejs",{admin})
        }
    }
    catch(err){
        console.log(err)
    }
})

app.get('/home',async(req,res)=>{
    try {
        if (!req.session.adminId) {
            req.flash("error", "Please login as admin first");
            return res.redirect("/login");
        }

        const admin = await Admin.findById(req.session.adminId);

        if (!admin) {
            req.session.adminId = null;
            req.flash("error", "Admin not found. Please login again.");
            return res.redirect("/login");
        }

        const users = await User.find({
            adminId: admin._id
        }).sort({ username: 1 });

        const totalUsers = users.length;

        const today = new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata"
        });

        const records = await Attendance.find({
            userId: { $in: users.map(user => user._id) },
            date: today
        });

        const todayStatus = {};

        records.forEach(record => {
            todayStatus[String(record.userId)] = record.status;
        });

        let presentCount = 0;
        let absentCount = 0;
        let halfDayCount = 0;

        users.forEach(user => {
            const status = todayStatus[String(user._id)] || "Absent";

            if (status === "Present" || status === "Late") {
                presentCount++;
            } else if (status === "Half-Day") {
                halfDayCount++;
            } else {
                absentCount++;
            }
        });

        res.render("menu/home.ejs", {
            admin,
            users,
            totalUsers: users.length,
            todayStatus,
            presentCount,
            absentCount,
            halfDayCount
        });

    } catch (error) {
        console.error("Admin dashboard error:", error);
        return res.status(500).send("Unable to load admin dashboard");
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
            req.flash("error", "Please login as admin first");
            return res.redirect("/login");
        }

        const admin = await Admin.findById(req.session.adminId);

        if (!admin) {
            req.session.adminId = null;
            req.flash("error", "Admin not found. Please login again.");
            return res.redirect("/login");
        }

        const users = await User.find({
            adminId: admin._id
        }).sort({ username: 1 });

        const totalUsers = users.length;

        const today = new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata"
        });

        const records = await Attendance.find({
            userId: { $in: users.map(user => user._id) },
            date: today
        });

        const todayStatus = {};

        records.forEach(record => {
            todayStatus[String(record.userId)] = record.status;
        });

        let presentCount = 0;
        let absentCount = 0;
        let halfDayCount = 0;

        users.forEach(user => {
            const status = todayStatus[String(user._id)] || "Absent";

            if (status === "Present" || status === "Late") {
                presentCount++;
            } else if (status === "Half-Day") {
                halfDayCount++;
            } else {
                absentCount++;
            }
        });

        res.render("menu/home.ejs", {
            admin,
            users,
            totalUsers: users.length,
            todayStatus,
            presentCount,
            absentCount,
            halfDayCount
        });

    } catch (error) {
        console.error("Admin dashboard error:", error);
        return res.status(500).send("Unable to load admin dashboard");
    }
})



/* ADMIN: Download one user's Excel attendance history */
app.get("/admin/users/:userId/attendance.xlsx", async (req, res) => {
    try {
        if (!req.session.adminId) {
            return res.redirect("/login");
        }

        const user = await User.findOne({
            _id: req.params.userId,
            adminId: req.session.adminId
        });

        if (!user) {
            return res.status(404).send("User not found");
        }

        const records = await Attendance.find({
            userId: user._id
        }).sort({ date: -1 });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Attendance History");

        sheet.columns = [
            { header: "Date", key: "date", width: 16 },
            { header: "Check In", key: "checkIn", width: 16 },
            { header: "Check Out", key: "checkOut", width: 16 },
            { header: "Working Minutes", key: "workingMinutes", width: 20 },
            { header: "Status", key: "status", width: 16 }
        ];

        records.forEach(record => {
            sheet.addRow({
                date: record.date || "",
                checkIn: record.checkIn
                    ? new Date(record.checkIn).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata"
                    })
                    : "--",
                checkOut: record.checkOut
                    ? new Date(record.checkOut).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata"
                    })
                    : "--",
                workingMinutes: record.workingMinutes || 0,
                status: record.status || "Unknown"
            });
        });

        sheet.getRow(1).font = { bold: true };

        const filename = `${String(user.username || "user")
            .replace(/[^a-z0-9_-]/gi, "_")}_attendance.xlsx`;

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${filename}"`
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("Admin Excel export error:", err);
        if (!res.headersSent) {
            res.status(500).send("Excel download failed");
        }
    }
});


/* ADMIN: Download one user's PDF attendance history */
app.get("/admin/users/:userId/attendance.pdf", async (req, res) => {
    try {
        if (!req.session.adminId) {
            return res.redirect("/login");
        }

        const user = await User.findOne({
            _id: req.params.userId,
            adminId: req.session.adminId
        });

        if (!user) {
            return res.status(404).send("User not found");
        }

        const records = await Attendance.find({
            userId: user._id
        }).sort({ date: -1 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${String(user.username || "user")
                .replace(/[^a-z0-9_-]/gi, "_")}_attendance.pdf"`
        );

        const pdf = new PDFDocument({
            size: "A4",
            margin: 40
        });

        pdf.pipe(res);

        pdf.fontSize(20).text("Attendance History", {
            align: "center"
        });

        pdf.moveDown();
        pdf.fontSize(11).text(`Name: ${user.username}`);
        pdf.text(`Email: ${user.email || "--"}`);
        pdf.text(`Department: ${user.department || "--"}`);
        pdf.moveDown();

        records.forEach((record, index) => {
            if (pdf.y > 720) {
                pdf.addPage();
            }

            const checkIn = record.checkIn
                ? new Date(record.checkIn).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata"
                })
                : "--";

            const checkOut = record.checkOut
                ? new Date(record.checkOut).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata"
                })
                : "--";

            pdf.fontSize(10).text(
                `${index + 1}. Date: ${record.date || "--"}`
            );
            pdf.text(`Check In: ${checkIn}`);
            pdf.text(`Check Out: ${checkOut}`);
            pdf.text(`Status: ${record.status || "--"}`);
            pdf.text(`Working Minutes: ${record.workingMinutes || 0}`);
            pdf.moveDown();
        });

        if (records.length === 0) {
            pdf.text("No attendance records found.");
        }

        pdf.end();

    } catch (err) {
        console.error("Admin PDF export error:", err);
        if (!res.headersSent) {
            res.status(500).send("PDF download failed");
        }
    }
});





app.listen(3000, () => {
  console.log(`app listening on port 3000`)
})