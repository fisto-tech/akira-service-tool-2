const path = require('path');
const mongoosePath = path.join(__dirname, 'backend', 'node_modules', 'mongoose');
const mongoose = require(mongoosePath);
const dotenvPath = path.join(__dirname, 'backend', 'node_modules', 'dotenv');
const dotenv = require(dotenvPath);

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const EscalationFlow = mongoose.model('EscalationFlow', new mongoose.Schema({
  type: String,
  steps: Array
}));

async function dumpFlows() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/akira_service_tool';
    await mongoose.connect(mongoUri);
    const flows = await EscalationFlow.find({});
    console.log('Flows in DB:', JSON.stringify(flows, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

dumpFlows();
