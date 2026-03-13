const express = require("express");
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/views/index.html");
});

app.get("/about", (req, res) => {
    res.sendFile(__dirname + "/views/about.html");
});

app.get("/contact", (req, res) => {
    res.sendFile(__dirname + "/views/contact.html");
});

app.get("*", (req, res) => {
    res.send("The route specified doesn't exist");
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
