const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();
const prisma = new PrismaClient();

// Signup route
router.post("/signup", async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Check if seller already exists
    const existingSeller = await prisma.seller.findUnique({
      where: { phone },
    });

    if (existingSeller) {
      return res
        .status(400)
        .json({ message: "Phone number already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new seller
    const seller = await prisma.seller.create({
      data: {
        phone,
        password: hashedPassword,
      },
    });

    // Generate JWT token
    const token = jwt.sign({ sellerId: seller.id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.status(201).json({
      message: "Seller registered successfully",
      token,
      sellerId: seller.id,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating seller", error: error.message });
  }
});

// Signin route
router.post("/signin", async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Find seller
    const seller = await prisma.seller.findUnique({
      where: { phone },
    });

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, seller.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT token
    const token = jwt.sign({ sellerId: seller.id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({
      message: "Signin successful",
      token,
      sellerId: seller.id,
    });
  } catch (error) {
    res.status(500).json({ message: "Error signing in", error: error.message });
  }
});

// Update seller details route
router.patch("/:sellerId/details", authMiddleware, async (req, res) => {
  try {
    const { sellerId } = req.params;
    const {
      shopName,
      ownerName,
      address,
      city,
      state,
      pincode,
      openTime,
      closeTime,
      categories,
    } = req.body;

    // Verify seller owns this profile
    if (sellerId !== req.sellerId) {
      return res
        .status(403)
        .json({ message: "Unauthorized to update this profile" });
    }

    // Update seller details
    const updatedSeller = await prisma.seller.update({
      where: { id: sellerId },
      data: {
        shopName,
        ownerName,
        address,
        city,
        state,
        pincode,
        openTime,
        closeTime,
        categories,
      },
    });

    res.json({
      message: "Seller details updated successfully",
      seller: updatedSeller,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating seller details", error: error.message });
  }
});

module.exports = router;
