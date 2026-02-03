/**
 * MongoDB schema init + lightweight seed for the express delivery system.
 *
 * Usage (from database/ folder):
 *   mongosh "$(cat db_connection.txt)" scripts/init_collections_and_seed.mongosh.js
 *
 * Notes:
 * - Idempotent: safe to run multiple times.
 * - Creates collections (if missing) and indexes.
 * - Seeds: 1 customer, 1 courier, 1 delivery linked to customer, 2 tracking events, 1 notification.
 */

/* global db, ObjectId, ISODate */

(function main() {
  const now = new Date();

  const collections = {
    users: "users",
    deliveries: "deliveries",
    tracking_events: "tracking_events",
    notifications: "notifications",
  };

  function ensureCollection(name) {
    const exists = db.getCollectionInfos({ name }).length > 0;
    if (!exists) {
      db.createCollection(name);
      print(`✓ Created collection: ${name}`);
    } else {
      print(`- Collection exists: ${name}`);
    }
    return db.getCollection(name);
  }

  const users = ensureCollection(collections.users);
  const deliveries = ensureCollection(collections.deliveries);
  const trackingEvents = ensureCollection(collections.tracking_events);
  const notifications = ensureCollection(collections.notifications);

  // -----------------------------
  // Indexes
  // -----------------------------
  // Users: unique email
  users.createIndex({ email: 1 }, { unique: true, name: "users_email_unique" });

  // Deliveries: indexes on customerId, courierId, status, createdAt
  deliveries.createIndex({ customerId: 1 }, { name: "deliveries_customerId" });
  deliveries.createIndex({ courierId: 1 }, { name: "deliveries_courierId" });
  deliveries.createIndex({ status: 1 }, { name: "deliveries_status" });
  deliveries.createIndex({ createdAt: -1 }, { name: "deliveries_createdAt_desc" });

  // Tracking events: compound index on deliveryId + createdAt
  trackingEvents.createIndex(
    { deliveryId: 1, createdAt: -1 },
    { name: "tracking_deliveryId_createdAt_desc" }
  );

  // Notifications: index on userId + read
  notifications.createIndex({ userId: 1, read: 1 }, { name: "notifications_userId_read" });

  print("✓ Indexes ensured.");

  // -----------------------------
  // Seed data
  // -----------------------------
  // We use stable emails to make seeding repeatable without duplicates.
  const customerEmail = "customer@example.com";
  const courierEmail = "courier@example.com";

  const customerUpsert = users.findOneAndUpdate(
    { email: customerEmail },
    {
      $setOnInsert: {
        email: customerEmail,
        // Placeholder hash; backend will manage real hashing.
        password_hash: "$2b$10$seed.placeholder.hash.for.customer",
        role: "customer",
        name: "Seed Customer",
        phone: "+15550000001",
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  const courierUpsert = users.findOneAndUpdate(
    { email: courierEmail },
    {
      $setOnInsert: {
        email: courierEmail,
        password_hash: "$2b$10$seed.placeholder.hash.for.courier",
        role: "courier",
        name: "Seed Courier",
        phone: "+15550000002",
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  const customerId = customerUpsert?._id || users.findOne({ email: customerEmail })._id;
  const courierId = courierUpsert?._id || users.findOne({ email: courierEmail })._id;

  print(`✓ Customer _id: ${customerId}`);
  print(`✓ Courier _id: ${courierId}`);

  // Create a sample delivery linked to customer (courierId nullable initially).
  // If it already exists (by deterministic marker), we reuse it.
  const deliveryMarker = "seed_delivery_1";

  const deliveryUpsert = deliveries.findOneAndUpdate(
    { seedMarker: deliveryMarker },
    {
      $setOnInsert: {
        seedMarker: deliveryMarker,
        customerId,
        courierId: null,
        pickupAddress: {
          line1: "123 Pickup St",
          city: "San Francisco",
          state: "CA",
          postalCode: "94103",
          country: "US",
        },
        dropoffAddress: {
          line1: "987 Dropoff Ave",
          city: "San Francisco",
          state: "CA",
          postalCode: "94107",
          country: "US",
        },
        packageDetails: {
          description: "Small box",
          weightKg: 1.2,
          fragile: false,
        },
        price: 19.99,
        status: "requested",
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  const delivery = deliveryUpsert || deliveries.findOne({ seedMarker: deliveryMarker });
  const deliveryId = delivery._id;

  print(`✓ Delivery _id: ${deliveryId}`);

  // Optionally add a couple tracking events (idempotent by marker + createdAt bucket)
  const event1 = {
    deliveryId,
    location: { lat: 37.7749, lng: -122.4194 },
    heading: 90,
    speed: 0,
    createdAt: new Date(now.getTime() - 2 * 60 * 1000),
    seedMarker: "seed_tracking_1",
  };

  const event2 = {
    deliveryId,
    location: { lat: 37.7765, lng: -122.4172 },
    heading: 95,
    speed: 4.2,
    createdAt: new Date(now.getTime() - 1 * 60 * 1000),
    seedMarker: "seed_tracking_2",
  };

  trackingEvents.updateOne(
    { seedMarker: event1.seedMarker },
    { $setOnInsert: event1 },
    { upsert: true }
  );
  trackingEvents.updateOne(
    { seedMarker: event2.seedMarker },
    { $setOnInsert: event2 },
    { upsert: true }
  );

  print("✓ Tracking events ensured.");

  // One notification for the customer
  notifications.updateOne(
    { seedMarker: "seed_notification_1" },
    {
      $setOnInsert: {
        seedMarker: "seed_notification_1",
        userId: customerId,
        type: "delivery_requested",
        title: "Delivery requested",
        message: "Your delivery request has been created.",
        read: false,
        createdAt: now,
      },
    },
    { upsert: true }
  );

  print("✓ Notification ensured.");
  print("✅ Schema initialization + seed complete.");
})();
