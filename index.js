import express from "express";
import "dotenv/config";
import { google } from "googleapis";
import bodyParser from "body-parser";

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.SECRET_ID,
  process.env.REDIRECT
);

let isAuthenticated = false;
let tempEvent = null;

app.get("/", (req, res) => {
  if (!isAuthenticated) {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: "https://www.googleapis.com/auth/calendar",
    });
    return res.redirect(url);
  }
  res.redirect("/form");
});

app.get("/redirect", async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    isAuthenticated = true;
    res.redirect("/form");
  } catch (error) {
    console.error(error.message);
    res.send("Error during authentication");
  }
});

app.get("/form", (req, res) => {
  res.render("form");
});

app.post("/reviewevent", (req, res) => {
  const { title, day, month, year, reminder } = req.body;

  const eventDate = new Date(year, month - 1, day);

  tempEvent = {
    summary: title,
    start: {
      dateTime: eventDate.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime: new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString(),
      timeZone: "Asia/Kolkata",
    },
    reminders: {
      useDefault: false,
      overrides: reminder
        ? [{ method: "popup", minutes: parseInt(reminder) }]
        : [],
    },
  };

  res.render("review", { event: tempEvent });
});

app.post("/addevent", async (req, res) => {
  if (!tempEvent) return res.redirect("/form");

  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    await calendar.events.insert({
      calendarId: "primary",
      resource: tempEvent,
    });
    tempEvent = null;
    res.send(
      "<h2 style='color:green;text-align:center;'>✅ Event added successfully! <br><a href='/form'>Back</a></h2>"
    );
  } catch (error) {
    console.error("Error adding event:", error);
    res.status(500).send("Error adding event");
  }
});

app.post("/declineevent", (req, res) => {
  tempEvent = null;
  res.redirect("/form");
});

app.get("/eventsbydate", async (req, res) => {
  const { day, month, year } = req.query;
  const selectedDate = new Date(year, month - 1, day);

  const startDate = new Date(selectedDate.setHours(0, 0, 0, 0));
  const endDate = new Date(selectedDate.setHours(23, 59, 59, 999));

  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const filteredEvents = response.data.items.filter((ev) => {
      const evDate = new Date(ev.start.dateTime || ev.start.date);
      return (
        evDate.toDateString() === new Date(year, month - 1, day).toDateString()
      );
    });

    res.render("events", { events: filteredEvents });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).send("Error fetching events");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`server is running on PORT: ${PORT}`);
});
