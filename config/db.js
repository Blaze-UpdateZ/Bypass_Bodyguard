const mongoose = require('mongoose');

const connectDB = async (retries = 5) => {
    if (mongoose.connection.readyState === 1) return;

    const MONGO_URI = process.env.MONGO_URI;

    if (!MONGO_URI) {
        console.warn("⚠️ MONGO_URI is not defined in environment variables. Database connection may fail.");
    }

    const options = {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        w: 'majority'
    };

    while (retries > 0) {
        try {
            await mongoose.connect(MONGO_URI, options);
            return;
        } catch (err) {
            retries -= 1;
            if (retries === 0) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};

module.exports = connectDB;
