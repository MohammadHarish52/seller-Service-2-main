const express = require("express");
const { PrismaClient } = require("@prisma/client");
const authMiddleware = require("../middleware/auth.middleware");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const router = express.Router();
const prisma = new PrismaClient();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || "product_images";

// Configure multer for file uploads - use system temp directory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use system temp directory instead of a folder in the project
    const tempDir = path.join(os.tmpdir(), "product-uploads");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename to avoid collisions
    const uniqueSuffix = crypto.randomBytes(16).toString("hex");
    const fileExt = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${fileExt}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Helper function to upload file to Supabase
async function uploadToSupabase(filePath, fileName) {
  try {
    const fileBuffer = fs.readFileSync(filePath);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(`products/${fileName}`, fileBuffer, {
        contentType: "image/*",
        upsert: true,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(`products/${fileName}`);

    // Clean up local file immediately after upload
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.error("Error cleaning up temp file:", cleanupError);
      // Continue execution even if cleanup fails
    }

    return urlData.publicUrl;
  } catch (error) {
    // Attempt to clean up in case of error too
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (cleanupError) {
      console.error(
        "Error cleaning up temp file after upload error:",
        cleanupError
      );
    }

    console.error("Error uploading to Supabase:", error);
    throw error;
  }
}

// Get all products (public)
router.get("/all", async (req, res) => {
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
    res
      .status(500)
      .json({ message: "Error fetching products", error: error.message });
  }
});

// Upload images endpoint
router.post(
  "/upload-images",
  authMiddleware,
  upload.array("images", 5),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploadPromises = req.files.map((file) =>
        uploadToSupabase(file.path, file.filename)
      );

      const imageUrls = await Promise.all(uploadPromises);

      res.status(200).json({
        message: "Images uploaded successfully",
        imageUrls,
      });
    } catch (error) {
      console.error("Upload error:", error);

      // Clean up any remaining files in case of error
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          } catch (cleanupError) {
            console.error(
              "Error cleaning up temp file after request error:",
              cleanupError
            );
          }
        });
      }

      res.status(500).json({
        message: "Error uploading images",
        error: error.message,
      });
    }
  }
);

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
        images: images || [],
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

    // Delete associated images from Supabase if they exist
    if (existingProduct.images && existingProduct.images.length > 0) {
      try {
        // Extract filenames from URLs
        const filesToDelete = existingProduct.images.map((url) => {
          const urlParts = url.split("/");
          return `products/${urlParts[urlParts.length - 1]}`;
        });

        // Delete files from Supabase
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(filesToDelete);

        if (error) {
          console.error("Error deleting images from Supabase:", error);
        }
      } catch (error) {
        console.error("Error processing image deletion:", error);
      }
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
