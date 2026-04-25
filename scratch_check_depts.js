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

async function checkDepts() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/akira_service_tool';
    console.log('Connecting to Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');
    
    const users = await User.find({});
    console.log(`Total users: ${users.length}`);
    
    const deptStats = {};
    users.forEach(u => {
      const d = u.department || 'No Department';
      deptStats[d] = (deptStats[d] || 0) + 1;
    });
    
    console.log('Department Stats:');
    console.log(JSON.stringify(deptStats, null, 2));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkDepts();
