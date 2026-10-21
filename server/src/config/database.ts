import mongoose from 'mongoose';

/** Establishes and manages the MongoDB connection via Mongoose. */
const MONGOOSE_OPTIONS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

/** Connect to MongoDB using the MONGO_URI environment variable. Throws if MONGO_URI is not set or the connection fails. */
export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI environment variable is not defined');
  }

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err: Error) => {
    console.error('MongoDB connection error:', err.message);
  });

  await mongoose.connect(uri, MONGOOSE_OPTIONS);
}

/** Close the MongoDB connection, allowing operations to complete. */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
