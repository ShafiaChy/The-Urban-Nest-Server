const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const bookingandinvoice = require("./bookingandinvoice.js");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

const uri =
  "mongodb+srv://urbannest:LgxZkLjbQdzvEiu9@cluster0.ebhzh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "forbidden access",
    });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}
async function run() {
  try {
    const database = client.db("urban-nest");
    const paymentsCollection = database.collection("payment");
    const usersCollection = database.collection("users");
    const itemsCollection = database.collection("items");
    const cartsCollection = database.collection("carts");
    const bookingsCollection = database.collection("bookings");
    const reviewsCollection = database.collection("reviews");
    const couponsCollection = database.collection("coupons");

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;

      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      console.log(user)
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "3h",
        });
        return res.status(200).json({
          success: true,
          accessToken: token,
        });
      }
      res.status(403).json({
        success: false,
        message: "Forbidden User",
      });
    });

    //GET USERS API
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });
    //POST USERS API
    app.post("/users", async (req, res) => {
      const user = req.body;

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.delete("/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;

      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" });
    });

    app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //GET ITEMS
    app.get("/items", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const category = req.query.category;
      const query = { category: category };

      if (size && category) {
        const cursor = itemsCollection.find(query);
        const products = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();

        const count = await itemsCollection.countDocuments(query);
        res.send({ count, products });
      } else {
        const cursor = itemsCollection.find({});
        const products = await cursor.toArray();
        res.send(products);
      }
    });

    //UPDATE ITEM
    app.patch("/items/:id", async (req, res) => {
      const id = req.params.id;

      const items = req.body;

      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          ...(items.name && { name: items.name }),
          ...(items.recipe && { recipe: items.recipe }),
          ...(items.image && { image: items.image }),
          ...(items.price && { price: items.price }),
          ...(items.category && { category: items.category }),
        },
      };
      const result = await itemsCollection.updateOne(query, updatedDoc);
      res.send(result);
    });
    //DELETE ITEMS
    app.delete("/items/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const result = await itemsCollection.deleteOne(filter);
      res.send(result);
    });
    // POST ITEMS API
    app.post("/addItems", async (req, res) => {
      const product = req.body;
      const result = await itemsCollection.insertOne(product);
      res.json(result);
    });

    //GET A USER'S CART
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const cartQuery = { email: email };
      const cart = await cartsCollection.find(cartQuery).toArray();

      res.send(cart);
    });
    //GET Bookings
    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (email) {
        const bookingQuery = { email: email };
        const booking = await bookingsCollection.find(bookingQuery).toArray();
        res.send(booking);
      } else {
        const booking = await bookingsCollection.find({}).toArray();

        res.send(booking);
      }
    });

    app.patch("/bookings/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await bookingsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );

      return res.status(200).json({
        success: true,
        result: result,
      });
    });

    //POST A USER'S CART
    app.post("/carts", async (req, res) => {
      const carts = req.body;

      // TODO: make sure you do not enter duplicate user email
      // only insert users if the user doesn't exist in the database
      const result = await cartsCollection.insertOne(carts);

      res.send(result);
    });

    //POST A USER'S CART
    app.post("/bookings", async (req, res) => {
      const bookings = req.body;

      // TODO: make sure you do not enter duplicate user email
      // only insert users if the user doesn't exist in the database
      const result = await bookingsCollection.insertOne(bookings);
      bookingandinvoice.sendBookingEmail(bookings);

      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const order = req.body.order;

      const price = order.total;
      const amount = parseInt((price * 100).toFixed(0));

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.delete("/carts", async (req, res) => {
      const email = req.query.email;
      const id = req.query.id;
      const deleteOption = req.query.delete;

      if (deleteOption == "true") {
        const result = await cartsCollection.deleteMany({ email: email });
        return res.send(result);
      } else {
        const result = await cartsCollection.deleteOne({
          email: email,
          _id: new ObjectId(id),
        });
        return res.send(result);
      }
    });

    app.delete("/bookings/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await bookingsCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/payments", async (req, res) => {
      const email = req.query.email;
      const paymentQuery = { email: email };
      const payment = await paymentsCollection.find(paymentQuery).toArray();

      res.send(payment);
    });

    // all payment
    app.get("/allPayments", async (req, res) => {
      const payment = await paymentsCollection.find({}).toArray();
      res.send(payment);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;

      const result = await paymentsCollection.insertOne(payment);
      bookingandinvoice.sendPaymentEmail(payment);
      res.send(result);
    });

    //POST REVIEWS

    app.post("/reviews", async (req, res) => {
      const reviews = req.body;

      // TODO: make sure you do not enter duplicate user email
      // only insert users if the user doesn't exist in the database
      const result = await reviewsCollection.insertOne(reviews);
      res.send(result);
    });

    app.get("/reviews", async (req, res) => {
      const query = {};
      const reviews = await reviewsCollection.find(query).toArray();
      res.send(reviews);
    });

    app.get("/review", async (req, res) => {
      const email = req.query.email;

      const reviews = await reviewsCollection.find({ email: email }).toArray();
      res.send(reviews);
    });

    app.get("/coupons", async (req, res) => {
      const coupon_code = req.query.coupon_code;

      const query = { coupon_code: coupon_code };
      const coupon = await couponsCollection.find(query).toArray();

      res.send(coupon);
    });
  } finally {
  }
}

run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("Welcome to UrbanNest");
});

app.listen(port, () => {
  console.log(`UrbanNest server is running on port: ${port}`);
});
