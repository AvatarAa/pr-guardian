const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.json());

const products = [
  {
    id: 1,
    name: "Laptop",
    price: 1200
  },
  {
    id: 2,
    name: "Keyboard",
    price: 80
  },
  {
    id: 3,
    name: "Mouse",
    price: 40
  }
];

const orders = [];

app.get("/", (req, res) => {
  res.json({
    message: "Shop API is running"
  });
});

app.get("/products", (req, res) => {
  res.json(products);
});

app.post("/orders", (req, res) => {
  const { productId, quantity } = req.body;

  if (!productId || !quantity || quantity <= 0) {
    return res.status(400).json({
      error: "productId and a positive quantity are required"
    });
  }

  const product = products.find((item) => item.id === productId);

  if (!product) {
    return res.status(404).json({
      error: "Product not found"
    });
  }

  const total = product.price * quantity;

  const order = {
    id: orders.length + 1,
    productId,
    quantity,
    total
  };

  orders.push(order);

  res.status(201).json(order);
});

app.get("/orders", (req, res) => {
  res.json(orders);
});

app.listen(PORT, () => {
  console.log(`Shop API running on http://localhost:${PORT}`);
});