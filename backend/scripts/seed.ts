import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connectDatabase, env } from "../src/config/runtime";
import { Activity, Manager, Queue, Token } from "../src/models";

const sampleQueues = [
  { name: "Central Service", description: "General walk-in assistance" },
  { name: "Appointments", description: "Scheduled customer support" },
  { name: "Returns", description: "Returns and exchanges" },
];
const samplePeople = ["Alex Morgan", "Sam Rivera", "Jordan Lee", "Taylor Patel", "Casey Nguyen"];

async function seed() {
  if (env.NODE_ENV === "production") throw new Error("Refusing to seed production");
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 10 || password.length > 72)
    throw new Error("Set DEMO_PASSWORD (10–72 characters) explicitly before seeding");
  await connectDatabase();
  const email = (process.env.DEMO_EMAIL || "demo@queueflow.local").trim().toLowerCase();
  let manager = await Manager.findOne({ email });
  if (!manager)
    manager = await Manager.create({
      name: "QueueFlow Demo Manager",
      email,
      passwordHash: await bcrypt.hash(password, 12),
    });

  for (const definition of sampleQueues) {
    let queue = await Queue.findOne({ managerId: manager._id, name: definition.name });
    if (!queue)
      queue = await Queue.create({
        managerId: manager._id,
        ...definition,
        publicId: randomUUID(),
        status: "active",
      });
    if (await Token.exists({ queueId: queue._id })) continue;

    let servingTokenId: mongoose.Types.ObjectId | null = null;
    for (let index = 0; index < samplePeople.length; index++) {
      const createdAt = new Date(Date.now() - (5 - index) * 60 * 60 * 1000);
      const status = index === 0 ? "completed" : index === 1 ? "serving" : "waiting";
      const serviceStartedAt = index < 2 ? new Date(createdAt.getTime() + 8 * 60_000) : undefined;
      const completedAt = index === 0 ? new Date(createdAt.getTime() + 25 * 60_000) : undefined;
      const token = await Token.create({
        queueId: queue._id,
        tokenNumber: index + 1,
        personName: samplePeople[index],
        status,
        position: status === "waiting" ? index - 2 : -1,
        createdAt,
        ...(serviceStartedAt ? { calledAt: serviceStartedAt, serviceStartedAt } : {}),
        ...(completedAt ? { completedAt } : {}),
      });
      if (status === "serving") servingTokenId = token._id;
      await Activity.create({
        managerId: manager._id,
        queueId: queue._id,
        tokenId: token._id,
        action: "token.added",
        description: `Added demo token Q${String(index + 1).padStart(3, "0")}`,
        occurredAt: createdAt,
      });
      if (serviceStartedAt)
        await Activity.create({
          managerId: manager._id,
          queueId: queue._id,
          tokenId: token._id,
          action: "token.called",
          description: `Called demo token Q${String(index + 1).padStart(3, "0")}`,
          occurredAt: serviceStartedAt,
        });
      if (completedAt)
        await Activity.create({
          managerId: manager._id,
          queueId: queue._id,
          tokenId: token._id,
          action: "token.completed",
          description: `Completed demo token Q${String(index + 1).padStart(3, "0")}`,
          occurredAt: completedAt,
        });
    }
    queue.tokenCounter = samplePeople.length;
    queue.servingTokenId = servingTokenId;
    await queue.save();
  }
  console.log(
    `Demo queues are ready for ${email}. Sign-in password is the value of DEMO_PASSWORD supplied for this command.`,
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
