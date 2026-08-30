const request = require("supertest");
const app = require("../index");

describe("Order API", () => {
  test("creates an order with the correct total", async () => {
    const response = await request(app)
      .post("/orders")
      .send({
        productId: 1,
        quantity: 2
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.total).toBe(2400);
  });
  test("applies a 10% discount for 3 or more items", async () => {
  const response = await request(app)
    .post("/orders")
    .send({
      productId: 1,
      quantity: 3
    });

  expect(response.statusCode).toBe(201);
  expect(response.body.total).toBe(3240);
});
});