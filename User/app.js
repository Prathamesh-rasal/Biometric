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















// ================= ATTENDANCE REPORT EXPORT =================

const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

// तुझ्या login system मध्ये user ID वेगळ्या property मध्ये
// save होत असेल, तर हा भाग त्यानुसार बदल.
function requireUserLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect("/login");
    }
    next();
}

// Fetch only the logged-in user's records
async function getMyAttendance(req, res) {
    const user = await User.findById(req.session.userId);

    if (!user) {
        const error = new Error("User account not found.");
        error.status = 404;
        throw error;
    }

    const attendanceRecords = await Attendance.find({
        userId: user._id
    }).sort({ date: -1 });

    return { user, attendanceRecords };
}

// ---------------- EXCEL EXPORT ----------------

app.get(
    "/user/attendance/export/excel",
    requireUserLogin,
    async (req, res) => {
        try {
            const { user, attendanceRecords } =
                await getMyAttendance(req, res);

            const workbook = new ExcelJS.Workbook();
            workbook.creator = "Biometric Attendance System";
            workbook.created = new Date();

            const sheet = workbook.addWorksheet("My Attendance");

            sheet.columns = [
                { header: "Date", key: "date", width: 16 },
                { header: "Check-in", key: "checkIn", width: 16 },
                { header: "Check-out", key: "checkOut", width: 16 },
                { header: "Working Hours", key: "workingHours", width: 18 },
                { header: "Status", key: "status", width: 16 }
            ];

            sheet.addRows(
                attendanceRecords.map(record => ({
                    date: record.date || "",
                    checkIn: record.checkIn
                        ? new Date(record.checkIn).toLocaleTimeString(
                            "en-IN",
                            {
                                timeZone: "Asia/Kolkata",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true
                            }
                        )
                        : "--",
                    checkOut: record.checkOut
                        ? new Date(record.checkOut).toLocaleTimeString(
                            "en-IN",
                            {
                                timeZone: "Asia/Kolkata",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true
                            }
                        )
                        : "--",
                    workingHours:
                        `${Math.floor((record.workingMinutes || 0) / 60)}h ` +
                        `${(record.workingMinutes || 0) % 60}m`,
                    status: record.status || "Unknown"
                }))
            );

            // Format header
            sheet.getRow(1).font = {
                bold: true,
                color: { argb: "FFFFFFFF" }
            };

            sheet.getRow(1).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF198754" }
            };

            sheet.views = [{ state: "frozen", ySplit: 1 }];
            sheet.autoFilter = {
                from: "A1",
                to: "E1"
            };

            const safeName = String(user.username || "user")
                .replace(/[^a-z0-9_-]/gi, "_");

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${safeName}_attendance.xlsx"`
            );

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error("Excel export error:", error);

            if (!res.headersSent) {
                res.status(error.status || 500)
                    .send("Unable to export attendance to Excel.");
            }
        }
    }
);

// ---------------- PDF EXPORT ----------------

app.get(
    "/user/attendance/export/pdf",
    requireUserLogin,
    async (req, res) => {
        try {
            const { user, attendanceRecords } =
                await getMyAttendance(req, res);

            const safeName = String(user.username || "user")
                .replace(/[^a-z0-9_-]/gi, "_");

            res.setHeader("Content-Type", "application/pdf");

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${safeName}_attendance.pdf"`
            );

            const doc = new PDFDocument({
                size: "A4",
                layout: "landscape",
                margin: 35,
                bufferPages: true
            });

            doc.pipe(res);

            doc.fontSize(20)
                .font("Helvetica-Bold")
                .text("Biometric Attendance Report", {
                    align: "center"
                });

            doc.moveDown(0.5);

            doc.fontSize(11)
                .font("Helvetica")
                .text(`Name: ${user.username || "-"}`);

            doc.text(`Department: ${user.department || "-"}`);
            doc.text(`Report generated: ${new Date().toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata"
            })}`);

            doc.moveDown();

            // Table layout
            const columns = [
                { label: "Date", x: 35, width: 100 },
                { label: "Check-in", x: 140, width: 100 },
                { label: "Check-out", x: 245, width: 100 },
                { label: "Working Hours", x: 350, width: 120 },
                { label: "Status", x: 475, width: 120 }
            ];

            function drawTableHeader() {
                const y = doc.y;

                doc.font("Helvetica-Bold").fontSize(10);

                columns.forEach(col => {
                    doc.text(col.label, col.x, y, {
                        width: col.width
                    });
                });

                doc.moveDown(1.5);
                doc.moveTo(35, doc.y)
                    .lineTo(590, doc.y)
                    .stroke();

                doc.moveDown(0.5);
            }

            function formatTime(value) {
                if (!value) return "--";

                return new Date(value).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true
                });
            }

            drawTableHeader();

            doc.font("Helvetica").fontSize(9);

            if (attendanceRecords.length === 0) {
                doc.text("No attendance records found.");
            } else {
                for (const record of attendanceRecords) {
                    // New page if the row will not fit
                    if (doc.y > 500) {
                        doc.addPage();
                        drawTableHeader();
                        doc.font("Helvetica").fontSize(9);
                    }

                    const y = doc.y;
                    const minutes = record.workingMinutes || 0;

                    const row = [
                        record.date || "--",
                        formatTime(record.checkIn),
                        formatTime(record.checkOut),
                        `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
                        record.status || "Unknown"
                    ];

                    columns.forEach((col, index) => {
                        doc.text(String(row[index]), col.x, y, {
                            width: col.width,
                            height: 30
                        });
                    });

                    doc.moveDown(1.5);
                }
            }

            // Summary
            const presentDays = attendanceRecords.filter(
                r => r.status === "Present"
            ).length;

            const lateDays = attendanceRecords.filter(
                r => r.status === "Late"
            ).length;

            const absentDays = attendanceRecords.filter(
                r => r.status === "Absent"
            ).length;

            const halfDays = attendanceRecords.filter(
                r => r.status === "Half-Day"
            ).length;

            const totalMinutes = attendanceRecords.reduce(
                (sum, r) => sum + (r.workingMinutes || 0),
                0
            );

            if (doc.y > 470) doc.addPage();

            doc.moveDown();
            doc.font("Helvetica-Bold").fontSize(12)
                .text("Attendance Summary");

            doc.moveDown(0.5);
            doc.font("Helvetica").fontSize(10)
                .text(`Present: ${presentDays} | Late: ${lateDays} | Absent: ${absentDays} | Half-Day: ${halfDays}`);

            doc.text(
                `Total Working Time: ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
            );

            doc.end();

        } catch (error) {
            console.error("PDF export error:", error);

            if (!res.headersSent) {
                res.status(error.status || 500)
                    .send("Unable to export attendance to PDF.");
            }
        }
    }
);















