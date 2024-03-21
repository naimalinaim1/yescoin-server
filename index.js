import express from "express";
import cors from "cors";
import { ObjectId, MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Bot game server is running!");
});

// generate random string
const generateRandomString = (length) => {
  var characters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  var result = "";
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// mongodb client config
const uri = process.env.URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// mongodb main function
async function run() {
  try {
    client.connect();

    const myDB = client.db("botgame");
    const usersColl = myDB.collection("users");

    // get all users
    app.get("/users", async (req, res) => {
      try {
        const users = await usersColl.find().toArray();
        res.send(users || []);
      } catch (error) {
        console.error("Error fetching top ranking users:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // get a user
    app.get("/users/:userId", async (req, res) => {
      try {
        const userId = req.params.userId;
        const findUser = await usersColl.findOne({ userId });
        res.send(findUser || {});
      } catch (error) {
        console.error("Error fetching top ranking users:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // get ranking 20 user list
    app.get("/ranking", async (req, res) => {
      try {
        const topRankUsers = await usersColl
          .find()
          .sort({ points: -1 })
          .limit(20)
          .toArray();
        res.send(topRankUsers);
      } catch (error) {
        console.error("Error fetching top ranking users:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // get friends information
    app.get("/friends/:userId", async (req, res) => {
      try {
        const userId = req.params.userId;
        const data = await usersColl
          .aggregate([
            {
              $match: { userId },
            },
            {
              $lookup: {
                from: "users",
                localField: "friendList",
                foreignField: "userId",
                as: "friends",
              },
            },
          ])
          .toArray();
        res.json(data);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.post("/users", async (req, res) => {
      const doc = req.body;
      let userId = generateRandomString(6);
      try {
        // Keep generating new userId until it's unique
        while (true) {
          const findUser = await usersColl.findOne({ userId });

          if (findUser?.userId) {
            userId = generateRandomString(6);
          } else {
            const date = new Date();
            const user = { ...doc, userId, date };
            const result = await usersColl.insertOne(user);
            res.send({ userId, result });
            break;
          }
        }
      } catch (error) {
        console.error("Error fetching top ranking users:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // update user
    app.patch("/users/:userId", async (req, res) => {
      const userId = req.params.userId;
      const updates = req.body;
      const newPoints = req.body.points;

      const { points, ...safeUpdates } = updates;
      if (typeof points !== "number") {
        return res.status(500).send({ error: "Points is not number" });
      }

      try {
        const filter = { userId };

        const updateDoc = {
          ...(Object.keys(safeUpdates).length > 0 && {
            $set: safeUpdates,
          }),
          $inc: { points: newPoints }, // Increment points by 1
        };

        const result = await usersColl.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: "User not found" });
        }

        res.send(result);
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
