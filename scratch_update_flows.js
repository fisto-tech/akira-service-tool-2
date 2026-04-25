const path = require('path');
const mongoosePath = path.join(__dirname, 'backend', 'node_modules', 'mongoose');
const mongoose = require(mongoosePath);
const dotenvPath = path.join(__dirname, 'backend', 'node_modules', 'dotenv');
const dotenv = require(dotenvPath);

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const EscalationFlow = mongoose.model('EscalationFlow', new mongoose.Schema({
  type: String,
  steps: [{ dept: String }]
}));

async function updateFlowDepts() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/akira_service_tool';
    console.log('Connecting to Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');
    
    const flows = await EscalationFlow.find({});
    console.log(`Checking ${flows.length} flows`);
    
    for (const flow of flows) {
      let changed = false;
      flow.steps.forEach(step => {
        if (step.dept === 'Support Engineer') {
          step.dept = 'Support Engineers';
          changed = true;
        }
        if (step.dept === 'Service Engineer') {
          step.dept = 'Service Engineers';
          changed = true;
        }
      });
      if (changed) {
        await flow.save();
        console.log(`Updated flow: ${flow.type}`);
      }
    }
    
    await mongoose.disconnect();
    console.log('Disconnected');
  } catch (err) {
    console.error('Error:', err);
  }
}

updateFlowDepts();