app.post('/markAttendance', async (req, res) => {
    try {
        const { face_features, latitude, longitude } = req.body;
        const userId = req.session.userId;

        if (!userId) {
            req.flash("error", "Please login first.");
            return res.redirect("/login");
        }

        if (
            !face_features ||
            latitude === undefined || latitude === "" ||
            longitude === undefined || longitude === ""
        ) {
            req.flash("error", "Face data and location are required.");
            return res.redirect("/markAttendance");
        }
        console.log("location la call lagla")
        const x = await checkLocation(latitude, longitude, userId);
        console.log("location la call complete", x)
        if (!x && x!==0) {
            req.flash("error", "Location does not match.");
            return res.redirect("/markAttendance");
        }

        const y = await checkFace(face_features, userId);

        if (!y) {
            req.flash("error", "Face does not match.");
            return res.redirect("/markAttendance");
        }





        // Face and location verification successful zalyanantar ha code run kar

        const user = await User.findById(req.session.userId);

        if (!user) {        
            req.flash("error", "User not found.");
            return res.redirect("/markAttendance");
        }

    // Today's date in India
        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
                }).format(new Date());

        // Get today's attendance record
        let attendance = await Attendance.findOne({
            userId: user._id,
            date: today
        });

        const now = new Date();

        // Convert HH:mm to minutes
        const timeToMinutes = (time) => {       
            const [hours, minutes] = time.split(":").map(Number);
            return hours * 60 + minutes;
        };

        const startMinutes = timeToMinutes(user.start_working_time);
        const endMinutes = timeToMinutes(user.end_working_time);

        // Handle shifts that cross midnight
        const expectedMinutes =
            endMinutes > startMinutes
                ? endMinutes - startMinutes
                : endMinutes + 1440 - startMinutes;

        if (!attendance) {      
            // FIRST SCAN: CHECK-IN
            const currentMinutes = timeToMinutes(
                new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23"
                }).format(now)
            );

    const status =
        currentMinutes > startMinutes ? "Late" : "Present";

        attendance = await Attendance.create({
            userId: user._id,
            date: today,
            checkIn: now,
            checkOut: null,
            status,
            workingMinutes: 0
        });

        req.flash("success", "Check-in successful!");
        return res.redirect("/markAttendance");
        }

        // SECOND SCAN: CHECK-OUT
        if (!attendance.checkOut) {
            if (!attendance.checkIn) {      
                req.flash("error", "Check-in record is missing.");
                return res.redirect("/markAttendance");
            }

            if (now <= attendance.checkIn) {        
                req.flash("error", "Check-out time must be after check-in.");
                return res.redirect("/markAttendance");
            }

            const workingMinutes = Math.floor(
                (now.getTime() - attendance.checkIn.getTime()) / 60000
            );

            let status;

            if (workingMinutes < expectedMinutes / 2) {
                status = "Half-Day";
            } else if (attendance.status === "Late") {
                status = "Late";
            } else {
                status = "Present";
            }

            attendance.checkOut = now;
            attendance.workingMinutes = workingMinutes;
            attendance.status = status;

            await attendance.save();

            req.flash("success", "Check-out successful!");
            return res.redirect("/markAttendance");
        }

        // CHECK-IN AND CHECK-OUT ALREADY COMPLETED
        req.flash("error", "Your attendance is already completed for today.");






        return res.redirect("/markAttendance");

    } catch (err) {
        console.error("Attendance route error:", err);
        req.flash("error", "Something went wrong.");
        return res.redirect("/markAttendance");
    }
});




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
            return res.redirect("/login");
        }

        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.redirect("/login");
        }

        const attendanceRecords = await Attendance.find({
            userId: user._id
        }).sort({ date: -1 });

        const presentDays = attendanceRecords.filter(
            r => r.status === "Present"
        ).length;

        const lateDays = attendanceRecords.filter(
            r => r.status === "Late"
        ).length;

        const absentDays = attendanceRecords.filter(
            r => r.status === "Absent"
        ).length;

        const halfDays = attendanceRecords.filter(
            r => r.status === "Half-Day"
        ).length;

        const totalWorkingMinutes = attendanceRecords.reduce(
            (total, r) => total + (r.workingMinutes || 0),
            0
        );

        const today = new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata"
        });

        const todayAttendance = attendanceRecords.find(
            r => r.date === today
        ) || null;

        res.render("menu/home", {
            user,
            attendanceRecords,
            presentDays,
            lateDays,
            absentDays,
            halfDays,
            totalWorkingMinutes,
            today,
            todayAttendance
        });

    } catch (err) {
        console.error("Dashboard error:", err);
        res.status(500).send("Unable to load dashboard.");
    }
    
})

app.listen(8080, () => {
  console.log(`app listening on port 3000`)
})