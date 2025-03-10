const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const publicRoutes = require("./routes/public.routes");

dotenv.config();

const app = express();

// CORS configuration allowing both local and production domains
app.use(
  cors({
    origin: ["http://localhost:3000", "https://www.fastandfab.in"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware
app.use(express.json());

// Routes
app.use("/api", authRoutes);
app.use("/api/products", productRoutes);
app.use("/", publicRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
