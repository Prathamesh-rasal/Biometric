require("dotenv").config();

const express = require('express')
const app = express()
const mongoose = require('mongoose');

const path = require('path')
const ejsMate = require('ejs-mate')
const methodOverride = require("method-override")
const session = require('express-session')
const flash = require('connect-flash');

const Admin = require("./models/admin");
const User = require("./models/user");
const Attendance = require("./models/attendance");
const { checkLocation, checkFace } = require('./utils/locationFace');
const bcrypt = require("bcrypt");
const { env } = require("process");



app.set('view engine','ejs')
app.set("query parser","extended");
app.set('views',path.join(__dirname,'views'))
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname,'/public')))
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({extended : true}))
app.use(methodOverride("_method"))
app.use(express.static("public"));

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
    res.locals.userId = req.session.userId || null;
    next()
})



// add fake data
// app.get('/adddata', async (req, res) => {
//     try {
//         const userId = new mongoose.Types.ObjectId(
//             "6ad269e1cb0db0e3ca989a1c"
//         );

//         const data = [
//             ["2026-10-01", "Present", "09:00", "18:00", 540],
//             ["2026-10-02", "Late", "09:30", "17:30", 480],
//             ["2026-10-03", "Present", "09:00", "18:00", 540],
//             ["2026-10-04", "Half-Day", "09:00", "13:00", 240],
//             ["2026-10-05", "Present", "09:00", "18:00", 540],
//             ["2026-10-06", "Absent", null, null, 0],
//             ["2026-10-07", "Late", "09:45", "17:45", 480],
//             ["2026-10-08", "Present", "09:00", "18:00", 540],
//             ["2026-10-09", "Present", "09:05", "18:05", 540],
//             ["2026-10-10", "Half-Day", "09:00", "12:30", 210],
//             ["2026-10-11", "Present", "09:00", "18:00", 540],
//             ["2026-10-12", "Absent", null, null, 0],
//             ["2026-10-13", "Late", "09:40", "17:40", 480],
//             ["2026-10-14", "Present", "09:00", "18:00", 540],
//             ["2026-10-15", "Present", "09:00", "18:00", 540]
//         ];

//         function makeDate(date, time) {
//             if (!time) return null;
//             return new Date(`${date}T${time}:00+05:30`);
//         }

//         // MongoDB connection already established as app starts.
//         const collection = mongoose.connection.collection("attendances");

//         let inserted = 0;
//         let skipped = 0;

//         for (const [date, status, inTime, outTime, minutes] of data) {
//             const existing = await collection.findOne({
//                 userId,
//                 date
//             });

//             if (existing) {
//                 skipped++;
//                 continue;
//             }

//             await collection.insertOne({
//                 userId,
//                 date,
//                 checkIn: makeDate(date, inTime),
//                 checkOut: makeDate(date, outTime),
//                 status,
//                 workingMinutes: minutes,
//                 createdAt: new Date(),
//                 updatedAt: new Date()
//             });

//             inserted++;
//         }

//         return res.status(200).json({
//             message: "Attendance data processed successfully",
//             inserted,
//             skipped,
//             total: data.length
//         });

//     } catch (error) {
//         console.error("Attendance insert error:", error);

//         return res.status(500).json({
//             message: "Failed to add attendance data",
//             error: error.message
//         });
//     }
// });


// app.post('/markAttendance', async (req, res) => {
//     try {
//         const { face_features, latitude, longitude } = req.body;
//         const userId = req.session.userId;

//         if (!userId) {
//             req.flash("error", "Please login first.");
//             return res.redirect("/login");
//         }

//         if (
//             !face_features ||
//             latitude === undefined || latitude === "" ||
//             longitude === undefined || longitude === ""
//         ) {
//             req.flash("error", "Face data and location are required.");
//             return res.redirect("/markAttendance");
//         }

//         const x = await checkLocation(latitude, longitude, userId);

//         if (!x) {
//             req.flash("error", "Location does not match.");
//             return res.redirect("/markAttendance");
//         }

//         const y = await checkFace(face_features, userId);

//         if (!y) {
//             req.flash("error", "Face does not match.");
//             return res.redirect("/markAttendance");
//         }





//         // Face and location verification successful zalyanantar ha code run kar

//         const user = await User.findById(req.session.userId);

//         if (!user) {        
//             req.flash("error", "User not found.");
//             return res.redirect("/markAttendance");
//         }

//     // Today's date in India
//         const today = new Intl.DateTimeFormat("en-CA", {
//             timeZone: "Asia/Kolkata",
//             year: "numeric",
//             month: "2-digit",
//             day: "2-digit"
//                 }).format(new Date());

//         // Get today's attendance record
//         let attendance = await Attendance.findOne({
//             userId: user._id,
//             date: today
//         });

//         const now = new Date();

//         // Convert HH:mm to minutes
//         const timeToMinutes = (time) => {       
//             const [hours, minutes] = time.split(":").map(Number);
//             return hours * 60 + minutes;
//         };

//         const startMinutes = timeToMinutes(user.start_working_time);
//         const endMinutes = timeToMinutes(user.end_working_time);

