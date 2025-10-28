const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        mongoose.set('strictQuery', true);
        
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useUnifiedTopology: true, 
            useNewUrlParser: true, 
            maxPoolSize: 50,   
            waitQueueTimeoutMS: 5000, 
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;