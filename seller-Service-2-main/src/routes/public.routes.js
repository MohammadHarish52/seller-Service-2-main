const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// Get all products for public viewing
router.get("/products", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        seller: {
          select: {
            shopName: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(products);
  } catch (error) {
    console.error("Error fetching public products:", error);
    res
      .status(500)
      .json({ message: "Error fetching products", error: error.message });
  }
});

// Get all active products for public viewing
router.get("/products/active", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        seller: {
          select: {
            shopName: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(products);
  } catch (error) {
    console.error("Error fetching active products:", error);
    res
      .status(500)
      .json({ message: "Error fetching products", error: error.message });
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
          equals: category,
          mode: "insensitive", // Case insensitive search
        },
      },
      include: {
        seller: {
          select: {
            shopName: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(products);
  } catch (error) {
    console.error(
      `Error fetching products by category ${req.params.category}:`,
      error
    );
    res
      .status(500)
      .json({ message: "Error fetching products", error: error.message });
  }
});

// Get products by subcategory
router.get("/products/subcategory/:subcategory", async (req, res) => {
  try {
    const { subcategory } = req.params;

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        subcategory: {
          equals: subcategory,
          mode: "insensitive", // Case insensitive search
        },
      },
      include: {
        seller: {
          select: {
            shopName: true,
            city: true,
            state: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(products);
  } catch (error) {
    console.error(
      `Error fetching products by subcategory ${req.params.subcategory}:`,
      error
    );
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
      },
      include: {
        seller: {
          select: {
            shopName: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // If product is not active, only return it if it's a valid product
    if (!product.isActive) {
      return res.status(404).json({ message: "Product not available" });
    }

    res.json(product);
  } catch (error) {
    console.error(`Error fetching product ${req.params.productId}:`, error);
    res
      .status(500)
      .json({ message: "Error fetching product", error: error.message });
  }
});

module.exports = router;
