const express = require('express');
const bodyParser = require('body-parser');
// Assuming modern Node.js environment where global 'fetch' is available.
// If not, you will need to 'npm install node-fetch' and 'const fetch = require('node-fetch');'

// --- Configuration (Load from .env in real app, hardcoded here for file generation) ---
const BPP_DOMAIN = process.env.BPP_DOMAIN || "staging.99digicom.com";
const BPP_ID = BPP_DOMAIN;
const BPP_URI = process.env.BPP_URI || `https://${BPP_DOMAIN}/ondc`;
const PORT = process.env.PORT || 3000;

// You would load your private signing key and BAP public keys here
// const PRIVATE_KEY = process.env.PRIVATE_KEY; 

const app = express();
// Increase limit for potentially large ONDC payloads
app.use(bodyParser.json({ limit: '5mb' }));

// --- Mock Product Data ---
const MOCK_PRODUCTS = [
    {
        "id": "SKU-99DC-001",
        "name": "Organic Black Tea Leaves (100g)",
        "price": 249.00,
        "category_id": "Grocery",
        "description": "Finest Assam blend, certified organic.",
        "image_url": "https://placehold.co/600x400/3A201A/FFFFFF?text=Tea+Leaves",
        "provider_id": "P-99DC-01"
    },
    {
        "id": "SKU-99DC-002",
        "name": "Artisanal Sourdough Bread",
        "price": 120.00,
        "category_id": "Bakery",
        "description": "Naturally fermented bread, 500g.",
        "image_url": "https://placehold.co/600x400/F0E68C/000000?text=Sourdough",
        "provider_id": "P-99DC-01"
    }
];

// --- 1. Signature Verification Placeholder (CRITICAL) ---
/**
 * WARNING: In a production BPP, this function MUST implement the ONDC
 * cryptographic signature verification logic using the BAP's public key
 * and the 'X-Signature' header.
 * @param {object} req The Express request object.
 * @returns {boolean} True if the signature is valid, False otherwise.
 */
function verifyRequest(req) {
    // --------------------------------------------------------------------------
    // TODO: Implement actual ONDC signature verification here!
    // If the signature fails, return HTTP 401 Unauthorized.
    // --------------------------------------------------------------------------
    console.log("SECURITY: Skipping ONDC signature verification in simulator mode. MUST IMPLEMENT for production.");
    return true; // SIMULATING SUCCESS
}

// --- 2. Asynchronous /on_search Sender ---

/**
 * Constructs and posts the /on_search response back to the BAP's URI.
 * In a real application, this should be done in a non-blocking background process.
 * * @param {object} onSearchPayload The payload to send.
 * @param {string} bapUri The base URI of the Buyer App.
 */
async function sendOnSearchToBAP(onSearchPayload, bapUri) {
    const callbackUrl = `${bapUri}/on_search`;
    
    // --------------------------------------------------------------------------
    // TODO: The on_search payload MUST be signed by the BPP's private key
    // before transmission in a live environment.
    // --------------------------------------------------------------------------
    
    try {
        console.log(`\nASYNC: Attempting to POST /on_search to BAP: ${callbackUrl}`);
        
        const response = await fetch(callbackUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': 'Signature ...' <- Must be added after signing
            },
            body: JSON.stringify(onSearchPayload),
            timeout: 5000 // Timeout for the callback (adjust as needed)
        });

        if (response.status === 200 || response.status === 202) {
            console.log(`ASYNC: Successfully posted /on_search. Status: ${response.status}`);
        } else {
            const errorText = await response.text();
            console.error(`ASYNC: Failed to post /on_search. Status: ${response.status}. Response: ${errorText}`);
        }
    } catch (error) {
        console.error(`ASYNC: Network error while posting /on_search: ${error.message}`);
    }
}


// --- 3. /on_search Payload Generator ---

function generateOnSearchPayload(context) {
    const onSearchContext = { 
        ...context,
        action: 'on_search',
        bpp_id: BPP_ID,
        bpp_uri: BPP_URI,
        timestamp: new Date().toISOString() // New timestamp for response
    };

    const catalogue = {
        "descriptor": { "name": "99DigiCom Staging Catalogue" },
        "providers": [
            {
                "id": "P-99DC-01",
                "descriptor": { "name": "99DigiCom Fulfillment Partner" },
                "locations": [
                    { "id": "L-99DC-01", "address": { "city": onSearchContext.city, "country": onSearchContext.country } }
                ],
                "fulfillments": [
                    { "id": "F-99DC-01", "type": "Delivery" } // Define default fulfillment
                ],
                "items": MOCK_PRODUCTS.map(product => ({
                    "id": product.id,
                    "descriptor": {
                        "name": product.name,
                        "short_desc": product.description,
                        "images": [product.image_url]
                    },
                    "price": {
                        "currency": "INR",
                        "value": String(product.price)
                    },
                    "category_id": product.category_id,
                    "location_id": "L-99DC-01", 
                    "fulfillment_id": "F-99DC-01" 
                }))
            }
        ]
    };

    return {
        "context": onSearchContext,
        "message": { "catalogue": catalogue }
    };
}


// --- 4. Main /search Endpoint ---

app.post("/search", async (req, res) => {
    const searchRequest = req.body;
    const context = searchRequest.context;
    
    // Step A: Security Check
    if (!verifyRequest(req)) {
        console.error(`Request failed signature verification: ${context?.transaction_id}`);
        return res.status(401).json({
            "message": { "ack": { "status": "NACK" } },
            "error": { "code": "401", "message": "Signature verification failed." }
        });
    }

    if (!context) {
        return res.status(400).json({
            "message": { "ack": { "status": "NACK" } },
            "error": { "code": "001", "message": "Missing context object." }
        });
    }

    try {
        console.log(`\n--- RECEIVED /search [${context.transaction_id}] ---`);
        console.log(`BAP URI: ${context.bap_uri}`);

        // Step B: Send Immediate ACK (HTTP 202 Accepted)
        const ackResponse = {
            "context": {
                ...context,
                bpp_id: BPP_ID,
                bpp_uri: BPP_URI,
                timestamp: new Date().toISOString()
            },
            "message": { "ack": { "status": "ACK" } }
        };
        res.status(202).json(ackResponse);

        // Step C: Process the request and send asynchronous /on_search
        const onSearchPayload = generateOnSearchPayload(context);
        
        // This is where you call the asynchronous function to post the result back.
        await sendOnSearchToBAP(onSearchPayload, context.bap_uri);

    } catch (e) {
        console.error(`ERROR: Critical error handling /search [${context.transaction_id}]: ${e.message}`);
        
        // NOTE: Since the ACK 202 has already been sent, subsequent errors
        // during async processing should be handled internally (e.g., logging
        // and optionally sending an error via the /on_error action if ACK fails).
    }
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log("\n=========================================================");
    console.log(`ONDC BPP Server for: ${BPP_DOMAIN}`);
    console.log(`Listening on port ${PORT}`);
    console.log("STATUS: Ready to receive /search requests.");
    console.log("=========================================================\n");
});