//         // Handle shifts that cross midnight
//         const expectedMinutes =
//             endMinutes > startMinutes
//                 ? endMinutes - startMinutes
//                 : endMinutes + 1440 - startMinutes;

//         if (!attendance) {      
//             // FIRST SCAN: CHECK-IN
//             const currentMinutes = timeToMinutes(
//                 new Intl.DateTimeFormat("en-GB", {
//                     timeZone: "Asia/Kolkata",
//                     hour: "2-digit",
//                     minute: "2-digit",
//                     hourCycle: "h23"
//                 }).format(now)
//             );

//     const status =
//         currentMinutes > startMinutes ? "Late" : "Present";

//         attendance = await Attendance.create({
//             userId: user._id,
//             date: today,
//             checkIn: now,
//             checkOut: null,
//             status,
//             workingMinutes: 0
//         });

//         req.flash("success", "Check-in successful!");
//         return res.redirect("/markAttendance");
//         }

//         // SECOND SCAN: CHECK-OUT
//         if (!attendance.checkOut) {
//             if (!attendance.checkIn) {      
//                 req.flash("error", "Check-in record is missing.");
//                 return res.redirect("/markAttendance");
//             }

//             if (now <= attendance.checkIn) {        
//                 req.flash("error", "Check-out time must be after check-in.");
//                 return res.redirect("/markAttendance");
//             }

//             const workingMinutes = Math.floor(
//                 (now.getTime() - attendance.checkIn.getTime()) / 60000
//             );

//             let status;

//             if (workingMinutes < expectedMinutes / 2) {
//                 status = "Half-Day";
//             } else if (attendance.status === "Late") {
//                 status = "Late";
//             } else {
//                 status = "Present";
//             }

//             attendance.checkOut = now;
//             attendance.workingMinutes = workingMinutes;
//             attendance.status = status;

//             await attendance.save();

//             req.flash("success", "Check-out successful!");
//             return res.redirect("/markAttendance");
//         }

//         // CHECK-IN AND CHECK-OUT ALREADY COMPLETED
//         req.flash("error", "Your attendance is already completed for today.");






//         return res.redirect("/markAttendance");

//     } catch (err) {
//         console.error("Attendance route error:", err);
//         req.flash("error", "Something went wrong.");
//         return res.redirect("/markAttendance");
//     }
// });




app.get('/markAttendance',async (req,res)=>{
    try {
        if (!req.session.userId) {
            req.flash("error","Please login first!")
            return res.redirect("/login");
        }

        res.render("menu/markAttendance.ejs");
    } catch (err){
        console.log(err)
    }
})

app.get('/logout',(req,res)=>{
    req.session.userId = null;
    req.flash("success","Logged out successfully!")
    res.redirect("/login");
})

app.get("/home", async (req, res) => {
    try {
        if (!req.session.userId) {
            req.flash("error", "Please login first");
            return res.redirect("/login");
        }

        const user = await User.findById(req.session.userId);

        if (!user) {
            req.session.userId = null;
            req.flash("error", "Please login again");
            return res.redirect("/login");
        }

        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());

        const attendanceRecords = await Attendance.find({
            userId: user._id
        }).sort({ date: -1 });

        const todayAttendance =
            attendanceRecords.find(record => record.date === today) || null;

        const presentDays = attendanceRecords.filter(
            record => record.status === "Present"
        ).length;

        const lateDays = attendanceRecords.filter(
            record => record.status === "Late"
        ).length;

        const absentDays = attendanceRecords.filter(
            record => record.status === "Absent"
        ).length;

        const halfDays = attendanceRecords.filter(
            record => record.status === "Half-Day"
        ).length;

        const totalWorkingMinutes = attendanceRecords.reduce(
            (total, record) => total + (record.workingMinutes || 0),
            0
        );

        return res.render("menu/home", {
            user,
            attendanceRecords,
            todayAttendance,
            today,
            presentDays,
            lateDays,
            absentDays,
            halfDays,
            totalWorkingMinutes
        });

    } catch (error) {
        console.error("Home dashboard error:", error);
        return res.status(500).send("Unable to load dashboard");
    }
});

app.get('/about',(req,res)=>{
    try {
        if (!req.session.userId) {
            req.flash("error","Please login first!")
            return res.redirect("/login");
        } else{
        res.render("menu/about.ejs")
        }
    }
    catch(err){
        console.log(err)
    }
})

app.post('/login', async (req, res) => {
    try{
        let { contact, password } = req.body;

        const checkContact = await User.findOne({contact_number: contact.trim()});
        if (!checkContact) {
            req.flash("error", "Invalid contact number!");
            return res.redirect("/login");
        }

        const checkPassword = await bcrypt.compare(password,checkContact.password);

        if (!checkPassword) {
            req.flash("error", "Invalid password!");
            return res.redirect("/login");
        }

        req.session.userId = checkContact._id.toString();
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
        if (!req.session.userId) {
            // req.flash("error","Please login first!")
            return res.redirect("/login");
        } 
        res.render("menu/home.ejs")

    }
    catch(err){
        console.log(err)
    }
    
})

app.listen(8080, () => {
  console.log(`app listening on port 3000`)
})