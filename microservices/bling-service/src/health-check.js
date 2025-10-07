const axios = require('axios');

async function healthCheck() {
  try {
    const response = await axios.get('http://localhost:3003/health', {
      timeout: 5000
    });
    
    if (response.status === 200) {
      console.log('✅ Health check passed');
      process.exit(0);
    } else {
      console.log('❌ Health check failed');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

healthCheck();