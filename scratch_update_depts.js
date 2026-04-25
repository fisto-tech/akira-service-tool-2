const path = require('path');
const mongoosePath = path.join(__dirname, 'backend', 'node_modules', 'mongoose');
const mongoose = require(mongoosePath);
const dotenvPath = path.join(__dirname, 'backend', 'node_modules', 'dotenv');
const dotenv = require(dotenvPath);

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const UserSchema = new mongoose.Schema({
  name: String,
  department: String,
  role: String
});
const User = mongoose.model('User', UserSchema);

async function updateDepts() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/akira_service_tool';
    console.log('Connecting to Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');
    
    // Update Support Engineer -> Support Engineers
    const res1 = await User.updateMany(
      { department: 'Support Engineer' },
      { $set: { department: 'Support Engineers' } }
    );
    console.log(`Updated Support Engineers: ${res1.modifiedCount}`);

    // Update Service Engineer -> Service Engineers
    const res2 = await User.updateMany(
      { department: 'Service Engineer' },
      { $set: { department: 'Service Engineers' } }
    );
    console.log(`Updated Service Engineers: ${res2.modifiedCount}`);
    
    await mongoose.disconnect();
    console.log('Disconnected');
  } catch (err) {
    console.error('Error:', err);
  }
}

updateDepts();
