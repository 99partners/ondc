// Ensure you have installed the package: npm install uuid

const { v4: uuidv4 } = require('uuid');

/**
 * Function to generate a Transaction and Message ID using UUID v4.
 */
function generateIds() {
    const transactionId = uuidv4();
    const messageId = uuidv4();

    console.log("\n--- CommonJS Format (require) ---");
    console.log(`Transaction ID: ${transactionId}`);
    console.log(`Message ID: ${messageId}`);
}

generateIds();