# express-delivery-management-system-314154-314166

## Database (MongoDB) schema + seed

This repository includes a MongoDB container under `database/` with:

- `startup.sh` (starts MongoDB on the existing port/bindings and creates users)
- `db_connection.txt` (authoritative connection command; used by seed/init steps)

### Collections

The delivery system uses these collections:

- `users`
- `deliveries`
- `tracking_events`
- `notifications`

### Indexes

Created by the init script:

- `users`: unique index on `email`
- `deliveries`: indexes on `customerId`, `courierId`, `status`, `createdAt`
- `tracking_events`: compound index on `{ deliveryId, createdAt }`
- `notifications`: compound index on `{ userId, read }`

### Run schema init + seed (recommended)

From the database container folder:

```bash
cd database
# Start MongoDB if needed (keeps existing port bindings; do not change)
./startup.sh

# Run idempotent init + seed script
mongosh "$(cat db_connection.txt)" scripts/init_collections_and_seed.mongosh.js
```

This will insert:

- 1 customer user (`customer@example.com`)
- 1 courier user (`courier@example.com`)
- 1 sample delivery linked to the customer
- 2 tracking events for that delivery
- 1 notification for the customer

### Manual one-by-one CLI commands (optional)

If you prefer running single statements, use the connection string in `db_connection.txt`:

```bash
cd database
mongosh "$(cat db_connection.txt)" --eval "db.users.createIndex({email:1},{unique:true,name:'users_email_unique'})"
mongosh "$(cat db_connection.txt)" --eval "db.deliveries.createIndex({customerId:1},{name:'deliveries_customerId'})"
mongosh "$(cat db_connection.txt)" --eval "db.deliveries.createIndex({courierId:1},{name:'deliveries_courierId'})"
mongosh "$(cat db_connection.txt)" --eval "db.deliveries.createIndex({status:1},{name:'deliveries_status'})"
mongosh "$(cat db_connection.txt)" --eval "db.deliveries.createIndex({createdAt:-1},{name:'deliveries_createdAt_desc'})"
mongosh "$(cat db_connection.txt)" --eval "db.tracking_events.createIndex({deliveryId:1,createdAt:-1},{name:'tracking_deliveryId_createdAt_desc'})"
mongosh "$(cat db_connection.txt)" --eval "db.notifications.createIndex({userId:1,read:1},{name:'notifications_userId_read'})"
```

Task scope note: this step only modifies the database container assets/scripts and documentation.