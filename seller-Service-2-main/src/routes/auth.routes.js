const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();
const prisma = new PrismaClient();

// Token configuration
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days

// Generate tokens
const generateTokens = (sellerId) => {
  const accessToken = jwt.sign({ sellerId }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { sellerId },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

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

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(seller.id);

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        sellerId: seller.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Remove password from seller object
    const { password: _, ...sellerData } = seller;

    res.status(201).json({
      message: "Seller registered successfully",
      accessToken,
      refreshToken,
      sellerId: seller.id,
      seller: sellerData,
    });
  } catch (error) {
    console.error("Signup error:", error);
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

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(seller.id);

    // Store refresh token in database (remove old ones first)
    await prisma.refreshToken.deleteMany({
      where: { sellerId: seller.id },
    });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        sellerId: seller.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Remove password from seller object
    const { password: _, ...sellerData } = seller;

    res.json({
      message: "Signin successful",
      accessToken,
      refreshToken,
      seller: sellerData,
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ message: "Error signing in", error: error.message });
  }
});

// Refresh token route
router.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );
    } catch (error) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Check if token exists in database
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        sellerId: decoded.sellerId,
      },
    });

    if (!storedToken) {
      return res.status(401).json({ message: "Refresh token not found" });
    }

    // Check if token is expired
    if (new Date(storedToken.expiresAt) < new Date()) {
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      return res.status(401).json({ message: "Refresh token expired" });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      decoded.sellerId
    );

    // Update refresh token in database
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Get seller data
    const seller = await prisma.seller.findUnique({
      where: { id: decoded.sellerId },
    });

    // Remove password from seller object
    const { password, ...sellerData } = seller;

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      seller: sellerData,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error refreshing token", error: error.message });
  }
});

// Logout route
router.post("/logout", authMiddleware, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    // Delete refresh token from database
    await prisma.refreshToken.deleteMany({
      where: {
        token: refreshToken,
        sellerId: req.sellerId,
      },
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error logging out", error: error.message });
  }
});

// Get seller profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const seller = await prisma.seller.findUnique({
      where: { id: req.sellerId },
    });

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    // Remove password from seller object
    const { password, ...sellerData } = seller;

    res.json({ seller: sellerData });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching profile", error: error.message });
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

    // Remove password from seller object
    const { password, ...sellerData } = updatedSeller;

    res.json({
      message: "Seller details updated successfully",
      seller: sellerData,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating seller details", error: error.message });
  }
});

module.exports = router;
