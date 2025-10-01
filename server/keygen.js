const { createAuthorizationHeader } = require("ondc-crypto-sdk-nodejs");

// This is where you would load your private key
// For example: const privateKey = fs.readFileSync('path/to/private-key.pem', 'utf8');
const privateKey = "T9e7d6aNJD1D90Y9qETlJGg0xLr0IuTKuMv6yg51CrwSxGy4nVCuYiZNz9nPVJOxUparuh3rKvj9mlyVzFRvrg=="; // Replace with your actual private key

async function generateAuthHeader() {
  try {
    // Create a proper request body
    const requestBody = {
      context: {
        domain: "ONDC:RET11",
        country: "IND",
        city: "*",
        action: "on_search",
        core_version: "1.2.5",
        transaction_id: "750e48ad-9c93-4908-9505-76d06253a09d",   
     message_id: "e4ab5067-84fa-4d43-a133-d4e9fdb62a1c",
        timestamp: new Date().toISOString()
      },
      message: {
        intent: {
          item: {
            descriptor: {
              name: "Sample Product"
            }
          }
        }
      }
    };

    const header = await createAuthorizationHeader({
      body: requestBody,
      privateKey: privateKey,
      subscriberId: "staging.99digicom.com", // Subscriber ID that you get after registering to ONDC Network
      subscriberUniqueKeyId: "99digicom-req-20250904-001", // Unique Key Id or uKid that you get after registering to ONDC Network
    });
    
    console.log("Generated Authorization Header:", header);
    return header;
  } catch (error) {
    console.error("Error generating authorization header:", error);
    throw error;
  }
}

// Execute the function
generateAuthHeader();