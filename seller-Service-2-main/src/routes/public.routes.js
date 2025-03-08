const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// Get all active products for public viewing
router.get("/products/active", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(products);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching products", error: error.message });
  }
});

// Get a specific product by ID for public viewing
router.get("/products/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
        isActive: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching product", error: error.message });
  }
});

// Get products by category
router.get("/products/category/:category", async (req, res) => {
  try {
    const { category } = req.params;

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        category: {
          startsWith: category,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(products);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching products", error: error.message });
  }
});

module.exports = router;
