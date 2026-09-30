import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('Missing MONGODB_URI');
}

await mongoose.connect(uri);
const users = mongoose.connection.collection('users');

await users.updateMany({ googleId: null }, { $unset: { googleId: '' } });

try {
  await users.dropIndex('googleId_1');
  console.log('Dropped legacy googleId index');
} catch (error) {
  console.log('No legacy googleId index to drop:', error.message);
}

await users.createIndex({ googleId: 1 }, { unique: true, sparse: true });
console.log('Created sparse unique googleId index');

await mongoose.disconnect();
