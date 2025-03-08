const express = require("express");
const { PrismaClient } = require("@prisma/client");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();
const prisma = new PrismaClient();

// Create a new product
router.post("/", authMiddleware, async (req, res) => {
  try {
    const sellerId = req.sellerId;
    const { name, description, price, stock, images, category, subcategory, sizes } = req.body;

    // Validate required fields
    if (!name || !price || !category || !subcategory) {
      return res.status(400).json({ message: "Name, price, category, and subcategory are required" });
    }

    // Create the product
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        stock: stock ? parseInt(stock) : 0,
        images,
        category,
        sellerId,
        subcategory,
        sizes,
      },
    });

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating product", error: error.message });
  }
});

// Get all products for a seller
router.get("/", authMiddleware, async (req, res) => {
  try {
    const sellerId = req.sellerId;

    const products = await prisma.product.findMany({
      where: {
        sellerId,
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

// Get a specific product
router.get("/:productId", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const sellerId = req.sellerId;

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if the product belongs to the seller
    if (product.sellerId !== sellerId) {
      return res
        .status(403)
        .json({ message: "Unauthorized to access this product" });
    }

    res.json(product);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching product", error: error.message });
  }
});

// Update a product
router.put("/:productId", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const sellerId = req.sellerId;
    const { name, description, price, stock, images, category, isActive, subcategory, sizes } = req.body;

    // Check if product exists and belongs to the seller
    const existingProduct = await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (existingProduct.sellerId !== sellerId) {
      return res
        .status(403)
        .json({ message: "Unauthorized to update this product" });
    }

    // Update the product
    const updatedProduct = await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        name,
        description,
        price: price ? parseFloat(price) : undefined,
        stock: stock !== undefined ? parseInt(stock) : undefined,
        images,
        category,
        isActive,
        subcategory,
        sizes,
      },
    });

    res.json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating product", error: error.message });
  }
});

// Delete a product
router.delete("/:productId", authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const sellerId = req.sellerId;

    // Check if product exists and belongs to the seller
    const existingProduct = await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (existingProduct.sellerId !== sellerId) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this product" });
    }

    // Delete the product
    await prisma.product.delete({
      where: {
        id: productId,
      },
    });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting product", error: error.message });
  }
});

module.exports = router;
