const express = require("express");
const { PrismaClient } = require("@prisma/client");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();
const prisma = new PrismaClient();

// Create a new product
router.post("/", authMiddleware, async (req, res) => {
  try {
    const sellerId = req.sellerId;
    const {
      name,
      description,
      mrpPrice,
      sellingPrice,
      images,
      category,
      subcategory,
      sizeQuantities,
    } = req.body;

    // Validate required fields
    if (!name || !mrpPrice || !sellingPrice) {
      return res
        .status(400)
        .json({ message: "Name, MRP price, and selling price are required" });
    }

    // Validate that selling price is not greater than MRP
    if (parseFloat(sellingPrice) > parseFloat(mrpPrice)) {
      return res
        .status(400)
        .json({ message: "Selling price cannot be greater than MRP" });
    }

    // Create the product
    const product = await prisma.product.create({
      data: {
        name,
        description,
        mrpPrice: parseFloat(mrpPrice),
        sellingPrice: parseFloat(sellingPrice),
        images,
        category,
        subcategory,
        sellerId,
        sizeQuantities: sizeQuantities || {
          XS: 0,
          S: 0,
          M: 0,
          L: 0,
          XL: 0,
        },
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
    const {
      name,
      description,
      mrpPrice,
      sellingPrice,
      images,
      category,
      subcategory,
      sizeQuantities,
      isActive,
    } = req.body;

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

    // Validate that selling price is not greater than MRP if both are being updated
    if (
      mrpPrice &&
      sellingPrice &&
      parseFloat(sellingPrice) > parseFloat(mrpPrice)
    ) {
      return res
        .status(400)
        .json({ message: "Selling price cannot be greater than MRP" });
    }

    // Update the product
    const updatedProduct = await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        name,
        description,
        mrpPrice: mrpPrice ? parseFloat(mrpPrice) : undefined,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : undefined,
        images,
        category,
        subcategory,
        sizeQuantities: sizeQuantities || undefined,
        isActive,
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
